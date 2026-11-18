export type RarityId =
  | 'Common'
  | 'Uncommon'
  | 'Rare'
  | 'Legendary'
  | 'Mythical'
  | 'Godly'
  | 'Exclusive';

export type ColorblindShape =
  | 'circle'
  | 'triangle'
  | 'square'
  | 'diamond'
  | 'star'
  | 'hexagon'
  | 'crown';

export interface RarityDef {
  id: RarityId;
  order: number;
  hex: string;
  colorNum: number;
  auraLabel: string;
  classicWeight: number;
  enchantedWeight: number;
  dewdropsOnDupe: number;
  colorblindShape: ColorblindShape;
  symbolChar: string;
}

export const RARITY_ORDER: RarityId[] = [
  'Common',
  'Uncommon',
  'Rare',
  'Legendary',
  'Mythical',
  'Godly',
  'Exclusive',
];

export const RARITIES: Record<RarityId, RarityDef> = {
  Common: {
    id: 'Common',
    order: 0,
    hex: '#4ade80',
    colorNum: 0x4ade80,
    auraLabel: 'None',
    classicWeight: 48.0,
    enchantedWeight: 15.0,
    dewdropsOnDupe: 1,
    colorblindShape: 'circle',
    symbolChar: '●',
  },
  Uncommon: {
    id: 'Uncommon',
    order: 1,
    hex: '#38bdf8',
    colorNum: 0x38bdf8,
    auraLabel: 'Subtle leaf ring',
    classicWeight: 27.0,
    enchantedWeight: 28.0,
    dewdropsOnDupe: 2,
    colorblindShape: 'triangle',
    symbolChar: '▲',
  },
  Rare: {
    id: 'Rare',
    order: 2,
    hex: '#818cf8',
    colorNum: 0x818cf8,
    auraLabel: 'Soft pulsing halo',
    classicWeight: 15.0,
    enchantedWeight: 27.0,
    dewdropsOnDupe: 3,
    colorblindShape: 'square',
    symbolChar: '■',
  },
  Legendary: {
    id: 'Legendary',
    order: 3,
    hex: '#fbbf24',
    colorNum: 0xfbbf24,
    auraLabel: 'Rotating golden star ring',
    classicWeight: 6.5,
    enchantedWeight: 16.5,
    dewdropsOnDupe: 5,
    colorblindShape: 'diamond',
    symbolChar: '◆',
  },
  Mythical: {
    id: 'Mythical',
    order: 4,
    hex: '#f43f5e',
    colorNum: 0xf43f5e,
    auraLabel: 'Dual counter-rotating rune rings',
    classicWeight: 2.5,
    enchantedWeight: 8.5,
    dewdropsOnDupe: 7,
    colorblindShape: 'star',
    symbolChar: '★',
  },
  Godly: {
    id: 'Godly',
    order: 5,
    hex: '#c084fc',
    colorNum: 0xc084fc,
    auraLabel: 'Blooming pillar + orbiting shards',
    classicWeight: 0.85,
    enchantedWeight: 4.0,
    dewdropsOnDupe: 9,
    colorblindShape: 'hexagon',
    symbolChar: '⬡',
  },
  Exclusive: {
    id: 'Exclusive',
    order: 6,
    hex: '#2dd4bf',
    colorNum: 0x2dd4bf,
    auraLabel: 'Prismatic shockwaves + floating crown',
    classicWeight: 0.15,
    enchantedWeight: 1.0,
    dewdropsOnDupe: 10,
    colorblindShape: 'crown',
    symbolChar: '♛',
  },
};

export interface CrateDef {
  id: 'classic' | 'enchanted';
  name: string;
  costSeeds: number;
  pityPrimaryThreshold: number;
  pityPrimaryMinRarity: RarityId;
  pitySecondaryThreshold: number;
  pitySecondaryMinRarity: RarityId;
}

export const CRATES: Record<'classic' | 'enchanted', CrateDef> = {
  classic: {
    id: 'classic',
    name: 'Classic Seed Crate',
    costSeeds: 100,
    pityPrimaryThreshold: 15,
    pityPrimaryMinRarity: 'Legendary',
    pitySecondaryThreshold: 40,
    pitySecondaryMinRarity: 'Mythical',
  },
  enchanted: {
    id: 'enchanted',
    name: 'Enchanted Seed Crate',
    costSeeds: 200,
    pityPrimaryThreshold: 15,
    pityPrimaryMinRarity: 'Mythical',
    pitySecondaryThreshold: 35,
    pitySecondaryMinRarity: 'Godly',
  },
};

export function getPreviousRarity(rarity: RarityId): RarityId {
  const idx = RARITY_ORDER.indexOf(rarity);
  return RARITY_ORDER[Math.max(0, idx - 1)];
}
