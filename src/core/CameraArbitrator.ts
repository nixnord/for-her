import * as THREE from 'three';
import type { ControlMode, SensorStatus } from '../types/universe.types';
import { DEG2RAD, headingOf } from './celestialMath';
import { MobileGyroController } from './controllers/MobileGyroController';
import { DesktopDragController } from './controllers/DesktopDragController';

export interface ArbitratorCallbacks {
  onModeChange: (mode: ControlMode) => void;
  onSensorStatus: (status: SensorStatus) => void;
}

/** Default view after entering / recentring: facing North, slightly above the horizon. */
const HOME_HEADING = 0;
const HOME_ELEVATION = 12 * DEG2RAD;

/**
 * Camera Finite State Machine (Report §4). Decides which input source owns the
 * camera each frame: phone IMU, pointer drag, or (later) programmatic slews.
 */
export class CameraArbitrator {
  private _mode: ControlMode = 'UNINITIALIZED';
  private previousMode: ControlMode = 'POINTER_DRAG';
  readonly gyro = new MobileGyroController();
  readonly drag: DesktopDragController;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly callbacks: ArbitratorCallbacks;
  private readonly scratchDir = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, callbacks: ArbitratorCallbacks) {
    this.camera = camera;
    this.callbacks = callbacks;
    this.drag = new DesktopDragController(camera, domElement);
    // Start gazing gently above the horizon for the onboarding backdrop.
    void this.drag.slewTo(HOME_HEADING, 20 * DEG2RAD, false);
  }

  get mode(): ControlMode {
    return this._mode;
  }

  private setMode(mode: ControlMode): void {
    if (this._mode === mode) return;
    this._mode = mode;
    this.callbacks.onModeChange(mode);
  }

  /**
   * Capability auto-detection after the user taps "Enter".
   * @param sensorPermission result of MobileGyroController.requestPermission(), or null on desktop.
   */
  async enter(sensorPermission: 'granted' | 'denied' | 'unsupported' | null): Promise<void> {
    if (sensorPermission === 'granted') {
      const ok = await this.gyro.connect();
      if (ok) {
        this.callbacks.onSensorStatus('granted');
        this.activateSensor(true);
        return;
      }
      this.gyro.disconnect();
      this.callbacks.onSensorStatus('timeout');
    } else if (sensorPermission) {
      this.callbacks.onSensorStatus(sensorPermission);
    } else {
      this.callbacks.onSensorStatus('unsupported');
    }
    this.activateDrag();
    void this.drag.slewTo(HOME_HEADING, HOME_ELEVATION, true);
  }

  private currentViewDirection(): THREE.Vector3 {
    return this.camera.getWorldDirection(this.scratchDir);
  }

  private activateSensor(isFirstEntry: boolean): void {
    this.drag.enabled = false;
    // Map the phone's current physical heading to whatever the user is currently looking at,
    // so switching modes never causes a jarring jump in azimuth.
    const heading = isFirstEntry ? HOME_HEADING : headingOf(this.currentViewDirection());
    this.gyro.recenter(heading, isFirstEntry);
    this.setMode('MOBILE_SENSOR');
  }

  private activateDrag(): void {
    if (this._mode === 'MOBILE_SENSOR') {
      // Hand over the current gaze to camera-controls (roll is dropped).
      void this.drag.lookAtDirection(this.currentViewDirection(), false);
    }
    this.drag.enabled = true;
    this.setMode('POINTER_DRAG');
  }

  /**
   * Mobile toggle between motion sensor and touch-drag exploration.
   * @param permission result of requestPermission() obtained inside the tap gesture.
   */
  async toggleSensorMode(permission: 'granted' | 'denied' | 'unsupported' = 'granted'): Promise<void> {
    if (this._mode === 'MOBILE_SENSOR') {
      this.activateDrag();
      return;
    }
    if (this._mode !== 'POINTER_DRAG') return;
    if (permission !== 'granted') {
      this.callbacks.onSensorStatus(permission);
      return;
    }
    const ok = await this.gyro.connect();
    if (ok) {
      this.callbacks.onSensorStatus('granted');
      this.activateSensor(false);
    } else {
      this.gyro.disconnect();
      this.callbacks.onSensorStatus('timeout');
    }
  }

  /** Human-readable sensor diagnostics for troubleshooting on real devices. */
  sensorDiagnostics(): string {
    const s = this.gyro.stats;
    return `${MobileGyroController.environmentReport()} events=${s.events} null=${s.nullEvents} src=${s.source}`;
  }

  /** Recenter (Report §3.3): bring the home heading back in front of the viewer. */
  recenter(): void {
    if (this._mode === 'MOBILE_SENSOR') {
      this.gyro.recenter(HOME_HEADING);
    } else if (this._mode === 'POINTER_DRAG') {
      void this.drag.slewTo(HOME_HEADING, HOME_ELEVATION, true);
    }
  }

  /**
   * Slew camera smoothly to focus on an inspected star (Report §4.1 TARGET_FOCUS).
   */
  async focusStar(direction: THREE.Vector3): Promise<void> {
    if (this._mode !== 'TARGET_FOCUS') {
      this.previousMode = this._mode;
    }
    this.setMode('TARGET_FOCUS');
    this.drag.enabled = false;
    await this.drag.lookAtDirection(direction, true);
  }

  /**
   * Returns camera to previous navigation mode after closing memory card modal.
   */
  releaseFocus(): void {
    if (this._mode !== 'TARGET_FOCUS') return;
    if (this.previousMode === 'MOBILE_SENSOR') {
      this.activateSensor(false);
    } else {
      this.activateDrag();
    }
  }

  update(dt: number): void {
    switch (this._mode) {
      case 'UNINITIALIZED':
        this.drag.idleDrift(dt);
        this.drag.update(dt);
        break;
      case 'MOBILE_SENSOR':
        this.gyro.update(this.camera, dt);
        break;
      case 'POINTER_DRAG':
        this.drag.update(dt);
        break;
      case 'TARGET_FOCUS':
        this.drag.update(dt);
        break;
      default:
        break;
    }
  }

  dispose(): void {
    this.gyro.disconnect();
    this.drag.dispose();
  }
}
