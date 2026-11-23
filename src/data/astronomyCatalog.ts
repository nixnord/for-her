import * as THREE from 'three';
import type {
  AstronomicalData,
  PersonalMemory,
  UnifiedCelestialObject,
} from '../types/universe.types';
import catalogData from './realCatalogData.json';
import { universeData } from './universeData';
import { CATALOG_RADIUS, raDecToCartesian } from '../core/celestialMath';

export const CONSTELLATION_NAMES: Record<string, string> = {
  And: 'Andromeda',
  Ant: 'Antlia',
  Aps: 'Apus',
  Aql: 'Aquila',
  Aqr: 'Aquarius',
  Ara: 'Ara',
  Ari: 'Aries',
  Aur: 'Auriga',
  Boo: 'Boötes',
  CMa: 'Canis Major',
  CMi: 'Canis Minor',
  CVn: 'Canes Venatici',
  Cas: 'Cassiopeia',
  Cen: 'Centaurus',
  Cep: 'Cepheus',
  Cet: 'Cetus',
  Cha: 'Chamaeleon',
  Cir: 'Circinus',
  Col: 'Columba',
  Com: 'Coma Berenices',
  CrA: 'Corona Australis',
  CrB: 'Corona Borealis',
  Crv: 'Corvus',
  Crt: 'Crater',
  Cru: 'Crux',
  Cyg: 'Cygnus',
  Del: 'Delphinus',
  Dor: 'Dorado',
  Dra: 'Draco',
  Equ: 'Equuleus',
  Eri: 'Eridanus',
  For: 'Fornax',
  Gem: 'Gemini',
  Gru: 'Grus',
  Her: 'Hercules',
  Hor: 'Horologium',
  Hya: 'Hydra',
  Hyi: 'Hydrus',
  Ind: 'Indus',
  Lac: 'Lacerta',
  Leo: 'Leo',
  Lep: 'Lepus',
  Lib: 'Libra',
  Lup: 'Lupus',
  Lyn: 'Lynx',
  Lyr: 'Lyra',
  Men: 'Mensa',
  Mic: 'Microscopium',
  Mon: 'Monoceros',
  Mus: 'Musca',
  Nor: 'Norma',
  Oct: 'Octans',
  Oph: 'Ophiuchus',
  Ori: 'Orion',
  Pav: 'Pavo',
  Peg: 'Pegasus',
  Per: 'Perseus',
  Phe: 'Phoenix',
  Pic: 'Pictor',
  Psc: 'Pisces',
  PsA: 'Piscis Austrinus',
  Pup: 'Puppis',
  Pyx: 'Pyxis',
  Ret: 'Reticulum',
  Sge: 'Sagitta',
  Sgr: 'Sagittarius',
  Sco: 'Scorpius',
  Scl: 'Sculptor',
  Sct: 'Scutum',
  Ser: 'Serpens',
  Sex: 'Sextans',
  Tau: 'Taurus',
  Tel: 'Telescopium',
  Tri: 'Triangulum',
  TrA: 'Triangulum Australe',
  Tuc: 'Tucana',
  UMa: 'Ursa Major',
  UMi: 'Ursa Minor',
  Vel: 'Vela',
  Vir: 'Virgo',
  Vol: 'Volans',
  Vul: 'Vulpecula',
};

export const NAMED_STAR_ASTRONOMY: Record<string, { constellation: string; bayer: string }> = {
  Alpheratz: { constellation: 'Andromeda', bayer: 'α Andromedae' },
  Caph: { constellation: 'Cassiopeia', bayer: 'β Cassiopeiae' },
  Algenib: { constellation: 'Pegasus', bayer: 'γ Pegasi' },
  Ankaa: { constellation: 'Phoenix', bayer: 'α Phoenicis' },
  Shedir: { constellation: 'Cassiopeia', bayer: 'α Cassiopeiae' },
  Diphda: { constellation: 'Cetus', bayer: 'β Ceti' },
  '96 G. Psc': { constellation: 'Pisces', bayer: '96 G. Piscium' },
  Cih: { constellation: 'Cassiopeia', bayer: 'γ Cassiopeiae' },
  Mirach: { constellation: 'Andromeda', bayer: 'β Andromedae' },
  Ruchbah: { constellation: 'Cassiopeia', bayer: 'δ Cassiopeiae' },
  Achernar: { constellation: 'Eridanus', bayer: 'α Eridani' },
  Sheratan: { constellation: 'Aries', bayer: 'β Arietis' },
  Almaak: { constellation: 'Andromeda', bayer: 'γ Andromedae' },
  Hamal: { constellation: 'Aries', bayer: 'α Arietis' },
  Mira: { constellation: 'Cetus', bayer: 'ο Ceti' },
  Polaris: { constellation: 'Ursa Minor', bayer: 'α Ursae Minoris' },
  '268 G. Cet': { constellation: 'Cetus', bayer: '268 G. Ceti' },
  Acamar: { constellation: 'Eridanus', bayer: 'θ Eridani' },
  Menkar: { constellation: 'Cetus', bayer: 'α Ceti' },
  Algol: { constellation: 'Perseus', bayer: 'β Persei' },
  '82 G. Eri': { constellation: 'Eridanus', bayer: '82 G. Eridani' },
  Mirphak: { constellation: 'Perseus', bayer: 'α Persei' },
  Alcyone: { constellation: 'Taurus', bayer: 'η Tauri' },
  Zaurak: { constellation: 'Eridanus', bayer: 'γ Eridani' },
  Aldebaran: { constellation: 'Taurus', bayer: 'α Tauri' },
  Hassaleh: { constellation: 'Auriga', bayer: 'ι Aurigae' },
  Cursa: { constellation: 'Eridanus', bayer: 'β Eridani' },
  Rigel: { constellation: 'Orion', bayer: 'β Orionis' },
  Capella: { constellation: 'Auriga', bayer: 'α Aurigae' },
  Bellatrix: { constellation: 'Orion', bayer: 'γ Orionis' },
  Alnath: { constellation: 'Taurus', bayer: 'β Tauri' },
  Nihal: { constellation: 'Lepus', bayer: 'β Leporis' },
  Mintaka: { constellation: 'Orion', bayer: 'δ Orionis' },
  Arneb: { constellation: 'Lepus', bayer: 'α Leporis' },
  Hatsya: { constellation: 'Orion', bayer: 'ι Orionis' },
  Alnilam: { constellation: 'Orion', bayer: 'ε Orionis' },
  Phakt: { constellation: 'Columba', bayer: 'α Columbae' },
  Alnitak: { constellation: 'Orion', bayer: 'ζ Orionis' },
  Saiph: { constellation: 'Orion', bayer: 'κ Orionis' },
  Betelgeuse: { constellation: 'Orion', bayer: 'α Orionis' },
  Menkalinan: { constellation: 'Auriga', bayer: 'β Aurigae' },
  Mirzam: { constellation: 'Canis Major', bayer: 'β Canis Majoris' },
  Canopus: { constellation: 'Carina', bayer: 'α Carinae' },
  Alhena: { constellation: 'Gemini', bayer: 'γ Geminorum' },
  Sirius: { constellation: 'Canis Major', bayer: 'α Canis Majoris' },
  Adhara: { constellation: 'Canis Major', bayer: 'ε Canis Majoris' },
  Wezen: { constellation: 'Canis Major', bayer: 'δ Canis Majoris' },
  Aludra: { constellation: 'Canis Major', bayer: 'η Canis Majoris' },
  Gomeisa: { constellation: 'Canis Minor', bayer: 'β Canis Minoris' },
  Castor: { constellation: 'Gemini', bayer: 'α Geminorum' },
  Procyon: { constellation: 'Canis Minor', bayer: 'α Canis Minoris' },
  Pollux: { constellation: 'Gemini', bayer: 'β Geminorum' },
  Naos: { constellation: 'Puppis', bayer: 'ζ Puppis' },
  Avior: { constellation: 'Carina', bayer: 'ε Carinae' },
  Miaplacidus: { constellation: 'Carina', bayer: 'β Carinae' },
  Tureis: { constellation: 'Carina', bayer: 'ι Carinae' },
  Alphard: { constellation: 'Hydra', bayer: 'α Hydrae' },
  'Ras Elased Australis': { constellation: 'Leo', bayer: 'ε Leonis' },
  Regulus: { constellation: 'Leo', bayer: 'α Leonis' },
  Algieba: { constellation: 'Leo', bayer: 'γ Leonis' },
  Merak: { constellation: 'Ursa Major', bayer: 'β Ursae Majoris' },
  Dubhe: { constellation: 'Ursa Major', bayer: 'α Ursae Majoris' },
  Zosma: { constellation: 'Leo', bayer: 'δ Leonis' },
  Denebola: { constellation: 'Leo', bayer: 'β Leonis' },
  'Groombridge 1830': { constellation: 'Ursa Major', bayer: 'HR 4550' },
  Phad: { constellation: 'Ursa Major', bayer: 'γ Ursae Majoris' },
  Megrez: { constellation: 'Ursa Major', bayer: 'δ Ursae Majoris' },
  'Gienah Ghurab': { constellation: 'Corvus', bayer: 'γ Corvi' },
  Acrux: { constellation: 'Crux', bayer: 'α Crucis' },
  Algorab: { constellation: 'Corvus', bayer: 'δ Corvi' },
  Gacrux: { constellation: 'Crux', bayer: 'γ Crucis' },
  Kraz: { constellation: 'Corvus', bayer: 'β Corvi' },
  Porrima: { constellation: 'Virgo', bayer: 'γ Virginis' },
  Becrux: { constellation: 'Crux', bayer: 'β Crucis' },
  Alioth: { constellation: 'Ursa Major', bayer: 'ε Ursae Majoris' },
  'Cor Caroli': { constellation: 'Canes Venatici', bayer: 'α Canum Venaticorum' },
  Vindemiatrix: { constellation: 'Virgo', bayer: 'ε Virginis' },
  Mizar: { constellation: 'Ursa Major', bayer: 'ζ Ursae Majoris' },
  Spica: { constellation: 'Virgo', bayer: 'α Virginis' },
  Alcor: { constellation: 'Ursa Major', bayer: '80 Ursae Majoris' },
  Alkaid: { constellation: 'Ursa Major', bayer: 'η Ursae Majoris' },
  Mufrid: { constellation: 'Boötes', bayer: 'η Boötis' },
  Hadar: { constellation: 'Centaurus', bayer: 'β Centauri' },
  Thuban: { constellation: 'Draco', bayer: 'α Draconis' },
  Menkent: { constellation: 'Centaurus', bayer: 'θ Centauri' },
  Arcturus: { constellation: 'Boötes', bayer: 'α Boötis' },
  'Rigil Kentaurus': { constellation: 'Centaurus', bayer: 'α Centauri' },
  Izar: { constellation: 'Boötes', bayer: 'ε Boötis' },
  Kochab: { constellation: 'Ursa Minor', bayer: 'β Ursae Minoris' },
  Zubenelgenubi: { constellation: 'Libra', bayer: 'α Librae' },
  Zubeneschemali: { constellation: 'Libra', bayer: 'β Librae' },
  Alphekka: { constellation: 'Corona Borealis', bayer: 'α Coronae Borealis' },
  Unukalhai: { constellation: 'Serpens', bayer: 'α Serpentis' },
  Dschubba: { constellation: 'Scorpius', bayer: 'δ Scorpii' },
  Graffias: { constellation: 'Scorpius', bayer: 'β Scorpii' },
  Antares: { constellation: 'Scorpius', bayer: 'α Scorpii' },
  Kornephoros: { constellation: 'Hercules', bayer: 'β Herculis' },
  Atria: { constellation: 'Triangulum Australe', bayer: 'α Trianguli Australis' },
  Rasalgethi: { constellation: 'Hercules', bayer: 'α Herculis' },
  Rastaban: { constellation: 'Draco', bayer: 'β Draconis' },
  Shaula: { constellation: 'Scorpius', bayer: 'λ Scorpii' },
  Rasalhague: { constellation: 'Ophiuchus', bayer: 'α Ophiuchi' },
  Sargas: { constellation: 'Scorpius', bayer: 'θ Scorpii' },
  Cebalrai: { constellation: 'Ophiuchus', bayer: 'β Ophiuchi' },
  Etamin: { constellation: 'Draco', bayer: 'γ Draconis' },
  Nash: { constellation: 'Sagittarius', bayer: 'γ² Sagittarii' },
  'Kaus Meridionalis': { constellation: 'Sagittarius', bayer: 'δ Sagittarii' },
  'Kaus Australis': { constellation: 'Sagittarius', bayer: 'ε Sagittarii' },
  'Kaus Borealis': { constellation: 'Sagittarius', bayer: 'λ Sagittarii' },
  Vega: { constellation: 'Lyra', bayer: 'α Lyrae' },
  Sheliak: { constellation: 'Lyra', bayer: 'β Lyrae' },
  Nunki: { constellation: 'Sagittarius', bayer: 'σ Sagittarii' },
  Albaldah: { constellation: 'Sagittarius', bayer: 'π Sagittarii' },
  Albireo: { constellation: 'Cygnus', bayer: 'β Cygni' },
  Tarazed: { constellation: 'Aquila', bayer: 'γ Aquilae' },
  Altair: { constellation: 'Aquila', bayer: 'α Aquilae' },
  Alshain: { constellation: 'Aquila', bayer: 'β Aquilae' },
  Sadr: { constellation: 'Cygnus', bayer: 'γ Cygni' },
  Peacock: { constellation: 'Pavo', bayer: 'α Pavonis' },
  Deneb: { constellation: 'Cygnus', bayer: 'α Cygni' },
  Gienah: { constellation: 'Cygnus', bayer: 'ε Cygni' },
  Alderamin: { constellation: 'Cepheus', bayer: 'α Cephei' },
  Sadalsuud: { constellation: 'Aquarius', bayer: 'β Aquarii' },
  Enif: { constellation: 'Pegasus', bayer: 'ε Pegasi' },
  Sadalmelik: { constellation: 'Aquarius', bayer: 'α Aquarii' },
  Alnair: { constellation: 'Grus', bayer: 'α Gruis' },
  Matar: { constellation: 'Pegasus', bayer: 'η Pegasi' },
  Fomalhaut: { constellation: 'Piscis Austrinus', bayer: 'α Piscis Austrini' },
  Scheat: { constellation: 'Pegasus', bayer: 'β Pegasi' },
  Markab: { constellation: 'Pegasus', bayer: 'α Pegasi' },
  'p Eridani': { constellation: 'Eridanus', bayer: 'p Eridani' },
  'Galactic Center': { constellation: 'Sagittarius', bayer: 'Milky Way Core' },
};

// Known astronomical distances in light-years
const KNOWN_DISTANCES: Record<string, number> = {
  'Galactic Center': 26670,
  Vega: 25.04,
  Sirius: 8.6,
  Betelgeuse: 642.5,
  Rigel: 864.3,
  Polaris: 433.8,
  Deneb: 2615.0,
  Altair: 16.73,
  Alcyone: 444.0,
  Arcturus: 36.7,
  Antares: 550.0,
  Alnilam: 1975.0,
  Spica: 250.0,
  Aldebaran: 65.3,
  Canopus: 310.0,
  Pollux: 33.78,
  Castor: 51.6,
  Fomalhaut: 25.13,
  Regulus: 79.3,
  Bellatrix: 252.5,
  Saiph: 650.0,
  Capella: 42.9,
  Mizar: 82.9,
  Achernar: 139.0,
  Hadar: 390.0,
  'Rigil Kentaurus': 4.37,
  Acrux: 320.0,
  Becrux: 280.0,
  Alkaid: 103.9,
  Alioth: 82.6,
  Dubhe: 123.0,
  Merak: 79.7,
  Phad: 83.2,
  Megrez: 80.5,
  Alnitak: 1260.0,
  Mintaka: 1200.0,
  Adhara: 430.0,
  Wezen: 1600.0,
  Alhena: 109.0,
  Procyon: 11.46,
};

function deriveSpectralType(ci: number): { spectralType: string; colorTemperatureK: number } {
  const t = Math.round(4600 * (1 / (0.92 * ci + 1.7) + 1 / (0.92 * ci + 0.62)));
  let spectral = 'A0V White Main-Sequence';
  if (ci < -0.15) spectral = 'O9 Blue Supergiant';
  else if (ci < 0.0) spectral = 'B2-B5 Blue Giant';
  else if (ci < 0.25) spectral = 'A0-A5 Pure White';
  else if (ci < 0.55) spectral = 'F2-F8 Yellow-White';
  else if (ci < 0.85) spectral = 'G2V Solar Yellow';
  else if (ci < 1.35) spectral = 'K1-K3 Golden Giant';
  else spectral = 'M1-M3 Red Supergiant';

  return { spectralType: spectral, colorTemperatureK: Math.max(2800, Math.min(32000, t)) };
}

function deriveDistance(name: string, mag: number, ci: number): number {
  if (name && KNOWN_DISTANCES[name]) return KNOWN_DISTANCES[name];
  const absMag = 1.2 + ci * 3.8;
  const distParsecs = Math.pow(10, (mag - absMag + 5) / 5);
  const ly = Math.round(distParsecs * 3.26156);
  return Math.max(12, Math.min(9500, isNaN(ly) ? 140 : ly));
}

// ------------------------------------------------------------------
// Real Catalog Pre-indexing for High-Performance Raycasting
// ------------------------------------------------------------------
export interface CatalogStarResolved {
  id: string;
  hr: number;
  name: string;
  raHours: number;
  decDeg: number;
  mag: number;
  ci: number;
  position: THREE.Vector3;
  direction: THREE.Vector3;
}

const rawStars = catalogData.stars as [number, number, number, number, number, string][];
const catalogByHr = new Map<number, (typeof rawStars)[0]>();
const catalogByName = new Map<string, (typeof rawStars)[0]>();

export const prominentCatalogStars: CatalogStarResolved[] = [];
export const allCatalogStars: CatalogStarResolved[] = [];

rawStars.forEach((star) => {
  const [ra, dec, mag, ci, hr, proper] = star;
  catalogByHr.set(hr, star);
  if (proper) catalogByName.set(proper.toLowerCase(), star);

  const pos = raDecToCartesian(ra, dec, CATALOG_RADIUS);
  const dir = pos.clone().normalize();
  const resolvedItem: CatalogStarResolved = {
    id: `HR_${hr}`,
    hr,
    name: proper || '',
    raHours: ra,
    decDeg: dec,
    mag,
    ci,
    position: pos,
    direction: dir,
  };

  allCatalogStars.push(resolvedItem);
  if (proper || mag < 3.2) {
    prominentCatalogStars.push(resolvedItem);
  }
});

// Personal memory registry
export const personalMemoryStars = universeData.interactiveStars.filter(
  (s) => s.category !== 'finale_anchor' && s.unveilsFinaleProgress !== false,
);

export const registeredMemoryStarIds: string[] = personalMemoryStars.map((s) => s.id);

/**
 * Creates a UnifiedCelestialObject combining authentic astronomical telemetry
 * with optional personal memory payload (Task 3).
 */
export function createUnifiedCelestialObject(
  starId: string,
  catalogOverride?: {
    raHours: number;
    decDeg: number;
    mag?: number;
    ci?: number;
    name?: string;
    constellation?: string;
  },
): UnifiedCelestialObject {
  // 1. Check if this is a personal memory star
  const personalItem = universeData.interactiveStars.find((s) => s.id === starId);

  let name = personalItem?.associatedCatalogStar || '';
  let ra = personalItem?.coordinates.raHours ?? 0;
  let dec = personalItem?.coordinates.decDeg ?? 0;
  let mag = 1.5;
  let ci = 0.4;
  let constellation = 'Milky Way';
  let bayerDesignation: string | undefined;
  let hrId = 0;

  // Search in catalog by associated name or HR
  const cleanName = name.replace(/\s*\(.*?\)\s*/g, '').trim();
  let foundCatalogStar: (typeof rawStars)[0] | undefined;
  if (name) {
    foundCatalogStar =
      catalogByName.get(name.toLowerCase()) ||
      catalogByName.get(cleanName.toLowerCase());
  } else if (starId.startsWith('HR_')) {
    const hrNum = parseInt(starId.replace('HR_', ''), 10);
    foundCatalogStar = catalogByHr.get(hrNum);
  }

  if (catalogOverride) {
    ra = catalogOverride.raHours;
    dec = catalogOverride.decDeg;
    if (catalogOverride.mag != null) mag = catalogOverride.mag;
    if (catalogOverride.ci != null) ci = catalogOverride.ci;
    if (catalogOverride.name) name = catalogOverride.name;
    if (catalogOverride.constellation) constellation = catalogOverride.constellation;
  } else if (foundCatalogStar) {
    const [cRa, cDec, cMag, cCi, cHr, cProper] = foundCatalogStar;
    ra = cRa;
    dec = cDec;
    mag = cMag;
    ci = cCi;
    hrId = cHr;
    name = cProper || name;
  }

  // Derive Bayer and Constellation from authentic registry
  const matchMeta = NAMED_STAR_ASTRONOMY[name] || NAMED_STAR_ASTRONOMY[cleanName];
  if (matchMeta) {
    constellation = matchMeta.constellation;
    bayerDesignation = matchMeta.bayer;
  } else if (!name && hrId > 0) {
    name = `HR ${hrId}`;
  }

  const { spectralType, colorTemperatureK } = deriveSpectralType(ci);
  const distanceLightYears = deriveDistance(name, mag, ci);

  const astronomy: AstronomicalData = {
    catalogId: hrId > 0 ? `HR_${hrId}` : `CAT_${starId.replace(/-/g, '_')}`,
    name: name || `Star ${starId}`,
    bayerDesignation,
    constellation,
    distanceLightYears,
    apparentMagnitude: Number(mag.toFixed(2)),
    spectralType,
    colorTemperatureK,
    rightAscension: Number(ra.toFixed(3)),
    declination: Number(dec.toFixed(3)),
  };

  // Build personal message section if designated
  let personalMemory: PersonalMemory | undefined;
  if (
    personalItem &&
    personalItem.content &&
    (personalItem.content.narrativeText || personalItem.content.title)
  ) {
    const foundIdx = personalMemoryStars.findIndex((s) => s.id === personalItem.id);
    const memoryIdx = foundIdx >= 0 ? foundIdx + 1 : 0;
    personalMemory = {
      memoryIndex: memoryIdx,
      title: personalItem.content.title,
      dateContext: personalItem.content.dateContext,
      narrativeText: personalItem.content.narrativeText,
      mediaUrl: personalItem.content.photoUrl,
      mediaCaption: personalItem.content.photoCaption,
      audioVoiceNoteUrl: personalItem.content.audioVoiceNoteUrl,
      ambientChimeNote: personalItem.content.chimeTone,
    };
  }

  return {
    id: starId,
    astronomy,
    personalMemory,
  };
}

/**
 * Searches prominent catalog stars to find if the forward camera cone locks onto one.
 */
export function findCatalogStarInDirection(
  forwardVec: THREE.Vector3,
  coneCosThreshold = Math.cos((2.4 * Math.PI) / 180),
): { star: CatalogStarResolved; unified: UnifiedCelestialObject } | null {
  let bestDot = -1;
  let bestStar: CatalogStarResolved | null = null;

  for (let i = 0; i < prominentCatalogStars.length; i++) {
    const s = prominentCatalogStars[i];
    const dot = forwardVec.dot(s.direction);
    if (dot > bestDot) {
      bestDot = dot;
      bestStar = s;
    }
  }

  if (bestStar && bestDot >= coneCosThreshold) {
    return {
      star: bestStar,
      unified: createUnifiedCelestialObject(`HR_${bestStar.hr}`, {
        raHours: bestStar.raHours,
        decDeg: bestStar.decDeg,
        mag: bestStar.mag,
        ci: bestStar.ci,
        name: bestStar.name,
      }),
    };
  }

  return null;
}

/**
 * Finds the closest catalog star along a raycaster ray (Desktop mouse hover / tap).
 */
export function findCatalogStarByRay(
  ray: THREE.Ray,
  maxDistance = 24.0,
): { star: CatalogStarResolved; unified: UnifiedCelestialObject } | null {
  let closestDist = Infinity;
  let closestStar: CatalogStarResolved | null = null;

  // 1. Test prominent/named stars first
  for (let i = 0; i < prominentCatalogStars.length; i++) {
    const s = prominentCatalogStars[i];
    const dist = ray.distanceToPoint(s.position);
    if (dist <= maxDistance && dist < closestDist) {
      closestDist = dist;
      closestStar = s;
    }
  }

  if (closestStar) {
    return {
      star: closestStar,
      unified: createUnifiedCelestialObject(`HR_${closestStar.hr}`, {
        raHours: closestStar.raHours,
        decDeg: closestStar.decDeg,
        mag: closestStar.mag,
        ci: closestStar.ci,
        name: closestStar.name,
      }),
    };
  }

  return null;
}
