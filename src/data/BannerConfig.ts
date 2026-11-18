import { UNITS, type UnitDef } from './UnitRegistry';

export type BannerTypeId = 'classic' | 'enchanted' | 'featured' | 'event';

export interface BannerDef {
  id: BannerTypeId;
  name: string;
  currency: 'seeds' | 'tickets';
  cost1: number;
  cost10: number;
  description: string;
}

export const BANNERS: Record<BannerTypeId, BannerDef> = {
  classic: {
    id: 'classic',
    name: 'Classic Seed',
    currency: 'seeds',
    cost1: 100,
    cost10: 900,
    description: 'Standard odds; Legendary pity 15, Mythical pity 50.',
  },
  enchanted: {
    id: 'enchanted',
    name: 'Enchanted Pod',
    currency: 'seeds',
    cost1: 200,
    cost10: 1800,
    description: 'Boosted Mythical & Godly rates! Mythical pity 40.',
  },
  featured: {
    id: 'featured',
    name: 'Featured Spotlight',
    currency: 'seeds',
    cost1: 250,
    cost10: 2250,
    description: 'Rotates every 4 hours! 2× drop share for the spotlight unit.',
  },
  event: {
    id: 'event',
    name: 'Seasonal Bloom',
    currency: 'tickets',
    cost1: 1,
    cost10: 9,
    description: 'Seasonal Ticket banner with Mythical+ guaranteed pools.',
  },
};

const FEATURED_POOL_IDS = [
  'sonic_bloom',
  'ice_buds',
  'venus_flytrap',
  'ancient_moss_golem',
  'sunflower_beacon',
  'gnome_barracks',
  'sunflower_producer',
  'chrono_bloom',
];

export function getFeaturedUnitForClock(now = new Date()): {
  unit: UnitDef;
  remainingSec: number;
  blockKey: string;
} {
  const epoch4Hr = Math.floor(now.getTime() / (4 * 3600 * 1000));
  const id = FEATURED_POOL_IDS[epoch4Hr % FEATURED_POOL_IDS.length];
  const unit = UNITS.find((u) => u.id === id) ?? UNITS[0];
  const nextBoundaryMs = (epoch4Hr + 1) * 4 * 3600 * 1000;
  const remainingSec = Math.max(0, Math.floor((nextBoundaryMs - now.getTime()) / 1000));
  return { unit, remainingSec, blockKey: String(epoch4Hr) };
}

export function formatCountdownHMS(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
