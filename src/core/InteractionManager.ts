import * as THREE from 'three';
import type { ControlMode, UnifiedCelestialObject } from '../types/universe.types';
import type { ResolvedStar } from '../data/universeData';
import type { InteractiveStarSystem } from './scene/InteractiveStarSystem';
import {
  createUnifiedCelestialObject,
  findCatalogStarByRay,
} from '../data/astronomyCatalog';
import { useUniverseStore } from '../store/useUniverseStore';

export interface InteractionCallbacks {
  onReticleLock: (star: UnifiedCelestialObject | null) => void;
  onSelectStar: (star: UnifiedCelestialObject, targetPosition?: THREE.Vector3) => void;
  getControlMode: () => ControlMode;
}

/** Reticle cone angular threshold: ~3.5 degrees (Task 4.1 & Report §5.1) */
const CONE_THRESHOLD_COS = Math.cos((3.5 * Math.PI) / 180);
/** Desktop hit proxy radius around each personal star */
const HIT_PROXY_RADIUS = 16.0;
/** Tap detection threshold: max pointer movement (px) to qualify as a tap */
const TAP_DISTANCE_THRESHOLD = 12.0;

export class InteractionManager {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly stars: ResolvedStar[];
  private readonly starSystem: InteractiveStarSystem;
  private readonly callbacks: InteractionCallbacks;

  private reticleElement: HTMLElement | null = null;
  private readonly isMobileDevice: boolean;

  // Scratch objects (zero GC in render tick)
  private readonly cameraForward = new THREE.Vector3();
  private readonly starDirection = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2(-999, -999);
  private readonly tapNdc = new THREE.Vector2();

  // Cached positions of personal stars
  private readonly personalStarTargets: {
    index: number;
    id: string;
    position: THREE.Vector3;
    direction: THREE.Vector3;
    resolved: ResolvedStar;
  }[];

  private lastDiscoveredRef: string[] | null = null;
  private readonly discoveredSet = new Set<string>();
  private lastResonanceKey = -1;
  private lastLockedFlag: boolean | null = null;

  private lockedStar: UnifiedCelestialObject | null = null;
  private lockedPosition: THREE.Vector3 | null = null;

  private desktopHoveredStar: UnifiedCelestialObject | null = null;
  private desktopHoveredPos: THREE.Vector3 | null = null;

  private pointerDownPos = { x: 0, y: 0 };
  private pointerDownTime = 0;
  private isPointerDown = false;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    stars: ResolvedStar[],
    starSystem: InteractiveStarSystem,
    callbacks: InteractionCallbacks,
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.stars = stars;
    this.starSystem = starSystem;
    this.callbacks = callbacks;
    this.isMobileDevice = useUniverseStore.getState().isMobileDevice;

    this.personalStarTargets = stars.map((s, index) => ({
      index,
      id: s.item.id,
      position: s.position,
      direction: s.direction,
      resolved: s,
    }));

    this.reticleElement = document.getElementById('celestial-reticle');
    this.bindEvents();
  }

  private bindEvents(): void {
    const el = this.domElement;
    el.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    el.addEventListener('pointermove', this.onPointerMove, { passive: true });
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerCancel);
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.isPointerDown = true;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.pointerDownTime = performance.now();
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const rect = this.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  };

  private readonly onPointerCancel = (): void => {
    this.isPointerDown = false;
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;

    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    const distance = Math.hypot(dx, dy);
    const duration = performance.now() - this.pointerDownTime;

    // Ignore drags / long holds
    if (distance > TAP_DISTANCE_THRESHOLD || duration > 650) return;

    const mode = this.callbacks.getControlMode();
    if (mode === 'UNINITIALIZED' || mode === 'CINEMATIC_FINALE') return;

    // 1. Mobile Primary (or desktop when locked on center reticle):
    // Tapping anywhere triggers the reticle-locked star
    if (this.lockedStar && this.lockedPosition) {
      this.callbacks.onSelectStar(this.lockedStar, this.lockedPosition);
      return;
    }

    // 2. Desktop Cursor Raycast selection
    if (this.desktopHoveredStar && this.desktopHoveredPos) {
      this.callbacks.onSelectStar(this.desktopHoveredStar, this.desktopHoveredPos);
      return;
    }

    // 3. Fallback: Direct Tap Raycast
    const rect = this.domElement.getBoundingClientRect();
    this.tapNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -(((e.clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.tapNdc, this.camera);
    const ray = this.raycaster.ray;

    // Check personal stars first
    let closestPersonalIdx = -1;
    let minDist = Infinity;
    for (let i = 0; i < this.stars.length; i++) {
      if (!this.starSystem.isVisible(i)) continue;
      const d = ray.distanceToPoint(this.stars[i].position);
      if (d <= HIT_PROXY_RADIUS * 1.5 && d < minDist) {
        minDist = d;
        closestPersonalIdx = i;
      }
    }

    if (closestPersonalIdx >= 0) {
      const s = this.stars[closestPersonalIdx];
      this.callbacks.onSelectStar(createUnifiedCelestialObject(s.item.id), s.position);
      return;
    }

    // Check real catalog stars only on desktop pointer click (prevent accidental thumb taps on mobile)
    if (!this.isMobileDevice) {
      const catHit = findCatalogStarByRay(ray, 20.0);
      if (catHit) {
        this.callbacks.onSelectStar(catHit.unified, catHit.star.position);
      }
    }
  };

  /**
   * High-Performance RAF Tick:
   * 1. Evaluates angular proximity to undiscovered personal stars (Task 4.2).
   * 2. Mutates direct DOM CSS variable `--resonance` on `#celestial-reticle` (zero React re-renders).
   * 3. Evaluates screen-center cone lock onto personal & prominent catalog stars.
   * 4. Evaluates desktop mouse raycasting.
   */
  update(): void {
    const mode = this.callbacks.getControlMode();
    if (mode === 'UNINITIALIZED' || mode === 'CINEMATIC_FINALE') {
      if (this.lockedStar) {
        this.lockedStar = null;
        this.lockedPosition = null;
        this.callbacks.onReticleLock(null);
      }
      return;
    }

    if (!this.reticleElement || !this.reticleElement.isConnected) {
      this.reticleElement = document.getElementById('celestial-reticle');
      this.lastResonanceKey = -1;
      this.lastLockedFlag = null;
    }

    this.camera.getWorldDirection(this.cameraForward);

    // ----------------------------------------------------------------
    // 1. Screen-Center Cone Targeting & Locking
    // ----------------------------------------------------------------
    let bestPersonalDot = -1;
    let bestPersonalIndex = -1;

    for (let i = 0; i < this.stars.length; i++) {
      if (!this.starSystem.isVisible(i)) continue;
      const dot = this.cameraForward.dot(this.stars[i].direction);
      if (dot > bestPersonalDot) {
        bestPersonalDot = dot;
        bestPersonalIndex = i;
      }
    }

    let newLockedStar: UnifiedCelestialObject | null = null;
    let newLockedPos: THREE.Vector3 | null = null;
    let personalActiveIndex = -1;

    if (bestPersonalDot >= CONE_THRESHOLD_COS && bestPersonalIndex >= 0) {
      const s = this.stars[bestPersonalIndex];
      newLockedStar = createUnifiedCelestialObject(s.item.id);
      newLockedPos = s.position;
      personalActiveIndex = bestPersonalIndex;
    }

    if (newLockedStar?.id !== this.lockedStar?.id) {
      this.lockedStar = newLockedStar;
      this.lockedPosition = newLockedPos;
      this.callbacks.onReticleLock(newLockedStar);
    }

    // ----------------------------------------------------------------
    // 2. Task 4.2: Starlight Proximity Resonance Engine (Zero-GC tick)
    // ----------------------------------------------------------------
    const { discoveredStarIds } = useUniverseStore.getState();
    if (this.lastDiscoveredRef !== discoveredStarIds) {
      this.lastDiscoveredRef = discoveredStarIds;
      this.discoveredSet.clear();
      for (let i = 0; i < discoveredStarIds.length; i++) {
        this.discoveredSet.add(discoveredStarIds[i]);
      }
    }

    let minUndiscoveredAngleDeg = 180.0;
    let minAllVisibleAngleDeg = 180.0;

    for (let i = 0; i < this.personalStarTargets.length; i++) {
      const t = this.personalStarTargets[i];
      if (!this.starSystem.isVisible(t.index)) continue;

      this.starDirection.copy(t.direction);
      const dot = this.cameraForward.dot(this.starDirection);
      const angleDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(dot, -1.0, 1.0)));

      if (angleDeg < minAllVisibleAngleDeg) {
        minAllVisibleAngleDeg = angleDeg;
      }
      if (!this.discoveredSet.has(t.id) && angleDeg < minUndiscoveredAngleDeg) {
        minUndiscoveredAngleDeg = angleDeg;
      }
    }

    // Use nearest undiscovered star; fall back to all visible message stars once all 10 are found
    const targetAngleDeg =
      minUndiscoveredAngleDeg < 180.0 ? minUndiscoveredAngleDeg : minAllVisibleAngleDeg;

    // Resonance factor: 0.0 at >= 40 deg, scaling smoothly to 1.0 at 3.5 deg
    let resonance =
      targetAngleDeg >= 40.0
        ? 0.0
        : Math.min(1.0, (40.0 - targetAngleDeg) / (40.0 - 3.5));

    // When locked onto any target star, ensure full warm radiance
    if (newLockedStar) {
      resonance = 1.0;
    }

    const isLockedNow = Boolean(newLockedStar);
    const resonanceKey = Math.round(resonance * 500);

    if (this.reticleElement && this.reticleElement.isConnected) {
      if (resonanceKey !== this.lastResonanceKey) {
        this.lastResonanceKey = resonanceKey;
        const r = Math.round(160 + resonance * 95);
        const g = Math.round(175 + resonance * 35);
        const b = Math.round(190 - resonance * 110);
        const glowAlpha = (resonance * 0.55).toFixed(3);
        const opacity = (0.25 + resonance * 0.75).toFixed(3);
        const scale = (0.85 + resonance * 0.35).toFixed(3);

        this.reticleElement.style.setProperty('--resonance', resonance.toFixed(3));
        this.reticleElement.style.setProperty('--resonance-color', `rgb(${r}, ${g}, ${b})`);
        this.reticleElement.style.setProperty(
          '--resonance-glow',
          `rgba(255, 200, 110, ${glowAlpha})`,
        );
        this.reticleElement.style.setProperty('--resonance-opacity', opacity);
        this.reticleElement.style.setProperty('--resonance-scale', scale);
      }

      if (isLockedNow !== this.lastLockedFlag) {
        this.lastLockedFlag = isLockedNow;
        this.reticleElement.setAttribute('data-locked', isLockedNow ? 'true' : 'false');
      }
    }

    // ----------------------------------------------------------------
    // Desktop Cursor Raycast (Report §5.2)
    // ----------------------------------------------------------------
    let desktopHoverIndex = -1;
    let desktopHoveredStar: UnifiedCelestialObject | null = null;
    let desktopHoveredPos: THREE.Vector3 | null = null;

    if (mode === 'POINTER_DRAG' && !this.isPointerDown) {
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      const ray = this.raycaster.ray;

      let closestDist = Infinity;
      for (let i = 0; i < this.stars.length; i++) {
        if (!this.starSystem.isVisible(i)) continue;
        const dist = ray.distanceToPoint(this.stars[i].position);
        if (dist <= HIT_PROXY_RADIUS && dist < closestDist) {
          closestDist = dist;
          desktopHoverIndex = i;
        }
      }

      if (desktopHoverIndex >= 0) {
        const s = this.stars[desktopHoverIndex];
        desktopHoveredStar = createUnifiedCelestialObject(s.item.id);
        desktopHoveredPos = s.position;
        this.domElement.style.cursor = 'pointer';
      } else if (!this.isMobileDevice) {
        const catHit = findCatalogStarByRay(ray, 20.0);
        if (catHit) {
          desktopHoveredStar = catHit.unified;
          desktopHoveredPos = catHit.star.position;
          this.domElement.style.cursor = 'pointer';
        } else {
          this.domElement.style.cursor = 'grab';
        }
      } else {
        this.domElement.style.cursor = 'grab';
      }
    } else if (mode === 'POINTER_DRAG' && this.isPointerDown) {
      this.domElement.style.cursor = 'grabbing';
    } else {
      this.domElement.style.cursor = 'default';
    }

    this.desktopHoveredStar = desktopHoveredStar;
    this.desktopHoveredPos = desktopHoveredPos;

    // Apply GLSL glow boost to whichever personal star is active
    const activeHoverIdx =
      desktopHoverIndex >= 0 ? desktopHoverIndex : personalActiveIndex;
    this.starSystem.setHovered(activeHoverIdx);
  }

  dispose(): void {
    const el = this.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerCancel);
  }
}
