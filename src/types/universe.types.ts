// Data contracts (Report §7 & Agent Context §8 & Bugfixes §3).

export type ControlMode =
  | 'UNINITIALIZED'
  | 'MOBILE_SENSOR'
  | 'POINTER_DRAG'
  | 'TARGET_FOCUS'
  | 'CINEMATIC_FINALE';

export type SensorStatus = 'unknown' | 'granted' | 'denied' | 'unsupported' | 'timeout';

export type StarCategory =
  | 'standalone_memory'
  | 'constellation_node'
  | 'nebula_heart'
  | 'finale_anchor';

export interface SphericalPosition {
  azimuthDeg?: number; // 0° to 360° (Heading, clockwise from North)
  elevationDeg?: number; // -90° to +90° (Pitch)
  raHours?: number; // 0 to 24 (Right Ascension in hours)
  decDeg?: number; // -90° to +90° (Declination in degrees)
  radius: number; // Default interactive shell = 200.0
}

export interface MemoryPayload {
  title?: string;
  dateContext?: string;
  narrativeText: string;
  photoUrl?: string;
  photoCaption?: string;
  audioVoiceNoteUrl?: string;
  chimeTone: 'C4' | 'D4' | 'E4' | 'G4' | 'A4' | 'C5' | 'D5' | 'E5' | 'G5' | 'A5';
}

export interface InteractiveStarItem {
  id: string;
  associatedCatalogStar?: string;
  category: StarCategory;
  coordinates: SphericalPosition;
  coreColorHex: string;
  haloColorHex: string;
  sizeMultiplier: number;
  constellationId?: string;
  unveilsFinaleProgress: boolean;
  content: MemoryPayload;
}

// ------------------------------------------------------------------
// Task 3: Dual-Data Celestial Card Contracts (Bugfixes §3.1)
// ------------------------------------------------------------------

export interface AstronomicalData {
  catalogId: string; // e.g. "HIP_27989" or "HR_2061"
  name: string; // "Betelgeuse"
  bayerDesignation?: string; // "α Orionis"
  constellation: string; // "Orion"
  distanceLightYears: number; // 642.5
  apparentMagnitude: number; // 0.45
  spectralType: string; // "M1-2 Ia-ab Red Supergiant"
  colorTemperatureK: number; // 3600
  rightAscension: number; // Hours (e.g. 5.919)
  declination: number; // Degrees (e.g. 7.407)
}

export interface PersonalMemory {
  memoryIndex: number; // e.g. 1..10 (0 for non-counted bonus objects)
  title?: string;
  dateContext?: string; // "October 14, 2023"
  narrativeText: string;
  mediaUrl?: string;
  mediaCaption?: string;
  audioVoiceNoteUrl?: string;
  ambientChimeNote: string; // "E4"
}

export interface UnifiedCelestialObject {
  id: string;
  astronomy: AstronomicalData;
  personalMemory?: PersonalMemory; // Present ONLY on designated stars
}

export interface ConstellationEdge {
  fromStarId: string;
  toStarId: string;
}

export interface ConstellationItem {
  id: string;
  name: string;
  storySnippet: string;
  themeColorHex: string;
  memberStarIds: string[];
  connections: ConstellationEdge[];
}

export interface NebulaRegion {
  id: string;
  coordinates: SphericalPosition;
  quadScale: [number, number];
  tintColorHex: string;
  particleDensity: number;
}

export interface FinaleConfiguration {
  targetCoordinates: SphericalPosition;
  birthdayStarIds: string[];
  constellationEdges: ConstellationEdge[];
  letterContent: {
    title: string;
    salutation: string;
    bodyParagraphs: string[];
    closing: string;
    signature: string;
  };
}

export interface MasterUniverseData {
  requiredStarCountForFinale: number;
  nasaSkyboxTextureUrl?: string;
  interactiveStars: InteractiveStarItem[];
  constellations: ConstellationItem[];
  nebulae: NebulaRegion[];
  finale: FinaleConfiguration;
}
