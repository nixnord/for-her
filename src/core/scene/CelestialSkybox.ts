import * as THREE from 'three';
import { SKYBOX_RADIUS } from '../celestialMath';

/**
 * Tier 3: Deep Cosmic Skybox (Agent Context §2 & §10).
 * Inverted sphere mapped with NASA SVS Deep Star Map / Milky Way equirectangular texture.
 * Aligns the real galactic plane, cosmic dust lanes, and galactic center with astronomical coordinates.
 */
export class CelestialSkybox {
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private readonly texture: THREE.Texture;

  constructor(textureUrl = '/textures/nasa_milkyway_4k.jpg', onReady?: () => void) {
    // 48x32 segments keeps horizon lines smooth while reducing vertex workload on mobile GPUs
    const geometry = new THREE.SphereGeometry(SKYBOX_RADIUS, 48, 32);

    const loader = new THREE.TextureLoader();
    this.texture = loader.load(
      textureUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        this.mesh.material.needsUpdate = true;
        onReady?.();
      },
      undefined,
      () => {
        // Still signal ready on texture error so the UI never deadlocks
        onReady?.();
      },
    );

    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      side: THREE.BackSide,
      depthWrite: false,
      transparent: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    // Align texture longitude with Right Ascension coordinates (Agent Context §4.1)
    this.mesh.rotation.y = Math.PI;
    this.mesh.renderOrder = -20;
    this.mesh.frustumCulled = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.texture.dispose();
  }
}
