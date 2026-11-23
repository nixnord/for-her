import * as THREE from 'three';
import { DEG2RAD, headingOf } from '../celestialMath';

export type PermissionResult = 'granted' | 'denied' | 'unsupported';

/** iOS 13+ exposes a static requestPermission() on DeviceOrientationEvent. */
type IOSDeviceOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

// Report §10 suggests 600ms, but real Android devices can take >1s to spin up the
// fused sensor after the first listener is attached, so we allow a little longer.
const SENSOR_WATCHDOG_MS = 2000;
const DEFAULT_LAMBDA = 16; // Report §3.4
const DEADBAND_DOT = Math.cos((0.04 * DEG2RAD) / 2); // Report §3.4 angular deadband

/**
 * Converts DeviceOrientation events into a gravity-aligned, yaw-calibrated
 * camera quaternion (Report §3.2 – §3.4). Contains zero React code.
 */
export class MobileGyroController {
  // Latest raw sensor readings (degrees).
  private alpha = 0;
  private beta = 0;
  private gamma = 0;
  private hasData = false;
  private listening = false;

  // Calibration state.
  private yawOffset = 0;
  private pendingCalibration = true;
  private calibrationTargetHeading = 0;
  private snapNextFrame = true;

  // Pre-allocated scratch objects (Report §10 — zero allocations in the tick).
  private readonly euler = new THREE.Euler();
  private readonly qRaw = new THREE.Quaternion();
  private readonly qCalibrated = new THREE.Quaternion();
  private readonly qYaw = new THREE.Quaternion();
  private readonly qScreen = new THREE.Quaternion();
  private readonly qFlip = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
  private readonly zAxis = new THREE.Vector3(0, 0, 1);
  private readonly yAxis = new THREE.Vector3(0, 1, 0);
  private readonly scratchDir = new THREE.Vector3();

  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  }

  /**
   * MUST be invoked synchronously from a user gesture (tap) for iOS Safari.
   */
  static requestPermission(): Promise<PermissionResult> {
    if (!MobileGyroController.isSupported()) return Promise.resolve('unsupported');
    const DOE = DeviceOrientationEvent as IOSDeviceOrientationEvent;
    if (typeof DOE.requestPermission === 'function') {
      return DOE.requestPermission()
        .then((r) => (r === 'granted' ? 'granted' : 'denied') as PermissionResult)
        .catch(() => 'denied' as PermissionResult);
    }
    // Android / other: no explicit permission prompt; the watchdog will verify data.
    return Promise.resolve('granted');
  }

  /** Snapshot of why the sensor did / didn't work — surfaced in the UI for debugging. */
  static environmentReport(): string {
    const parts = [
      `secure=${window.isSecureContext}`,
      `DOE=${'DeviceOrientationEvent' in window}`,
      `iOSPerm=${typeof (window.DeviceOrientationEvent as IOSDeviceOrientationEvent | undefined)?.requestPermission === 'function'}`,
    ];
    return parts.join(' ');
  }

  /** Event diagnostics for the current session. */
  readonly stats = { events: 0, nullEvents: 0, source: 'none' as 'none' | 'relative' | 'absolute' };

  private ingest(event: DeviceOrientationEvent, source: 'relative' | 'absolute'): void {
    this.stats.events++;
    // Accelerometer-only devices may report alpha = null; beta/gamma still give
    // pitch & roll, and yaw is calibrated anyway.
    if (event.beta == null || event.gamma == null) {
      this.stats.nullEvents++;
      return;
    }
    // Lock onto the first stream that delivers data so alpha frames never mix.
    if (this.stats.source === 'none') this.stats.source = source;
    if (this.stats.source !== source) return;
    this.alpha = event.alpha ?? 0;
    this.beta = event.beta;
    this.gamma = event.gamma;
    this.hasData = true;
  }

  private readonly handleOrientation = (event: DeviceOrientationEvent): void => {
    this.ingest(event, 'relative');
  };

  private readonly handleOrientationAbsolute = (event: DeviceOrientationEvent): void => {
    this.ingest(event, 'absolute');
  };

  /**
   * Starts listening. Resolves `true` once a valid numeric reading arrives,
   * or `false` if none arrives within the watchdog window.
   */
  connect(): Promise<boolean> {
    if (!this.listening) {
      this.stats.source = 'none';
      window.addEventListener('deviceorientation', this.handleOrientation);
      // Chrome on Android also emits this compass-referenced variant; some devices only fire this one.
      window.addEventListener('deviceorientationabsolute', this.handleOrientationAbsolute as EventListener);
      this.listening = true;
    }
    if (this.hasData) return Promise.resolve(true);

    return new Promise((resolve) => {
      const started = performance.now();
      const check = () => {
        if (this.hasData) return resolve(true);
        if (performance.now() - started > SENSOR_WATCHDOG_MS) return resolve(false);
        // setTimeout rather than rAF: rAF can be throttled while the permission dialog is open.
        window.setTimeout(check, 50);
      };
      check();
    });
  }

  disconnect(): void {
    if (this.listening) {
      window.removeEventListener('deviceorientation', this.handleOrientation);
      window.removeEventListener('deviceorientationabsolute', this.handleOrientationAbsolute as EventListener);
      this.listening = false;
    }
    this.hasData = false;
  }

  get isActive(): boolean {
    return this.listening && this.hasData;
  }

  /**
   * Gravity-aligned yaw calibration (Report §3.3). On the next frame the
   * current physical heading will map to `targetHeadingRad` in the virtual sky.
   * Pitch and roll are never touched, so the horizon stays aligned with gravity.
   */
  recenter(targetHeadingRad = 0, snap = false): void {
    this.calibrationTargetHeading = targetHeadingRad;
    this.pendingCalibration = true;
    if (snap) this.snapNextFrame = true;
  }

  private computeRawQuaternion(): void {
    const orient = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) * DEG2RAD;
    this.euler.set(this.beta * DEG2RAD, this.alpha * DEG2RAD, -this.gamma * DEG2RAD, 'YXZ');
    this.qRaw.setFromEuler(this.euler);
    this.qRaw.multiply(this.qFlip);
    this.qRaw.multiply(this.qScreen.setFromAxisAngle(this.zAxis, -orient));
  }

  private currentRawHeading(): number {
    // Forward line of sight in world space.
    const fwd = this.scratchDir.set(0, 0, -1).applyQuaternion(this.qRaw);
    if (Math.hypot(fwd.x, fwd.z) > 0.15) return headingOf(fwd);
    // Looking almost straight up/down: the screen's top edge points away from the
    // user in both cases, i.e. along the heading they are facing.
    return headingOf(this.scratchDir.set(0, 1, 0).applyQuaternion(this.qRaw));
  }

  /** Applies the smoothed sensor orientation to the camera. */
  update(camera: THREE.Camera, dt: number, lambda = DEFAULT_LAMBDA): void {
    if (!this.hasData) return;
    this.computeRawQuaternion();

    if (this.pendingCalibration) {
      // Rotating about +Y by `a` changes heading h -> h - a, so a = h - target.
      this.yawOffset = this.currentRawHeading() - this.calibrationTargetHeading;
      this.pendingCalibration = false;
    }

    this.qYaw.setFromAxisAngle(this.yAxis, this.yawOffset);
    this.qCalibrated.copy(this.qYaw).multiply(this.qRaw);

    if (this.snapNextFrame) {
      camera.quaternion.copy(this.qCalibrated);
      this.snapNextFrame = false;
      return;
    }

    if (Math.abs(camera.quaternion.dot(this.qCalibrated)) > DEADBAND_DOT) return;
    const t = 1 - Math.exp(-lambda * dt);
    camera.quaternion.slerp(this.qCalibrated, t);
  }
}
