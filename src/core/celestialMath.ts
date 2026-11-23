import * as THREE from 'three';

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

/** Radius of the interactive star shell (Report §3.1 & Agent Context §2). */
export const SHELL_RADIUS = 200;
/** Radius of the real astronomical catalog stars & IAU constellations (Agent Context §2). */
export const CATALOG_RADIUS = 460;
/** Radius of the deep cosmic NASA skybox sphere (Agent Context §2). */
export const SKYBOX_RADIUS = 950;

/**
 * Converts authorable azimuth / elevation (degrees) to Cartesian coordinates.
 * +X = East, +Y = Zenith, -Z = North (Report §3.1).
 */
export function sphericalToCartesian(
  azimuthDeg: number,
  elevationDeg: number,
  radius: number,
  target: THREE.Vector3 = new THREE.Vector3(),
): THREE.Vector3 {
  const phi = (90 - elevationDeg) * DEG2RAD;
  const theta = azimuthDeg * DEG2RAD;
  return target.set(
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    -radius * Math.sin(phi) * Math.cos(theta),
  );
}

/**
 * Converts astronomical Right Ascension (hours [0, 24)) and Declination (degrees [-90, +90])
 * to Cartesian coordinates (Agent Context §4.1).
 * +X = East, +Y = North Celestial Pole / Zenith, +Z = South.
 */
export function raDecToCartesian(
  raHours: number,
  decDeg: number,
  radius = SHELL_RADIUS,
  target: THREE.Vector3 = new THREE.Vector3(),
): THREE.Vector3 {
  const theta = (raHours / 24) * 2 * Math.PI;
  const decRad = decDeg * DEG2RAD;
  const phi = Math.PI / 2 - decRad;

  return target.set(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(decRad),
    -radius * Math.sin(phi) * Math.sin(theta),
  );
}

/**
 * Converts astronomical Color Index (B - V) to approximate sRGB color (Agent Context §2).
 * Uses Planckian blackbody / Ballesteros formula.
 */
export function bvToRgb(bv: number): [number, number, number] {
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  let x = 0;
  let y = 0;

  if (t >= 1667 && t <= 4000) {
    x =
      (-0.2661239 * 1e9) / Math.pow(t, 3) +
      (-0.234358 * 1e6) / Math.pow(t, 2) +
      (0.8776956 * 1e3) / t +
      0.17991;
  } else if (t > 4000) {
    x =
      (-3.0258469 * 1e9) / Math.pow(t, 3) +
      (2.1070379 * 1e6) / Math.pow(t, 2) +
      (0.2226347 * 1e3) / t +
      0.24039;
  }

  if (t >= 1667 && t <= 2222) {
    y = -1.1063814 * Math.pow(x, 3) - 1.3481102 * Math.pow(x, 2) + 2.18555832 * x - 0.20219683;
  } else if (t > 2222 && t <= 4000) {
    y = -0.9549476 * Math.pow(x, 3) - 1.37418593 * Math.pow(x, 2) + 2.09137015 * x - 0.16748867;
  } else if (t > 4000) {
    y = 3.081758 * Math.pow(x, 3) - 5.8733867 * Math.pow(x, 2) + 3.75112997 * x - 0.37001483;
  }

  const Y = 1.0;
  const X = y === 0 ? 0 : (x * Y) / y;
  const Z = y === 0 ? 0 : ((1 - x - y) * Y) / y;

  const r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  const g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  const b = 0.0557 * X - 0.204 * Y + 1.057 * Z;

  const R = r <= 0.0031308 ? 12.92 * r : 1.055 * Math.pow(r, 1 / 2.4) - 0.055;
  const G = g <= 0.0031308 ? 12.92 * g : 1.055 * Math.pow(g, 1 / 2.4) - 0.055;
  const B = b <= 0.0031308 ? 12.92 * b : 1.055 * Math.pow(b, 1 / 2.4) - 0.055;

  return [
    Math.min(1, Math.max(0, R)),
    Math.min(1, Math.max(0, G)),
    Math.min(1, Math.max(0, B)),
  ];
}

/** Heading (radians, clockwise from North / -Z toward East / +X) of a direction. */
export function headingOf(direction: THREE.Vector3): number {
  return Math.atan2(direction.x, -direction.z);
}

/** Wraps an angle to (-π, π]. */
export function wrapAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  let a = ((angle + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
  if (a === -Math.PI) a = Math.PI;
  return a;
}

export function isLikelyMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return (coarse && 'DeviceOrientationEvent' in window) || uaMobile || iPadOS;
}
