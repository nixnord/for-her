import * as THREE from 'three';
import rawData from './universeData.json';
import type { InteractiveStarItem, MasterUniverseData } from '../types/universe.types';
import { raDecToCartesian, sphericalToCartesian, SHELL_RADIUS } from '../core/celestialMath';

export const universeData = rawData as MasterUniverseData;

/** Interactive star with its pre-computed world position. */
export interface ResolvedStar {
  item: InteractiveStarItem;
  position: THREE.Vector3;
  /** Unit direction from the observer (origin) to the star. */
  direction: THREE.Vector3;
}

export function resolveStars(data: MasterUniverseData): ResolvedStar[] {
  const seen = new Set<string>();
  return data.interactiveStars.map((item) => {
    if (seen.has(item.id)) console.warn(`[universeData] duplicate star id "${item.id}"`);
    seen.add(item.id);
    const coords = item.coordinates;
    const r = coords.radius || SHELL_RADIUS;

    let position: THREE.Vector3;
    if (coords.raHours != null && coords.decDeg != null) {
      position = raDecToCartesian(coords.raHours, coords.decDeg, r);
    } else {
      position = sphericalToCartesian(coords.azimuthDeg ?? 0, coords.elevationDeg ?? 0, r);
    }

    return { item, position, direction: position.clone().normalize() };
  });
}
