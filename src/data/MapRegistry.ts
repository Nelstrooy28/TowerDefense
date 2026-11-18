export type MapId = 'sunny_backyard' | 'enchanted_jungle' | 'volcano_greenhouse';
export type DifficultyId = 'Easy' | 'Normal' | 'Hard' | 'Insane';

export interface DifficultyDef {
  id: DifficultyId;
  waves: number;
  startingCash: number;
  baseHP: number;
  enemyHpMult: number;
  clearRewardSeeds: number;
  badgeColor: string;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  Easy: {
    id: 'Easy',
    waves: 20,
    startingCash: 600,
    baseHP: 150,
    enemyHpMult: 0.85,
    clearRewardSeeds: 150,
    badgeColor: '#4ade80',
  },
  Normal: {
    id: 'Normal',
    waves: 30,
    startingCash: 500,
    baseHP: 125,
    enemyHpMult: 1.15,
    clearRewardSeeds: 400,
    badgeColor: '#38bdf8',
  },
  Hard: {
    id: 'Hard',
    waves: 35,
    startingCash: 450,
    baseHP: 100,
    enemyHpMult: 1.65,
    clearRewardSeeds: 700,
    badgeColor: '#fbbf24',
  },
  Insane: {
    id: 'Insane',
    waves: 40,
    startingCash: 400,
    baseHP: 100,
    enemyHpMult: 2.5,
    clearRewardSeeds: 1200,
    badgeColor: '#f43f5e',
  },
};

export interface CliffZone {
  x: number;
  z: number;
  radius: number;
  height: number;
}

export interface PondDef {
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
}

export interface MapDef {
  id: MapId;
  name: string;
  tierLabel: string;
  description: string;
  skyColor: number;
  groundColor: number;
  trackColor: number;
  trackEdgeColor: number;
  ambientSkyHex: number;
  ambientGroundHex: number;
  trackHalfWidth: number;
  boundsHalfSize: number;
  paths: Array<Array<[number, number]>>;
  cliffs: CliffZone[];
  pond: PondDef;
  hasMeteorHazards: boolean;
  ambientLifeSummary: string;
  signatureMomentSummary: string;
}

export const MAPS: Record<MapId, MapDef> = {
  sunny_backyard: {
    id: 'sunny_backyard',
    name: 'Sunny Backyard',
    tierLabel: 'Beginner',
    description: 'Single winding garden path with picket fences, a wooden deck, sleeping cat, and sprinklers.',
    skyColor: 0x87ceeb,
    groundColor: 0x4ca64c,
    trackColor: 0xd6b88d,
    trackEdgeColor: 0x9c7a4c,
    ambientSkyHex: 0x87ceeb,
    ambientGroundHex: 0x3a6b35,
    trackHalfWidth: 1.35,
    boundsHalfSize: 22,
    paths: [
      [
        [-19, -11],
        [-11, -11],
        [-8, -2],
        [-14, 6],
        [-4, 12],
        [6, 5],
        [2, -6],
        [12, -10],
        [15, 3],
        [19, 10],
      ],
    ],
    cliffs: [
      { x: -1, z: 3, radius: 2.1, height: 1.5 },
      { x: 9, z: -2, radius: 2.0, height: 1.5 },
    ],
    pond: { x: -12, z: 12, radiusX: 3.4, radiusZ: 2.4 },
    hasMeteorHazards: false,
    ambientLifeSummary: 'Butterflies, sleeping cat on deck, sprinkler arcs',
    signatureMomentSummary: 'Wave 10: lawnmower rumbles past behind the picket fence',
  },
  enchanted_jungle: {
    id: 'enchanted_jungle',
    name: 'Enchanted Glowing Jungle',
    tierLabel: 'Intermediate',
    description: 'Two glowing spore trails merge across an ancient stone bridge beneath elevated Cliff Pillars.',
    skyColor: 0x1e2954,
    groundColor: 0x1e4d3b,
    trackColor: 0x5c5368,
    trackEdgeColor: 0x38bdf8,
    ambientSkyHex: 0x67e8f9,
    ambientGroundHex: 0x133326,
    trackHalfWidth: 1.35,
    boundsHalfSize: 23,
    paths: [
      [
        [-20, -12],
        [-11, -10],
        [-5, -4],
        [0, 0],
        [7, 0],
        [14, 4],
        [20, 8],
      ],
      [
        [-20, 12],
        [-11, 10],
        [-5, 4],
        [0, 0],
        [7, 0],
        [14, 4],
        [20, 8],
      ],
    ],
    cliffs: [
      { x: -7, z: 0, radius: 2.2, height: 2.0 },
      { x: 4, z: -6, radius: 2.3, height: 2.2 },
      { x: 4, z: 6, radius: 2.3, height: 2.2 },
    ],
    pond: { x: 11, z: -10, radiusX: 3.8, radiusZ: 2.8 },
    hasMeteorHazards: false,
    ambientLifeSummary: '200 instanced fireflies, music-pulsing mushrooms, glowing pollen',
    signatureMomentSummary: 'Bridge lanterns light up one by one as enemies cross the merge',
  },
  volcano_greenhouse: {
    id: 'volcano_greenhouse',
    name: 'Volcano Greenhouse',
    tierLabel: 'Expert',
    description: 'Short dual parallel tracks inside a cracked obsidian dome with magma channels and meteor strikes.',
    skyColor: 0x3a1816,
    groundColor: 0x2c2529,
    trackColor: 0x573b32,
    trackEdgeColor: 0xf97316,
    ambientSkyHex: 0xfb923c,
    ambientGroundHex: 0x2b120c,
    trackHalfWidth: 1.35,
    boundsHalfSize: 22,
    paths: [
      [
        [-19, -7],
        [-10, -9],
        [-2, -5],
        [7, -8],
        [15, -5],
        [20, -6],
      ],
      [
        [-19, 7],
        [-10, 9],
        [-2, 5],
        [7, 8],
        [15, 5],
        [20, 6],
      ],
    ],
    cliffs: [
      { x: -6, z: 0, radius: 2.2, height: 2.2 },
      { x: 3, z: 0, radius: 2.4, height: 2.4 },
      { x: 12, z: 0, radius: 2.1, height: 2.0 },
    ],
    pond: { x: -13, z: 0, radiusX: 2.8, radiusZ: 2.1 },
    hasMeteorHazards: true,
    ambientLifeSummary: 'Heat haze over magma, ash flakes, glass dome cracks spreading',
    signatureMomentSummary: 'Meteor hazard: 1.5 s red warning ring, falling fireball & crater decal',
  },
};

export const MAP_LIST: MapDef[] = [
  MAPS.sunny_backyard,
  MAPS.enchanted_jungle,
  MAPS.volcano_greenhouse,
];
