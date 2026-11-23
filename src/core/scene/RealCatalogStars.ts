import * as THREE from 'three';
import { CATALOG_RADIUS, bvToRgb, raDecToCartesian } from '../celestialMath';
import catalogData from '../../data/realCatalogData.json';

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aBrightness;
  attribute float aPhase;
  attribute float aSpeed;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uZoom;

  varying vec3 vColor;
  varying float vBrightness;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    // Organic non-repeating twinkle
    float tw = 0.65 + 0.22 * sin(uTime * aSpeed + aPhase) + 0.13 * sin(uTime * aSpeed * 2.4 + aPhase * 1.7);
    vBrightness = aBrightness * mix(0.75, 1.15, tw);
    vColor = aColor;

    // Point size scales with zoom and pixel ratio
    gl_PointSize = aSize * uPixelRatio * pow(uZoom, 0.45) * mix(0.88, 1.12, tw);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vBrightness;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d2 = dot(c, c) * 4.0;
    if (d2 > 1.0) discard;

    // Analytical core + soft stellar halo
    float core = exp(-d2 * 7.0);
    float halo = exp(-d2 * 2.2) * 0.4;
    float a = clamp((core + halo) * vBrightness, 0.0, 1.5);

    // Premultiplied additive starlight
    gl_FragColor = vec4(vColor * a, a);
  }
`;

/**
 * Tier 2: Real Celestial Catalog & IAU Constellations (Agent Context §2 & §10).
 * Displays 8,912 real catalog stars from the Yale Bright Star Catalog (with accurate
 * B-V spectral colors and magnitude brightness) + 88 modern IAU constellation stick lines.
 */
export class RealCatalogStars {
  readonly group = new THREE.Group();
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly constellationLines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;

  constructor(pixelRatio: number) {
    const rawStars = catalogData.stars as [number, number, number, number, number, string][];
    const n = rawStars.length;

    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const brightnesses = new Float32Array(n);
    const phases = new Float32Array(n);
    const speeds = new Float32Array(n);

    const posScratch = new THREE.Vector3();

    rawStars.forEach((star, i) => {
      const [ra, dec, mag, ci, _hr, _name] = star;

      // Real 3D Cartesian position at CATALOG_RADIUS (Agent Context §4.1)
      raDecToCartesian(ra, dec, CATALOG_RADIUS, posScratch);
      positions.set([posScratch.x, posScratch.y, posScratch.z], i * 3);

      // Real spectral color from B-V astronomical color index (Agent Context §2)
      const rgb = bvToRgb(ci);
      colors.set(rgb, i * 3);

      // Star point size based on visual magnitude (V_mag)
      // Bright stars (V < 1.0) stand out prominently; faint stars (V ~ 6) are delicate points
      const sizeVal = THREE.MathUtils.clamp(9.5 - mag * 1.15, 1.8, 16.0);
      sizes[i] = sizeVal;

      // Brightness multiplier based on magnitude
      const brightVal = THREE.MathUtils.clamp(1.15 - (mag - 0.5) * 0.12, 0.45, 1.3);
      brightnesses[i] = brightVal;

      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.8 + Math.random() * 2.2;
    });

    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeom.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    starGeom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    starGeom.setAttribute('aBrightness', new THREE.BufferAttribute(brightnesses, 1));
    starGeom.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    starGeom.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));

    const starMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uZoom: { value: 1 },
      },
    });

    this.points = new THREE.Points(starGeom, starMaterial);
    this.points.renderOrder = -4;
    this.points.frustumCulled = false;
    this.group.add(this.points);

    // 2. Build 88 Modern IAU Constellation Stick Lines (Agent Context §2)
    const rawLines = catalogData.lines as number[];
    const linePositions: number[] = [];
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const LINE_RADIUS = CATALOG_RADIUS * 0.99;

    for (let i = 0; i < rawLines.length; i += 4) {
      const ra1 = rawLines[i];
      const dec1 = rawLines[i + 1];
      const ra2 = rawLines[i + 2];
      const dec2 = rawLines[i + 3];

      raDecToCartesian(ra1, dec1, LINE_RADIUS, p1);
      raDecToCartesian(ra2, dec2, LINE_RADIUS, p2);

      linePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    }

    const linesGeom = new THREE.BufferGeometry();
    linesGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

    const linesMaterial = new THREE.LineBasicMaterial({
      color: '#55688a',
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });

    this.constellationLines = new THREE.LineSegments(linesGeom, linesMaterial);
    this.constellationLines.renderOrder = -6;
    this.constellationLines.frustumCulled = false;
    this.group.add(this.constellationLines);
  }

  setConstellationsVisible(visible: boolean): void {
    this.constellationLines.visible = visible;
  }

  getConstellationsVisible(): boolean {
    return this.constellationLines.visible;
  }

  update(time: number, zoom: number): void {
    this.points.material.uniforms.uTime.value = time;
    this.points.material.uniforms.uZoom.value = zoom;
  }

  setPixelRatio(pr: number): void {
    this.points.material.uniforms.uPixelRatio.value = pr;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.constellationLines.geometry.dispose();
    this.constellationLines.material.dispose();
  }
}
