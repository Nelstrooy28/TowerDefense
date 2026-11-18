export type TraitId =
  | 'Keen I'
  | 'Frugal I'
  | 'Mighty I'
  | 'Swift I'
  | 'Lingering I'
  | 'Keen II'
  | 'Frugal II'
  | 'Mighty II'
  | 'Swift II'
  | 'Lingering II'
  | 'Keen III'
  | 'Frugal III'
  | 'Mighty III'
  | 'Swift III'
  | 'Lingering III'
  | 'Lucky Harvest'
  | 'Wide Bloom'
  | 'Bullseye'
  | 'Fertile'
  | 'Ironbark'
  | 'Golden'
  | 'Celestial';

export type TraitTier = 'I' | 'II' | 'III' | 'Legendary' | 'Godly';

export interface TraitDef {
  id: TraitId;
  tier: TraitTier;
  weight: number;
  dmgMult: number;
  cdMult: number;
  rangeMult: number;
  aoeMult: number;
  splashBonus: number;
  debuffDurMult: number;
  stunImmune: boolean;
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
  'Keen I',
  'Frugal I',
  'Mighty I',
  'Swift I',
  'Lingering I',
  'Keen II',
  'Frugal II',
  'Mighty II',
  'Swift II',
  'Lingering II',
  'Keen III',
  'Frugal III',
  'Mighty III',
  'Swift III',
  'Lingering III',
  'Lucky Harvest',
  'Wide Bloom',
  'Bullseye',
  'Fertile',
  'Ironbark',
  'Golden',
  'Celestial',
];

function baseTrait(
  id: TraitId,
  tier: TraitTier,
  weight: number,
  color: string,
  description: string,
  visualIndicator: string,
  overrides: Partial<TraitDef>
): TraitDef {
  return {
    id,
    tier,
    weight,
    dmgMult: 1.0,
    cdMult: 1.0,
    rangeMult: 1.0,
    aoeMult: 1.0,
    splashBonus: 0,
    debuffDurMult: 1.0,
    stunImmune: false,
    upgradeCostMult: 1.0,
    cashMult: 1.0,
    abilityCdMult: 1.0,
    critChanceBonus: 0,
    modelScale: 1.0,
    color,
    description,
    visualIndicator,
    ...overrides,
  };
}

export const TRAITS: Record<TraitId, TraitDef> = {
  'Keen I': baseTrait('Keen I', 'I', 8.5, '#86efac', '+2.5% Range', '1 Leaf Badge', { rangeMult: 1.025 }),
  'Frugal I': baseTrait('Frugal I', 'I', 8.5, '#86efac', '5% Cheaper Upgrades', '1 Leaf Badge', { upgradeCostMult: 0.95 }),
  'Mighty I': baseTrait('Mighty I', 'I', 8.5, '#86efac', '+2.5% Damage', '1 Leaf Badge', { dmgMult: 1.025 }),
  'Swift I': baseTrait('Swift I', 'I', 8.5, '#86efac', '+2.5% Attack Speed', '1 Leaf Badge', { cdMult: 0.975 }),
  'Lingering I': baseTrait('Lingering I', 'I', 8.5, '#86efac', '+10% Debuff Duration', '1 Leaf Badge', { debuffDurMult: 1.1 }),

  'Keen II': baseTrait('Keen II', 'II', 6.0, '#38bdf8', '+4.5% Range', '2 Leaves + Soft Glow', { rangeMult: 1.045 }),
  'Frugal II': baseTrait('Frugal II', 'II', 6.0, '#38bdf8', '10% Cheaper Upgrades', '2 Leaves + Soft Glow', { upgradeCostMult: 0.9 }),
  'Mighty II': baseTrait('Mighty II', 'II', 6.0, '#38bdf8', '+4.5% Damage', '2 Leaves + Soft Glow', { dmgMult: 1.045 }),
  'Swift II': baseTrait('Swift II', 'II', 6.0, '#38bdf8', '+4.5% Attack Speed', '2 Leaves + Soft Glow', { cdMult: 0.955 }),
  'Lingering II': baseTrait('Lingering II', 'II', 6.0, '#38bdf8', '+15% Debuff Duration', '2 Leaves + Soft Glow', { debuffDurMult: 1.15 }),

  'Keen III': baseTrait('Keen III', 'III', 4.4, '#818cf8', '+6.5% Range', '3 Leaves + Glowing Root Veins', { rangeMult: 1.065 }),
  'Frugal III': baseTrait('Frugal III', 'III', 4.4, '#818cf8', '15% Cheaper Upgrades', '3 Leaves + Glowing Root Veins', { upgradeCostMult: 0.85 }),
  'Mighty III': baseTrait('Mighty III', 'III', 4.4, '#818cf8', '+6.5% Damage', '3 Leaves + Glowing Root Veins', { dmgMult: 1.065 }),
  'Swift III': baseTrait('Swift III', 'III', 4.4, '#818cf8', '+6.5% Attack Speed', '3 Leaves + Glowing Root Veins', { cdMult: 0.935 }),
  'Lingering III': baseTrait('Lingering III', 'III', 4.4, '#818cf8', '+20% Debuff Duration', '3 Leaves + Glowing Root Veins', { debuffDurMult: 1.2 }),

  'Lucky Harvest': baseTrait('Lucky Harvest', 'Legendary', 1.6, '#fbbf24', '20% Cheaper Upgrades, +15% Damage Cash', 'Gold Rune under Roots', {
    upgradeCostMult: 0.8,
    cashMult: 1.15,
    modelScale: 1.04,
  }),
  'Wide Bloom': baseTrait('Wide Bloom', 'Legendary', 1.4, '#fbbf24', '+5% Damage, +2.0 Splash Radius', 'Gold Rune + Expanded Canopy', {
    dmgMult: 1.05,
    splashBonus: 2.0,
    modelScale: 1.12,
  }),
  Bullseye: baseTrait('Bullseye', 'Legendary', 1.0, '#fbbf24', '+12.5% Double-Damage Crit Chance', 'Gold Rune + Glowing Sight', {
    critChanceBonus: 0.125,
    modelScale: 1.04,
  }),
  Fertile: baseTrait('Fertile', 'Legendary', 0.9, '#fbbf24', '+5% Damage, Attack Speed, and Range', 'Gold Rune + Vine Crown', {
    dmgMult: 1.05,
    cdMult: 0.95,
    rangeMult: 1.05,
    modelScale: 1.06,
  }),

  Ironbark: baseTrait('Ironbark', 'Godly', 0.25, '#f97316', '+15% Range, Stun Immune, −15% Ability CD', 'Obsidian Bark Shader + Aura', {
    rangeMult: 1.15,
    stunImmune: true,
    abilityCdMult: 0.85,
    modelScale: 1.06,
  }),
  Golden: baseTrait('Golden', 'Godly', 0.2, '#facc15', '+40% Damage, −15% CD, +25% Cash', 'Full Metallic Gold PBR Shader', {
    dmgMult: 1.4,
    cdMult: 0.85,
    cashMult: 1.25,
    modelScale: 1.06,
  }),
  Celestial: baseTrait('Celestial', 'Godly', 0.15, '#c084fc', '+65% Damage, −22% CD, +20% Range, −20% Ability CD', 'Starfield Emissive Shader + Halo', {
    dmgMult: 1.65,
    cdMult: 0.78,
    rangeMult: 1.2,
    abilityCdMult: 0.8,
    critChanceBonus: 0.05,
    modelScale: 1.08,
  }),
};

const LEGACY_TRAIT_MAP: Record<string, TraitId> = {
  Sprouting: 'Keen II',
  Swift: 'Swift II',
  Thorny: 'Mighty II',
  Bountiful: 'Frugal II',
  Sniper: 'Bullseye',
  Overgrown: 'Wide Bloom',
  Golden: 'Golden',
  Celestial: 'Celestial',
};

export function migrateTraitId(oldId?: string): TraitId {
  if (!oldId) return 'Keen I';
  if (oldId in TRAITS) return oldId as TraitId;
  return LEGACY_TRAIT_MAP[oldId] ?? 'Keen I';
}

export function getTraitOddsText(traitId: TraitId): string {
  const w = TRAITS[traitId]?.weight ?? 1;
  const n = Math.max(1, Math.round(100 / w));
  return `about 1 in ${n.toLocaleString()} rolls`;
}

export function rollRandomTrait(rng: () => number = Math.random): TraitId {
  let total = 0;
  for (const id of TRAIT_ORDER) total += TRAITS[id].weight;
  let roll = rng() * total;
  for (const id of TRAIT_ORDER) {
    roll -= TRAITS[id].weight;
    if (roll <= 0) return id;
  }
  return 'Keen I';
}

export function isHighRarityTrait(trait: TraitId): boolean {
  const tier = TRAITS[trait]?.tier;
  return tier === 'Legendary' || tier === 'Godly';
}
