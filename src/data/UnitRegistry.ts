import type { RarityId } from './RarityConfig';
import { ECONOMY_CONFIG } from './BalanceConfig';

export type TerrainTag = 'GROUND' | 'CLIFF' | 'HYBRID' | 'PATH';
export type UnitRoleCategory =
  | 'Attacker'
  | 'Splash'
  | 'DoT'
  | 'Control'
  | 'Support'
  | 'Farm'
  | 'Trap'
  | 'Roller'
  | 'Spawner'
  | 'Wall';
export type ElementTag =
  | 'physical'
  | 'burn'
  | 'chill'
  | 'freeze'
  | 'bleed'
  | 'arcane'
  | 'wet'
  | 'knockback'
  | 'heavy'
  | 'poison'
  | 'crit_aura'
  | 'farm'
  | 'support';

export type AbilityId =
  | 'bass_drop'
  | 'overdrive_mist'
  | 'tectonic_slam'
  | 'chrono_tsunami'
  | 'solar_flare';

export interface ActiveAbilityDef {
  id: AbilityId;
  name: string;
  cooldown: number;
  description: string;
  hotkeyHint: string;
}

export interface UnitLevelStats {
  level: number;
  dmg: number;
  cd: number;
  range: number;
  projectiles: number;
  splashRadius: number;
  farmPayout: number;
  buffCd: number;
  buffRange: number;
  buffCrit: number;
  upgradeCost: number;
}

export interface UnitDef {
  id: string;
  index: number;
  name: string;
  rarity: RarityId;
  cost: number;
  cap: number;
  footprintRadius: number;
  terrain: TerrainTag;
  dmgBase: number;
  dmgMax: number;
  cdBase: number;
  cdMax: number;
  rangeBase: number;
  rangeMax: number;
  projectilesBase: number;
  projectilesMax: number;
  splashRadius: number;
  roleSummary: string;
  elements: ElementTag[];
  canHitFlying: boolean;
  canHitBurrowed: boolean;
  isFarm?: boolean;
  isCollectFarm?: boolean;
  isSupport?: boolean;
  isBeam?: boolean;
  isExplosive?: boolean;
  isMelee?: boolean;
  isPiercing?: boolean;
  isPoisonCloud?: boolean;
  isTrap?: boolean;
  isRoller?: boolean;
  isSpawner?: boolean;
  isWall?: boolean;
  wallHpBase?: number;
  wallHpMax?: number;
  spawnHpBase?: number;
  spawnHpMax?: number;
  trapHitsBase?: number;
  trapHitsMax?: number;
  ability?: ActiveAbilityDef;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  signatureAnim: {
    idle: string;
    attack: string;
    impact: string;
    lv5Extra: string;
  };
  levels: UnitLevelStats[];
}

export function roundTo25(val: number): number {
  return Math.max(25, Math.round(val / 25) * 25);
}

export const UPGRADE_MULTS = ECONOMY_CONFIG.upgradeCostMultipliers;

function buildLevels(
  cost: number,
  dmgBase: number,
  dmgMax: number,
  cdBase: number,
  cdMax: number,
  rangeBase: number,
  rangeMax: number,
  projBase: number,
  projMax: number,
  splashRadius: number,
  isFarm = false,
  isSupport = false,
  critMin = 0,
  critMax = 0
): UnitLevelStats[] {
  const t = [0, 0.16, 0.34, 0.56, 0.78, 1.0];
  const levels: UnitLevelStats[] = [];
  for (let i = 0; i <= 5; i++) {
    const f = t[i];
    const dmg = isSupport ? 0 : Math.round(dmgBase + (dmgMax - dmgBase) * Math.pow(f, 1.2));
    const cd = cdBase === 0 ? 0 : Number((cdBase + (cdMax - cdBase) * f).toFixed(2));
    const range = rangeBase === 0 ? 0 : Number((rangeBase + (rangeMax - rangeBase) * f).toFixed(1));
    const projectiles = i >= 4 ? projMax : projBase;
    const farmPayout = isFarm ? Math.round(80 + (1150 - 80) * Math.pow(f, 1.3)) : 0;
    const buffCd = isSupport && critMax === 0 ? Number((0.1 + 0.15 * f).toFixed(2)) : 0;
    const buffRange = isSupport && critMax === 0 ? 0.15 : 0;
    const buffCrit = critMax > 0 ? Number((critMin + (critMax - critMin) * f).toFixed(3)) : 0;
    const upgradeCost = i === 0 ? cost : roundTo25(cost * UPGRADE_MULTS[i]);
    levels.push({
      level: i,
      dmg,
      cd,
      range,
      projectiles,
      splashRadius,
      farmPayout,
      buffCd,
      buffRange,
      buffCrit,
      upgradeCost,
    });
  }
  return levels;
}

export const UNITS: UnitDef[] = [
  {
    id: 'tomato_tosser',
    index: 1,
    name: 'Tomato Tosser',
    rarity: 'Common',
    cost: 175,
    cap: 8,
    footprintRadius: 0.7,
    terrain: 'GROUND',
    dmgBase: 14,
    dmgMax: 115,
    cdBase: 1.1,
    cdMax: 0.65,
    rangeBase: 8,
    rangeMax: 13,
    projectilesBase: 1,
    projectilesMax: 1,
    splashRadius: 1.5,
    roleSummary: 'Starter mini-splash, 1.5-unit tomato splatter',
    elements: ['physical'],
    canHitFlying: true,
    canHitBurrowed: false,
    primaryColor: 0xef4444,
    secondaryColor: 0x22c55e,
    accentColor: 0xfca5a5,
    signatureAnim: {
      idle: 'Bobs head to music beat',
      attack: 'Squash back, fling forward',
      impact: 'Red arc + juice splat decal (fades 4 s)',
      lv5Extra: 'Tomatoes become flaming, leave smoke trail',
    },
    levels: buildLevels(175, 14, 115, 1.1, 0.65, 8, 13, 1, 1, 1.5),
  },
  {
    id: 'cactus_striker',
    index: 2,
    name: 'Cactus Striker',
    rarity: 'Common',
    cost: 250,
    cap: 8,
    footprintRadius: 0.72,
    terrain: 'GROUND',
    dmgBase: 8,
    dmgMax: 55,
    cdBase: 1.3,
    cdMax: 0.75,
    rangeBase: 10,
    rangeMax: 16,
    projectilesBase: 3,
    projectilesMax: 4,
    splashRadius: 0,
    roleSummary: 'Burst of 3–4 spines; Bleed 20% Dmg/s for 3 s',
    elements: ['bleed'],
    canHitFlying: true,
    canHitBurrowed: false,
    primaryColor: 0x22c55e,
    secondaryColor: 0x15803d,
    accentColor: 0xfef08a,
    signatureAnim: {
      idle: 'Spines bristle when enemy in range',
      attack: 'Puff up 10%, needle volley',
      impact: 'Thin white streak trails, tiny dust pops',
      lv5Extra: 'Spines glow green, ricochet once',
    },
    levels: buildLevels(250, 8, 55, 1.3, 0.75, 10, 16, 3, 4, 0),
  },
  {
    id: 'pineapple_cannon',
    index: 3,
    name: 'Pineapple Cannon',
    rarity: 'Uncommon',
    cost: 425,
    cap: 6,
    footprintRadius: 0.85,
    terrain: 'GROUND',
    dmgBase: 45,
    dmgMax: 420,
    cdBase: 2.4,
    cdMax: 1.5,
    rangeBase: 12,
    rangeMax: 20,
    projectilesBase: 1,
    projectilesMax: 1,
    splashRadius: 3.5,
    roleSummary: 'Artillery 3.5-unit splash; breaks Armor 2× faster',
    elements: ['heavy'],
    canHitFlying: false,
    canHitBurrowed: true,
    isExplosive: true,
    primaryColor: 0xfacc15,
    secondaryColor: 0x65a30d,
    accentColor: 0xf97316,
    signatureAnim: {
      idle: 'Leaves rustle, barrel sniffs left/right',
      attack: 'Deep crouch, big recoil, smoke puff',
      impact: 'Spinning pineapple, tropical shrapnel ring, scorch decal',
      lv5Extra: 'Shrapnel splits into 6 mini-bombs',
    },
    levels: buildLevels(425, 45, 420, 2.4, 1.5, 12, 20, 1, 1, 3.5),
  },
  {
    id: 'money_tree',
    index: 4,
    name: 'Money Tree',
    rarity: 'Rare',
    cost: 500,
    cap: 4,
    footprintRadius: 0.9,
    terrain: 'GROUND',
    dmgBase: 0,
    dmgMax: 0,
    cdBase: 0,
    cdMax: 0,
    rangeBase: 0,
    rangeMax: 0,
    projectilesBase: 0,
    projectilesMax: 0,
    splashRadius: 0,
    roleSummary: 'Economy farm; mid-wave cash crates + end-of-wave payout',
    elements: ['farm'],
    canHitFlying: false,
    canHitBurrowed: false,
    isFarm: true,
    primaryColor: 0x16a34a,
    secondaryColor: 0x854d0e,
    accentColor: 0xfbbf24,
    signatureAnim: {
      idle: 'Leaves jingle like coins',
      attack: 'Shakes on wave end',
      impact: 'Coins pop out, arc to the Cash counter in the HUD',
      lv5Extra: 'Gold leaves fall constantly, shimmer aura',
    },
    levels: buildLevels(500, 0, 0, 0, 0, 0, 0, 0, 0, 0, true, false),
  },
  {
    id: 'ghost_pepper',
    index: 5,
    name: 'Ghost Pepper',
    rarity: 'Rare',
    cost: 650,
    cap: 5,
    footprintRadius: 0.78,
    terrain: 'GROUND',
    dmgBase: 28,
    dmgMax: 260,
    cdBase: 0.9,
    cdMax: 0.5,
    rangeBase: 7,
    rangeMax: 11,
    projectilesBase: 1,
    projectilesMax: 1,
    splashRadius: 2.2,
    roleSummary: '50° pierce fire cone; Fire DoT 35% Dmg/s for 4 s',
    elements: ['burn'],
    canHitFlying: true,
    canHitBurrowed: false,
    primaryColor: 0xf97316,
    secondaryColor: 0x991b1b,
    accentColor: 0xfde047,
    signatureAnim: {
      idle: 'Wisp of smoke from top',
      attack: 'Inhale (scale up), exhale flame',
      impact: 'Cone of fire particles + heat haze + ember decals',
      lv5Extra: 'Flame turns blue-white, ghost faces in fire',
    },
    levels: buildLevels(650, 28, 260, 0.9, 0.5, 7, 11, 1, 1, 2.2),
  },
  {
    id: 'sonic_bloom',
    index: 6,
    name: 'Sonic Bloom',
    rarity: 'Legendary',
    cost: 850,
    cap: 4,
    footprintRadius: 0.88,
    terrain: 'GROUND',
    dmgBase: 80,
    dmgMax: 680,
    cdBase: 2.2,
    cdMax: 1.35,
    rangeBase: 9,
    rangeMax: 14,
    projectilesBase: 1,
    projectilesMax: 1,
    splashRadius: 9,
    roleSummary: '360° shockwave, knockback 1.2 units. Bass Drop: 1.5 s AoE stun, 25 s CD',
    elements: ['knockback'],
    canHitFlying: true,
    canHitBurrowed: true,
    ability: {
      id: 'bass_drop',
      name: 'Bass Drop',
      cooldown: 25,
      description: '1.5 s AoE stun + massive sonic ring',
      hotkeyHint: 'Q/E/R',
    },
    primaryColor: 0xe879f9,
    secondaryColor: 0x6366f1,
    accentColor: 0x38bdf8,
    signatureAnim: {
      idle: 'Petals pulse like speakers',
      attack: 'Petals fold, then blast open',
      impact: 'Shockwave ring shader + grass flattens outward',
      lv5Extra: 'Rings become rainbow equalizer bars',
    },
    levels: buildLevels(850, 80, 680, 2.2, 1.35, 9, 14, 1, 1, 9),
  },
  {
    id: 'ice_buds',
    index: 7,
    name: 'Ice Buds',
    rarity: 'Legendary',
    cost: 800,
    cap: 4,
    footprintRadius: 0.82,
    terrain: 'HYBRID',
    dmgBase: 40,
    dmgMax: 390,
    cdBase: 1.4,
    cdMax: 0.85,
    rangeBase: 11,
    rangeMax: 17,
    projectilesBase: 1,
    projectilesMax: 1,
    splashRadius: 1.5,
    roleSummary: '40% Chill for 3.5 s; every 4th hit Freezes 1.2 s',
    elements: ['chill', 'freeze'],
    canHitFlying: true,
    canHitBurrowed: false,
    isBeam: true,
    primaryColor: 0x38bdf8,
    secondaryColor: 0xe0f2fe,
    accentColor: 0x7dd3fc,
    signatureAnim: {
      idle: 'Breath mist puffs',
      attack: 'Buds open like flowers, aim',
      impact: 'Frost beam, frost decal spreads on ground, ice shard shatter',
      lv5Extra: 'Snowfall in its range circle',
    },
    levels: buildLevels(800, 40, 390, 1.4, 0.85, 11, 17, 1, 1, 1.5),
  },
  {
    id: 'speed_sprinkler',
    index: 8,
    name: 'Speed Sprinkler',
    rarity: 'Mythical',
    cost: 1100,
    cap: 3,
    footprintRadius: 0.85,
    terrain: 'GROUND',
    dmgBase: 0,
    dmgMax: 0,
    cdBase: 2.0,
    cdMax: 2.0,
    rangeBase: 9,
    rangeMax: 15,
    projectilesBase: 0,
    projectilesMax: 0,
    splashRadius: 0,
    roleSummary: '−10% → −25% Attack CD and +15% Range. Overdrive Mist: cleanse stuns + −35% CD 10 s',
    elements: ['support', 'wet'],
    canHitFlying: false,
    canHitBurrowed: false,
    isSupport: true,
    ability: {
      id: 'overdrive_mist',
      name: 'Overdrive Mist',
      cooldown: 30,
      description: 'Cleanse stuns + −35% CD for 10 s & wets nearby pests',
      hotkeyHint: 'Q/E/R',
    },
    primaryColor: 0x06b6d4,
    secondaryColor: 0x0284c7,
    accentColor: 0x67e8f9,
    signatureAnim: {
      idle: 'Spins slowly, drips',
      attack: 'Fast spin pulse',
      impact: 'Water arcs to buffed towers, droplets sparkle',
      lv5Extra: 'Rainbow arc over buffed area',
    },
    levels: buildLevels(1100, 0, 0, 2.0, 2.0, 9, 15, 0, 0, 0, false, true),
  },
  {
    id: 'laser_plant',
    index: 9,
    name: 'Laser Plant',
    rarity: 'Mythical',
    cost: 1450,
    cap: 4,
    footprintRadius: 0.82,
    terrain: 'HYBRID',
    dmgBase: 22,
    dmgMax: 290,
    cdBase: 0.2,
    cdMax: 0.2,
    rangeBase: 14,
    rangeMax: 24,
    projectilesBase: 1,
    projectilesMax: 1,
    splashRadius: 0,
    roleSummary: 'Ramping beam up to 2.0× over 4 s on same target (CLIFF or GROUND); Lv.5 Radar reveals Burrowers',
    elements: ['arcane'],
    canHitFlying: true,
    canHitBurrowed: false,
    isBeam: true,
    primaryColor: 0xf43f5e,
    secondaryColor: 0x4c1d95,
    accentColor: 0xfda4af,
    signatureAnim: {
      idle: 'Lens iris blinks',
      attack: 'Charge glow 0.3 s, then fire',
      impact: 'Dual-cylinder beam, impact sparks, scorch line on ground',
      lv5Extra: 'Beam forks to a 2nd target at 50% damage',
    },
    levels: buildLevels(1450, 22, 290, 0.2, 0.2, 14, 24, 1, 1, 0),
  },
  {
    id: 'venus_flytrap',
    index: 10,
    name: 'Venus Flytrap',
    rarity: 'Godly',
    cost: 1800,
    cap: 3,
    footprintRadius: 0.95,
    terrain: 'GROUND',
    dmgBase: 320,
    dmgMax: 3800,
    cdBase: 2.6,
    cdMax: 1.45,
    rangeBase: 7,
    rangeMax: 12,
    projectilesBase: 1,
    projectilesMax: 1,
    splashRadius: 1.5,
    roleSummary: 'Lunging chomp + ground vines; executes non-bosses below 18% HP',
    elements: ['heavy', 'bleed'],
    canHitFlying: false,
    canHitBurrowed: false,
    isMelee: true,
    primaryColor: 0xa855f7,
    secondaryColor: 0x16a34a,
    accentColor: 0xf43f5e,
    signatureAnim: {
      idle: 'Licks lips, jaw twitches',
      attack: 'Lunge + chomp',
      impact: 'Bite slash lines, vine eruption, devour gulp swallow anim',
      lv5Extra: 'Jaws drip glowing venom, vines stay 2 s as a slow zone',
    },
    levels: buildLevels(1800, 320, 3800, 2.6, 1.45, 7, 12, 1, 1, 1.5),
  },
  {
    id: 'ancient_moss_golem',
    index: 11,
    name: 'Ancient Moss Golem',
    rarity: 'Godly',
    cost: 3000,
    cap: 2,
    footprintRadius: 1.15,
    terrain: 'GROUND',
    dmgBase: 550,
    dmgMax: 6500,
    cdBase: 3.5,
    cdMax: 2.1,
    rangeBase: 10,
    rangeMax: 18,
    projectilesBase: 1,
    projectilesMax: 1,
    splashRadius: 4.5,
    roleSummary: '4.5-radius boulders; immune to stuns in 8-unit aura. Tectonic Slam: 5× quake + 2.5 s stun',
    elements: ['heavy'],
    canHitFlying: false,
    canHitBurrowed: true,
    isExplosive: true,
    ability: {
      id: 'tectonic_slam',
      name: 'Tectonic Slam',
      cooldown: 40,
      description: '5× damage quake + 2.5 s stun in range',
      hotkeyHint: 'Q/E/R',
    },
    primaryColor: 0x4d7c0f,
    secondaryColor: 0x57534e,
    accentColor: 0xc084fc,
    signatureAnim: {
      idle: 'Breathes, moss sways, birds land on shoulder',
      attack: 'Overhead raise, ground smash',
      impact: 'Boulder with dust trail, crater decal, rock eruption',
      lv5Extra: 'Crystals grow on back and glow on slam',
    },
    levels: buildLevels(3000, 550, 6500, 3.5, 2.1, 10, 18, 1, 1, 4.5),
  },
  {
    id: 'chrono_bloom',
    index: 12,
    name: 'Elemental Chrono-Bloom',
    rarity: 'Exclusive',
    cost: 4200,
    cap: 1,
    footprintRadius: 1.05,
    terrain: 'HYBRID',
    dmgBase: 400,
    dmgMax: 4800,
    cdBase: 1.2,
    cdMax: 0.55,
    rangeBase: 16,
    rangeMax: 28,
    projectilesBase: 1,
    projectilesMax: 1,
    splashRadius: 3.0,
    roleSummary: 'Cycles Solar (Burn), Frost (Chill), Arcane (Chain Lightning). Chrono Tsunami: stops time 5.0 s',
    elements: ['burn', 'chill', 'arcane'],
    canHitFlying: true,
    canHitBurrowed: true,
    ability: {
      id: 'chrono_tsunami',
      name: 'Chrono Tsunami',
      cooldown: 55,
      description: 'Stops enemies 5.0 s, wave pushes them back, allies +20% APM',
      hotkeyHint: 'Q/E/R',
    },
    primaryColor: 0x2dd4bf,
    secondaryColor: 0xfbbf24,
    accentColor: 0xa78bfa,
    signatureAnim: {
      idle: 'Three orbs orbit, petals tick like a clock',
      attack: 'Orb launches matching element',
      impact: 'Solar: fire nova. Frost: ice spikes. Arcane: jagged chain lightning',
      lv5Extra: 'Clock-hand halo, time-ripple distortion around it',
    },
    levels: buildLevels(4200, 400, 4800, 1.2, 0.55, 16, 28, 1, 1, 3.0),
  },
  // Spec v3 §7 New Units (13-15)
  {
    id: 'bamboo_archer',
    index: 13,
    name: 'Bamboo Archer',
    rarity: 'Uncommon',
    cost: 375,
    cap: 6,
    footprintRadius: 0.72,
    terrain: 'CLIFF',
    dmgBase: 30,
    dmgMax: 290,
    cdBase: 1.6,
    cdMax: 0.95,
    rangeBase: 15,
    rangeMax: 24,
    projectilesBase: 1,
    projectilesMax: 3,
    splashRadius: 0,
    roleSummary: 'CLIFF only. Long-range piercing arrow (hits up to 3 enemies in a line). Hits flying.',
    elements: ['physical'],
    canHitFlying: true,
    canHitBurrowed: false,
    isPiercing: true,
    primaryColor: 0x84cc16,
    secondaryColor: 0x3f6212,
    accentColor: 0xbef264,
    signatureAnim: {
      idle: 'Stalks sway; leaves flick like ears',
      attack: 'Top stalk bends back like a bow (0.25 s), snaps forward',
      impact: 'Bamboo arrow with green ribbon trail; pierce sparks per enemy',
      lv5Extra: 'Arrows split into 3 at the end of range',
    },
    levels: buildLevels(375, 30, 290, 1.6, 0.95, 15, 24, 1, 3, 0),
  },
  {
    id: 'puffball_mushroom',
    index: 14,
    name: 'Puffball Spore Mushroom',
    rarity: 'Rare',
    cost: 600,
    cap: 5,
    footprintRadius: 0.82,
    terrain: 'GROUND',
    dmgBase: 12,
    dmgMax: 120,
    cdBase: 3.0,
    cdMax: 2.4,
    rangeBase: 8,
    rangeMax: 12,
    projectilesBase: 1,
    projectilesMax: 1,
    splashRadius: 2.5,
    roleSummary: 'Drops a poison cloud (radius 2.5, 4 s) on track. Poison stacks 3×. Hits burrowed moles.',
    elements: ['poison'],
    canHitFlying: false,
    canHitBurrowed: true,
    isPoisonCloud: true,
    primaryColor: 0xa855f7,
    secondaryColor: 0x84cc16,
    accentColor: 0xd8b4fe,
    signatureAnim: {
      idle: 'Cap breathes slowly, small spores drift',
      attack: 'Cap squashes down hard (0.12 s), puff',
      impact: 'Green-purple cloud, soft swirling particles, poison decal',
      lv5Extra: 'Cloud gets glowing eyes and follows enemies slowly',
    },
    levels: buildLevels(600, 12, 120, 3.0, 2.4, 8, 12, 1, 1, 2.5),
  },
  {
    id: 'sunflower_beacon',
    index: 15,
    name: 'Sunflower Solar Beacon',
    rarity: 'Legendary',
    cost: 1000,
    cap: 3,
    footprintRadius: 0.9,
    terrain: 'GROUND',
    dmgBase: 0,
    dmgMax: 0,
    cdBase: 2.0,
    cdMax: 2.0,
    rangeBase: 8,
    rangeMax: 13,
    projectilesBase: 0,
    projectilesMax: 0,
    splashRadius: 0,
    roleSummary: 'Aura: +6% → +15% crit chance to nearby towers. Solar Flare (Lv.4): guaranteed crits 4 s, 35 s CD.',
    elements: ['support', 'crit_aura'],
    canHitFlying: false,
    canHitBurrowed: false,
    isSupport: true,
    ability: {
      id: 'solar_flare',
      name: 'Solar Flare',
      cooldown: 35,
      description: 'All towers in range guaranteed crit for 4 s + Overcharge Laser ramp 2×',
      hotkeyHint: 'Q/E/R',
    },
    primaryColor: 0xfacc15,
    secondaryColor: 0x78350f,
    accentColor: 0xfef08a,
    signatureAnim: {
      idle: 'Face turns to follow the sun angle',
      attack: 'Petals flare open on each aura pulse',
      impact: 'Warm light rays to buffed towers, lens flare',
      lv5Extra: 'Face becomes a tiny sun; heat shimmer ring',
    },
    levels: buildLevels(1000, 0, 0, 2.0, 2.0, 8, 13, 0, 0, 0, false, true, 0.06, 0.15),
  },
  // Spec v4 Doc 06 §1 New Tactical Unit Roles (16–20)
  {
    id: 'bramble_snare',
    index: 16,
    name: 'Bramble Snare',
    rarity: 'Uncommon',
    cost: 300,
    cap: 6,
    footprintRadius: 0.72,
    terrain: 'PATH',
    dmgBase: 18,
    dmgMax: 160,
    cdBase: 1.0,
    cdMax: 0.75,
    rangeBase: 1.8,
    rangeMax: 2.5,
    projectilesBase: 1,
    projectilesMax: 1,
    splashRadius: 1.8,
    roleSummary: 'Placed ON the track. Pests stepping on thorns take 18→160 dmg/s & −25% speed (40→120 hits).',
    elements: ['bleed'],
    canHitFlying: false,
    canHitBurrowed: true,
    isTrap: true,
    trapHitsBase: 40,
    trapHitsMax: 120,
    primaryColor: 0x15803d,
    secondaryColor: 0x713f12,
    accentColor: 0xbe123c,
    signatureAnim: {
      idle: 'Thorny coils twitch over soil bed',
      attack: 'Thorns snap upward as pest steps over',
      impact: 'Blood-thorn splinters & cracks as durability drops',
      lv5Extra: 'Crimson rose blooms weave along spikes',
    },
    levels: buildLevels(300, 18, 160, 1.0, 0.75, 1.8, 2.5, 1, 1, 1.8),
  },
  {
    id: 'garden_roller',
    index: 17,
    name: 'Garden Roller',
    rarity: 'Rare',
    cost: 650,
    cap: 2,
    footprintRadius: 0.85,
    terrain: 'PATH',
    dmgBase: 120,
    dmgMax: 1400,
    cdBase: 20.0,
    cdMax: 20.0,
    rangeBase: 2.0,
    rangeMax: 2.4,
    projectilesBase: 1,
    projectilesMax: 1,
    splashRadius: 2.0,
    roleSummary: 'Placed ON path; rolls toward spawn at 2.5 u/s crushing bugs for 120→1,400 dmg. No sell refund.',
    elements: ['heavy'],
    canHitFlying: false,
    canHitBurrowed: true,
    isRoller: true,
    primaryColor: 0xb45309,
    secondaryColor: 0x475569,
    accentColor: 0xfacc15,
    signatureAnim: {
      idle: 'Heavy iron drum spins forward',
      attack: 'Bounces over stone bumps leaving striped track',
      impact: 'Squashes pests into confetti + stone sparks',
      lv5Extra: 'Golden spiked drum leaves fiery wheel tracks',
    },
    levels: buildLevels(650, 120, 1400, 20.0, 20.0, 2.0, 2.4, 1, 1, 2.0),
  },
  {
    id: 'gnome_barracks',
    index: 18,
    name: 'Gnome Barracks',
    rarity: 'Legendary',
    cost: 1200,
    cap: 2,
    footprintRadius: 0.95,
    terrain: 'GROUND',
    dmgBase: 25,
    dmgMax: 300,
    cdBase: 6.0,
    cdMax: 3.5,
    rangeBase: 10,
    rangeMax: 14,
    projectilesBase: 1,
    projectilesMax: 1,
    splashRadius: 0,
    roleSummary: 'Every 6→3.5 s dispatches a Gnome Soldier (150→1,800 HP, 25→300 dmg) marching up the path.',
    elements: ['physical'],
    canHitFlying: false,
    canHitBurrowed: false,
    isSpawner: true,
    spawnHpBase: 150,
    spawnHpMax: 1800,
    primaryColor: 0xdc2626,
    secondaryColor: 0x78350f,
    accentColor: 0xfde047,
    signatureAnim: {
      idle: 'Chimney puffs cozy moss smoke',
      attack: 'Door swings open as gnome hops onto path',
      impact: 'Gnome swings shovel & poofs into leaves on KO',
      lv5Extra: 'Gnomes wear gleaming knight helmets',
    },
    levels: buildLevels(1200, 25, 300, 6.0, 3.5, 10, 14, 1, 1, 0),
  },
  {
    id: 'walnut_wall',
    index: 19,
    name: 'Walnut Wall',
    rarity: 'Common',
    cost: 150,
    cap: 30,
    footprintRadius: 0.78,
    terrain: 'PATH',
    dmgBase: 0,
    dmgMax: 0,
    cdBase: 1.0,
    cdMax: 1.0,
    rangeBase: 1.5,
    rangeMax: 1.8,
    projectilesBase: 0,
    projectilesMax: 0,
    splashRadius: 0,
    roleSummary: 'Placed ON path. Halts non-boss bugs (800→9,000 HP) while they chew through.',
    elements: ['heavy'],
    canHitFlying: false,
    canHitBurrowed: false,
    isWall: true,
    wallHpBase: 800,
    wallHpMax: 9000,
    primaryColor: 0x92400e,
    secondaryColor: 0x451a03,
    accentColor: 0x4ade80,
    signatureAnim: {
      idle: 'Sturdy walnut shell grins calmly; wobbles at low HP',
      attack: 'Absorbs pest bites with flying shell crumbs',
      impact: 'Visible shell cracks at 66% and 33% HP',
      lv5Extra: 'Ironbound walnut shell with leafy plume',
    },
    levels: buildLevels(150, 0, 0, 1.0, 1.0, 1.5, 1.8, 0, 0, 0),
  },
  {
    id: 'sunflower_producer',
    index: 20,
    name: 'Sunflower Collector',
    rarity: 'Legendary',
    cost: 700,
    cap: 3,
    footprintRadius: 0.82,
    terrain: 'GROUND',
    dmgBase: 0,
    dmgMax: 0,
    cdBase: 8.0,
    cdMax: 6.5,
    rangeBase: 4.5,
    rangeMax: 9.0,
    projectilesBase: 0,
    projectilesMax: 0,
    splashRadius: 0,
    roleSummary: 'Collect Farm: drops bouncing Sun Coins every 8 s. Hover/tap for 100% value (50% auto after 4 s).',
    elements: ['farm'],
    canHitFlying: false,
    canHitBurrowed: false,
    isFarm: true,
    isCollectFarm: true,
    primaryColor: 0xfacc15,
    secondaryColor: 0x16a34a,
    accentColor: 0xfef08a,
    signatureAnim: {
      idle: 'Golden head turns cheerfully toward sun coins',
      attack: 'Pops bright Sun Coin onto nearby grass',
      impact: 'Magnet sparkle & chime when collected by cursor',
      lv5Extra: 'Twin suns orbit petals',
    },
    levels: buildLevels(700, 0, 0, 8.0, 6.5, 4.5, 9.0, 0, 0, 0, true, false),
  },
];

export const UNIT_MAP: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));

export function getUnitById(id: string): UnitDef {
  return UNIT_MAP[id] ?? UNITS[0];
}

export function getUnitRoleCategory(u: UnitDef): UnitRoleCategory {
  if (u.isWall) return 'Wall';
  if (u.isRoller) return 'Roller';
  if (u.isTrap) return 'Trap';
  if (u.isSpawner) return 'Spawner';
  if (u.isFarm) return 'Farm';
  if (u.isSupport) return 'Support';
  if (u.elements.includes('burn') || u.elements.includes('poison')) return 'DoT';
  if (u.elements.includes('chill') || u.elements.includes('knockback')) return 'Control';
  if (u.splashRadius >= 2.0) return 'Splash';
  return 'Attacker';
}

export function getUpgradePreviewLabel(unit: UnitDef, nextLevel: number): string {
  if (nextLevel === 1) return '+Stone Ring';
  if (nextLevel === 2) return '+Mossy Roots';
  if (nextLevel === 3) return '+Runic Veins';
  if (nextLevel === 4) return unit.ability ? `+${unit.ability.name}` : '+Bloom Flowers';
  if (nextLevel === 5) return '+Awakened Crown';
  return '';
}
