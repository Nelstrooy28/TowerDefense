import type { ElementTag } from './UnitRegistry';

export type SynergyId =
  | 'steam_burst'
  | 'cauterize'
  | 'ice_skate'
  | 'shatter'
  | 'conduct'
  | 'fizzle'
  | 'toxic_blaze'
  | 'poison_spread';

export interface SynergyDef {
  id: SynergyId;
  name: string;
  popupText: string;
  color: string;
  colorNum: number;
  requires: [ElementTag, ElementTag];
  effectDesc: string;
  vfxDesc: string;
  partnerUnitNames: string[];
}

export const SYNERGIES: SynergyDef[] = [
  {
    id: 'steam_burst',
    name: 'Steam Burst',
    popupText: 'STEAM!',
    color: '#f1f5f9',
    colorNum: 0xf1f5f9,
    requires: ['burn', 'chill'],
    effectDesc: '1.5 s blind (enemies slowed 30%) + 120% bonus hit',
    vfxDesc: 'White steam cloud, hiss',
    partnerUnitNames: ['Ghost Pepper', 'Ice Buds', 'Elemental Chrono-Bloom'],
  },
  {
    id: 'cauterize',
    name: 'Cauterize',
    popupText: 'CAUTERIZE!',
    color: '#fb923c',
    colorNum: 0xfb923c,
    requires: ['burn', 'bleed'],
    effectDesc: 'Bleed ends, deals all remaining bleed damage at once',
    vfxDesc: 'Red-orange flash, sizzle',
    partnerUnitNames: ['Ghost Pepper', 'Cactus Striker', 'Venus Flytrap', 'Elemental Chrono-Bloom'],
  },
  {
    id: 'ice_skate',
    name: 'Ice Skate',
    popupText: 'ICE SKATE!',
    color: '#7dd3fc',
    colorNum: 0x7dd3fc,
    requires: ['chill', 'knockback'],
    effectDesc: 'Knockback distance ×2',
    vfxDesc: 'Ice trail under enemy',
    partnerUnitNames: ['Ice Buds', 'Sonic Bloom', 'Elemental Chrono-Bloom'],
  },
  {
    id: 'shatter',
    name: 'Shatter',
    popupText: 'SHATTER!',
    color: '#38bdf8',
    colorNum: 0x38bdf8,
    requires: ['freeze', 'heavy'],
    effectDesc: '+50% damage, removes freeze',
    vfxDesc: 'Ice cube explosion',
    partnerUnitNames: ['Ice Buds', 'Pineapple Cannon', 'Venus Flytrap', 'Ancient Moss Golem'],
  },
  {
    id: 'conduct',
    name: 'Conduct',
    popupText: 'CONDUCT!',
    color: '#a78bfa',
    colorNum: 0xa78bfa,
    requires: ['arcane', 'wet'],
    effectDesc: 'Chain lightning jumps +2 extra targets',
    vfxDesc: 'Blue sparks on water droplets',
    partnerUnitNames: ['Laser Plant', 'Elemental Chrono-Bloom', 'Speed Sprinkler'],
  },
  {
    id: 'fizzle',
    name: 'Fizzle',
    popupText: 'FIZZLE',
    color: '#9ca3af',
    colorNum: 0x9ca3af,
    requires: ['burn', 'wet'],
    effectDesc: 'Removes burn (counter-play to watch for)',
    vfxDesc: 'Grey smoke puff',
    partnerUnitNames: ['Ghost Pepper', 'Speed Sprinkler'],
  },
  // v3 §7.2 New Synergies
  {
    id: 'toxic_blaze',
    name: 'Toxic Blaze',
    popupText: 'TOXIC BLAZE!',
    color: '#a3e635',
    colorNum: 0xa3e635,
    requires: ['poison', 'burn'],
    effectDesc: 'Poison cloud ignites: 1-time 200% burst, poison clears',
    vfxDesc: 'Green-orange toxic fireball',
    partnerUnitNames: ['Puffball Spore Mushroom', 'Ghost Pepper', 'Elemental Chrono-Bloom'],
  },
  {
    id: 'poison_spread',
    name: 'Spread',
    popupText: 'SPREAD!',
    color: '#4ade80',
    colorNum: 0x4ade80,
    requires: ['poison', 'wet'],
    effectDesc: 'Poison spreads to 2 nearby enemies',
    vfxDesc: 'Glowing spore splash',
    partnerUnitNames: ['Puffball Spore Mushroom', 'Speed Sprinkler'],
  },
];

export function getUnitSynergyPartners(unitName: string, unitElements: ElementTag[]): string[] {
  const partners = new Set<string>();
  for (const syn of SYNERGIES) {
    if (syn.id === 'fizzle') continue;
    const hasA = unitElements.includes(syn.requires[0]);
    const hasB = unitElements.includes(syn.requires[1]);
    if (hasA || hasB) {
      for (const name of syn.partnerUnitNames) {
        if (name !== unitName) partners.add(name);
      }
    }
  }
  if (unitElements.includes('crit_aura')) {
    partners.add('Laser Plant');
  }
  if (unitElements.includes('arcane')) {
    partners.add('Sunflower Solar Beacon');
  }
  return Array.from(partners);
}
