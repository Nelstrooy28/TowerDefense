import type { MapId, DifficultyId } from './MapRegistry';

export type GameModeId = 'standard' | 'weekly' | 'boss_rush' | 'puzzle';

export interface WeeklyRuleDef {
  title: string;
  description: string;
  mapId: MapId;
  difficulty: DifficultyId;
  onlyRarity?: 'Common';
  enemySpeedMult: number;
  noSelling: boolean;
}

const WEEKLY_PRESETS: Array<Omit<WeeklyRuleDef, 'mapId' | 'difficulty'>> = [
  {
    title: 'Commons Only Sprint',
    description: 'Only Common plants allowed! Enemies move 1.35× faster.',
    onlyRarity: 'Common',
    enemySpeedMult: 1.35,
    noSelling: false,
  },
  {
    title: 'Rooted Forever',
    description: 'No selling towers! Enemies move 1.25× faster.',
    enemySpeedMult: 1.25,
    noSelling: true,
  },
  {
    title: 'Turbo Pests',
    description: 'Enemies move ×2 speed! Double starting cash.',
    enemySpeedMult: 2.0,
    noSelling: false,
  },
];

export function getWeeklyChallengeForDate(date = new Date()): WeeklyRuleDef {
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNum = Math.floor((date.getTime() - yearStart.getTime()) / (7 * 86400 * 1000));
  const preset = WEEKLY_PRESETS[weekNum % WEEKLY_PRESETS.length];
  const maps: MapId[] = ['sunny_backyard', 'enchanted_jungle', 'volcano_greenhouse', 'frosty_allotment'];
  const mapId = maps[weekNum % maps.length];
  return {
    ...preset,
    mapId,
    difficulty: 'Normal',
  };
}

export interface PuzzleStageDef {
  id: number;
  title: string;
  hint: string;
  mapId: MapId;
  startingCash: number;
  allowedUnits: string[];
  waveNumber: number;
}

export const GARDEN_PUZZLES: PuzzleStageDef[] = [
  { id: 1, title: 'Steam Kitchen', hint: 'Combine Ghost Pepper (Burn) + Ice Buds (Chill) for Steam Burst!', mapId: 'sunny_backyard', startingCash: 1650, allowedUnits: ['ghost_pepper', 'ice_buds'], waveNumber: 8 },
  { id: 2, title: 'Cauterize Wounds', hint: 'Use Cactus Striker (Bleed) + Ghost Pepper (Burn) to burst beetles!', mapId: 'sunny_backyard', startingCash: 1300, allowedUnits: ['cactus_striker', 'ghost_pepper'], waveNumber: 10 },
  { id: 3, title: 'Slippery Slope', hint: 'Pair Ice Buds + Sonic Bloom for Ice Skate ×2 knockback!', mapId: 'enchanted_jungle', startingCash: 1850, allowedUnits: ['ice_buds', 'sonic_bloom'], waveNumber: 12 },
  { id: 4, title: 'Shatter Strike', hint: 'Freeze with Ice Buds, then smash with Pineapple Cannon!', mapId: 'sunny_backyard', startingCash: 1450, allowedUnits: ['ice_buds', 'pineapple_cannon'], waveNumber: 11 },
  { id: 5, title: 'Wet Circuit', hint: 'Wet pests with Speed Sprinkler, then zap with Laser Plant!', mapId: 'enchanted_jungle', startingCash: 2700, allowedUnits: ['speed_sprinkler', 'laser_plant'], waveNumber: 14 },
  { id: 6, title: 'Toxic Blaze', hint: 'Drop Puffball Mushroom poison + Ghost Pepper fire for Toxic Blaze!', mapId: 'volcano_greenhouse', startingCash: 1500, allowedUnits: ['puffball_mushroom', 'ghost_pepper'], waveNumber: 13 },
  { id: 7, title: 'Plague Mist', hint: 'Wet + Poison spreads spores across tight swarms!', mapId: 'enchanted_jungle', startingCash: 1800, allowedUnits: ['puffball_mushroom', 'speed_sprinkler'], waveNumber: 15 },
  { id: 8, title: 'Mole Hunt', hint: 'Burrowers hide from bullets — use Puffball Mushroom or Pineapple Cannon!', mapId: 'sunny_backyard', startingCash: 1600, allowedUnits: ['puffball_mushroom', 'pineapple_cannon'], waveNumber: 12 },
  { id: 9, title: 'Cliff Snipers', hint: 'Place Bamboo Archer on cliffs to pierce flying wasps!', mapId: 'enchanted_jungle', startingCash: 1400, allowedUnits: ['bamboo_archer', 'tomato_tosser'], waveNumber: 16 },
  { id: 10, title: 'Solar Overcharge', hint: 'Link Sunflower Solar Beacon with Laser Plant for massive crits!', mapId: 'frosty_allotment', startingCash: 3200, allowedUnits: ['sunflower_beacon', 'laser_plant'], waveNumber: 18 },
];

export interface GardenPassTier {
  tier: number;
  xpRequired: number;
  rewardLabel: string;
  seeds?: number;
  dewdrops?: number;
  unitId?: string;
}

export const GARDEN_PASS_TIERS: GardenPassTier[] = Array.from({ length: 30 }, (_, idx) => {
  const tier = idx + 1;
  const xpRequired = tier * 150;
  if (tier === 30) {
    return { tier, xpRequired, rewardLabel: 'Mythical: Laser Plant + 300 Seeds', seeds: 300, unitId: 'laser_plant' };
  }
  if (tier % 5 === 0) {
    return { tier, xpRequired, rewardLabel: '+3 Dewdrops & +100 Seeds', seeds: 100, dewdrops: 3 };
  }
  if (tier % 2 === 0) {
    return { tier, xpRequired, rewardLabel: '+2 Dewdrops', dewdrops: 2 };
  }
  return { tier, xpRequired, rewardLabel: '+60 Seeds', seeds: 60 };
});
