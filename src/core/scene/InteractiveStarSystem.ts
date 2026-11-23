import * as THREE from 'three';
import type { ResolvedStar } from '../../data/universeData';

/** World-space edge length of a star billboard quad (Task 2 & Report §6.1). */
const BASE_QUAD_SIZE = 22.0;
const HOVER_LAMBDA = 10.0;
const REVEAL_LAMBDA = 2.5;

const vertexShader = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aCoreColor;
  attribute vec3 aHaloColor;
  attribute float aSize;
  attribute float aPhase;
  attribute float aDiscovered;
  attribute float aHover;
  attribute float aVisible;

  varying vec2 vUv;
  varying vec3 vCoreColor;
  varying vec3 vHaloColor;
  varying float vPhase;
  varying float vDiscovered;
  varying float vHover;
  varying float vVisible;

  uniform float uTime;

  void main() {
    vUv = uv;
    vCoreColor = aCoreColor;
    vHaloColor = aHaloColor;
    vPhase = aPhase;
    vDiscovered = aDiscovered;
    vHover = aHover;
    vVisible = aVisible;

    // Organic breathing pulse: delicate 18% shimmer on personal stars (Bugfixes §2.1)
    float breath = 1.0 + 0.18 * sin(uTime * 2.2 + aPhase);

    // Camera-facing billboard quad
    vec4 mvCenter = modelViewMatrix * vec4(aCenter, 1.0);
    float scale = aSize * breath * (1.0 + aHover * 0.3) * aVisible;
    vec4 mvPosition = mvCenter + vec4(position.xy * scale, 0.0, 0.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vCoreColor;
  varying vec3 vHaloColor;
  varying float vPhase;
  varying float vDiscovered;
  varying float vHover;
  varying float vVisible;

  void main() {
    if (vVisible < 0.001) discard;
    vec2 p = (vUv - 0.5) * 2.0;
    float dist = length(p);
    if (dist > 1.0) discard;

    // 1. Analytical Inverse-Square Core (white hot nucleus)
    float core = 0.018 / (dist * dist + 0.009);

    // 2. Exponential Soft Halation
    float halo = pow(max(0.0, 1.0 - dist), 3.2) * 0.85;

    // 3. Delicate 4-Point Rotating Diffraction Spikes (Bugfixes §2.2)
    float ang = uTime * 0.04 + vPhase;
    mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    vec2 q = rot * p;
    float spikeH = exp(-abs(q.y) * 26.0) * exp(-abs(q.x) * 2.5);
    float spikeV = exp(-abs(q.x) * 26.0) * exp(-abs(q.y) * 2.5);
    float spikes = (spikeH + spikeV) * 0.45 * (1.0 + vDiscovered * 0.4);

    // Reticle Focus Boost
    float focus = 1.0 + vHover * 0.65;
    float totalIntensity = (core + halo + spikes) * focus * vVisible;

    // Core blends to bright white, outer halo preserves warm golden/spectral tint
    vec3 finalColor = mix(vHaloColor, vCoreColor, clamp(core * 0.7, 0.0, 1.0));
    // Warm celestial tint injection (Bugfixes §2.2)
    finalColor = mix(finalColor, vec3(1.0, 0.88, 0.62), 0.28);

    float edgeAlpha = smoothstep(1.0, 0.72, dist);
    float a = totalIntensity * edgeAlpha;

    // Premultiplied additive output
    gl_FragColor = vec4(finalColor * a, min(a, 1.0));
  }
`;

/**
 * All interactive (memory) stars in a single instanced draw call
 * (Report §2 & Bugfixes Task 2). Renders natural Pogson-scaled, breathing celestial stars.
 */
export class InteractiveStarSystem {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  readonly stars: ResolvedStar[];
  private readonly indexById = new Map<string, number>();

  private readonly hoverTarget: Float32Array;
  private readonly discoveredTarget: Float32Array;
  private readonly visibleTarget: Float32Array;
  private readonly hoverAttr: THREE.InstancedBufferAttribute;
  private readonly discoveredAttr: THREE.InstancedBufferAttribute;
  private readonly visibleAttr: THREE.InstancedBufferAttribute;

  constructor(stars: ResolvedStar[]) {
    this.stars = stars;
    const n = stars.length;

    const centers = new Float32Array(n * 3);
    const cores = new Float32Array(n * 3);
    const halos = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const phases = new Float32Array(n);
    const color = new THREE.Color();

    this.hoverTarget = new Float32Array(n);
    this.discoveredTarget = new Float32Array(n);
    this.visibleTarget = new Float32Array(n);

    stars.forEach((s, i) => {
      this.indexById.set(s.item.id, i);
      centers.set([s.position.x, s.position.y, s.position.z], i * 3);
      color.set(s.item.coreColorHex);
      cores.set([color.r, color.g, color.b], i * 3);
      color.set(s.item.haloColorHex);
      halos.set([color.r, color.g, color.b], i * 3);

      // Natural magnitude scaling (Bugfixes §2.1)
      sizes[i] = BASE_QUAD_SIZE * (s.item.sizeMultiplier || 1);
      phases[i] = Math.random() * Math.PI * 2;
      // Finale stars stay hidden until the cinematic finale reveals them
      this.visibleTarget[i] = s.item.category === 'finale_anchor' ? 0 : 1;
    });

    const geometry = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geometry.index = quad.index;
    geometry.setAttribute('position', quad.getAttribute('position'));
    geometry.setAttribute('uv', quad.getAttribute('uv'));
    geometry.instanceCount = n;

    geometry.setAttribute('aCenter', new THREE.InstancedBufferAttribute(centers, 3));
    geometry.setAttribute('aCoreColor', new THREE.InstancedBufferAttribute(cores, 3));
    geometry.setAttribute('aHaloColor', new THREE.InstancedBufferAttribute(halos, 3));
    geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));

    this.hoverAttr = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    this.discoveredAttr = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    this.visibleAttr = new THREE.InstancedBufferAttribute(Float32Array.from(this.visibleTarget), 1);
    for (const attr of [this.hoverAttr, this.discoveredAttr, this.visibleAttr]) {
      attr.setUsage(THREE.DynamicDrawUsage);
    }
    geometry.setAttribute('aHover', this.hoverAttr);
    geometry.setAttribute('aDiscovered', this.discoveredAttr);
    geometry.setAttribute('aVisible', this.visibleAttr);

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
      uniforms: { uTime: { value: 0 } },
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  indexOf(id: string): number {
    return this.indexById.get(id) ?? -1;
  }

  setHovered(index: number): void {
    this.hoverTarget.fill(0);
    if (index >= 0) this.hoverTarget[index] = 1;
  }

  setDiscovered(id: string, discovered: boolean, immediate = false): void {
    const i = this.indexOf(id);
    if (i < 0) return;
    this.discoveredTarget[i] = discovered ? 1 : 0;
    if (immediate) {
      (this.discoveredAttr.array as Float32Array)[i] = this.discoveredTarget[i];
      this.discoveredAttr.needsUpdate = true;
    }
  }

  setVisible(id: string, visible: boolean): void {
    const i = this.indexOf(id);
    if (i >= 0) this.visibleTarget[i] = visible ? 1 : 0;
  }

  isVisible(index: number): boolean {
    return this.visibleTarget[index] > 0.5;
  }

  private static approach(
    attr: THREE.InstancedBufferAttribute,
    target: Float32Array,
    t: number,
  ): void {
    const arr = attr.array as Float32Array;
    let changed = false;
    for (let i = 0; i < arr.length; i++) {
      const diff = target[i] - arr[i];
      if (diff === 0) continue;
      arr[i] = Math.abs(diff) < 0.001 ? target[i] : arr[i] + diff * t;
      changed = true;
    }
    if (changed) attr.needsUpdate = true;
  }

  update(time: number, dt: number): void {
    this.mesh.material.uniforms.uTime.value = time;
    InteractiveStarSystem.approach(this.hoverAttr, this.hoverTarget, 1 - Math.exp(-HOVER_LAMBDA * dt));
    InteractiveStarSystem.approach(this.discoveredAttr, this.discoveredTarget, 1 - Math.exp(-REVEAL_LAMBDA * dt));
    InteractiveStarSystem.approach(this.visibleAttr, this.visibleTarget, 1 - Math.exp(-REVEAL_LAMBDA * dt));
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
