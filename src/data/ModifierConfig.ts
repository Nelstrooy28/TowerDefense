export type EliteModifierId =
  | 'Hasty'
  | 'Regenerating'
  | 'Shielded'
  | 'Splitter'
  | 'Cleanser'
  | 'Giant';

export interface EliteModifierDef {
  id: EliteModifierId;
  effectDesc: string;
  visualCue: string;
  color: string;
  colorNum: number;
  speedMult: number;
  hpMult: number;
  scaleMult: number;
}

export const ELITE_MODIFIER_LIST: EliteModifierId[] = [
  'Hasty',
  'Regenerating',
  'Shielded',
  'Splitter',
  'Cleanser',
  'Giant',
];

export const ELITE_MODIFIERS: Record<EliteModifierId, EliteModifierDef> = {
  Hasty: {
    id: 'Hasty',
    effectDesc: '+40% speed',
    visualCue: 'Speed lines, yellow outline',
    color: '#facc15',
    colorNum: 0xfacc15,
    speedMult: 1.4,
    hpMult: 1.0,
    scaleMult: 1.0,
  },
  Regenerating: {
    id: 'Regenerating',
    effectDesc: 'Heals 2% HP/s out of combat',
    visualCue: 'Green plus particles',
    color: '#4ade80',
    colorNum: 0x4ade80,
    speedMult: 1.0,
    hpMult: 1.0,
    scaleMult: 1.0,
  },
  Shielded: {
    id: 'Shielded',
    effectDesc: 'Bubble absorbs 25% max HP',
    visualCue: 'Blue hex bubble that cracks',
    color: '#38bdf8',
    colorNum: 0x38bdf8,
    speedMult: 1.0,
    hpMult: 1.0,
    scaleMult: 1.0,
  },
  Splitter: {
    id: 'Splitter',
    effectDesc: 'Splits into 2 smaller copies on death',
    visualCue: 'Wobbly jelly outline',
    color: '#e879f9',
    colorNum: 0xe879f9,
    speedMult: 1.0,
    hpMult: 1.0,
    scaleMult: 1.05,
  },
  Cleanser: {
    id: 'Cleanser',
    effectDesc: 'Removes debuffs every 4 s',
    visualCue: 'White pulse rings',
    color: '#f8fafc',
    colorNum: 0xf8fafc,
    speedMult: 1.0,
    hpMult: 1.0,
    scaleMult: 1.0,
  },
  Giant: {
    id: 'Giant',
    effectDesc: '×1.5 size, +150% HP, −20% speed',
    visualCue: 'Bigger shadow, ground thuds',
    color: '#fb923c',
    colorNum: 0xfb923c,
    speedMult: 0.8,
    hpMult: 2.5,
    scaleMult: 1.5,
  },
};

export function getEliteSpawnChance(wave: number): number {
  if (wave < 12) return 0;
  return Math.min(0.25, 0.04 + 0.004 * wave);
}

export function rollEliteModifier(rng: () => number = Math.random): EliteModifierId {
  return ELITE_MODIFIER_LIST[Math.floor(rng() * ELITE_MODIFIER_LIST.length)];
}
