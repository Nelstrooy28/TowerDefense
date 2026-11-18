export type ParticleShape = 'sphere' | 'diamond' | 'leaf' | 'spark';

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
  | 'ant_death_confetti';

export interface VFXRecipe {
  id: VFXRecipeId;
  countHigh: number;
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
}

export const VFX_RECIPES: Record<VFXRecipeId, VFXRecipe> = {
  tomato_juicy_burst: {
    id: 'tomato_juicy_burst',
    countHigh: 18,
    shapes: ['sphere'],
    life: 0.5,
    speedMin: 2,
    speedMax: 5,
    gravity: -9,
    drag: 0.6,
    spinDegPerSec: 180,
    colors: [0xef4444, 0xfca5a5],
    sizeMin: 0.08,
    sizeMax: 0.16,
  },
  pineapple_tropical_explosion: {
    id: 'pineapple_tropical_explosion',
    countHigh: 40,
    shapes: ['diamond', 'leaf'],
    life: 0.8,
    speedMin: 4,
    speedMax: 9,
    gravity: -12,
    drag: 1.0,
    spinDegPerSec: 420,
    colors: [0xfacc15, 0x84cc16, 0xf97316],
    sizeMin: 0.12,
    sizeMax: 0.28,
  },
  frost_shatter: {
    id: 'frost_shatter',
    countHigh: 24,
    shapes: ['diamond'],
    life: 0.7,
    speedMin: 3,
    speedMax: 6,
    gravity: -8,
    drag: 0.8,
    spinDegPerSec: 360,
    colors: [0xe0f2fe, 0x7dd3fc],
    sizeMin: 0.09,
    sizeMax: 0.2,
  },
  fire_cinders: {
    id: 'fire_cinders',
    countHigh: 8,
    shapes: ['spark'],
    life: 0.9,
    speedMin: 1,
    speedMax: 2.2,
    gravity: 1.5,
    drag: 0.4,
    spinDegPerSec: 90,
    colors: [0xfb923c, 0xfde047],
    sizeMin: 0.07,
    sizeMax: 0.14,
    additive: true,
  },
  soil_placement_clods: {
    id: 'soil_placement_clods',
    countHigh: 14,
    shapes: ['sphere'],
    life: 0.6,
    speedMin: 2,
    speedMax: 4,
    gravity: -14,
    drag: 0.5,
    spinDegPerSec: 220,
    colors: [0x78350f, 0xa16207],
    sizeMin: 0.08,
    sizeMax: 0.16,
  },
  golden_coin_fountain: {
    id: 'golden_coin_fountain',
    countHigh: 20,
    shapes: ['leaf'],
    life: 1.0,
    speedMin: 3,
    speedMax: 6,
    gravity: -10,
    drag: 0.5,
    spinDegPerSec: 720,
    colors: [0xfbbf24, 0xfde047],
    sizeMin: 0.12,
    sizeMax: 0.18,
  },
  confetti_crate_burst: {
    id: 'confetti_crate_burst',
    countHigh: 120,
    shapes: ['leaf'],
    life: 1.6,
    speedMin: 5,
    speedMax: 10,
    gravity: -4,
    drag: 1.8,
    spinDegPerSec: 540,
    colors: [0x4ade80, 0x38bdf8, 0x818cf8, 0xfbbf24, 0xf43f5e, 0xc084fc, 0x2dd4bf],
    sizeMin: 0.12,
    sizeMax: 0.24,
  },
  shield_shatter: {
    id: 'shield_shatter',
    countHigh: 16,
    shapes: ['diamond'],
    life: 0.6,
    speedMin: 4,
    speedMax: 7,
    gravity: -10,
    drag: 0.7,
    spinDegPerSec: 400,
    colors: [0x9ca3af, 0xf8fafc],
    sizeMin: 0.11,
    sizeMax: 0.22,
  },
  steam_burst: {
    id: 'steam_burst',
    countHigh: 30,
    shapes: ['sphere'],
    life: 1.2,
    speedMin: 1,
    speedMax: 3,
    gravity: 0.5,
    drag: 1.5,
    spinDegPerSec: 60,
    colors: [0xf1f5f9, 0xe2e8f0],
    sizeMin: 0.15,
    sizeMax: 0.34,
    scaleUpTo: 2.0,
  },
  upgrade_spiral: {
    id: 'upgrade_spiral',
    countHigh: 30,
    shapes: ['leaf'],
    life: 0.6,
    speedMin: 2.5,
    speedMax: 4.0,
    gravity: 0,
    drag: 0,
    spinDegPerSec: 360,
    colors: [0xfbbf24, 0xfde047],
    sizeMin: 0.1,
    sizeMax: 0.18,
    spiralIn: true,
  },
  sell_leaf_swirl: {
    id: 'sell_leaf_swirl',
    countHigh: 20,
    shapes: ['leaf'],
    life: 0.7,
    speedMin: 2.5,
    speedMax: 4.5,
    gravity: -2,
    drag: 0.8,
    spinDegPerSec: 320,
    colors: [0x86efac, 0x4ade80],
    sizeMin: 0.1,
    sizeMax: 0.18,
    spiralOut: true,
  },
  boss_core_explosion: {
    id: 'boss_core_explosion',
    countHigh: 300,
    shapes: ['diamond', 'spark', 'sphere', 'leaf'],
    life: 2.5,
    speedMin: 6,
    speedMax: 15,
    gravity: -6,
    drag: 1.1,
    spinDegPerSec: 540,
    colors: [0xc084fc, 0xffffff, 0xf43f5e, 0x2dd4bf],
    sizeMin: 0.14,
    sizeMax: 0.36,
  },
  ant_death_confetti: {
    id: 'ant_death_confetti',
    countHigh: 6,
    shapes: ['leaf', 'sphere'],
    life: 0.35,
    speedMin: 2,
    speedMax: 4.5,
    gravity: -9,
    drag: 0.7,
    spinDegPerSec: 360,
    colors: [0x4ade80, 0xfca5a5, 0xfde047],
    sizeMin: 0.06,
    sizeMax: 0.12,
  },
};
