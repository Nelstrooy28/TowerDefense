import type { EnemyTypeId } from './EnemyRegistry';
import {
  DIFFICULTY_LADDER,
  DIFFICULTY_ORDER,
  type DifficultyId,
  type DifficultyBalanceDef,
} from './BalanceConfig';

export type MapId =
  | 'sunny_backyard'
  | 'enchanted_jungle'
  | 'volcano_greenhouse'
  | 'frosty_allotment'
  | 'zen_garden'
  | 'pond_isle';

export { DIFFICULTY_ORDER };
export type { DifficultyId };
export type DifficultyDef = DifficultyBalanceDef;
export const DIFFICULTIES: Record<DifficultyId, DifficultyBalanceDef> = DIFFICULTY_LADDER;

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
  frozen?: boolean;
}

export type PathVisualStyle =
  | 'stepping_stones'
  | 'mossy_slabs'
  | 'iron_grates'
  | 'snowy_track'
  | 'wood_walkway'
  | 'wooden_docks';

export type LandmarkStyle =
  | 'red_shed'
  | 'giant_mushroom_tree'
  | 'glass_volcano_dome'
  | 'snowman_greenhouse'
  | 'red_pagoda'
  | 'willow_tree';

export type SpawnMarkerStyle =
  | 'molehill'
  | 'hollow_log'
  | 'lava_crack'
  | 'snowdrift'
  | 'torii_gate'
  | 'whirlpool';

export type BaseStructureStyle =
  | 'vegetable_patch'
  | 'seed_shrine'
  | 'seed_vault'
  | 'root_cellar'
  | 'bonsai_altar'
  | 'lotus_sanctuary';

export type PropKind =
  | 'boulder'
  | 'bush'
  | 'flower_bed'
  | 'fence'
  | 'tree'
  | 'glow_mushroom'
  | 'vine_arch'
  | 'lantern'
  | 'bamboo'
  | 'snow_pile'
  | 'obsidian_shard'
  | 'lily_pad'
  | 'reeds'
  | 'wheelbarrow'
  | 'bench'
  | 'garden_bed';

export interface MapHeightZone {
  shape: 'ellipse' | 'rect';
  x: number;
  z: number;
  rx: number;
  rz: number;
  height: number;
  style: 'raised_bed' | 'pond' | 'stone_terrace' | 'lava_pool' | 'moss_mound' | 'sand_court';
}

export interface MapCluster {
  at: [number, number];
  kit: PropKind[];
  count: number;
  seedOffset?: number;
}

export interface MapLayout {
  size: { w: number; d: number };
  palette: {
    grass: number;
    grassDark: number;
    path: number;
    soil: number;
    accent: number;
    sky: number;
    water: number;
  };
  timeOfDay: 'morning' | 'dusk' | 'night' | 'noon' | 'sunset' | 'afternoon';
  pathStyle: PathVisualStyle;
  landmark: { style: LandmarkStyle; at: [number, number] };
  spawnStyle: SpawnMarkerStyle;
  baseStyle: BaseStructureStyle;
  heightZones: MapHeightZone[];
  clusters: MapCluster[];
  rotatingBridgeCenter?: [number, number];
  hasWaterLane?: boolean;
}

export interface MapDef {
  id: MapId;
  name: string;
  tierLabel: string;
  description: string;
  bossId: EnemyTypeId;
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
  hasBlizzardHazards?: boolean;
  ambientLifeSummary: string;
  signatureMomentSummary: string;
  layout: MapLayout;
}

export const MAPS: Record<MapId, MapDef> = {
  sunny_backyard: {
    id: 'sunny_backyard',
    name: 'Sunny Backyard',
    tierLabel: 'Beginner',
    description: 'Stepping-stone garden path with red garden shed, raised vegetable beds, sunken pond, and white picket fences.',
    bossId: 'treant_overlord',
    skyColor: 0x9fd8ff,
    groundColor: 0x5fb65a,
    trackColor: 0xd8c29a,
    trackEdgeColor: 0x9c7a4c,
    ambientSkyHex: 0xbae6fd,
    ambientGroundHex: 0x3f8f3f,
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
    ambientLifeSummary: 'Butterflies, sleeping cat, boss-watching gnomes, sprinkler rainbows',
    signatureMomentSummary: 'Wave 10: lawnmower rumbles past; Blighted Treant Overlord boss',
    layout: {
      size: { w: 44, d: 44 },
      palette: {
        grass: 0x5fb65a,
        grassDark: 0x3f8f3f,
        path: 0xd8c29a,
        soil: 0x6b4a2b,
        accent: 0xffd36b,
        sky: 0x9fd8ff,
        water: 0x38bdf8,
      },
      timeOfDay: 'morning',
      pathStyle: 'stepping_stones',
      landmark: { style: 'red_shed', at: [16, -15] },
      spawnStyle: 'molehill',
      baseStyle: 'vegetable_patch',
      heightZones: [
        { shape: 'rect', x: -14, z: -16, rx: 4.5, rz: 2.2, height: 0.55, style: 'raised_bed' },
        { shape: 'ellipse', x: -12, z: 12, rx: 3.6, rz: 2.6, height: -0.35, style: 'pond' },
      ],
      clusters: [
        { at: [-18, -17], kit: ['fence', 'bush', 'flower_bed'], count: 5 },
        { at: [-18, 16], kit: ['boulder', 'reeds', 'flower_bed'], count: 4 },
        { at: [8, -16], kit: ['tree', 'bench', 'wheelbarrow'], count: 3 },
        { at: [18, 16], kit: ['garden_bed', 'flower_bed', 'fence'], count: 4 },
      ],
    },
  },
  enchanted_jungle: {
    id: 'enchanted_jungle',
    name: 'Enchanted Glowing Jungle',
    tierLabel: 'Intermediate',
    description: 'Two mossy slab trails merge across a stone bridge beneath a giant glowing mushroom tree and ruins.',
    bossId: 'vinewyrm_hydra',
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
    ambientLifeSummary: 'Fireflies, music-pulsing mushrooms, swaying hanging vines, giant mushroom landmark',
    signatureMomentSummary: '70/30 uneven lane rushes; Vinewyrm Hydra boss',
    layout: {
      size: { w: 46, d: 46 },
      palette: {
        grass: 0x1e4d3b,
        grassDark: 0x133326,
        path: 0x5c5368,
        soil: 0x3b2f3d,
        accent: 0xc084fc,
        sky: 0x1e2954,
        water: 0x0ea5e9,
      },
      timeOfDay: 'dusk',
      pathStyle: 'mossy_slabs',
      landmark: { style: 'giant_mushroom_tree', at: [-2, -16] },
      spawnStyle: 'hollow_log',
      baseStyle: 'seed_shrine',
      heightZones: [
        { shape: 'ellipse', x: 11, z: -10, rx: 4.0, rz: 3.0, height: -0.38, style: 'pond' },
        { shape: 'rect', x: 3.5, z: 0, rx: 3.8, rz: 2.4, height: 0.2, style: 'stone_terrace' },
      ],
      clusters: [
        { at: [-16, 0], kit: ['glow_mushroom', 'boulder', 'bush'], count: 5 },
        { at: [14, -15], kit: ['reeds', 'lantern', 'glow_mushroom'], count: 4 },
        { at: [-15, 17], kit: ['vine_arch', 'tree', 'glow_mushroom'], count: 4 },
        { at: [16, 16], kit: ['boulder', 'lantern', 'bush'], count: 4 },
      ],
    },
  },
  volcano_greenhouse: {
    id: 'volcano_greenhouse',
    name: 'Volcano Greenhouse',
    tierLabel: 'Expert',
    description: 'Iron grate walkways over glowing lava channels beneath a cracked glass volcano dome.',
    bossId: 'magma_beetle_queen',
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
    ambientLifeSummary: 'Heat haze, popping lava bubbles, ash flakes, rattling cracked glass dome',
    signatureMomentSummary: 'Tougher armored waves & meteor strikes; Magma Beetle Queen boss',
    layout: {
      size: { w: 44, d: 44 },
      palette: {
        grass: 0x2c2529,
        grassDark: 0x1c1917,
        path: 0x573b32,
        soil: 0x3f241d,
        accent: 0xf97316,
        sky: 0x3a1816,
        water: 0xea580c,
      },
      timeOfDay: 'night',
      pathStyle: 'iron_grates',
      landmark: { style: 'glass_volcano_dome', at: [0, -16] },
      spawnStyle: 'lava_crack',
      baseStyle: 'seed_vault',
      heightZones: [
        { shape: 'ellipse', x: -13, z: 0, rx: 3.0, rz: 2.3, height: -0.4, style: 'lava_pool' },
        { shape: 'ellipse', x: 16, z: -14, rx: 4.0, rz: 2.8, height: 0.7, style: 'stone_terrace' },
      ],
      clusters: [
        { at: [-16, -15], kit: ['obsidian_shard', 'boulder', 'lantern'], count: 5 },
        { at: [16, 15], kit: ['obsidian_shard', 'boulder'], count: 4 },
        { at: [-16, 15], kit: ['obsidian_shard', 'lantern'], count: 4 },
      ],
    },
  },
  frosty_allotment: {
    id: 'frosty_allotment',
    name: 'Frosty Allotment',
    tierLabel: 'Hard',
    description: 'Winter allotment with raised timber beds, snowman & fogged greenhouse, and a frozen pond (+20% slide speed).',
    bossId: 'frost_moth_empress',
    skyColor: 0xbfe3ff,
    groundColor: 0xdbeafe,
    trackColor: 0x94a3b8,
    trackEdgeColor: 0x7dd3fc,
    ambientSkyHex: 0xe0f2fe,
    ambientGroundHex: 0x475569,
    trackHalfWidth: 1.35,
    boundsHalfSize: 23,
    paths: [
      [
        [-20, -10],
        [-10, -10],
        [-2, -2],
        [6, -10],
        [14, -4],
        [8, 6],
        [-2, 1],
        [-10, 10],
        [2, 14],
        [18, 12],
      ],
    ],
    cliffs: [
      { x: -12, z: 2, radius: 2.2, height: 1.9 },
      { x: 12, z: 3, radius: 2.2, height: 1.9 },
    ],
    pond: { x: -1, z: -1, radiusX: 4.5, radiusZ: 3.4, frozen: true },
    hasMeteorHazards: false,
    hasBlizzardHazards: true,
    ambientLifeSummary: 'Falling snow, hopping robins, snowman landmark, raised timber beds',
    signatureMomentSummary: 'Fast bugs slide on ice; Peak wave Blizzards; Frost Moth Empress boss',
    layout: {
      size: { w: 46, d: 46 },
      palette: {
        grass: 0xdbeafe,
        grassDark: 0xbfdbfe,
        path: 0x94a3b8,
        soil: 0x475569,
        accent: 0x7dd3fc,
        sky: 0xbfe3ff,
        water: 0xbae6fd,
      },
      timeOfDay: 'noon',
      pathStyle: 'snowy_track',
      landmark: { style: 'snowman_greenhouse', at: [-16, -16] },
      spawnStyle: 'snowdrift',
      baseStyle: 'root_cellar',
      heightZones: [
        { shape: 'ellipse', x: -1, z: -1, rx: 4.6, rz: 3.5, height: -0.25, style: 'pond' },
        { shape: 'rect', x: 14, z: -15, rx: 4.0, rz: 2.4, height: 0.65, style: 'raised_bed' },
      ],
      clusters: [
        { at: [16, -15], kit: ['snow_pile', 'tree', 'garden_bed'], count: 4 },
        { at: [-17, 16], kit: ['snow_pile', 'fence', 'boulder'], count: 5 },
        { at: [17, 17], kit: ['snow_pile', 'lantern', 'tree'], count: 4 },
      ],
    },
  },
  zen_garden: {
    id: 'zen_garden',
    name: 'Zen Garden',
    tierLabel: 'Insane',
    description: 'Sunset raked-sand courtyard with a red pagoda, koi pond, stone lanterns, and a rotating red bridge.',
    bossId: 'vinewyrm_hydra',
    skyColor: 0xfb923c,
    groundColor: 0xd6d3d1,
    trackColor: 0x92400e,
    trackEdgeColor: 0xdc2626,
    ambientSkyHex: 0xfdba74,
    ambientGroundHex: 0x3f6212,
    trackHalfWidth: 1.35,
    boundsHalfSize: 23,
    paths: [
      [
        [-20, -10],
        [-10, -10],
        [-3, -2],
        [4, -10],
        [13, -6],
        [15, 6],
        [4, 12],
        [-8, 8],
        [0, 0],
        [19, 14],
      ],
      [
        [-20, 10],
        [-11, 12],
        [-4, 4],
        [4, -2],
        [12, 2],
        [19, 14],
      ],
    ],
    cliffs: [
      { x: -12, z: -2, radius: 2.1, height: 1.8 },
      { x: 8, z: -12, radius: 2.2, height: 2.0 },
      { x: 6, z: 6, radius: 2.1, height: 1.8 },
    ],
    pond: { x: -10, z: 14, radiusX: 4.2, radiusZ: 2.8 },
    hasMeteorHazards: false,
    ambientLifeSummary: 'Swimming koi, drifting pink sakura petals, pagoda bell rings on boss waves',
    signatureMomentSummary: 'Rotating red bridge alternates routes every 10 waves; Pagoda Boss chime',
    layout: {
      size: { w: 46, d: 46 },
      palette: {
        grass: 0xd6d3d1,
        grassDark: 0xa8a29e,
        path: 0x92400e,
        soil: 0x57534e,
        accent: 0xf472b6,
        sky: 0xfb923c,
        water: 0x0284c7,
      },
      timeOfDay: 'sunset',
      pathStyle: 'wood_walkway',
      landmark: { style: 'red_pagoda', at: [16, -15] },
      spawnStyle: 'torii_gate',
      baseStyle: 'bonsai_altar',
      rotatingBridgeCenter: [0, 0],
      heightZones: [
        { shape: 'ellipse', x: -10, z: 14, rx: 4.4, rz: 3.0, height: -0.38, style: 'pond' },
        { shape: 'ellipse', x: -14, z: -15, rx: 4.2, rz: 3.0, height: 0.45, style: 'moss_mound' },
      ],
      clusters: [
        { at: [-17, -16], kit: ['bamboo', 'lantern', 'boulder'], count: 5 },
        { at: [16, 17], kit: ['lantern', 'bamboo', 'bush'], count: 4 },
        { at: [-17, 0], kit: ['boulder', 'lantern', 'tree'], count: 4 },
      ],
    },
  },
  pond_isle: {
    id: 'pond_isle',
    name: 'Pond Isle',
    tierLabel: 'Nightmare',
    description: 'Sunlit lily-pond sanctuary shaded by an ancient weeping willow with wooden docks and a swimming bug lane.',
    bossId: 'frost_moth_empress',
    skyColor: 0x60a5fa,
    groundColor: 0x4ade80,
    trackColor: 0x854d0e,
    trackEdgeColor: 0x0ea5e9,
    ambientSkyHex: 0x93c5fd,
    ambientGroundHex: 0x0369a1,
    trackHalfWidth: 1.35,
    boundsHalfSize: 23,
    paths: [
      [
        [-20, -9],
        [-11, -9],
        [-4, -12],
        [4, -8],
        [10, 0],
        [4, 9],
        [-6, 10],
        [8, 15],
        [19, 10],
      ],
      [
        [-20, 4],
        [-10, 4],
        [-2, 2],
        [6, 4],
        [14, 6],
        [19, 10],
      ],
    ],
    cliffs: [
      { x: -2, z: -4, radius: 2.2, height: 2.0 },
      { x: 12, z: -9, radius: 2.1, height: 2.0 },
      { x: -12, z: 13, radius: 2.2, height: 1.8 },
    ],
    pond: { x: 0, z: 0, radiusX: 5.5, radiusZ: 3.5 },
    hasMeteorHazards: false,
    ambientLifeSummary: 'Weeping willow canopy, hopping frogs on lily pads, water ripples under swimming lanes',
    signatureMomentSummary: 'Heavy flying & swimming waves across water docks; Hybrid Cliff perches shine',
    layout: {
      size: { w: 46, d: 46 },
      palette: {
        grass: 0x4ade80,
        grassDark: 0x16a34a,
        path: 0x854d0e,
        soil: 0x451a03,
        accent: 0xf472b6,
        sky: 0x60a5fa,
        water: 0x0ea5e9,
      },
      timeOfDay: 'afternoon',
      pathStyle: 'wooden_docks',
      landmark: { style: 'willow_tree', at: [-14, -16] },
      spawnStyle: 'whirlpool',
      baseStyle: 'lotus_sanctuary',
      hasWaterLane: true,
      heightZones: [
        { shape: 'ellipse', x: 0, z: 0, rx: 5.6, rz: 3.6, height: -0.35, style: 'pond' },
        { shape: 'ellipse', x: 15, z: -15, rx: 4.0, rz: 2.8, height: 0.6, style: 'moss_mound' },
      ],
      clusters: [
        { at: [-18, -16], kit: ['lily_pad', 'reeds', 'boulder'], count: 5 },
        { at: [16, -15], kit: ['tree', 'flower_bed', 'lantern'], count: 4 },
        { at: [-17, 16], kit: ['lily_pad', 'reeds', 'bush'], count: 5 },
      ],
    },
  },
};

export const MAP_LIST: MapDef[] = [
  MAPS.sunny_backyard,
  MAPS.enchanted_jungle,
  MAPS.volcano_greenhouse,
  MAPS.frosty_allotment,
  MAPS.zen_garden,
  MAPS.pond_isle,
];
