import { create } from 'zustand';
import type {
  ControlMode,
  SensorStatus,
  UnifiedCelestialObject,
} from '../types/universe.types';
import type { CelestialUniverse } from '../core/CelestialUniverse';
import { isLikelyMobileDevice } from '../core/celestialMath';
import { universeData } from '../data/universeData';
import { registeredMemoryStarIds } from '../data/astronomyCatalog';

const FAILURE_STATUSES: SensorStatus[] = ['denied', 'unsupported', 'timeout'];
const DISCOVERED_STARS_KEY = 'my_universe_discovered_stars';
const COMPLETED_CONSTELLATIONS_KEY = 'my_universe_completed_constellations';

function clearSavedProgress(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DISCOVERED_STARS_KEY);
    localStorage.removeItem(COMPLETED_CONSTELLATIONS_KEY);
  } catch {
    // Ignore restricted storage errors
  }
}

/**
 * Reactive bridge between the imperative WebGL engine and the React overlay
 * (Report §1 & Bugfixes Task 1: Discovery Counter deduplication & sanitization).
 */
interface UniverseState {
  engine: CelestialUniverse | null;
  isMobileDevice: boolean;
  hasEntered: boolean;
  controlMode: ControlMode;
  sensorStatus: SensorStatus;
  sensorFailureCount: number;
  sensorFailureDismissed: number;
  gridVisible: boolean;
  iauConstellationsVisible: boolean;
  isAssetsReady: boolean;
  isAudioMuted: boolean;

  // Task 1: Strict Discovery Progress & Registry
  registeredMemoryStarIds: string[];
  discoveredStarIds: string[];
  isFinaleUnlocked: boolean;

  // Task 3: Dual-Data Celestial Object for Targeting & Modals
  reticleLockedStar: UnifiedCelestialObject | null;
  selectedStar: UnifiedCelestialObject | null;

  // Constellation Progress
  completedConstellationIds: string[];

  setEngine: (engine: CelestialUniverse | null) => void;
  setAssetsReady: (ready: boolean) => void;
  setEntered: () => void;
  setControlMode: (mode: ControlMode) => void;
  setSensorStatus: (status: SensorStatus) => void;
  dismissSensorFailure: () => void;
  toggleGrid: () => void;
  toggleIauConstellations: () => void;
  toggleAudioMute: () => void;

  setReticleLockedStar: (star: UnifiedCelestialObject | null) => void;
  openStarModal: (star: UnifiedCelestialObject) => void;
  closeStarModal: () => void;
  recordStarDiscovery: (starId: string) => { isNewDiscovery: boolean; currentCount: number; totalCount: number };
}

// Always reset discovery progress to 0 on every fresh visit
clearSavedProgress();

export const useUniverseStore = create<UniverseState>((set, get) => ({
  engine: null,
  isMobileDevice: isLikelyMobileDevice(),
  hasEntered: false,
  controlMode: 'UNINITIALIZED',
  sensorStatus: 'unknown',
  sensorFailureCount: 0,
  sensorFailureDismissed: 0,
  gridVisible: false,
  iauConstellationsVisible: true,
  isAssetsReady: false,
  isAudioMuted: false,

  registeredMemoryStarIds,
  discoveredStarIds: [],
  isFinaleUnlocked: false,

  reticleLockedStar: null,
  selectedStar: null,
  completedConstellationIds: [],

  setEngine: (engine) => {
    if (engine) {
      engine.setGridVisible(get().gridVisible);
      engine.setIauConstellationsVisible(get().iauConstellationsVisible);
      engine.audio.setMuted(get().isAudioMuted);
      // Restore discovered stars into the GLSL instanced attribute
      get().discoveredStarIds.forEach((id) =>
        engine.interactiveStars.setDiscovered(id, true, true),
      );
      // Restore completed constellations into the constellation line shaders
      get().completedConstellationIds.forEach((id) =>
        engine.constellations.setConstellationCompleted(id, true, true),
      );
    }
    set({ engine });
  },
  setAssetsReady: (isAssetsReady) => set({ isAssetsReady }),
  setEntered: () => set({ hasEntered: true }),
  setControlMode: (controlMode) => set({ controlMode }),
  setSensorStatus: (sensorStatus) =>
    set((s) => ({
      sensorStatus,
      sensorFailureCount: FAILURE_STATUSES.includes(sensorStatus)
        ? s.sensorFailureCount + 1
        : s.sensorFailureCount,
    })),
  dismissSensorFailure: () => set((s) => ({ sensorFailureDismissed: s.sensorFailureCount })),
  toggleGrid: () => {
    const gridVisible = !get().gridVisible;
    get().engine?.setGridVisible(gridVisible);
    set({ gridVisible });
  },
  toggleIauConstellations: () => {
    const iauConstellationsVisible = !get().iauConstellationsVisible;
    get().engine?.setIauConstellationsVisible(iauConstellationsVisible);
    set({ iauConstellationsVisible });
  },
  toggleAudioMute: () => {
    const isAudioMuted = !get().isAudioMuted;
    get().engine?.audio.setMuted(isAudioMuted);
    set({ isAudioMuted });
  },

  setReticleLockedStar: (star) => set({ reticleLockedStar: star }),

  openStarModal: (star) => {
    // Play common celestial success chime when opening a star's hidden message
    if (star.personalMemory) {
      get().engine?.audio.playSuccessChime();
    }
    // If star is a designated personal memory star, record discovery
    if (get().registeredMemoryStarIds.includes(star.id)) {
      get().recordStarDiscovery(star.id);
    }
    set({ selectedStar: star });
  },

  closeStarModal: () => {
    get().engine?.releaseFocus();
    set({ selectedStar: null });
  },

  recordStarDiscovery: (starId: string) => {
    const { discoveredStarIds, registeredMemoryStarIds: memoryIds } = get();

    // Guard: ignore if not a registered personal memory star (Bugfixes §1.2)
    if (!memoryIds.includes(starId)) {
      return {
        isNewDiscovery: false,
        currentCount: discoveredStarIds.length,
        totalCount: memoryIds.length,
      };
    }

    const discoveredSet = new Set(discoveredStarIds);
    const isNew = !discoveredSet.has(starId);

    if (isNew) {
      discoveredSet.add(starId);
      const nextDiscovered = Array.from(discoveredSet);
      get().engine?.interactiveStars.setDiscovered(starId, true);

      // Check for completed story constellations (illuminate lines in sky)
      const currentCompleted = get().completedConstellationIds;
      let constellationUpdated = false;
      const nextCompleted = [...currentCompleted];

      for (const c of universeData.constellations) {
        if (nextCompleted.includes(c.id)) continue;
        const allFound = c.memberStarIds.every((id) => nextDiscovered.includes(id));
        if (allFound) {
          nextCompleted.push(c.id);
          constellationUpdated = true;
          get().engine?.constellations.setConstellationCompleted(c.id, true);
        }
      }

      const unlocked = nextDiscovered.length >= memoryIds.length;

      if (constellationUpdated) {
        set({
          discoveredStarIds: nextDiscovered,
          completedConstellationIds: nextCompleted,
          isFinaleUnlocked: unlocked,
        });
      } else {
        set({
          discoveredStarIds: nextDiscovered,
          isFinaleUnlocked: unlocked,
        });
      }

      return {
        isNewDiscovery: true,
        currentCount: nextDiscovered.length,
        totalCount: memoryIds.length,
      };
    }

    return {
      isNewDiscovery: false,
      currentCount: discoveredStarIds.length,
      totalCount: memoryIds.length,
    };
  },
}));
