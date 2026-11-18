export type TraitId =
  | 'Sprouting'
  | 'Swift'
  | 'Thorny'
  | 'Bountiful'
  | 'Sniper'
  | 'Overgrown'
  | 'Golden'
  | 'Celestial';

export interface TraitDef {
  id: TraitId;
  weight: number;
  dmgMult: number;
  cdMult: number;
  rangeMult: number;
  aoeMult: number;
  upgradeCostMult: number;
  cashMult: number;
  abilityCdMult: number;
  critChanceBonus: number;
  modelScale: number;
  color: string;
  description: string;
  visualIndicator: string;
}

export const TRAIT_ORDER: TraitId[] = [
  'Sprouting',
  'Swift',
  'Thorny',
  'Bountiful',
  'Sniper',
  'Overgrown',
  'Golden',
  'Celestial',
];

export const TRAITS: Record<TraitId, TraitDef> = {
  Sprouting: {
    id: 'Sprouting',
    weight: 32,
    dmgMult: 1.0,
    cdMult: 1.0,
    rangeMult: 1.1,
    aoeMult: 1.0,
    upgradeCostMult: 1.0,
    cashMult: 1.0,
    abilityCdMult: 1.0,
    critChanceBonus: 0,
    modelScale: 1.0,
    color: '#4ade80',
    description: '+10% Range',
    visualIndicator: 'Floating leaf icon on selection',
  },
  Swift: {
    id: 'Swift',
    weight: 25,
    dmgMult: 1.0,
    cdMult: 0.88,
    rangeMult: 1.0,
    aoeMult: 1.0,
    upgradeCostMult: 1.0,
    cashMult: 1.0,
    abilityCdMult: 1.0,
    critChanceBonus: 0,
    modelScale: 1.0,
    color: '#38bdf8',
    description: '−12% Attack Cooldown',
    visualIndicator: 'Wind swirl ring around soil mound',
  },
  Thorny: {
    id: 'Thorny',
    weight: 20,
    dmgMult: 1.15,
    cdMult: 1.0,
    rangeMult: 1.0,
    aoeMult: 1.0,
    upgradeCostMult: 1.0,
    cashMult: 1.0,
    abilityCdMult: 1.0,
    critChanceBonus: 0,
    modelScale: 1.0,
    color: '#f43f5e',
    description: '+15% Damage',
    visualIndicator: 'Crimson thorn rim on soil mound',
  },
  Bountiful: {
    id: 'Bountiful',
    weight: 10,
    dmgMult: 1.0,
    cdMult: 1.0,
    rangeMult: 1.0,
    aoeMult: 1.0,
    upgradeCostMult: 0.9,
    cashMult: 1.15,
    abilityCdMult: 1.0,
    critChanceBonus: 0,
    modelScale: 1.0,
    color: '#facc15',
    description: '−10% Upgrade Cost, +15% Farm Cash',
    visualIndicator: 'Falling gold sparkles',
  },
  Sniper: {
    id: 'Sniper',
    weight: 6,
    dmgMult: 1.1,
    cdMult: 1.0,
    rangeMult: 1.25,
    aoeMult: 1.0,
    upgradeCostMult: 1.0,
    cashMult: 1.0,
    abilityCdMult: 1.0,
    critChanceBonus: 0.05,
    modelScale: 1.0,
    color: '#60a5fa',
    description: '+25% Range, +10% Damage, +5% Crit',
    visualIndicator: 'Blue targeting laser sight',
  },
  Overgrown: {
    id: 'Overgrown',
    weight: 4,
    dmgMult: 1.3,
    cdMult: 1.0,
    rangeMult: 1.0,
    aoeMult: 1.15,
    upgradeCostMult: 1.0,
    cashMult: 1.0,
    abilityCdMult: 1.0,
    critChanceBonus: 0,
    modelScale: 1.18,
    color: '#22c55e',
    description: '+30% Damage, +15% AoE Radius',
    visualIndicator: '18% larger model scale',
  },
  Golden: {
    id: 'Golden',
    weight: 2,
    dmgMult: 1.4,
    cdMult: 0.85,
    rangeMult: 1.0,
    aoeMult: 1.0,
    upgradeCostMult: 1.0,
    cashMult: 1.25,
    abilityCdMult: 1.0,
    critChanceBonus: 0,
    modelScale: 1.04,
    color: '#fbbf24',
    description: '+40% Damage, −15% Cooldown, +25% Cash',
    visualIndicator: 'Metallic gold PBR override + glints',
  },
  Celestial: {
    id: 'Celestial',
    weight: 1,
    dmgMult: 1.65,
    cdMult: 0.78,
    rangeMult: 1.2,
    aoeMult: 1.0,
    upgradeCostMult: 1.0,
    cashMult: 1.0,
    abilityCdMult: 0.8,
    critChanceBonus: 0.05,
    modelScale: 1.06,
    color: '#c084fc',
    description: '+65% Damage, −22% Cooldown, +20% Range, −20% Ability CD, +5% Crit',
    visualIndicator: 'Starfield emissive rim + orbiting mini-star',
  },
};

export function rollRandomTrait(rng: () => number = Math.random): TraitId {
  let total = 0;
  for (const id of TRAIT_ORDER) total += TRAITS[id].weight;
  let roll = rng() * total;
  for (const id of TRAIT_ORDER) {
    roll -= TRAITS[id].weight;
    if (roll <= 0) return id;
  }
  return 'Sprouting';
}

export function isHighRarityTrait(trait: TraitId): boolean {
  return trait === 'Golden' || trait === 'Celestial';
}
