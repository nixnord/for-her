import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { DEG2RAD, wrapAngle } from '../celestialMath';

CameraControls.install({
  THREE: {
    Vector2: THREE.Vector2,
    Vector3: THREE.Vector3,
    Vector4: THREE.Vector4,
    Quaternion: THREE.Quaternion,
    Matrix4: THREE.Matrix4,
    Spherical: THREE.Spherical,
    Box3: THREE.Box3,
    Sphere: THREE.Sphere,
    Raycaster: THREE.Raycaster,
  },
});

/** The camera orbits this tiny radius around the origin, i.e. it effectively sits at the centre of the sky. */
const ORBIT_EPSILON = 1e-4;
/** Negative => the sky follows the finger / cursor ("grab the sky"), like Stellarium. */
const BASE_ROTATE_SPEED = -0.32;
const POLAR_MARGIN = 0.5 * DEG2RAD;

/**
 * Desktop / touch drag navigation built on `camera-controls` (Report §4.1 POINTER_DRAG).
 * Provides inertia, damping, scroll / pinch zoom (via FOV zoom) and smooth slews.
 */
export class DesktopDragController {
  readonly controls: CameraControls;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scratch = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    const c = new CameraControls(camera, domElement);
    this.controls = c;

    c.mouseButtons.left = CameraControls.ACTION.ROTATE;
    c.mouseButtons.middle = CameraControls.ACTION.NONE;
    c.mouseButtons.right = CameraControls.ACTION.NONE;
    c.mouseButtons.wheel = CameraControls.ACTION.ZOOM;
    c.touches.one = CameraControls.ACTION.TOUCH_ROTATE;
    c.touches.two = CameraControls.ACTION.TOUCH_ZOOM;
    c.touches.three = CameraControls.ACTION.NONE;

    c.minZoom = 1;
    c.maxZoom = 5;
    c.minPolarAngle = POLAR_MARGIN;
    c.maxPolarAngle = Math.PI - POLAR_MARGIN;
    c.smoothTime = 0.35;
    c.draggingSmoothTime = 0.12;
    c.azimuthRotateSpeed = BASE_ROTATE_SPEED;
    c.polarRotateSpeed = BASE_ROTATE_SPEED;
    c.restThreshold = 0.0005;

    c.setLookAt(0, 0, ORBIT_EPSILON, 0, 0, 0, false);
    c.enabled = false;
  }

  set enabled(v: boolean) {
    this.controls.enabled = v;
  }

  get enabled(): boolean {
    return this.controls.enabled;
  }

  /** Points the camera along a world direction (unit or not). */
  lookAtDirection(direction: THREE.Vector3, animate: boolean): Promise<void> {
    const d = this.scratch.copy(direction).normalize().multiplyScalar(-ORBIT_EPSILON);
    return this.controls.setLookAt(d.x, d.y, d.z, 0, 0, 0, animate);
  }

  /**
   * Rotates so the view faces a heading (clockwise from North) and elevation,
   * always taking the shortest way round.
   */
  slewTo(headingRad: number, elevationRad: number, animate = true): Promise<void> {
    const c = this.controls;
    c.normalizeRotations();
    // camera-controls azimuth is measured on the camera offset (opposite to view): theta = -heading.
    const targetAz = -headingRad;
    const az = c.azimuthAngle + wrapAngle(targetAz - c.azimuthAngle);
    const polar = Math.PI / 2 + elevationRad;
    return c.rotateTo(az, polar, animate);
  }

  /** Slow ambient drift used behind the onboarding screen. */
  idleDrift(dt: number): void {
    this.controls.azimuthAngle += dt * 0.025;
  }

  update(dt: number): boolean {
    // Keep drag sensitivity consistent when zoomed in.
    const speed = BASE_ROTATE_SPEED / this.camera.zoom;
    this.controls.azimuthRotateSpeed = speed;
    this.controls.polarRotateSpeed = speed;
    return this.controls.update(dt);
  }

  dispose(): void {
    this.controls.dispose();
  }
}
