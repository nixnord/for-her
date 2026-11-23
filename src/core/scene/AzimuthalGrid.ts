import * as THREE from 'three';
import { sphericalToCartesian } from '../celestialMath';

const GRID_RADIUS = 450;
const STEP_DEG = 15;
const SEGMENTS = 120;

/**
 * Stellarium-style azimuthal grid with a highlighted horizon and cardinal labels.
 * Gives the viewer a sense of orientation while exploring the sky.
 */
export class AzimuthalGrid {
  readonly group = new THREE.Group();
  private readonly disposables: { dispose(): void }[] = [];

  constructor() {
    this.buildGridLines();
    this.buildHorizon();
    this.buildCardinalLabels();
  }

  set visible(v: boolean) {
    this.group.visible = v;
  }

  get visible(): boolean {
    return this.group.visible;
  }

  private buildGridLines(): void {
    const points: number[] = [];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();

    // Altitude circles (excluding horizon which is drawn separately).
    for (let el = -75; el <= 75; el += STEP_DEG) {
      if (el === 0) continue;
      for (let i = 0; i < SEGMENTS; i++) {
        sphericalToCartesian((i / SEGMENTS) * 360, el, GRID_RADIUS, a);
        sphericalToCartesian(((i + 1) / SEGMENTS) * 360, el, GRID_RADIUS, b);
        points.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }

    // Azimuth meridians, stopping short of the poles to avoid a dense knot.
    for (let az = 0; az < 360; az += STEP_DEG) {
      const steps = 48;
      for (let i = 0; i < steps; i++) {
        const el0 = -84 + (i / steps) * 168;
        const el1 = -84 + ((i + 1) / steps) * 168;
        sphericalToCartesian(az, el0, GRID_RADIUS, a);
        sphericalToCartesian(az, el1, GRID_RADIUS, b);
        points.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const material = new THREE.LineBasicMaterial({
      color: '#7f8cff',
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
    });
    this.group.add(new THREE.LineSegments(geometry, material));
    this.disposables.push(geometry, material);
  }

  private buildHorizon(): void {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= SEGMENTS * 2; i++) {
      pts.push(sphericalToCartesian((i / (SEGMENTS * 2)) * 360, 0, GRID_RADIUS));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(pts);
    const material = new THREE.LineBasicMaterial({
      color: '#f9b48a',
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.group.add(new THREE.Line(geometry, material));
    this.disposables.push(geometry, material);
  }

  private buildCardinalLabels(): void {
    const labels: [string, number, number][] = [
      ['N', 0, 2.5],
      ['E', 90, 2.5],
      ['S', 180, 2.5],
      ['W', 270, 2.5],
      ['NE', 45, 2.5],
      ['SE', 135, 2.5],
      ['SW', 225, 2.5],
      ['NW', 315, 2.5],
    ];
    for (const [text, az, el] of labels) {
      const major = text.length === 1;
      const sprite = this.makeLabel(text, major);
      sphericalToCartesian(az, el, GRID_RADIUS * 0.98, sprite.position);
      this.group.add(sprite);
    }
  }

  private makeLabel(text: string, major: boolean): THREE.Sprite {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.font = `${major ? 600 : 400} ${major ? 64 : 42}px "Cormorant Garamond", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = major ? '#f9b48a' : 'rgba(249, 180, 138, 0.6)';
    ctx.shadowColor = 'rgba(249, 180, 138, 0.6)';
    ctx.shadowBlur = 12;
    ctx.fillText(text, size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    const scale = major ? 26 : 20;
    sprite.scale.set(scale, scale, 1);
    this.disposables.push(texture, material);
    return sprite;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
