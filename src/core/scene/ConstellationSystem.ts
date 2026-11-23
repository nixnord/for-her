import * as THREE from 'three';
import type { ConstellationItem, FinaleConfiguration } from '../../types/universe.types';
import type { ResolvedStar } from '../../data/universeData';

interface ConstellationMeshEntry {
  id: string;
  item: ConstellationItem;
  mesh: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;
  currentCompletion: number;
  targetCompletion: number;
}

const vertexShader = /* glsl */ `
  attribute vec3 aColor;
  varying vec3 vColor;
  varying vec3 vPos;

  void main() {
    vColor = aColor;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uCompletion; // 0.0 undiscovered -> 1.0 completed
  uniform vec3 uThemeColor;
  varying vec3 vColor;
  varying vec3 vPos;

  void main() {
    // Subtle cosmic pulse traveling along lines
    float pulse = 0.5 + 0.5 * sin(uTime * 1.8 + length(vPos) * 0.05);

    // When undiscovered: delicate ethereal guide line (opacity ~ 0.22)
    // When completed: radiant starlight glow (opacity ~ 0.85) + pulse boost
    float baseOpacity = mix(0.20, 0.75, uCompletion);
    float glow = mix(0.0, pulse * 0.25, uCompletion);
    float alpha = baseOpacity + glow;

    // Color: subtle cool lavender when undiscovered -> rich constellation theme color when unlocked
    vec3 neutralColor = vec3(0.55, 0.62, 0.88);
    vec3 color = mix(neutralColor, uThemeColor, uCompletion);

    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

export class ConstellationSystem {
  readonly group = new THREE.Group();
  private readonly entries: ConstellationMeshEntry[] = [];
  private finaleMesh: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  private finaleCompletion = 0;
  private targetFinaleCompletion = 0;

  constructor(
    constellations: ConstellationItem[],
    resolvedStars: ResolvedStar[],
    finale?: FinaleConfiguration,
  ) {
    const starMap = new Map<string, THREE.Vector3>();
    resolvedStars.forEach((s) => starMap.set(s.item.id, s.position));

    // 1. Build line segments for regular memory constellations
    constellations.forEach((c) => {
      const positions: number[] = [];
      c.connections.forEach((conn) => {
        const from = starMap.get(conn.fromStarId);
        const to = starMap.get(conn.toStarId);
        if (from && to) {
          positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
        }
      });

      if (positions.length === 0) return;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

      const themeColor = new THREE.Color(c.themeColorHex);
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        premultipliedAlpha: true,
        uniforms: {
          uTime: { value: 0 },
          uCompletion: { value: 0 },
          uThemeColor: { value: themeColor },
        },
      });

      const mesh = new THREE.LineSegments(geometry, material);
      mesh.renderOrder = 2; // above sky/nebulae, beneath star points
      mesh.frustumCulled = false;
      this.group.add(mesh);

      this.entries.push({
        id: c.id,
        item: c,
        mesh,
        currentCompletion: 0,
        targetCompletion: 0,
      });
    });

    // 2. Build line segments for Finale Constellation (Heart / Birthday Asterism)
    if (finale && finale.constellationEdges.length > 0) {
      const finalePositions: number[] = [];
      finale.constellationEdges.forEach((conn) => {
        const from = starMap.get(conn.fromStarId);
        const to = starMap.get(conn.toStarId);
        if (from && to) {
          finalePositions.push(from.x, from.y, from.z, to.x, to.y, to.z);
        }
      });

      if (finalePositions.length > 0) {
        const finaleGeometry = new THREE.BufferGeometry();
        finaleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(finalePositions, 3));

        const finaleMaterial = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          premultipliedAlpha: true,
          uniforms: {
            uTime: { value: 0 },
            uCompletion: { value: 0 },
            uThemeColor: { value: new THREE.Color('#ff8fa3') },
          },
        });

        this.finaleMesh = new THREE.LineSegments(finaleGeometry, finaleMaterial);
        this.finaleMesh.renderOrder = 3;
        this.finaleMesh.frustumCulled = false;
        this.finaleMesh.visible = false; // stays hidden until Stage 5 finale sequence
        this.group.add(this.finaleMesh);
      }
    }
  }

  setConstellationCompleted(constellationId: string, completed: boolean, immediate = false): void {
    const entry = this.entries.find((e) => e.id === constellationId);
    if (!entry) return;
    entry.targetCompletion = completed ? 1 : 0;
    if (immediate) {
      entry.currentCompletion = entry.targetCompletion;
      entry.mesh.material.uniforms.uCompletion.value = entry.currentCompletion;
    }
  }

  setFinaleActive(active: boolean): void {
    if (!this.finaleMesh) return;
    this.finaleMesh.visible = active;
    this.targetFinaleCompletion = active ? 1 : 0;
  }

  update(time: number, dt: number): void {
    const lambda = 4.0;
    const factor = 1.0 - Math.exp(-lambda * dt);

    for (const entry of this.entries) {
      entry.mesh.material.uniforms.uTime.value = time;
      if (Math.abs(entry.targetCompletion - entry.currentCompletion) > 0.001) {
        entry.currentCompletion += (entry.targetCompletion - entry.currentCompletion) * factor;
        entry.mesh.material.uniforms.uCompletion.value = entry.currentCompletion;
      }
    }

    if (this.finaleMesh && this.finaleMesh.visible) {
      this.finaleMesh.material.uniforms.uTime.value = time;
      if (Math.abs(this.targetFinaleCompletion - this.finaleCompletion) > 0.001) {
        this.finaleCompletion += (this.targetFinaleCompletion - this.finaleCompletion) * factor;
        this.finaleMesh.material.uniforms.uCompletion.value = this.finaleCompletion;
      }
    }
  }

  dispose(): void {
    for (const entry of this.entries) {
      entry.mesh.geometry.dispose();
      entry.mesh.material.dispose();
    }
    if (this.finaleMesh) {
      this.finaleMesh.geometry.dispose();
      this.finaleMesh.material.dispose();
    }
  }
}
