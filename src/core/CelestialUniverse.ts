import * as THREE from 'three';
import type { ControlMode, SensorStatus, UnifiedCelestialObject } from '../types/universe.types';
import { CameraArbitrator } from './CameraArbitrator';
import type { PermissionResult } from './controllers/MobileGyroController';
import { CelestialSkybox } from './scene/CelestialSkybox';
import { RealCatalogStars } from './scene/RealCatalogStars';
import { AzimuthalGrid } from './scene/AzimuthalGrid';
import { InteractiveStarSystem } from './scene/InteractiveStarSystem';
import { ProceduralNebulae } from './scene/ProceduralNebulae';
import { ConstellationSystem } from './scene/ConstellationSystem';
import { universeData, resolveStars, type ResolvedStar } from '../data/universeData';
import { InteractionManager } from './InteractionManager';
import { CelestialAudioEngine, type ChimeNote } from '../audio/CelestialAudioEngine';

export interface UniverseCallbacks {
  onModeChange: (mode: ControlMode) => void;
  onSensorStatus: (status: SensorStatus) => void;
  onReticleLock: (star: UnifiedCelestialObject | null) => void;
  onSelectStar: (star: UnifiedCelestialObject) => void;
  onAssetsReady?: () => void;
}

const MAX_PIXEL_RATIO = 1.75; // Report §10 — fill-rate guard
const MAX_DT = 0.1;

/**
 * Imperative WebGL master controller (Report §1, decision 3 & Agent Context §2).
 * Orchestrates the Three-Tier Celestial Hierarchy:
 * - Tier 3: Deep Cosmic Skybox (NASA SVS Deep Star Map / Milky Way panorama, R = 950)
 * - Tier 2: Real Celestial Catalog (8,912 Yale Bright Star Catalog stars + 88 IAU constellations, R = 460)
 * - Tier 1: Personal Universe Overlay (Interactive memory stars & story constellations, R = 200)
 */
export class CelestialUniverse {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly arbitrator: CameraArbitrator;

  // Tier 3: NASA Deep Star Map Equirectangular Skybox
  readonly skybox: CelestialSkybox;

  // Tier 2: Real Astronomical Catalog & IAU Constellations
  readonly realStars: RealCatalogStars;

  // Tier 1: Personal Universe Overlay
  readonly interactiveStars: InteractiveStarSystem;
  readonly constellations: ConstellationSystem;
  private readonly nebulae: ProceduralNebulae;
  readonly resolvedStars: ResolvedStar[];

  // Stellarium Azimuthal Grid
  private readonly grid = new AzimuthalGrid();

  // Procedural Web Audio soundscape & pentatonic chimes
  readonly audio = new CelestialAudioEngine();

  private readonly interactionManager: InteractionManager;
  private readonly resizeObserver: ResizeObserver;
  private readonly container: HTMLElement;
  private readonly readyFallbackTimer: number;
  private assetsSignaled = false;
  private lastTime = -1;
  private disposed = false;

  constructor(container: HTMLElement, callbacks: UniverseCallbacks) {
    this.container = container;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setClearColor('#010204');
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1500);

    // Resolve personal star data
    this.resolvedStars = resolveStars(universeData);

    const markAssetsReady = () => {
      if (this.disposed || this.assetsSignaled) return;
      this.assetsSignaled = true;
      window.clearTimeout(this.readyFallbackTimer);
      // Warm GPU shader programs before user enters the sky
      this.renderer.compile(this.scene, this.camera);
      callbacks.onAssetsReady?.();
    };

    // 1. Tier 3: NASA SVS Deep Star Map Skybox
    this.skybox = new CelestialSkybox(universeData.nasaSkyboxTextureUrl, markAssetsReady);

    // 2. Tier 2: Real Yale Catalog Stars (8,912 stars) & 88 IAU Constellations
    this.realStars = new RealCatalogStars(pixelRatio);

    // 3. Tier 1: Personal Story Overlay (Interactive Stars & Story Constellations)
    this.interactiveStars = new InteractiveStarSystem(this.resolvedStars);
    this.constellations = new ConstellationSystem(
      universeData.constellations,
      this.resolvedStars,
      universeData.finale,
    );
    this.nebulae = new ProceduralNebulae(universeData.nebulae);

    // Assemble the celestial scene
    this.scene.add(this.skybox.mesh);
    this.scene.add(this.realStars.group);
    this.scene.add(this.nebulae.group);
    this.scene.add(this.constellations.group);
    this.scene.add(this.interactiveStars.mesh);
    this.scene.add(this.grid.group);

    this.arbitrator = new CameraArbitrator(this.camera, this.renderer.domElement, callbacks);

    // Interaction Manager (Screen-Center Reticle + Desktop Raycasting)
    this.interactionManager = new InteractionManager(
      this.camera,
      this.renderer.domElement,
      this.resolvedStars,
      this.interactiveStars,
      {
        onReticleLock: (star) => {
          if (star?.personalMemory) {
            this.audio.playLockChime(star.personalMemory.ambientChimeNote as ChimeNote);
          }
          callbacks.onReticleLock(star);
        },
        onSelectStar: (star, pos) => {
          if (pos) {
            void this.focusStar(pos);
          }
          callbacks.onSelectStar(star);
        },
        getControlMode: () => this.arbitrator.mode,
      },
    );

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    // Compile initial shaders immediately and guarantee ready state within 2.5s
    this.renderer.compile(this.scene, this.camera);
    this.readyFallbackTimer = window.setTimeout(markAssetsReady, 2500);

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.renderer.setAnimationLoop(this.tick);
  }

  private readonly onVisibilityChange = (): void => {
    if (this.disposed) return;
    if (document.hidden) {
      this.renderer.setAnimationLoop(null);
      this.audio.setPageHidden(true);
    } else {
      this.lastTime = -1;
      this.audio.setPageHidden(false);
      this.renderer.setAnimationLoop(this.tick);
    }
  };

  private resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Portrait phones get a taller vertical FOV so the horizontal view isn't too narrow
    this.camera.fov = aspect < 1 ? 78 : 60;
    this.camera.updateProjectionMatrix();

    const pr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    this.realStars.setPixelRatio(pr);
  }

  private readonly tick = (timeMs: number): void => {
    if (this.disposed) return;
    const t = timeMs / 1000;
    const dt = this.lastTime < 0 ? 1 / 60 : Math.min(t - this.lastTime, MAX_DT);
    this.lastTime = t;

    this.arbitrator.update(dt);
    this.interactionManager.update();
    this.realStars.update(t, this.camera.zoom);
    this.constellations.update(t, dt);
    this.interactiveStars.update(t, dt);
    this.nebulae.update(t);

    this.renderer.render(this.scene, this.camera);
  };

  // ------------------------------------------------------------------
  // Public commands for the UI layer
  // ------------------------------------------------------------------

  enter(sensorPermission: PermissionResult | null): Promise<void> {
    return this.arbitrator.enter(sensorPermission);
  }

  recenter(): void {
    this.arbitrator.recenter();
  }

  toggleSensorMode(permission?: PermissionResult): Promise<void> {
    return this.arbitrator.toggleSensorMode(permission);
  }

  sensorDiagnostics(): string {
    return this.arbitrator.sensorDiagnostics();
  }

  setGridVisible(visible: boolean): void {
    this.grid.visible = visible;
  }

  setIauConstellationsVisible(visible: boolean): void {
    this.realStars.setConstellationsVisible(visible);
  }

  focusStar(target: THREE.Vector3 | ResolvedStar): Promise<void> {
    const pos = target instanceof THREE.Vector3 ? target : target.position;
    return this.arbitrator.focusStar(pos);
  }

  releaseFocus(): void {
    this.arbitrator.releaseFocus();
  }

  dispose(): void {
    this.disposed = true;
    window.clearTimeout(this.readyFallbackTimer);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.interactionManager.dispose();
    this.arbitrator.dispose();
    this.audio.dispose();
    this.skybox.dispose();
    this.realStars.dispose();
    this.constellations.dispose();
    this.interactiveStars.dispose();
    this.nebulae.dispose();
    this.grid.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
