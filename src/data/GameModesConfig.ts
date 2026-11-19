import type { MapId } from './MapRegistry';
import type { DifficultyId } from './BalanceConfig';

export type GameModeId =
  | 'standard'
  | 'endless'
  | 'weekly'
  | 'hourly'
  | 'boss_rush'
  | 'puzzle'
  | 'survival'
  | 'sandbox'
  | 'rival'
  | 'story';

export interface ModeCatalogEntry {
  id: GameModeId;
  name: string;
  tagline: string;
  icon: string;
  rewardText: string;
  unlockText: string;
}

export const MODE_CATALOG: ModeCatalogEntry[] = [
  { id: 'standard', name: 'Classic', tagline: 'Defend all waves and defeat the Garden Boss.', icon: '🌱', rewardText: 'Seeds + Difficulty Unlocks', unlockText: 'Unlocked at start' },
  { id: 'endless', name: 'Endless', tagline: 'Infinite scaling waves for Leaderboard glory & Variants.', icon: '♾', rewardText: 'Bronze/Silver/Gold Variants', unlockText: 'Clear any map on Normal' },
  { id: 'weekly', name: 'Weekly Challenge', tagline: 'Curated weekly rule twist across rotating maps.', icon: '📅', rewardText: '+300 🌱 & Pass XP', unlockText: 'Unlocked at start' },
  { id: 'hourly', name: 'Hourly Challenge', tagline: 'Clock-synced 3-modifier challenge every UTC hour.', icon: '⏰', rewardText: 'Bloom Chest (+250 🌱 & +2 💧)', unlockText: 'Unlocked at start' },
  { id: 'boss_rush', name: 'Boss Rush', tagline: 'All 4 major bosses in 8 rapid high-cash waves.', icon: '🐉', rewardText: 'Seeds + Boss Slayer Badge', unlockText: 'Beat 2 bosses or unlock Normal' },
  { id: 'puzzle', name: 'Garden Puzzles', tagline: '10 synergy & counter puzzles with curated squads.', icon: '🧩', rewardText: 'Stars & Puzzle Seeds', unlockText: 'Unlocked at start' },
  { id: 'survival', name: 'Gardener Survival', tagline: 'Control your Gardener (WASD + Space Dash + E Splash)!', icon: '🧑‍🌾', rewardText: 'Survival Trophy & Seeds', unlockText: 'Clear Hard on any map' },
  { id: 'story', name: 'Story: The Blight', tagline: '10 guided chapters with Sprout teaching combos & bosses.', icon: '📖', rewardText: '+80 🌱 per chapter', unlockText: 'Unlocked at start' },
  { id: 'rival', name: 'Rival Garden VS', tagline: 'Outlast an AI gardener and send pests across the lane!', icon: '⚔', rewardText: '+350 🌱 Victory Bonus', unlockText: 'Unlocked at start' },
  { id: 'sandbox', name: 'Sandbox', tagline: 'Infinite cash, custom spawns, wave jump & range overlay.', icon: '🛠', rewardText: 'Practice (no rewards)', unlockText: 'Reach Player Level 10' },
];

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
  const maps: MapId[] = [
    'sunny_backyard',
    'enchanted_jungle',
    'volcano_greenhouse',
    'frosty_allotment',
    'zen_garden',
    'pond_isle',
  ];
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
  { id: 1, title: 'Steam Kitchen', hint: 'Combine Ghost Pepper (Burn) + Cryo Water-Lily (Chill) for Steam Burst!', mapId: 'sunny_backyard', startingCash: 1650, allowedUnits: ['ghost_pepper', 'ice_buds'], waveNumber: 8 },
  { id: 2, title: 'Cauterize Wounds', hint: 'Use Needle Barrel Cactus (Bleed) + Ghost Pepper (Burn) to burst beetles!', mapId: 'sunny_backyard', startingCash: 1300, allowedUnits: ['cactus_striker', 'ghost_pepper'], waveNumber: 10 },
  { id: 3, title: 'Slippery Slope', hint: 'Pair Cryo Water-Lily + Sonic Bloom for Ice Skate ×2 knockback!', mapId: 'enchanted_jungle', startingCash: 1850, allowedUnits: ['ice_buds', 'sonic_bloom'], waveNumber: 12 },
  { id: 4, title: 'Shatter Strike', hint: 'Freeze with Cryo Water-Lily, then smash with Pitcher Mortar!', mapId: 'sunny_backyard', startingCash: 1450, allowedUnits: ['ice_buds', 'pineapple_cannon'], waveNumber: 11 },
  { id: 5, title: 'Wet Circuit', hint: 'Wet pests with Speed Sprinkler, then zap with Laser Plant!', mapId: 'enchanted_jungle', startingCash: 2700, allowedUnits: ['speed_sprinkler', 'laser_plant'], waveNumber: 14 },
  { id: 6, title: 'Toxic Blaze', hint: 'Drop Puffball Mushroom poison + Ghost Pepper fire for Toxic Blaze!', mapId: 'volcano_greenhouse', startingCash: 1500, allowedUnits: ['puffball_mushroom', 'ghost_pepper'], waveNumber: 13 },
  { id: 7, title: 'Plague Mist', hint: 'Wet + Poison spreads spores across tight swarms!', mapId: 'enchanted_jungle', startingCash: 1800, allowedUnits: ['puffball_mushroom', 'speed_sprinkler'], waveNumber: 15 },
  { id: 8, title: 'Mole Hunt', hint: 'Burrowers hide from bullets — use Puffball Mushroom or Pitcher Mortar!', mapId: 'sunny_backyard', startingCash: 1600, allowedUnits: ['puffball_mushroom', 'pineapple_cannon'], waveNumber: 12 },
  { id: 9, title: 'Cliff Snipers', hint: 'Place Bamboo Archer on cliffs to pierce Stinger Wasps!', mapId: 'enchanted_jungle', startingCash: 1400, allowedUnits: ['bamboo_archer', 'tomato_tosser'], waveNumber: 16 },
  { id: 10, title: 'Solar Overcharge', hint: 'Link Sunflower Solar Beacon with Laser Plant for massive crits!', mapId: 'frosty_allotment', startingCash: 3200, allowedUnits: ['sunflower_beacon', 'laser_plant'], waveNumber: 18 },
];

export interface StoryChapterDef {
  id: number;
  title: string;
  sproutQuote: string;
  lesson: string;
  mapId: MapId;
  waves: number;
  startingCash: number;
}

export const STORY_CHAPTERS: StoryChapterDef[] = [
  { id: 1, title: 'Ch.1: First Roots', sproutQuote: '"Every strong garden begins with Sprout Strikers and leaf splash!"', lesson: 'Splash Basics', mapId: 'sunny_backyard', waves: 8, startingCash: 650 },
  { id: 2, title: 'Ch.2: Armored March', sproutQuote: '"Rhino Beetles shrug off tiny seeds. Crack shells with Pitcher Mortars!"', lesson: 'Armor Breaking', mapId: 'sunny_backyard', waves: 9, startingCash: 800 },
  { id: 3, title: 'Ch.3: Under the Lawn', sproutQuote: '"See those dirt mounds? Nectar bombs and traps hit Burrowing Moles!"', lesson: 'Burrower Counters', mapId: 'sunny_backyard', waves: 10, startingCash: 950 },
  { id: 4, title: 'Ch.4: Wings Overhead', sproutQuote: '"Put Bamboo Archers on raised beds to pick off Stinger Wasps!"', lesson: 'Anti-Air & Cliffs', mapId: 'enchanted_jungle', waves: 10, startingCash: 950 },
  { id: 5, title: 'Ch.5: Steam & Shatter', sproutQuote: '"Fire + Frost = Steam Burst! Watch those root links glow gold."', lesson: 'Element Synergies', mapId: 'enchanted_jungle', waves: 10, startingCash: 1200 },
  { id: 6, title: 'Ch.6: Money Grows', sproutQuote: '"Greedy Pocket Mice steal cash! Place Ironwood Stumps before they slip by."', lesson: 'Farms & Path Walls', mapId: 'frosty_allotment', waves: 10, startingCash: 1100 },
  { id: 7, title: 'Ch.7: Blizzard Siege', sproutQuote: '"Chill shields towers near snowstorms. Keep Ghost Peppers lit!"', lesson: 'Hazard Management', mapId: 'frosty_allotment', waves: 12, startingCash: 1350 },
  { id: 8, title: 'Ch.8: Dual Meltdown', sproutQuote: '"Both magma lanes are hot! Cover the center with Sonar & Beams."', lesson: 'Dual Track Splits', mapId: 'volcano_greenhouse', waves: 12, startingCash: 1500 },
  { id: 9, title: 'Ch.9: Shifting Bridges', sproutQuote: '"The red bridge turns every 10 waves — watch your range rings!"', lesson: 'Adapting Chokepoints', mapId: 'zen_garden', waves: 12, startingCash: 1700 },
  { id: 10, title: 'Ch.10: Queen of the Pond', sproutQuote: '"Bring your finest team — the Blight Core awakens!"', lesson: 'Master Finale', mapId: 'pond_isle', waves: 12, startingCash: 2200 },
];

export interface ShopOfferDef {
  unitId: string;
  priceSeeds: number;
  maxStock: number;
  label: string;
}

export function getWeeklyShopOffers(date = new Date()): { weekKey: string; offers: ShopOfferDef[] } {
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNum = Math.floor((date.getTime() - yearStart.getTime()) / (7 * 86400 * 1000));
  const weekKey = `${date.getFullYear()}-W${weekNum}`;
  const catalog: ShopOfferDef[] = [
    { unitId: 'bramble_snare', priceSeeds: 220, maxStock: 3, label: 'Path Trap Stock' },
    { unitId: 'garden_roller', priceSeeds: 360, maxStock: 3, label: 'Heavy Lawn Roller' },
    { unitId: 'walnut_wall', priceSeeds: 140, maxStock: 5, label: 'Sturdy Blocker' },
    { unitId: 'sunflower_producer', priceSeeds: 650, maxStock: 2, label: 'Sun Coin Farm' },
    { unitId: 'gnome_barracks', priceSeeds: 750, maxStock: 2, label: 'Marching Squads' },
    { unitId: 'puffball_mushroom', priceSeeds: 380, maxStock: 3, label: 'Poison Spore' },
  ];
  const first = catalog[weekNum % catalog.length];
  const second = catalog[(weekNum + 2) % catalog.length];
  return { weekKey, offers: [first, second] };
}

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
