/**
 * Central Balance Configuration (Spec v4 Doc 02 §3–§11 & Doc 06 §2–§3, §6–§7).
 * Single source of truth for difficulties, economy, unit value targets,
 * enemy toughness tiers, variants, modifier board, codes, and patch notes.
 */

export type DifficultyId =
  | 'Easy'
  | 'Normal'
  | 'Hard'
  | 'Insane'
  | 'Nightmare'
  | 'Apocalypse'
  | 'Blight';

export interface DifficultyBalanceDef {
  id: DifficultyId;
  order: number;
  waves: number;
  startingCash: number;
  baseHP: number;
  enemyHpMult: number;
  enemySpeedMult: number;
  eliteChanceCap: number;
  clearRewardSeeds: number;
  unlockRule: string;
  badgeColor: string;
  recommendedPower: number;
}

export const DIFFICULTY_ORDER: DifficultyId[] = [
  'Easy',
  'Normal',
  'Hard',
  'Insane',
  'Nightmare',
  'Apocalypse',
  'Blight',
];

export const DIFFICULTY_LADDER: Record<DifficultyId, DifficultyBalanceDef> = {
  Easy: {
    id: 'Easy',
    order: 0,
    waves: 20,
    startingCash: 600,
    baseHP: 150,
    enemyHpMult: 0.85,
    enemySpeedMult: 1.0,
    eliteChanceCap: 0.0,
    clearRewardSeeds: 150,
    unlockRule: 'Start',
    badgeColor: '#4ade80',
    recommendedPower: 1600,
  },
  Normal: {
    id: 'Normal',
    order: 1,
    waves: 30,
    startingCash: 500,
    baseHP: 125,
    enemyHpMult: 1.15,
    enemySpeedMult: 1.05,
    eliteChanceCap: 0.1,
    clearRewardSeeds: 400,
    unlockRule: 'Easy cleared',
    badgeColor: '#38bdf8',
    recommendedPower: 3800,
  },
  Hard: {
    id: 'Hard',
    order: 2,
    waves: 35,
    startingCash: 450,
    baseHP: 100,
    enemyHpMult: 1.65,
    enemySpeedMult: 1.12,
    eliteChanceCap: 0.18,
    clearRewardSeeds: 700,
    unlockRule: 'Normal cleared',
    badgeColor: '#fbbf24',
    recommendedPower: 7200,
  },
  Insane: {
    id: 'Insane',
    order: 3,
    waves: 40,
    startingCash: 400,
    baseHP: 100,
    enemyHpMult: 2.5,
    enemySpeedMult: 1.2,
    eliteChanceCap: 0.25,
    clearRewardSeeds: 1200,
    unlockRule: 'Hard cleared',
    badgeColor: '#f43f5e',
    recommendedPower: 12500,
  },
  Nightmare: {
    id: 'Nightmare',
    order: 4,
    waves: 45,
    startingCash: 400,
    baseHP: 75,
    enemyHpMult: 3.3,
    enemySpeedMult: 1.3,
    eliteChanceCap: 0.3,
    clearRewardSeeds: 2000,
    unlockRule: 'Insane cleared on this map',
    badgeColor: '#a855f7',
    recommendedPower: 18500,
  },
  Apocalypse: {
    id: 'Apocalypse',
    order: 5,
    waves: 50,
    startingCash: 350,
    baseHP: 50,
    enemyHpMult: 4.2,
    enemySpeedMult: 1.4,
    eliteChanceCap: 0.35,
    clearRewardSeeds: 3200,
    unlockRule: 'Nightmare cleared',
    badgeColor: '#ec4899',
    recommendedPower: 25000,
  },
  Blight: {
    id: 'Blight',
    order: 6,
    waves: 50,
    startingCash: 300,
    baseHP: 25,
    enemyHpMult: 5.5,
    enemySpeedMult: 1.5,
    eliteChanceCap: 0.4,
    clearRewardSeeds: 5000,
    unlockRule: 'Apocalypse cleared on 3 maps',
    badgeColor: '#dc2626',
    recommendedPower: 32000,
  },
};

export const ECONOMY_CONFIG = {
  damageCashDivisor: 12,
  killBountyDivisor: 25,
  farmWaveShareCap: 0.35,
  farmPostCapMult: 0.25,
  earlySkipRatePer10Sec: 0.08,
  earlySkipMaxShare: 0.25,
  sellRefundSameWave: 0.8,
  sellRefundLater: 0.65,
  globalTowerCap: 30,
  upgradeCostMultipliers: [0, 0.85, 1.65, 3.2, 6.5, 13.5] as readonly number[],
  waveBonus: (w: number): number => Math.floor(120 + 35 * w + 4 * Math.pow(w, 1.35)),
  computeKillBounty: (baseHp: number): number => Math.max(1, Math.round(baseHp / 25)),
  critMultiplier: 1.75,
  baseCritChance: 0.05,
  pocketMouseCashPerWave: 50,
  sunflowerDropIntervalSec: 8.0,
  sunflowerAutoCollectDelaySec: 4.0,
  sunflowerAutoCollectRatio: 0.5,
  gardenRollerResetCooldownSec: 20.0,
} as const;

export const WAVE_RHYTHM = {
  warmupMult: 1.05,
  buildMult: 1.15,
  testMult: 1.25,
  breatherMult: 0.85,
  peakMult: 1.4,
  maxWaveSpikeRatio: 1.6,
} as const;

export interface ToughnessClassDef {
  id: 'grey' | 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  label: string;
  minHp: number;
  barColor: string;
  skull: boolean;
  darkAura: boolean;
  scaleMult: number;
}

export const TOUGHNESS_CLASSES: ToughnessClassDef[] = [
  { id: 'purple', label: 'Abyssal', minHp: 20000, barColor: '#a855f7', skull: true, darkAura: true, scaleMult: 1.22 },
  { id: 'red', label: 'Colossal', minHp: 5000, barColor: '#ef4444', skull: true, darkAura: false, scaleMult: 1.12 },
  { id: 'yellow', label: 'Armored', minHp: 1500, barColor: '#facc15', skull: false, darkAura: false, scaleMult: 1.08 },
  { id: 'green', label: 'Sturdy', minHp: 500, barColor: '#4ade80', skull: false, darkAura: false, scaleMult: 1.0 },
  { id: 'blue', label: 'Nimble', minHp: 150, barColor: '#38bdf8', skull: false, darkAura: false, scaleMult: 1.0 },
  { id: 'grey', label: 'Pest', minHp: 0, barColor: '#9ca3af', skull: false, darkAura: false, scaleMult: 1.0 },
];

export function getEnemyToughnessClass(scaledHp: number): ToughnessClassDef {
  for (const tier of TOUGHNESS_CLASSES) {
    if (scaledHp >= tier.minHp) return tier;
  }
  return TOUGHNESS_CLASSES[TOUGHNESS_CLASSES.length - 1];
}

export type VariantId = 'none' | 'glass' | 'bronze' | 'silver' | 'gold' | 'rainbow';

export interface VariantDef {
  id: VariantId;
  label: string;
  statMult: number;
  color: string;
  emissiveHex: number;
  oddsText: string;
}

export const VARIANT_ORDER: VariantId[] = ['none', 'glass', 'bronze', 'silver', 'gold', 'rainbow'];

export const VARIANTS: Record<VariantId, VariantDef> = {
  none: { id: 'none', label: 'Standard', statMult: 1.0, color: '#cbd5e1', emissiveHex: 0x000000, oddsText: 'Base' },
  glass: { id: 'glass', label: 'Glass', statMult: 1.03, color: '#bae6fd', emissiveHex: 0x38bdf8, oddsText: '1 in 200' },
  bronze: { id: 'bronze', label: 'Bronze', statMult: 1.05, color: '#d97706', emissiveHex: 0xb45309, oddsText: 'Endless W50' },
  silver: { id: 'silver', label: 'Silver', statMult: 1.08, color: '#e2e8f0', emissiveHex: 0x94a3b8, oddsText: 'Endless W75' },
  gold: { id: 'gold', label: 'Gold', statMult: 1.12, color: '#fbbf24', emissiveHex: 0xf59e0b, oddsText: 'Endless W100' },
  rainbow: { id: 'rainbow', label: 'Rainbow', statMult: 1.15, color: '#f472b6', emissiveHex: 0xa855f7, oddsText: '1 in 5,000' },
};

export interface ModifierFamilyDef {
  id:
    | 'fast_pests'
    | 'tough_pests'
    | 'small_garden'
    | 'swarm'
    | 'broke'
    | 'drought'
    | 'inflation'
    | 'wilt'
    | 'sluggish'
    | 'fog';
  name: string;
  icon: string;
  effectDescriptions: [string, string, string, string];
  values: [number, number, number, number];
  seedBonuses: [number, number, number, number]; // e.g. 0.05 = +5%
}

export const MODIFIER_FAMILIES: ModifierFamilyDef[] = [
  {
    id: 'fast_pests',
    name: 'Fast Pests',
    icon: '💨',
    effectDescriptions: ['+25% enemy speed', '+50% enemy speed', '+75% enemy speed', '+100% enemy speed'],
    values: [1.25, 1.5, 1.75, 2.0],
    seedBonuses: [0.05, 0.1, 0.15, 0.2],
  },
  {
    id: 'tough_pests',
    name: 'Tough Pests',
    icon: '🛡',
    effectDescriptions: ['+45% enemy HP', '+65% enemy HP', '+85% enemy HP', '+100% enemy HP'],
    values: [1.45, 1.65, 1.85, 2.0],
    seedBonuses: [0.1, 0.22, 0.35, 0.5],
  },
  {
    id: 'small_garden',
    name: 'Small Garden',
    icon: '🪴',
    effectDescriptions: ['Max 15 towers', 'Max 12 towers', 'Max 8 towers', 'Max 5 towers'],
    values: [15, 12, 8, 5],
    seedBonuses: [0.1, 0.2, 0.35, 0.5],
  },
  {
    id: 'swarm',
    name: 'Swarm',
    icon: '🐜',
    effectDescriptions: ['+25% enemy count', '+50% enemy count', '+75% enemy count', '+100% enemy count'],
    values: [1.25, 1.5, 1.75, 2.0],
    seedBonuses: [0.05, 0.18, 0.32, 0.5],
  },
  {
    id: 'broke',
    name: 'Broke',
    icon: '💸',
    effectDescriptions: ['-5% start cash', '-10% start cash', '-15% start cash', '-20% start cash'],
    values: [0.95, 0.9, 0.85, 0.8],
    seedBonuses: [0.03, 0.05, 0.08, 0.1],
  },
  {
    id: 'drought',
    name: 'Drought',
    icon: '☀',
    effectDescriptions: ['-10% cash earned', '-20% cash earned', '-35% cash earned', '-50% cash earned'],
    values: [0.9, 0.8, 0.65, 0.5],
    seedBonuses: [0.05, 0.1, 0.15, 0.2],
  },
  {
    id: 'inflation',
    name: 'Inflation',
    icon: '📈',
    effectDescriptions: ['+10% tower cost', '+20% tower cost', '+35% tower cost', '+50% tower cost'],
    values: [1.1, 1.2, 1.35, 1.5],
    seedBonuses: [0.05, 0.14, 0.24, 0.35],
  },
  {
    id: 'wilt',
    name: 'Wilt',
    icon: '🥀',
    effectDescriptions: ['-10% tower damage', '-15% tower damage', '-20% tower damage', '-25% tower damage'],
    values: [0.9, 0.85, 0.8, 0.75],
    seedBonuses: [0.1, 0.18, 0.26, 0.35],
  },
  {
    id: 'sluggish',
    name: 'Sluggish',
    icon: '🐢',
    effectDescriptions: ['5% slower attacks', '8% slower attacks', '12% slower attacks', '15% slower attacks'],
    values: [1.05, 1.08, 1.12, 1.15],
    seedBonuses: [0.05, 0.1, 0.15, 0.2],
  },
  {
    id: 'fog',
    name: 'Fog',
    icon: '🌫',
    effectDescriptions: ['-10% tower range', '-20% tower range', '-35% tower range', '-50% tower range'],
    values: [0.9, 0.8, 0.65, 0.5],
    seedBonuses: [0.05, 0.14, 0.24, 0.35],
  },
];

export interface ActiveModifierEffects {
  enemySpeedMult: number;
  enemyHpMult: number;
  maxTowers: number;
  enemyCountMult: number;
  startCashMult: number;
  incomeMult: number;
  towerCostMult: number;
  towerDmgMult: number;
  towerCdMult: number;
  towerRangeMult: number;
  seedBonusTotal: number;
}

export function computeModifierEffects(active: Record<string, number>): ActiveModifierEffects {
  const getVal = (id: ModifierFamilyDef['id'], fallback: number): { val: number; bonus: number } => {
    const lvl = active[id] ?? 0;
    if (lvl <= 0 || lvl > 4) return { val: fallback, bonus: 0 };
    const fam = MODIFIER_FAMILIES.find((f) => f.id === id);
    if (!fam) return { val: fallback, bonus: 0 };
    return { val: fam.values[lvl - 1], bonus: fam.seedBonuses[lvl - 1] };
  };

  const fast = getVal('fast_pests', 1);
  const tough = getVal('tough_pests', 1);
  const small = getVal('small_garden', ECONOMY_CONFIG.globalTowerCap);
  const swarm = getVal('swarm', 1);
  const broke = getVal('broke', 1);
  const drought = getVal('drought', 1);
  const infl = getVal('inflation', 1);
  const wilt = getVal('wilt', 1);
  const slug = getVal('sluggish', 1);
  const fog = getVal('fog', 1);

  return {
    enemySpeedMult: fast.val,
    enemyHpMult: tough.val,
    maxTowers: small.val,
    enemyCountMult: swarm.val,
    startCashMult: broke.val,
    incomeMult: drought.val,
    towerCostMult: infl.val,
    towerDmgMult: wilt.val,
    towerCdMult: slug.val,
    towerRangeMult: fog.val,
    seedBonusTotal:
      fast.bonus +
      tough.bonus +
      small.bonus +
      swarm.bonus +
      broke.bonus +
      drought.bonus +
      infl.bonus +
      wilt.bonus +
      slug.bonus +
      fog.bonus,
  };
}

export function getHourlyChallengeModifiers(date = new Date()): {
  hourKey: string;
  modifiers: Record<string, number>;
  seedBonusPct: number;
} {
  const hourKey = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}-H${date.getUTCHours()}`;
  let hash = 2166136261;
  for (let i = 0; i < hourKey.length; i++) {
    hash ^= hourKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const mods: Record<string, number> = {};
  for (let k = 0; k < 3; k++) {
    const idx = Math.abs((hash >>> (k * 6)) % MODIFIER_FAMILIES.length);
    const fam = MODIFIER_FAMILIES[idx];
    const lvl = 1 + (Math.abs(hash >>> (k * 4 + 1)) % 3);
    mods[fam.id] = lvl;
  }
  const eff = computeModifierEffects(mods);
  return {
    hourKey,
    modifiers: mods,
    seedBonusPct: Math.round(eff.seedBonusTotal * 100),
  };
}

export interface RedeemCodeDef {
  code: string;
  seeds: number;
  dewdrops: number;
  tickets?: number;
  label: string;
}

export const REDEEM_CODES: Record<string, RedeemCodeDef> = {
  SPROUT: { code: 'SPROUT', seeds: 200, dewdrops: 0, label: 'Starter Seeds (+200 🌱)' },
  ROOTS: { code: 'ROOTS', seeds: 0, dewdrops: 3, label: 'Root Dewdrops (+3 💧)' },
  BASTION4: { code: 'BASTION4', seeds: 350, dewdrops: 2, tickets: 2, label: 'v4 Launch Gift (+350 🌱, +2 💧, +2 🎟)' },
  BLOOM: { code: 'BLOOM', seeds: 150, dewdrops: 1, tickets: 1, label: 'Spring Bloom (+150 🌱, +1 💧, +1 🎟)' },
  GARDENER: { code: 'GARDENER', seeds: 250, dewdrops: 0, tickets: 1, label: 'Survival Kit (+250 🌱, +1 🎟)' },
  BASTION5: { code: 'BASTION5', seeds: 400, dewdrops: 3, tickets: 2, label: 'v5 Launch Gift (+400 🌱, +3 💧, +2 🎟)' },
  BASTION6: { code: 'BASTION6', seeds: 500, dewdrops: 4, tickets: 2, label: 'v6 Art Sheet Gift (+500 🌱, +4 💧, +2 🎟)' },
};

export const CURRENT_VERSION = '6.0.0';

export const WHATS_NEW_NOTES = [
  {
    version: 'v6.0.0 — Art Sheet Redesign & Cel Style',
    highlights: [
      'Cel-Shaded Cartoon Art Style Across All Units & Pests: 3-step toon shading ramp, soft round highlights, and color-matched dark outlines (toggleable in Low quality tier).',
      '6 Redesigned Tower Silhouettes: Sprout Striker (terracotta pot & trumpet stem), Needle Barrel Cactus (magenta scope sniper), Pitcher Mortar (violet-striped nectar jar), Solar Marigold (radiant amber-gold flower), Cryo Water-Lily (twin spinning ice lotus), and Ironwood Stump (mossy trunk with glowing amber sap cracks).',
      '6 Redesigned Pest Enemies & Mini-Boss: Scout Ant, Aphid Hopper, Rhino Beetle (destructible shell halves), Terracotta Snail, Stinger Wasp (dive-sting attack), and Brood Mantis + Crowned Brood Mantis Queen mini-boss.',
      'Re-rendered 2D Hotbar Portraits & Codex Bestiary matching the v6 palette and 3/4 art-sheet angle.',
    ],
    balanceNotes: [
      'Needle Barrel Cactus Sniper Fit: range increased +20% (10–16 → 12–19.2), fires 2 heavy sniper needles (12–110 DMG) preserving volley DPS.',
      'Wave 10/30 Crowned Mini-Boss introduces Brood Mantis Queen (spawns 3 Brood Mantis every 8 s after a 1.2 s core-glow telegraph).',
    ],
  },
  {
    version: 'v5.0.0 — Overgrown Polish & Walkable Hub',
    highlights: [
      'Walkable 3D Garden Lobby Hub: walk with WASD / Shift / Space and press [E] at 8 interactive garden stations, or press [M] anytime for the Fast Wooden Sign Menu.',
      'BugRigKit (20 Rebuilt Enemies + Mini-Boss Kings): Roblox-blocky rounded bug silhouettes, blinking rectangle eyes, tripod/worm/fly gaits, low-HP sweat drops, and 15 custom death animations.',
      'VFX Upgrade Across Every System: Lv0 / Lv3 / Lv5 tier progressions for all 20 units, rune-glyph Summon circles + variant reveals, element color language, boss roar/corruption peel, and VFX Budget Manager.',
      'GTD Controls & Presets (Keybinds.ts): GTD preset default (Shift+Click / hold [E] upgrade, [Q] cancel, [R] rotate, [X] sell, [Z/C/V] abilities, [Tab] Unit Manager, [F] speed), full Settings rebinding + F1 overlay.',
      'Unit Manager v5 & HUD v5: Priority circles (①②③), auto-upgrade queue with Cash Reserve slider, Weakest targeting, Bulk Shift+Select, bottom-right Inspector, rarity frames, and 250ms smart tooltips.',
    ],
    balanceNotes: [
      'All 7 automated balance suite benchmarks preserved cleanly alongside Mini-Boss King waves.',
      'VFX Budget Manager keeps Medium quality <= 1,500 particles at Wave 30 while preserving all crits, telegraphs, and cash drops.',
    ],
  },
  {
    version: 'v4.0.0 — Overgrown Rebirth',
    highlights: [
      'New Game Menu & Screen Router: Title Diorama, Wooden Garden Sign Hub, 3D Map Table, 7-tier Difficulty Pots, Team Pick, and Esc Pause Menu.',
      'Rebuilt 6 Diorama Maps on soil cross-section plinths using PropKit: Sunny Backyard, Enchanted Jungle, Volcano Greenhouse, Frosty Allotment, Zen Garden, and Pond Isle.',
      '5 New Tactical Unit Roles: Bramble Snare (Path Trap), Garden Roller (Moving Trap), Gnome Barracks (Spawner), Walnut Wall (Path Blocker), Sunflower (Collect Farm).',
      'Traits 2.0 (22 tiered traits), 5 Unit Variants (Glass → Rainbow), Modifier Board (10×4 challenges), Summon v4 rotating banners & 10-bud reveals.',
      'New Modes: Gardener Survival (WASD + Dash + Splash), Sandbox Debug Mode, Rival Garden VS Bot, Story Mode (10 chapters), and Hourly Challenges.',
    ],
    balanceNotes: [
      'Laser Plant: beam ramp capped 2.5× → 2.0× over 2.5 s → 4.0 s',
      'Sonic Bloom: base damage raised 65 → 80',
      'Ice Buds: placement cost reduced $900 → $800',
      'Chrono-Bloom: base damage tuned 480 → 400 to respect Exclusive cap',
    ],
  },
];
