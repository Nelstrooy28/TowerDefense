export type EnemyTypeId =
  | 'garden_ant'
  | 'sprinter_mantis'
  | 'iron_beetle'
  | 'burrowing_mole'
  | 'spore_wasp'
  | 'gargantuan_snail'
  | 'speedy_slug'
  | 'treant_overlord';

export interface EnemyDef {
  id: EnemyTypeId;
  name: string;
  appearsWave: number;
  baseHP: number;
  speed: number;
  armorRatio: number;
  isFlying: boolean;
  canBurrow: boolean;
  canStunTowers: boolean;
  chillResist: number;
  isMiniBoss: boolean;
  isBoss: boolean;
  bounty: number;
  baseDamage: number;
  scale: number;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  colorblindSymbol: string;
  deathDuration: number;
  deathVfxDesc: string;
  traitSummary: string;
}

export const ENEMIES: Record<EnemyTypeId, EnemyDef> = {
  garden_ant: {
    id: 'garden_ant',
    name: 'Garden Ant',
    appearsWave: 1,
    baseHP: 45,
    speed: 3.4,
    armorRatio: 0,
    isFlying: false,
    canBurrow: false,
    canStunTowers: false,
    chillResist: 0,
    isMiniBoss: false,
    isBoss: false,
    bounty: 6,
    baseDamage: 1,
    scale: 0.72,
    primaryColor: 0x991b1b,
    secondaryColor: 0x450a0a,
    accentColor: 0xfca5a5,
    colorblindSymbol: '●',
    deathDuration: 0.35,
    deathVfxDesc: '6 seed confetti + tiny dust puff',
    traitSummary: 'Swarm pest; 6-leg scuttle cycle',
  },
  sprinter_mantis: {
    id: 'sprinter_mantis',
    name: 'Sprinter Mantis',
    appearsWave: 4,
    baseHP: 70,
    speed: 5.8,
    armorRatio: 0,
    isFlying: false,
    canBurrow: false,
    canStunTowers: false,
    chillResist: 0,
    isMiniBoss: false,
    isBoss: false,
    bounty: 10,
    baseDamage: 2,
    scale: 0.9,
    primaryColor: 0x84cc16,
    secondaryColor: 0x3f6212,
    accentColor: 0xd9f99d,
    colorblindSymbol: '▲',
    deathDuration: 0.45,
    deathVfxDesc: 'Green leaf shards along its path',
    traitSummary: 'Very fast lime-green striker; punishes low early DPS',
  },
  iron_beetle: {
    id: 'iron_beetle',
    name: 'Iron-Shell Beetle',
    appearsWave: 7,
    baseHP: 260,
    speed: 2.1,
    armorRatio: 0.5,
    isFlying: false,
    canBurrow: false,
    canStunTowers: false,
    chillResist: 0,
    isMiniBoss: false,
    isBoss: false,
    bounty: 24,
    baseDamage: 4,
    scale: 1.08,
    primaryColor: 0x64748b,
    secondaryColor: 0x1e293b,
    accentColor: 0xcbd5e1,
    colorblindSymbol: '■',
    deathDuration: 0.6,
    deathVfxDesc: 'Metal sparks + grey shards',
    traitSummary: 'Armor shield (+50% grey bar): −35% non-explosive/non-beam damage until shattered',
  },
  burrowing_mole: {
    id: 'burrowing_mole',
    name: 'Burrowing Mole',
    appearsWave: 11,
    baseHP: 380,
    speed: 2.8,
    armorRatio: 0,
    isFlying: false,
    canBurrow: true,
    canStunTowers: false,
    chillResist: 0,
    isMiniBoss: false,
    isBoss: false,
    bounty: 32,
    baseDamage: 5,
    scale: 1.05,
    primaryColor: 0x78350f,
    secondaryColor: 0x451a03,
    accentColor: 0xfdba74,
    colorblindSymbol: '▼',
    deathDuration: 0.7,
    deathVfxDesc: 'Dirt fountain + stars',
    traitSummary: 'Burrows 2.5 s every 7 s; only ground AoE or max Radar hits',
  },
  spore_wasp: {
    id: 'spore_wasp',
    name: 'Spore Stunner Wasp',
    appearsWave: 15,
    baseHP: 620,
    speed: 3.6,
    armorRatio: 0,
    isFlying: true,
    canBurrow: false,
    canStunTowers: true,
    chillResist: 0,
    isMiniBoss: false,
    isBoss: false,
    bounty: 45,
    baseDamage: 6,
    scale: 1.0,
    primaryColor: 0xa855f7,
    secondaryColor: 0xfacc15,
    accentColor: 0xe879f9,
    colorblindSymbol: '◆',
    deathDuration: 0.8,
    deathVfxDesc: 'Purple spore cloud fades',
    traitSummary: 'FLYING. Every 9 s lobs a spore bomb at a tower → 3.5 s stun',
  },
  gargantuan_snail: {
    id: 'gargantuan_snail',
    name: 'Gargantuan Snail',
    appearsWave: 10,
    baseHP: 6500,
    speed: 1.3,
    armorRatio: 0.35,
    isFlying: false,
    canBurrow: false,
    canStunTowers: false,
    chillResist: 0.5,
    isMiniBoss: true,
    isBoss: false,
    bounty: 240,
    baseDamage: 20,
    scale: 1.85,
    primaryColor: 0x38bdf8,
    secondaryColor: 0x164e63,
    accentColor: 0xe0f2fe,
    colorblindSymbol: '★',
    deathDuration: 1.2,
    deathVfxDesc: 'Crystal shards + slime decal',
    traitSummary: 'Mini-Boss: Crystal shell, 50% Chill resist, spawns 6 Speedy Slugs at 50% HP',
  },
  speedy_slug: {
    id: 'speedy_slug',
    name: 'Speedy Slug',
    appearsWave: 10,
    baseHP: 220,
    speed: 4.9,
    armorRatio: 0,
    isFlying: false,
    canBurrow: false,
    canStunTowers: false,
    chillResist: 0,
    isMiniBoss: false,
    isBoss: false,
    bounty: 14,
    baseDamage: 2,
    scale: 0.68,
    primaryColor: 0x22d3ee,
    secondaryColor: 0x0e7490,
    accentColor: 0xa5f3fc,
    colorblindSymbol: '•',
    deathDuration: 0.35,
    deathVfxDesc: 'Cyan slime splash',
    traitSummary: 'Spawned from Gargantuan Snail shell shatter',
  },
  treant_overlord: {
    id: 'treant_overlord',
    name: 'Blighted Treant Overlord',
    appearsWave: 20,
    baseHP: 65000,
    speed: 1.0,
    armorRatio: 0.3,
    isFlying: false,
    canBurrow: false,
    canStunTowers: true,
    chillResist: 0.65,
    isMiniBoss: false,
    isBoss: true,
    bounty: 1500,
    baseDamage: 100,
    scale: 2.75,
    primaryColor: 0x3b0764,
    secondaryColor: 0x451a03,
    accentColor: 0xc084fc,
    colorblindSymbol: '♛',
    deathDuration: 4.0,
    deathVfxDesc: 'Boss finale implosion + bloom wave',
    traitSummary: 'Boss: Root Slam stuns within 9 u, Bark Regen shield at 40% HP, Swarm Summon roar',
  },
};

export function computeScaledEnemyHP(baseHP: number, wave: number, difficultyMult: number): number {
  const linearScale = 1 + 0.16 * Math.max(0, wave - 1);
  const expScale = Math.pow(1.085, Math.max(0, wave - 15));
  return Math.round(baseHP * difficultyMult * linearScale * expScale);
}
