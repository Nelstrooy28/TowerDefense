import type { TraitId } from '../../src/data/TraitConfig';
import type { VariantId } from '../../src/data/BalanceConfig';

export interface SimTeamSlot {
  unitId: string;
  trait: TraitId;
  masteryLevel: number;
  variant?: VariantId;
  isPrime?: boolean;
}

export interface SimTeamPreset {
  id: 'starter' | 'starter_leg' | 'mid' | 'best';
  label: string;
  slots: SimTeamSlot[];
}

export const TEST_TEAMS: Record<SimTeamPreset['id'], SimTeamPreset> = {
  starter: {
    id: 'starter',
    label: 'Starter Squad',
    slots: [
      { unitId: 'tomato_tosser', trait: 'Keen II', masteryLevel: 1 },
      { unitId: 'cactus_striker', trait: 'Mighty II', masteryLevel: 1 },
      { unitId: 'pineapple_cannon', trait: 'Wide Bloom', masteryLevel: 1 },
      { unitId: 'bamboo_archer', trait: 'Swift II', masteryLevel: 1 },
    ],
  },
  starter_leg: {
    id: 'starter_leg',
    label: 'Starter + 1 Legendary',
    slots: [
      { unitId: 'tomato_tosser', trait: 'Keen II', masteryLevel: 3 },
      { unitId: 'cactus_striker', trait: 'Mighty II', masteryLevel: 3 },
      { unitId: 'pineapple_cannon', trait: 'Wide Bloom', masteryLevel: 3 },
      { unitId: 'money_tree', trait: 'Frugal II', masteryLevel: 3 },
      { unitId: 'sonic_bloom', trait: 'Mighty III', masteryLevel: 4 },
      { unitId: 'venus_flytrap', trait: 'Swift III', masteryLevel: 4 },
    ],
  },
  mid: {
    id: 'mid',
    label: 'Mid-Game Squad',
    slots: [
      { unitId: 'tomato_tosser', trait: 'Fertile', masteryLevel: 6, variant: 'bronze' },
      { unitId: 'cactus_striker', trait: 'Swift III', masteryLevel: 6, variant: 'bronze' },
      { unitId: 'money_tree', trait: 'Frugal III', masteryLevel: 6 },
      { unitId: 'ghost_pepper', trait: 'Mighty III', masteryLevel: 6, variant: 'bronze' },
      { unitId: 'ice_buds', trait: 'Lingering III', masteryLevel: 6, variant: 'bronze' },
      { unitId: 'laser_plant', trait: 'Fertile', masteryLevel: 6, variant: 'silver' },
    ],
  },
  best: {
    id: 'best',
    label: 'Best Meta Squad',
    slots: [
      { unitId: 'tomato_tosser', trait: 'Golden', masteryLevel: 10, variant: 'gold', isPrime: true },
      { unitId: 'ice_buds', trait: 'Celestial', masteryLevel: 10, variant: 'gold', isPrime: true },
      { unitId: 'money_tree', trait: 'Golden', masteryLevel: 10, variant: 'gold' },
      { unitId: 'sunflower_beacon', trait: 'Golden', masteryLevel: 10, variant: 'gold' },
      { unitId: 'laser_plant', trait: 'Celestial', masteryLevel: 10, variant: 'gold', isPrime: true },
      { unitId: 'chrono_bloom', trait: 'Celestial', masteryLevel: 10, variant: 'rainbow', isPrime: true },
    ],
  },
};
