import * as THREE from 'three';
import type { NebulaRegion } from '../../types/universe.types';
import { raDecToCartesian, sphericalToCartesian } from '../celestialMath';
import { noise2D } from './glslNoise';

const DEFAULT_RADIUS = 340;
const LAYERS_PER_NEBULA = 3;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uTint;
  uniform float uTime;
  uniform float uSeed;
  uniform float uIntensity;
  varying vec2 vUv;

  ${noise2D}

  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    if (r > 1.0) discard;

    // Soft elliptical envelope so the quad edges are never visible.
    float envelope = pow(smoothstep(1.0, 0.0, r), 1.6);

    vec2 drift = vec2(uTime * 0.006, -uTime * 0.004);
    vec2 uv = vUv * 2.6 + uSeed;
    // Domain warping gives wispy, filamentary gas.
    vec2 warp = vec2(fbm2(uv + drift), fbm2(uv + vec2(5.2, 1.3) - drift));
    float gas = fbm2(uv + warp * 1.6 + drift);
    float fine = fbm2(uv * 2.3 - warp + uSeed * 0.37);

    float density = smoothstep(0.38, 0.85, gas) * envelope;
    density *= 0.65 + 0.55 * fine;

    // Hue shift toward magenta / blue in denser regions for depth.
    vec3 color = mix(uTint * 0.8, uTint * vec3(1.15, 0.85, 1.25) + 0.06, fine);
    float a = density * uIntensity;
    gl_FragColor = vec4(color * a, a);
  }
`;

/**
 * Layered billboard nebula clouds (Report §2 ProceduralNebulae). Each region is
 * built from a few rotated, offset quads facing the observer, all additive.
 */
export class ProceduralNebulae {
  readonly group = new THREE.Group();
  private readonly materials: THREE.ShaderMaterial[] = [];
  private readonly geometry = new THREE.PlaneGeometry(1, 1);

  constructor(regions: NebulaRegion[]) {
    regions.forEach((region, regionIndex) => {
      const coords = region.coordinates;
      const radius = coords.radius || DEFAULT_RADIUS;
      const center =
        coords.raHours != null && coords.decDeg != null
          ? raDecToCartesian(coords.raHours, coords.decDeg, radius)
          : sphericalToCartesian(coords.azimuthDeg ?? 0, coords.elevationDeg ?? 0, radius);
      const density = THREE.MathUtils.clamp(region.particleDensity ?? 0.6, 0, 1);
      const tint = new THREE.Color(region.tintColorHex);

      for (let layer = 0; layer < LAYERS_PER_NEBULA; layer++) {
        const material = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          premultipliedAlpha: true,
          uniforms: {
            uTint: { value: tint.clone().offsetHSL((layer - 1) * 0.03, 0, 0) },
            uTime: { value: 0 },
            uSeed: { value: regionIndex * 13.7 + layer * 4.3 },
            uIntensity: { value: (0.22 + 0.35 * density) / (1 + layer * 0.35) },
          },
        });
        this.materials.push(material);

        const mesh = new THREE.Mesh(this.geometry, material);
        const spread = 0.12;
        const scale = 1 - layer * 0.18;
        mesh.scale.set(region.quadScale[0] * scale, region.quadScale[1] * scale, 1);
        mesh.position.copy(center);
        mesh.position.x += (Math.random() - 0.5) * region.quadScale[0] * spread;
        mesh.position.y += (Math.random() - 0.5) * region.quadScale[1] * spread;
        mesh.lookAt(0, 0, 0);
        mesh.rotateZ(Math.random() * Math.PI * 2);
        mesh.renderOrder = -2;
        mesh.frustumCulled = true;
        this.group.add(mesh);
      }
    });
  }

  update(time: number): void {
    for (const m of this.materials) m.uniforms.uTime.value = time;
  }

  dispose(): void {
    this.geometry.dispose();
    for (const m of this.materials) m.dispose();
  }
}
