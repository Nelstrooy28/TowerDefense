import type { QualityTier } from '../core/QualityManager';

export type ParticleShape = 'sphere' | 'diamond' | 'leaf' | 'spark';
export type VFXPriority = 'critical' | 'high' | 'normal' | 'ambient';

export interface VFXTierCounts {
  low: number;
  medium: number;
  high: number;
  ultra: number;
}

export const ELEMENT_COLORS = {
  physical: { main: 0xf5f5f4, glow: 0xd6d3d1, hex: '#f5f5f4' },
  fire: { main: 0xfb923c, glow: 0xfde047, hex: '#fb923c' },
  ice: { main: 0x7dd3fc, glow: 0xe0f2fe, hex: '#7dd3fc' },
  poison: { main: 0x84cc16, glow: 0xa855f7, hex: '#84cc16' },
  lightning: { main: 0xa78bfa, glow: 0xe0e7ff, hex: '#a78bfa' },
  water: { main: 0x38bdf8, glow: 0xbae6fd, hex: '#38bdf8' },
  nature: { main: 0x4ade80, glow: 0xbbf7d0, hex: '#4ade80' },
  cash: { main: 0xfbbf24, glow: 0xfef3c7, hex: '#fbbf24' },
  danger: { main: 0xef4444, glow: 0xfecaca, hex: '#ef4444' },
} as const;

export type VFXRecipeId =
  | 'tomato_juicy_burst'
  | 'pineapple_tropical_explosion'
  | 'frost_shatter'
  | 'fire_cinders'
  | 'soil_placement_clods'
  | 'golden_coin_fountain'
  | 'confetti_crate_burst'
  | 'shield_shatter'
  | 'steam_burst'
  | 'upgrade_spiral'
  | 'sell_leaf_swirl'
  | 'boss_core_explosion'
  | 'ant_death_confetti'
  | 'seed_drop_trail'
  | 'root_burst_clods'
  | 'wilt_leaves'
  | 'dissolve_embers'
  | 'overkill_burst'
  | 'combo_coin_merge'
  | 'poison_cloud'
  | 'bamboo_pierce'
  | 'solar_flare'
  | 'wing_dust'
  | 'flower_bloom_ripple'
  | 'lava_trail'
  // v5 Doc 01 VFX Recipes
  | 'muzzle_puff'
  | 'muzzle_ring_flash'
  | 'lv5_awake_pillar'
  | 'lv5_motes'
  | 'ghost_fire_wisp'
  | 'rainbow_equalizer'
  | 'snowfall_aura'
  | 'water_rainbow_arc'
  | 'thorn_bleed'
  | 'confetti_squash'
  | 'war_horn_ring'
  | 'walnut_shell_shock'
  | 'sun_ray_burst'
  | 'enemy_element_death'
  | 'base_leak_bonk'
  | 'boss_step_dust'
  | 'corruption_peel'
  | 'summon_pollen'
  | 'summon_glass_sparkle'
  | 'summon_gold_pour'
  | 'summon_rainbow_wave'
  | 'map_sun_dust'
  | 'map_snow_sparkle'
  | 'map_sakura_petal'
  | 'map_lava_ember'
  | 'ui_leaf_puff';

export interface VFXRecipe {
  id: VFXRecipeId;
  countHigh: number;
  tiers: VFXTierCounts;
  priority: VFXPriority;
  shapes: ParticleShape[];
  life: number;
  speedMin: number;
  speedMax: number;
  gravity: number;
  drag: number;
  spinDegPerSec: number;
  colors: number[];
  sizeMin: number;
  sizeMax: number;
  additive?: boolean;
  scaleUpTo?: number;
  spiralIn?: boolean;
  spiralOut?: boolean;
  respectsReducedMotion?: boolean;
}

function mkRecipe(
  id: VFXRecipeId,
  countHigh: number,
  priority: VFXPriority,
  opts: Omit<VFXRecipe, 'id' | 'countHigh' | 'tiers' | 'priority'>
): VFXRecipe {
  return {
    id,
    countHigh,
    priority,
    tiers: {
      low: Math.max(1, Math.round(countHigh * 0.25)),
      medium: Math.max(1, Math.round(countHigh * 0.6)),
      high: countHigh,
      ultra: Math.max(1, Math.round(countHigh * 1.5)),
    },
    respectsReducedMotion: priority === 'ambient',
    ...opts,
  };
}

export function getRecipeCountForTier(recipe: VFXRecipe, tier: QualityTier): number {
  if (tier === 'Low') return recipe.tiers.low;
  if (tier === 'Medium') return recipe.tiers.medium;
  if (tier === 'Ultra') return recipe.tiers.ultra;
  return recipe.tiers.high;
}

export const VFX_RECIPES: Record<VFXRecipeId, VFXRecipe> = {
  tomato_juicy_burst: mkRecipe('tomato_juicy_burst', 16, 'normal', {
    shapes: ['sphere'],
    life: 0.45,
    speedMin: 2,
    speedMax: 5,
    gravity: -9,
    drag: 0.6,
    spinDegPerSec: 180,
    colors: [0xef4444, 0xfca5a5],
    sizeMin: 0.08,
    sizeMax: 0.16,
  }),
  pineapple_tropical_explosion: mkRecipe('pineapple_tropical_explosion', 36, 'high', {
    shapes: ['diamond', 'leaf'],
    life: 0.75,
    speedMin: 4,
    speedMax: 9,
    gravity: -12,
    drag: 1.0,
    spinDegPerSec: 420,
    colors: [0xfacc15, 0x84cc16, 0xf97316],
    sizeMin: 0.12,
    sizeMax: 0.28,
  }),
  frost_shatter: mkRecipe('frost_shatter', 22, 'normal', {
    shapes: ['diamond'],
    life: 0.65,
    speedMin: 3,
    speedMax: 6,
    gravity: -8,
    drag: 0.8,
    spinDegPerSec: 360,
    colors: [ELEMENT_COLORS.ice.glow, ELEMENT_COLORS.ice.main],
    sizeMin: 0.09,
    sizeMax: 0.2,
  }),
  fire_cinders: mkRecipe('fire_cinders', 8, 'normal', {
    shapes: ['spark'],
    life: 0.85,
    speedMin: 1,
    speedMax: 2.2,
    gravity: 1.5,
    drag: 0.4,
    spinDegPerSec: 90,
    colors: [ELEMENT_COLORS.fire.main, ELEMENT_COLORS.fire.glow],
    sizeMin: 0.07,
    sizeMax: 0.14,
    additive: true,
  }),
  soil_placement_clods: mkRecipe('soil_placement_clods', 16, 'high', {
    shapes: ['diamond', 'leaf'],
    life: 0.5,
    speedMin: 2,
    speedMax: 4.5,
    gravity: -11,
    drag: 0.7,
    spinDegPerSec: 260,
    colors: [0x92400e, 0x78350f, ELEMENT_COLORS.nature.main],
    sizeMin: 0.08,
    sizeMax: 0.16,
  }),
  golden_coin_fountain: mkRecipe('golden_coin_fountain', 18, 'critical', {
    shapes: ['diamond'],
    life: 0.7,
    speedMin: 2.5,
    speedMax: 5.5,
    gravity: -9,
    drag: 0.5,
    spinDegPerSec: 540,
    colors: [ELEMENT_COLORS.cash.main, ELEMENT_COLORS.cash.glow],
    sizeMin: 0.1,
    sizeMax: 0.18,
  }),
  confetti_crate_burst: mkRecipe('confetti_crate_burst', 56, 'critical', {
    shapes: ['leaf', 'diamond'],
    life: 1.4,
    speedMin: 4,
    speedMax: 10,
    gravity: -6,
    drag: 1.4,
    spinDegPerSec: 540,
    colors: [0xef4444, 0xfbbf24, 0x4ade80, 0x38bdf8, 0xc084fc],
    sizeMin: 0.1,
    sizeMax: 0.22,
  }),
  shield_shatter: mkRecipe('shield_shatter', 24, 'critical', {
    shapes: ['diamond'],
    life: 0.65,
    speedMin: 4,
    speedMax: 8,
    gravity: -9,
    drag: 0.6,
    spinDegPerSec: 400,
    colors: [ELEMENT_COLORS.ice.glow, ELEMENT_COLORS.water.main],
    sizeMin: 0.12,
    sizeMax: 0.24,
  }),
  steam_burst: mkRecipe('steam_burst', 26, 'high', {
    shapes: ['sphere'],
    life: 0.75,
    speedMin: 2,
    speedMax: 5,
    gravity: 2.0,
    drag: 1.2,
    spinDegPerSec: 90,
    colors: [0xffffff, 0xe2e8f0],
    sizeMin: 0.14,
    sizeMax: 0.34,
    scaleUpTo: 2.2,
  }),
  upgrade_spiral: mkRecipe('upgrade_spiral', 28, 'high', {
    shapes: ['spark', 'leaf'],
    life: 0.8,
    speedMin: 2,
    speedMax: 4,
    gravity: 1,
    drag: 0.5,
    spinDegPerSec: 720,
    colors: [ELEMENT_COLORS.cash.glow, ELEMENT_COLORS.nature.main],
    sizeMin: 0.1,
    sizeMax: 0.2,
    spiralOut: true,
    additive: true,
  }),
  sell_leaf_swirl: mkRecipe('sell_leaf_swirl', 22, 'high', {
    shapes: ['leaf'],
    life: 0.7,
    speedMin: 1.5,
    speedMax: 3.5,
    gravity: 2,
    drag: 0.6,
    spinDegPerSec: 540,
    colors: [ELEMENT_COLORS.nature.main, 0x86efac, ELEMENT_COLORS.cash.main],
    sizeMin: 0.1,
    sizeMax: 0.2,
    spiralOut: true,
  }),
  boss_core_explosion: mkRecipe('boss_core_explosion', 72, 'critical', {
    shapes: ['diamond', 'spark', 'sphere'],
    life: 1.3,
    speedMin: 5,
    speedMax: 14,
    gravity: -8,
    drag: 0.8,
    spinDegPerSec: 480,
    colors: [ELEMENT_COLORS.lightning.main, 0xf43f5e, ELEMENT_COLORS.cash.glow],
    sizeMin: 0.15,
    sizeMax: 0.36,
    additive: true,
  }),
  ant_death_confetti: mkRecipe('ant_death_confetti', 12, 'normal', {
    shapes: ['leaf', 'sphere'],
    life: 0.5,
    speedMin: 2,
    speedMax: 4.5,
    gravity: -9,
    drag: 0.6,
    spinDegPerSec: 360,
    colors: [0xef4444, ELEMENT_COLORS.nature.main, ELEMENT_COLORS.cash.glow],
    sizeMin: 0.08,
    sizeMax: 0.15,
  }),
  seed_drop_trail: mkRecipe('seed_drop_trail', 12, 'normal', {
    shapes: ['spark'],
    life: 0.3,
    speedMin: 0.8,
    speedMax: 2.0,
    gravity: -2,
    drag: 0.5,
    spinDegPerSec: 180,
    colors: [ELEMENT_COLORS.nature.glow, ELEMENT_COLORS.cash.glow],
    sizeMin: 0.06,
    sizeMax: 0.12,
    additive: true,
  }),
  root_burst_clods: mkRecipe('root_burst_clods', 16, 'high', {
    shapes: ['diamond', 'leaf'],
    life: 0.48,
    speedMin: 2.2,
    speedMax: 5.0,
    gravity: -12,
    drag: 0.7,
    spinDegPerSec: 320,
    colors: [0x92400e, 0x65a30d, ELEMENT_COLORS.nature.main],
    sizeMin: 0.08,
    sizeMax: 0.16,
  }),
  wilt_leaves: mkRecipe('wilt_leaves', 12, 'normal', {
    shapes: ['leaf'],
    life: 0.8,
    speedMin: 0.5,
    speedMax: 1.5,
    gravity: -2.5,
    drag: 0.9,
    spinDegPerSec: 220,
    colors: [0xa16207, 0x854d0e, 0xd97706],
    sizeMin: 0.09,
    sizeMax: 0.16,
  }),
  dissolve_embers: mkRecipe('dissolve_embers', 14, 'normal', {
    shapes: ['spark'],
    life: 0.4,
    speedMin: 1.0,
    speedMax: 2.5,
    gravity: 3.5,
    drag: 0.4,
    spinDegPerSec: 160,
    colors: [ELEMENT_COLORS.fire.main, ELEMENT_COLORS.nature.main],
    sizeMin: 0.06,
    sizeMax: 0.12,
    additive: true,
  }),
  overkill_burst: mkRecipe('overkill_burst', 18, 'critical', {
    shapes: ['diamond', 'spark'],
    life: 0.45,
    speedMin: 4,
    speedMax: 8,
    gravity: -8,
    drag: 0.7,
    spinDegPerSec: 420,
    colors: [ELEMENT_COLORS.danger.main, ELEMENT_COLORS.cash.glow],
    sizeMin: 0.1,
    sizeMax: 0.2,
  }),
  combo_coin_merge: mkRecipe('combo_coin_merge', 14, 'critical', {
    shapes: ['leaf'],
    life: 0.5,
    speedMin: 2,
    speedMax: 4,
    gravity: 1.5,
    drag: 0.5,
    spinDegPerSec: 720,
    colors: [ELEMENT_COLORS.cash.main, ELEMENT_COLORS.cash.glow],
    sizeMin: 0.12,
    sizeMax: 0.2,
  }),
  poison_cloud: mkRecipe('poison_cloud', 20, 'normal', {
    shapes: ['sphere'],
    life: 1.6,
    speedMin: 0.2,
    speedMax: 0.8,
    gravity: 0.1,
    drag: 1.2,
    spinDegPerSec: 45,
    colors: [ELEMENT_COLORS.poison.main, ELEMENT_COLORS.poison.glow],
    sizeMin: 0.16,
    sizeMax: 0.34,
    scaleUpTo: 1.8,
  }),
  bamboo_pierce: mkRecipe('bamboo_pierce', 6, 'normal', {
    shapes: ['spark'],
    life: 0.25,
    speedMin: 3,
    speedMax: 5,
    gravity: -6,
    drag: 0.6,
    spinDegPerSec: 220,
    colors: [0xbef264, ELEMENT_COLORS.poison.main],
    sizeMin: 0.07,
    sizeMax: 0.14,
  }),
  solar_flare: mkRecipe('solar_flare', 26, 'high', {
    shapes: ['spark', 'diamond'],
    life: 0.6,
    speedMin: 4,
    speedMax: 9,
    gravity: 0,
    drag: 1.2,
    spinDegPerSec: 240,
    colors: [ELEMENT_COLORS.cash.glow, ELEMENT_COLORS.fire.main],
    sizeMin: 0.12,
    sizeMax: 0.24,
    additive: true,
  }),
  wing_dust: mkRecipe('wing_dust', 24, 'normal', {
    shapes: ['sphere'],
    life: 1.0,
    speedMin: 1,
    speedMax: 3,
    gravity: -1,
    drag: 1.1,
    spinDegPerSec: 120,
    colors: [0xfde68a, 0xe9d5ff],
    sizeMin: 0.05,
    sizeMax: 0.1,
  }),
  flower_bloom_ripple: mkRecipe('flower_bloom_ripple', 20, 'ambient', {
    shapes: ['leaf'],
    life: 1.2,
    speedMin: 0.2,
    speedMax: 1.2,
    gravity: 0.3,
    drag: 1.2,
    spinDegPerSec: 180,
    colors: [0xf9a8d4, ELEMENT_COLORS.fire.glow, 0x93c5fd, ELEMENT_COLORS.nature.main],
    sizeMin: 0.12,
    sizeMax: 0.22,
  }),
  lava_trail: mkRecipe('lava_trail', 6, 'ambient', {
    shapes: ['spark'],
    life: 1.1,
    speedMin: 0.5,
    speedMax: 1.5,
    gravity: 1,
    drag: 0.5,
    spinDegPerSec: 120,
    colors: [ELEMENT_COLORS.fire.main, ELEMENT_COLORS.danger.main],
    sizeMin: 0.09,
    sizeMax: 0.18,
    additive: true,
  }),
  muzzle_puff: mkRecipe('muzzle_puff', 4, 'ambient', {
    shapes: ['sphere'],
    life: 0.22,
    speedMin: 0.8,
    speedMax: 2.0,
    gravity: 0.4,
    drag: 1.4,
    spinDegPerSec: 90,
    colors: [ELEMENT_COLORS.physical.main, ELEMENT_COLORS.physical.glow],
    sizeMin: 0.07,
    sizeMax: 0.13,
  }),
  muzzle_ring_flash: mkRecipe('muzzle_ring_flash', 10, 'normal', {
    shapes: ['spark', 'diamond'],
    life: 0.28,
    speedMin: 2.2,
    speedMax: 4.5,
    gravity: 0.2,
    drag: 1.0,
    spinDegPerSec: 360,
    colors: [ELEMENT_COLORS.fire.glow, ELEMENT_COLORS.water.glow],
    sizeMin: 0.08,
    sizeMax: 0.16,
    additive: true,
  }),
  lv5_awake_pillar: mkRecipe('lv5_awake_pillar', 40, 'critical', {
    shapes: ['spark', 'diamond'],
    life: 1.0,
    speedMin: 3.5,
    speedMax: 7.5,
    gravity: 3.0,
    drag: 0.6,
    spinDegPerSec: 540,
    colors: [ELEMENT_COLORS.cash.glow, ELEMENT_COLORS.nature.glow],
    sizeMin: 0.12,
    sizeMax: 0.24,
    additive: true,
    spiralOut: true,
  }),
  lv5_motes: mkRecipe('lv5_motes', 4, 'ambient', {
    shapes: ['spark'],
    life: 1.2,
    speedMin: 0.4,
    speedMax: 1.0,
    gravity: 0.9,
    drag: 0.8,
    spinDegPerSec: 90,
    colors: [ELEMENT_COLORS.cash.glow, ELEMENT_COLORS.nature.main],
    sizeMin: 0.05,
    sizeMax: 0.1,
    additive: true,
  }),
  ghost_fire_wisp: mkRecipe('ghost_fire_wisp', 12, 'normal', {
    shapes: ['spark', 'sphere'],
    life: 0.65,
    speedMin: 1.2,
    speedMax: 2.8,
    gravity: 2.4,
    drag: 0.5,
    spinDegPerSec: 180,
    colors: [0x67e8f9, 0xe0f2fe],
    sizeMin: 0.09,
    sizeMax: 0.18,
    additive: true,
  }),
  rainbow_equalizer: mkRecipe('rainbow_equalizer', 18, 'high', {
    shapes: ['spark'],
    life: 0.55,
    speedMin: 3.0,
    speedMax: 6.0,
    gravity: 0.2,
    drag: 1.0,
    spinDegPerSec: 320,
    colors: [0xef4444, 0xfbbf24, 0x4ade80, 0x38bdf8, 0xa855f7],
    sizeMin: 0.09,
    sizeMax: 0.18,
    additive: true,
  }),
  snowfall_aura: mkRecipe('snowfall_aura', 10, 'ambient', {
    shapes: ['diamond'],
    life: 1.2,
    speedMin: 0.4,
    speedMax: 1.2,
    gravity: -1.6,
    drag: 0.9,
    spinDegPerSec: 180,
    colors: [ELEMENT_COLORS.ice.glow, ELEMENT_COLORS.ice.main],
    sizeMin: 0.06,
    sizeMax: 0.12,
  }),
  water_rainbow_arc: mkRecipe('water_rainbow_arc', 16, 'ambient', {
    shapes: ['sphere', 'spark'],
    life: 0.75,
    speedMin: 1.4,
    speedMax: 3.2,
    gravity: -2.0,
    drag: 0.8,
    spinDegPerSec: 220,
    colors: [ELEMENT_COLORS.water.main, 0x4ade80, 0xfbbf24, 0xf472b6],
    sizeMin: 0.08,
    sizeMax: 0.15,
  }),
  thorn_bleed: mkRecipe('thorn_bleed', 10, 'normal', {
    shapes: ['spark'],
    life: 0.4,
    speedMin: 1.5,
    speedMax: 3.5,
    gravity: -6,
    drag: 0.6,
    spinDegPerSec: 240,
    colors: [ELEMENT_COLORS.danger.main, 0x991b1b],
    sizeMin: 0.06,
    sizeMax: 0.12,
  }),
  confetti_squash: mkRecipe('confetti_squash', 20, 'high', {
    shapes: ['leaf', 'diamond'],
    life: 0.75,
    speedMin: 2.5,
    speedMax: 5.5,
    gravity: -7,
    drag: 0.8,
    spinDegPerSec: 460,
    colors: [ELEMENT_COLORS.cash.main, 0xec4899, 0x38bdf8, ELEMENT_COLORS.nature.main],
    sizeMin: 0.09,
    sizeMax: 0.17,
  }),
  war_horn_ring: mkRecipe('war_horn_ring', 14, 'high', {
    shapes: ['spark'],
    life: 0.55,
    speedMin: 2.4,
    speedMax: 4.5,
    gravity: 0.8,
    drag: 0.7,
    spinDegPerSec: 260,
    colors: [ELEMENT_COLORS.cash.main, ELEMENT_COLORS.fire.glow],
    sizeMin: 0.09,
    sizeMax: 0.16,
    additive: true,
  }),
  walnut_shell_shock: mkRecipe('walnut_shell_shock', 14, 'normal', {
    shapes: ['diamond'],
    life: 0.45,
    speedMin: 2.0,
    speedMax: 4.5,
    gravity: -9,
    drag: 0.7,
    spinDegPerSec: 320,
    colors: [0xd97706, ELEMENT_COLORS.cash.glow],
    sizeMin: 0.08,
    sizeMax: 0.15,
  }),
  sun_ray_burst: mkRecipe('sun_ray_burst', 18, 'high', {
    shapes: ['spark', 'diamond'],
    life: 0.65,
    speedMin: 2.5,
    speedMax: 5.5,
    gravity: 1.5,
    drag: 0.8,
    spinDegPerSec: 240,
    colors: [ELEMENT_COLORS.cash.glow, ELEMENT_COLORS.cash.main],
    sizeMin: 0.09,
    sizeMax: 0.18,
    additive: true,
  }),
  enemy_element_death: mkRecipe('enemy_element_death', 14, 'normal', {
    shapes: ['diamond', 'sphere'],
    life: 0.55,
    speedMin: 2.2,
    speedMax: 4.8,
    gravity: -7,
    drag: 0.8,
    spinDegPerSec: 300,
    colors: [ELEMENT_COLORS.physical.main, ELEMENT_COLORS.nature.main],
    sizeMin: 0.08,
    sizeMax: 0.16,
  }),
  base_leak_bonk: mkRecipe('base_leak_bonk', 18, 'critical', {
    shapes: ['diamond', 'spark'],
    life: 0.55,
    speedMin: 3.0,
    speedMax: 6.5,
    gravity: -6,
    drag: 0.7,
    spinDegPerSec: 360,
    colors: [ELEMENT_COLORS.danger.main, ELEMENT_COLORS.danger.glow],
    sizeMin: 0.1,
    sizeMax: 0.2,
  }),
  boss_step_dust: mkRecipe('boss_step_dust', 10, 'normal', {
    shapes: ['sphere'],
    life: 0.5,
    speedMin: 1.4,
    speedMax: 3.2,
    gravity: -3,
    drag: 1.1,
    spinDegPerSec: 120,
    colors: [0xa8a29e, 0x78716c],
    sizeMin: 0.1,
    sizeMax: 0.22,
  }),
  corruption_peel: mkRecipe('corruption_peel', 44, 'critical', {
    shapes: ['leaf', 'spark'],
    life: 1.6,
    speedMin: 2.0,
    speedMax: 6.0,
    gravity: 4.5,
    drag: 0.5,
    spinDegPerSec: 320,
    colors: [0xa855f7, 0xc084fc, 0x6b21a8],
    sizeMin: 0.1,
    sizeMax: 0.24,
    additive: true,
  }),
  summon_pollen: mkRecipe('summon_pollen', 24, 'ambient', {
    shapes: ['sphere'],
    life: 2.2,
    speedMin: 0.3,
    speedMax: 1.1,
    gravity: 0.4,
    drag: 0.9,
    spinDegPerSec: 90,
    colors: [ELEMENT_COLORS.cash.glow, ELEMENT_COLORS.nature.glow],
    sizeMin: 0.04,
    sizeMax: 0.09,
    additive: true,
  }),
  summon_glass_sparkle: mkRecipe('summon_glass_sparkle', 24, 'high', {
    shapes: ['diamond'],
    life: 0.9,
    speedMin: 1.8,
    speedMax: 4.0,
    gravity: 0.5,
    drag: 0.8,
    spinDegPerSec: 420,
    colors: [0xe0f2fe, 0xffffff],
    sizeMin: 0.06,
    sizeMax: 0.14,
    additive: true,
  }),
  summon_gold_pour: mkRecipe('summon_gold_pour', 28, 'high', {
    shapes: ['spark', 'diamond'],
    life: 1.1,
    speedMin: 1.5,
    speedMax: 4.0,
    gravity: -5.5,
    drag: 0.6,
    spinDegPerSec: 360,
    colors: [ELEMENT_COLORS.cash.main, ELEMENT_COLORS.cash.glow],
    sizeMin: 0.08,
    sizeMax: 0.17,
    additive: true,
  }),
  summon_rainbow_wave: mkRecipe('summon_rainbow_wave', 36, 'high', {
    shapes: ['leaf', 'spark'],
    life: 1.2,
    speedMin: 2.5,
    speedMax: 5.5,
    gravity: 0.6,
    drag: 0.7,
    spinDegPerSec: 480,
    colors: [0xef4444, 0xfbbf24, 0x4ade80, 0x38bdf8, 0xa855f7],
    sizeMin: 0.09,
    sizeMax: 0.19,
    additive: true,
  }),
  map_sun_dust: mkRecipe('map_sun_dust', 4, 'ambient', {
    shapes: ['sphere'],
    life: 2.4,
    speedMin: 0.2,
    speedMax: 0.6,
    gravity: 0.25,
    drag: 0.6,
    spinDegPerSec: 60,
    colors: [0xfef3c7, 0xfde68a],
    sizeMin: 0.05,
    sizeMax: 0.09,
  }),
  map_snow_sparkle: mkRecipe('map_snow_sparkle', 6, 'ambient', {
    shapes: ['diamond'],
    life: 2.2,
    speedMin: 0.5,
    speedMax: 1.3,
    gravity: -1.4,
    drag: 0.8,
    spinDegPerSec: 180,
    colors: [0xe0f2fe, 0xffffff],
    sizeMin: 0.06,
    sizeMax: 0.11,
  }),
  map_sakura_petal: mkRecipe('map_sakura_petal', 5, 'ambient', {
    shapes: ['leaf'],
    life: 2.6,
    speedMin: 0.6,
    speedMax: 1.4,
    gravity: -0.9,
    drag: 1.1,
    spinDegPerSec: 220,
    colors: [0xf9a8d4, 0xfbcfe8],
    sizeMin: 0.08,
    sizeMax: 0.14,
  }),
  map_lava_ember: mkRecipe('map_lava_ember', 5, 'ambient', {
    shapes: ['spark'],
    life: 1.6,
    speedMin: 0.8,
    speedMax: 2.0,
    gravity: 1.8,
    drag: 0.5,
    spinDegPerSec: 120,
    colors: [ELEMENT_COLORS.fire.main, ELEMENT_COLORS.danger.main],
    sizeMin: 0.06,
    sizeMax: 0.12,
    additive: true,
  }),
  ui_leaf_puff: mkRecipe('ui_leaf_puff', 8, 'ambient', {
    shapes: ['leaf'],
    life: 0.45,
    speedMin: 1.5,
    speedMax: 3.5,
    gravity: 0.5,
    drag: 1.0,
    spinDegPerSec: 360,
    colors: [ELEMENT_COLORS.nature.main, ELEMENT_COLORS.nature.glow],
    sizeMin: 0.08,
    sizeMax: 0.14,
  }),
};
