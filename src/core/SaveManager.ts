import { EventBus } from './EventBus';
import { QualityManager, type QualitySettings } from './QualityManager';
import { migrateTraitId, rollRandomTrait, type TraitId } from '../data/TraitConfig';
import { UNITS, type UnitDef } from '../data/UnitRegistry';
import { CRATES, RARITIES, RARITY_ORDER, type RarityId } from '../data/RarityConfig';
import { GARDEN_PASS_TIERS, getWeeklyShopOffers } from '../data/GameModesConfig';
import type { MapId } from '../data/MapRegistry';
import {
  DIFFICULTY_LADDER,
  DIFFICULTY_ORDER,
  REDEEM_CODES,
  type DifficultyId,
  type VariantId,
  VARIANTS,
} from '../data/BalanceConfig';

export const SAVE_KEY_V1 = 'garden_bastion_save_v1';
export const SAVE_KEY_V2 = 'garden_bastion_save_v2';
export const SAVE_KEY_V3 = 'garden_bastion_save_v3';

export type SoilSkinId =
  | 'garden_loam'
  | 'mossy_stone'
  | 'crystal_bed'
  | 'golden_sand'
  | 'galaxy_soil'
  | 'lava_rock';

export type TargetingModeValue = 'First' | 'Strongest' | 'Last' | 'Closest' | 'Weakest';

export interface OwnedUnitData {
  unitId: string;
  copies: number;
  fusedStacks: number; // +5% permanent damage per stack (3 copies -> +1 stack)
  trait: TraitId;
  traitLocked: boolean;
  masteryXp: number;
  masteryLevel: number; // 0..10 (+1% damage/level)
  soilSkin: SoilSkinId;
  isPrime?: boolean; // v3 §13.4 +12% all stats
  variant?: VariantId; // v4 Doc 06 §6
  locked?: boolean; // v4 Doc 03 §2.6
  favorite?: boolean; // v4 Doc 03 §2.2
  seen?: boolean; // v4 Doc 01 §3.3 NEW badge
}

export interface TeamPreset {
  name: string;
  slots: Array<string | null>; // length 6
}

export interface PullHistoryEntry {
  timestamp: number;
  banner: string;
  unitId: string;
  rarity: RarityId;
  variant: VariantId;
}

export interface DailyQuestState {
  id: string;
  title: string;
  type: 'kill_ant' | 'steam_burst' | 'win_hard' | 'summon' | 'upgrade_max';
  target: number;
  progress: number;
  rewardSeeds: number;
  rewardEnchantedCrate?: number;
  claimed: boolean;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  rewardSeeds: number;
}

export interface LeaderboardEntry {
  bestWave: number;
  fastestClearSec: number;
  topHit: number;
}

export interface EndlessRunEntry {
  wave: number;
  team: string[];
  date: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_godly', title: 'Divine Sprout', description: 'Pull your first Godly or Exclusive unit', icon: '✨', rewardSeeds: 150 },
  { id: 'beat_insane', title: 'Master Gardener', description: 'Clear any map on Insane difficulty', icon: '🏆', rewardSeeds: 300 },
  { id: 'endless_50', title: 'Eternal Bloom', description: 'Reach Endless Wave 50', icon: '♾️', rewardSeeds: 400 },
  { id: 'max_unit', title: 'Awakened Flora', description: 'Upgrade a unit to Lv.5 in a match', icon: '🌟', rewardSeeds: 100 },
  { id: 'synergy_master', title: 'Alchemist', description: 'Trigger 25 Element Synergies', icon: '⚗️', rewardSeeds: 120 },
  { id: 'trait_gold', title: 'Midas Touch', description: 'Roll a Golden or Celestial trait', icon: '👑', rewardSeeds: 150 },
  { id: 'boss_slayer', title: 'Boss Slayer', description: 'Clear Boss Rush mode', icon: '🐉', rewardSeeds: 250 },
  { id: 'volcano_insane', title: 'Magma Gardener', description: 'Clear Volcano Greenhouse on Insane (unlocks Lava Rock soil)', icon: '🌋', rewardSeeds: 350 },
];

export interface SaveStateV2 {
  version: 2;
  seeds: number;
  dewdrops: number;
  enchantedKeys: number;
  playerLevel: number;
  playerXp: number;
  selectedMap: MapId;
  selectedDifficulty: DifficultyId;
  loadout: Array<string | null>;
  owned: Record<string, OwnedUnitData>;
  pity: {
    classicSinceLeg: number;
    classicSinceMyth: number;
    enchantedSinceMyth: number;
    enchantedSinceGodly: number;
  };
  dailyQuestDate: string;
  dailyQuests: DailyQuestState[];
  achievements: Record<string, boolean>;
  stats: {
    totalKills: number;
    totalSynergies: number;
    highestEndlessWave: number;
    cratesOpened: number;
    matchesWon: number;
  };
  leaderboard: Record<string, Record<string, LeaderboardEntry>>;
  gardenPass: {
    season: number;
    xp: number;
    tier: number;
    claimed: number[];
  };
  bestiarySeen: string[];
  codexSeen: string[];
  puzzleStars: Record<number, number>;
  targetingMemory: Record<string, TargetingModeValue>;
  tutorialCompleted: boolean;
  tutorialSkipped: boolean;
  settings: QualitySettings;
}

export interface SaveStateV3 extends Omit<SaveStateV2, 'version'> {
  version: 3;
  eventTickets: number;
  teamPresets: TeamPreset[];
  activePreset: number;
  modifiersBest: Record<string, Record<string, number>>;
  survivalProgress: Record<string, { bestWave: number; cleared: DifficultyId[] }>;
  shop: { weekKey: string; stock: Record<string, number> };
  codesUsed: string[];
  questGnomeXp: number;
  questGnomeClaimed: number[];
  unlockedDifficulties: Record<string, DifficultyId[]>;
  endlessPodium: Record<string, EndlessRunEntry[]>;
  storyCleared: number[];
  pullHistory: PullHistoryEntry[];
  whatsNewSeenVersion: string;
  fastSummons: boolean;
  autoRecycleCommons: boolean;
  hourlyStreak: number;
  avatarColors?: { hat: number; shirt: number; can: number };
}

function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function createDailyQuests(): DailyQuestState[] {
  return [
    {
      id: 'q_ants',
      title: 'Defeat 300 Scout Ants',
      type: 'kill_ant',
      target: 300,
      progress: 0,
      rewardSeeds: 60,
      claimed: false,
    },
    {
      id: 'q_steam',
      title: 'Trigger 20 Steam Bursts',
      type: 'steam_burst',
      target: 20,
      progress: 0,
      rewardSeeds: 80,
      claimed: false,
    },
    {
      id: 'q_hard',
      title: 'Win a match on Hard+',
      type: 'win_hard',
      target: 1,
      progress: 0,
      rewardSeeds: 0,
      rewardEnchantedCrate: 1,
      claimed: false,
    },
  ];
}

export function mapV1PotSkinToSoilSkin(oldSkin?: string): SoilSkinId {
  if (oldSkin === 'mossy_stone' || oldSkin === 'mossy') return 'mossy_stone';
  if (oldSkin === 'crystal' || oldSkin === 'crystal_bed') return 'crystal_bed';
  if (oldSkin === 'golden' || oldSkin === 'golden_sand') return 'golden_sand';
  if (oldSkin === 'galaxy' || oldSkin === 'galaxy_soil') return 'galaxy_soil';
  if (oldSkin === 'lava_rock') return 'lava_rock';
  return 'garden_loam';
}

export function createDefaultSaveV2(): SaveStateV2 {
  return {
    version: 2,
    seeds: 400,
    dewdrops: 5,
    enchantedKeys: 0,
    playerLevel: 1,
    playerXp: 0,
    selectedMap: 'sunny_backyard',
    selectedDifficulty: 'Easy',
    loadout: ['tomato_tosser', 'cactus_striker', null, null, null, null],
    owned: {
      tomato_tosser: {
        unitId: 'tomato_tosser',
        copies: 1,
        fusedStacks: 0,
        trait: 'Keen II',
        traitLocked: false,
        masteryXp: 0,
        masteryLevel: 0,
        soilSkin: 'garden_loam',
        variant: 'none',
        locked: false,
        favorite: false,
        seen: true,
      },
      cactus_striker: {
        unitId: 'cactus_striker',
        copies: 1,
        fusedStacks: 0,
        trait: 'Mighty II',
        traitLocked: false,
        masteryXp: 0,
        masteryLevel: 0,
        soilSkin: 'garden_loam',
        variant: 'none',
        locked: false,
        favorite: false,
        seen: true,
      },
    },
    pity: {
      classicSinceLeg: 0,
      classicSinceMyth: 0,
      enchantedSinceMyth: 0,
      enchantedSinceGodly: 0,
    },
    dailyQuestDate: getTodayDateString(),
    dailyQuests: createDailyQuests(),
    achievements: {},
    stats: {
      totalKills: 0,
      totalSynergies: 0,
      highestEndlessWave: 0,
      cratesOpened: 0,
      matchesWon: 0,
    },
    leaderboard: {},
    gardenPass: {
      season: 1,
      xp: 0,
      tier: 0,
      claimed: [],
    },
    bestiarySeen: [],
    codexSeen: [],
    puzzleStars: {},
    targetingMemory: {},
    tutorialCompleted: false,
    tutorialSkipped: false,
    settings: { ...QualityManager.settings },
  };
}

export function createDefaultSaveV3(): SaveStateV3 {
  const v2 = createDefaultSaveV2();
  const weeklyShop = getWeeklyShopOffers();
  const initialStock: Record<string, number> = {};
  for (const offer of weeklyShop.offers) initialStock[offer.unitId] = offer.maxStock;
  return {
    ...v2,
    version: 3,
    eventTickets: 2,
    teamPresets: [
      { name: '① Main Squad', slots: [...v2.loadout] },
      { name: '② Boss Hunters', slots: [...v2.loadout] },
      { name: '③ Farm & Chill', slots: [...v2.loadout] },
    ],
    activePreset: 0,
    modifiersBest: {},
    survivalProgress: {},
    shop: { weekKey: weeklyShop.weekKey, stock: initialStock },
    codesUsed: [],
    questGnomeXp: 0,
    questGnomeClaimed: [],
    unlockedDifficulties: {},
    endlessPodium: {},
    storyCleared: [],
    pullHistory: [],
    whatsNewSeenVersion: '',
    fastSummons: false,
    autoRecycleCommons: false,
    hourlyStreak: 0,
    avatarColors: { hat: 0xfde047, shirt: 0x22c55e, can: 0x38bdf8 },
  };
}

export function migrateSaveToV2(rawParsed: Record<string, unknown>): SaveStateV2 {
  const def = createDefaultSaveV2();
  const rawOwned = (rawParsed.owned ?? {}) as Record<string, Record<string, unknown>>;
  const migratedOwned: Record<string, OwnedUnitData> = {};

  for (const [k, u] of Object.entries(rawOwned)) {
    const soilSkin = mapV1PotSkinToSoilSkin((u.soilSkin as string) ?? (u.potSkin as string));
    migratedOwned[k] = {
      unitId: String(u.unitId ?? k),
      copies: Number(u.copies ?? 1),
      fusedStacks: Number(u.fusedStacks ?? 0),
      trait: migrateTraitId(u.trait as string | undefined),
      traitLocked: Boolean(u.traitLocked),
      masteryXp: Number(u.masteryXp ?? 0),
      masteryLevel: Number(u.masteryLevel ?? 0),
      soilSkin,
      isPrime: Boolean(u.isPrime),
      variant: (u.variant as VariantId) ?? 'none',
      locked: Boolean(u.locked),
      favorite: Boolean(u.favorite),
      seen: u.seen === undefined ? true : Boolean(u.seen),
    };
  }

  return {
    ...def,
    ...(rawParsed as Partial<SaveStateV2>),
    version: 2,
    owned: Object.keys(migratedOwned).length > 0 ? migratedOwned : def.owned,
    pity: { ...def.pity, ...((rawParsed.pity as object) ?? {}) },
    stats: { ...def.stats, ...((rawParsed.stats as object) ?? {}) },
    settings: { ...def.settings, ...((rawParsed.settings as object) ?? {}) },
    loadout:
      Array.isArray(rawParsed.loadout) && rawParsed.loadout.length === 6
        ? (rawParsed.loadout as Array<string | null>)
        : def.loadout,
    dailyQuests:
      Array.isArray(rawParsed.dailyQuests) && rawParsed.dailyQuests.length === 3
        ? (rawParsed.dailyQuests as DailyQuestState[])
        : def.dailyQuests,
    achievements: { ...((rawParsed.achievements as Record<string, boolean>) ?? {}) },
    leaderboard: { ...((rawParsed.leaderboard as SaveStateV2['leaderboard']) ?? {}) },
    gardenPass: { ...def.gardenPass, ...((rawParsed.gardenPass as object) ?? {}) },
    bestiarySeen: Array.isArray(rawParsed.bestiarySeen) ? (rawParsed.bestiarySeen as string[]) : [],
    codexSeen: Array.isArray(rawParsed.codexSeen) ? (rawParsed.codexSeen as string[]) : [],
    puzzleStars: { ...((rawParsed.puzzleStars as Record<number, number>) ?? {}) },
    targetingMemory: { ...((rawParsed.targetingMemory as Record<string, TargetingModeValue>) ?? {}) },
  };
}

export function migrateSaveToV3(rawParsed: Record<string, unknown>): SaveStateV3 {
  const def = createDefaultSaveV3();
  const baseV2 = migrateSaveToV2(rawParsed);
  const rawPresets = Array.isArray(rawParsed.teamPresets) ? (rawParsed.teamPresets as TeamPreset[]) : null;
  const presets =
    rawPresets && rawPresets.length >= 3
      ? rawPresets
      : [
          { name: '① Main Squad', slots: [...baseV2.loadout] },
          { name: '② Boss Hunters', slots: [...baseV2.loadout] },
          { name: '③ Farm & Chill', slots: [...baseV2.loadout] },
        ];
  const activePreset = Math.max(0, Math.min(presets.length - 1, Number(rawParsed.activePreset ?? 0)));

  return {
    ...def,
    ...baseV2,
    ...(rawParsed as Partial<SaveStateV3>),
    version: 3,
    owned: baseV2.owned,
    pity: baseV2.pity,
    stats: baseV2.stats,
    settings: baseV2.settings,
    dailyQuests: baseV2.dailyQuests,
    gardenPass: baseV2.gardenPass,
    teamPresets: presets,
    activePreset,
    loadout: presets[activePreset].slots,
    modifiersBest: { ...((rawParsed.modifiersBest as SaveStateV3['modifiersBest']) ?? {}) },
    survivalProgress: { ...((rawParsed.survivalProgress as SaveStateV3['survivalProgress']) ?? {}) },
    shop: { ...def.shop, ...((rawParsed.shop as SaveStateV3['shop']) ?? {}) },
    codesUsed: Array.isArray(rawParsed.codesUsed) ? (rawParsed.codesUsed as string[]) : [],
    questGnomeClaimed: Array.isArray(rawParsed.questGnomeClaimed) ? (rawParsed.questGnomeClaimed as number[]) : [],
    unlockedDifficulties: { ...((rawParsed.unlockedDifficulties as Record<string, DifficultyId[]>) ?? {}) },
    endlessPodium: { ...((rawParsed.endlessPodium as Record<string, EndlessRunEntry[]>) ?? {}) },
    storyCleared: Array.isArray(rawParsed.storyCleared) ? (rawParsed.storyCleared as number[]) : [],
    pullHistory: Array.isArray(rawParsed.pullHistory) ? (rawParsed.pullHistory as PullHistoryEntry[]) : [],
  };
}

class SaveManagerImpl {
  public data: SaveStateV3 = createDefaultSaveV3();

  constructor() {
    this.load();
    this.bindEvents();
  }

  private bindEvents(): void {
    EventBus.on('quest:progress', ({ type, amount }) => {
      let changed = false;
      for (const q of this.data.dailyQuests) {
        if (q.type === type && !q.claimed && q.progress < q.target) {
          q.progress = Math.min(q.target, q.progress + amount);
          changed = true;
        }
      }
      if (type === 'steam_burst') {
        this.data.stats.totalSynergies += amount;
        if (this.data.stats.totalSynergies >= 25) {
          this.unlockAchievement('synergy_master');
        }
        changed = true;
      }
      if (type === 'upgrade_max') {
        this.unlockAchievement('max_unit');
      }
      if (changed) this.save();
    });
  }

  public load(): void {
    try {
      const rawV3 = localStorage.getItem(SAVE_KEY_V3);
      if (rawV3) {
        this.data = migrateSaveToV3(JSON.parse(rawV3) as Record<string, unknown>);
        this.checkDailyAndShopReset();
        QualityManager.applySettings(this.data.settings, false);
        return;
      }

      // Migrate v2 -> v3, keeping v2 intact
      const rawV2 = localStorage.getItem(SAVE_KEY_V2);
      if (rawV2) {
        this.data = migrateSaveToV3(JSON.parse(rawV2) as Record<string, unknown>);
        this.checkDailyAndShopReset();
        QualityManager.applySettings(this.data.settings, false);
        this.save();
        return;
      }

      // Migrate v1 -> v3, keeping v1 intact
      const rawV1 = localStorage.getItem(SAVE_KEY_V1);
      if (rawV1) {
        this.data = migrateSaveToV3(JSON.parse(rawV1) as Record<string, unknown>);
        this.checkDailyAndShopReset();
        QualityManager.applySettings(this.data.settings, false);
        this.save();
        return;
      }

      this.data = createDefaultSaveV3();
      this.save();
    } catch {
      this.data = createDefaultSaveV3();
      this.save();
    }
  }

  public checkDailyReset(): void {
    this.checkDailyAndShopReset();
  }

  public checkDailyAndShopReset(): void {
    let dirty = false;
    const today = getTodayDateString();
    if (this.data.dailyQuestDate !== today) {
      this.data.dailyQuestDate = today;
      this.data.dailyQuests = createDailyQuests();
      dirty = true;
    }
    const weeklyShop = getWeeklyShopOffers();
    if (this.data.shop.weekKey !== weeklyShop.weekKey) {
      const stock: Record<string, number> = {};
      for (const o of weeklyShop.offers) stock[o.unitId] = o.maxStock;
      this.data.shop = { weekKey: weeklyShop.weekKey, stock };
      dirty = true;
    }
    if (dirty) this.save();
  }

  public save(): void {
    this.data.settings = { ...QualityManager.settings };
    if (this.data.teamPresets[this.data.activePreset]) {
      this.data.teamPresets[this.data.activePreset].slots = [...this.data.loadout];
    }
    try {
      localStorage.setItem(SAVE_KEY_V3, JSON.stringify(this.data));
    } catch {
      // Ignore storage quota errors
    }
    EventBus.emit('save:updated', undefined);
  }

  public resetSave(): void {
    this.data = createDefaultSaveV3();
    QualityManager.applySettings(this.data.settings, true);
    this.save();
  }

  public exportSaveBase64(): string {
    return btoa(unescape(encodeURIComponent(JSON.stringify(this.data))));
  }

  public importSaveBase64(encoded: string): boolean {
    try {
      const json = decodeURIComponent(escape(atob(encoded.trim())));
      const parsed = JSON.parse(json) as Record<string, unknown>;
      this.data = migrateSaveToV3(parsed);
      QualityManager.applySettings(this.data.settings, true);
      this.save();
      return true;
    } catch {
      return false;
    }
  }

  /** Doc 06 §7 Active boost windows (Weekend ×2 Seeds, daily clock-synced Luck Hour). */
  public getActiveBoosts(now = new Date()): {
    doubleSeeds: boolean;
    doubleLuck: boolean;
    luckCountdownSec: number;
  } {
    const day = now.getDay();
    const doubleSeeds = day === 0 || day === 6;
    const luckHour = (now.getDate() * 7 + now.getMonth() * 5) % 24;
    const doubleLuck = now.getHours() === luckHour;
    const secsIntoHour = now.getMinutes() * 60 + now.getSeconds();
    return {
      doubleSeeds,
      doubleLuck,
      luckCountdownSec: doubleLuck ? Math.max(0, 3600 - secsIntoHour) : 0,
    };
  }

  public addSeeds(amount: number): void {
    this.data.seeds = Math.max(0, this.data.seeds + Math.round(amount));
    this.save();
  }

  public addDewdrops(amount: number): void {
    this.data.dewdrops = Math.max(0, this.data.dewdrops + Math.round(amount));
    this.save();
  }

  public addPlayerXp(xp: number): void {
    this.data.playerXp += Math.round(xp);
    let needed = this.data.playerLevel * 200;
    while (this.data.playerXp >= needed) {
      this.data.playerXp -= needed;
      this.data.playerLevel++;
      this.data.seeds += 50;
      if (this.data.playerLevel === 15 && this.data.teamPresets.length < 4) {
        this.data.teamPresets.push({ name: '④ Endless', slots: [...this.data.loadout] });
      }
      if (this.data.playerLevel === 30 && this.data.teamPresets.length < 5) {
        this.data.teamPresets.push({ name: '⑤ Blight', slots: [...this.data.loadout] });
      }
      needed = this.data.playerLevel * 200;
    }

    // Garden Pass XP
    this.data.gardenPass.xp += Math.round(xp);
    let newTier = this.data.gardenPass.tier;
    for (const t of GARDEN_PASS_TIERS) {
      if (this.data.gardenPass.xp >= t.xpRequired && t.tier > newTier) {
        newTier = t.tier;
      }
    }
    if (newTier > this.data.gardenPass.tier) {
      this.data.gardenPass.tier = newTier;
      EventBus.emit('toast:show', {
        title: `🌿 Garden Pass Tier ${newTier} Reached!`,
        subtitle: 'Claim your reward in the Pass menu',
        color: '#4ade80',
      });
    }
    this.save();
  }

  public claimGardenPassTier(tier: number): boolean {
    if (this.data.gardenPass.tier < tier || this.data.gardenPass.claimed.includes(tier)) return false;
    const def = GARDEN_PASS_TIERS.find((t) => t.tier === tier);
    if (!def) return false;
    this.data.gardenPass.claimed.push(tier);
    if (def.seeds) this.data.seeds += def.seeds;
    if (def.dewdrops) this.data.dewdrops += def.dewdrops;
    if (def.unitId) this.grantUnit(def.unitId);
    this.save();
    return true;
  }

  public grantUnit(unitId: string, variant: VariantId = 'none'): void {
    const existing = this.data.owned[unitId];
    if (!existing) {
      this.data.owned[unitId] = {
        unitId,
        copies: 1,
        fusedStacks: 0,
        trait: rollRandomTrait(),
        traitLocked: false,
        masteryXp: 0,
        masteryLevel: 0,
        soilSkin: 'garden_loam',
        variant,
        locked: false,
        favorite: false,
        seen: false,
      };
      const emptySlot = this.data.loadout.indexOf(null);
      if (emptySlot !== -1) this.data.loadout[emptySlot] = unitId;
    } else {
      existing.copies += 1;
      if (variant !== 'none' && existing.variant === 'none') existing.variant = variant;
    }
  }

  public switchTeamPreset(index: number): void {
    if (index < 0 || index >= this.data.teamPresets.length) return;
    this.data.activePreset = index;
    this.data.loadout = [...this.data.teamPresets[index].slots];
    this.save();
  }

  public renameTeamPreset(index: number, name: string): void {
    if (!this.data.teamPresets[index] || !name.trim()) return;
    this.data.teamPresets[index].name = name.trim().slice(0, 18);
    this.save();
  }

  public isDifficultyUnlocked(mapId: MapId, diff: DifficultyId): boolean {
    if (diff === 'Easy') return true;
    const unlocked = this.data.unlockedDifficulties[mapId] ?? [];
    if (unlocked.includes(diff)) return true;
    const idx = DIFFICULTY_ORDER.indexOf(diff);
    const prev = DIFFICULTY_ORDER[idx - 1];
    if (diff === 'Blight') {
      const apocMaps = Object.values(this.data.unlockedDifficulties).filter((arr) =>
        arr.includes('Blight') || arr.includes('Apocalypse')
      ).length;
      return apocMaps >= 3 && unlocked.includes('Apocalypse');
    }
    return prev ? unlocked.includes(diff) : true;
  }

  public unlockNextDifficulty(mapId: MapId, clearedDiff: DifficultyId): void {
    if (!this.data.unlockedDifficulties[mapId]) {
      this.data.unlockedDifficulties[mapId] = ['Easy'];
    }
    const list = this.data.unlockedDifficulties[mapId];
    if (!list.includes(clearedDiff)) list.push(clearedDiff);
    const idx = DIFFICULTY_ORDER.indexOf(clearedDiff);
    const next = DIFFICULTY_ORDER[idx + 1];
    if (next && !list.includes(next)) {
      list.push(next);
    }
    this.save();
  }

  public recordLeaderboard(
    mapId: string,
    difficulty: string,
    wave: number,
    clearSec: number,
    topHit: number
  ): void {
    if (!this.data.leaderboard[mapId]) this.data.leaderboard[mapId] = {};
    const prev = this.data.leaderboard[mapId][difficulty] ?? {
      bestWave: 0,
      fastestClearSec: 0,
      topHit: 0,
    };
    prev.bestWave = Math.max(prev.bestWave, wave);
    if (clearSec > 0 && (prev.fastestClearSec === 0 || clearSec < prev.fastestClearSec)) {
      prev.fastestClearSec = Math.round(clearSec);
    }
    prev.topHit = Math.max(prev.topHit, Math.round(topHit));
    this.data.leaderboard[mapId][difficulty] = prev;
    this.save();
  }

  public recordEndlessPodium(mapId: string, wave: number): void {
    if (wave <= 0) return;
    if (!this.data.endlessPodium[mapId]) this.data.endlessPodium[mapId] = [];
    this.data.endlessPodium[mapId].push({
      wave,
      team: this.data.loadout.filter((x): x is string => Boolean(x)),
      date: getTodayDateString(),
    });
    this.data.endlessPodium[mapId].sort((a, b) => b.wave - a.wave);
    this.data.endlessPodium[mapId] = this.data.endlessPodium[mapId].slice(0, 3);
    this.save();
  }

  public markEnemySeen(enemyId: string): void {
    if (!this.data.bestiarySeen.includes(enemyId)) {
      this.data.bestiarySeen.push(enemyId);
    }
  }

  public markSynergySeen(synergyId: string): void {
    if (!this.data.codexSeen.includes(synergyId)) {
      this.data.codexSeen.push(synergyId);
      this.save();
    }
  }

  public markUnitSeen(unitId: string): void {
    const owned = this.data.owned[unitId];
    if (owned && !owned.seen) {
      owned.seen = true;
      this.save();
    }
  }

  public toggleUnitLock(unitId: string): void {
    const owned = this.data.owned[unitId];
    if (!owned) return;
    owned.locked = !owned.locked;
    this.save();
  }

  public toggleUnitFavorite(unitId: string): void {
    const owned = this.data.owned[unitId];
    if (!owned) return;
    owned.favorite = !owned.favorite;
    this.save();
  }

  public recycleSpareCopy(unitId: string, rarity: RarityId): number {
    const owned = this.data.owned[unitId];
    if (!owned || owned.locked || owned.copies <= 1) return 0;
    owned.copies -= 1;
    const gain = Math.max(1, RARITIES[rarity].dewdropsOnDupe);
    this.data.dewdrops += gain;
    this.save();
    return gain;
  }

  public getUnitBonusDamageMult(unitId: string): number {
    const owned = this.data.owned[unitId];
    if (!owned) return 1.0;
    const primeMult = owned.isPrime ? 1.12 : 1.0;
    const variantMult = VARIANTS[owned.variant ?? 'none']?.statMult ?? 1.0;
    return (1 + owned.fusedStacks * 0.05 + owned.masteryLevel * 0.01) * primeMult * variantMult;
  }

  public getUnitPrimeStatMult(unitId: string): number {
    const owned = this.data.owned[unitId];
    if (!owned) return 1.0;
    const primeMult = owned.isPrime ? 1.12 : 1.0;
    const variantMult = VARIANTS[owned.variant ?? 'none']?.statMult ?? 1.0;
    return primeMult * variantMult;
  }

  public evolveUnitToPrime(unitId: string): boolean {
    const owned = this.data.owned[unitId];
    if (!owned || owned.isPrime || owned.masteryLevel < 10 || this.data.dewdrops < 3) {
      return false;
    }
    this.data.dewdrops -= 3;
    owned.isPrime = true;
    owned.soilSkin = 'golden_sand';
    this.save();
    return true;
  }

  public addUnitMasteryXp(unitId: string, dmgDealt: number): void {
    const owned = this.data.owned[unitId];
    if (!owned || owned.masteryLevel >= 10) return;
    owned.masteryXp += Math.max(1, Math.round(dmgDealt * 0.02));
    while (owned.masteryLevel < 10) {
      const req = (owned.masteryLevel + 1) * 500;
      if (owned.masteryXp < req) break;
      owned.masteryXp -= req;
      owned.masteryLevel++;
      if (owned.masteryLevel === 5 && owned.soilSkin === 'garden_loam') {
        owned.soilSkin = 'mossy_stone';
      }
      if (owned.masteryLevel === 10) {
        owned.soilSkin = 'golden_sand';
      }
    }
  }

  public getUnlockedSoilSkins(unitId: string): SoilSkinId[] {
    const owned = this.data.owned[unitId];
    const skins: SoilSkinId[] = ['garden_loam'];
    if (!owned) return skins;
    if (owned.masteryLevel >= 5) {
      skins.push('mossy_stone');
    }
    if (owned.masteryLevel >= 10) {
      skins.push('crystal_bed', 'golden_sand', 'galaxy_soil');
    }
    if (this.data.achievements.volcano_insane) {
      skins.push('lava_rock');
    }
    return skins;
  }

  public setSoilSkin(unitId: string, skin: SoilSkinId): void {
    const owned = this.data.owned[unitId];
    if (!owned) return;
    owned.soilSkin = skin;
    this.save();
  }

  public toggleLoadoutUnit(unitId: string): boolean {
    if (!this.data.owned[unitId]) return false;
    const existingIdx = this.data.loadout.indexOf(unitId);
    if (existingIdx >= 0) {
      const equippedCount = this.data.loadout.filter(Boolean).length;
      if (equippedCount <= 1) {
        EventBus.emit('toast:show', { title: 'Keep at least 1 unit equipped!', color: '#f43f5e' });
        return false;
      }
      this.data.loadout[existingIdx] = null;
      this.save();
      return true;
    }
    const emptyIdx = this.data.loadout.indexOf(null);
    if (emptyIdx === -1) {
      EventBus.emit('toast:show', { title: 'Loadout full (6/6). Unequip a unit first.', color: '#fbbf24' });
      return false;
    }
    this.data.loadout[emptyIdx] = unitId;
    this.save();
    return true;
  }

  public setLoadoutSlot(slotIndex: number, unitId: string | null): void {
    if (slotIndex < 0 || slotIndex >= 6) return;
    if (unitId && !this.data.owned[unitId]) return;
    if (unitId === null) {
      const equipped = this.data.loadout.filter(Boolean).length;
      if (equipped <= 1 && this.data.loadout[slotIndex] !== null) return;
    } else {
      const existing = this.data.loadout.indexOf(unitId);
      if (existing >= 0) this.data.loadout[existing] = this.data.loadout[slotIndex];
    }
    this.data.loadout[slotIndex] = unitId;
    this.save();
  }

  public fuseUnitCopies(unitId: string): boolean {
    const owned = this.data.owned[unitId];
    if (!owned || owned.copies < 4) return false;
    owned.copies -= 3;
    owned.fusedStacks += 1;
    this.save();
    EventBus.emit('toast:show', {
      title: 'Fusion Complete!',
      subtitle: `+5% permanent damage (Total +${owned.fusedStacks * 5}%)`,
      color: '#4ade80',
    });
    return true;
  }

  public rerollUnitTrait(unitId: string, currency: 'seeds' | 'dewdrops'): TraitId | null {
    const owned = this.data.owned[unitId];
    if (!owned) return null;
    if (currency === 'seeds') {
      if (this.data.seeds < 50) return null;
      this.data.seeds -= 50;
    } else {
      if (this.data.dewdrops < 1) return null;
      this.data.dewdrops -= 1;
    }
    const newTrait = rollRandomTrait();
    owned.trait = newTrait;
    owned.traitLocked = false;
    if (newTrait === 'Golden' || newTrait === 'Celestial') {
      this.unlockAchievement('trait_gold');
    }
    this.save();
    return newTrait;
  }

  public redeemCode(rawCode: string): { ok: boolean; message: string } {
    const code = rawCode.trim().toUpperCase();
    const def = REDEEM_CODES[code];
    if (!def) return { ok: false, message: 'Invalid code.' };
    if (this.data.codesUsed.includes(code)) return { ok: false, message: 'Code already redeemed.' };
    this.data.codesUsed.push(code);
    this.data.seeds += def.seeds;
    this.data.dewdrops += def.dewdrops;
    if (def.tickets) this.data.eventTickets += def.tickets;
    this.save();
    return { ok: true, message: `Redeemed: ${def.label}` };
  }

  public buyShopOffer(unitId: string): boolean {
    const offers = getWeeklyShopOffers().offers;
    const offer = offers.find((o) => o.unitId === unitId);
    if (!offer) return false;
    const stock = this.data.shop.stock[unitId] ?? 0;
    if (stock <= 0 || this.data.seeds < offer.priceSeeds) return false;
    this.data.seeds -= offer.priceSeeds;
    this.data.shop.stock[unitId] = stock - 1;
    this.grantUnit(unitId);
    this.save();
    return true;
  }

  public claimQuestGnomeMilestone(xpThreshold: number, unitId: string): boolean {
    if (this.data.questGnomeXp < xpThreshold || this.data.questGnomeClaimed.includes(xpThreshold)) return false;
    this.data.questGnomeClaimed.push(xpThreshold);
    this.grantUnit(unitId);
    this.save();
    return true;
  }

  public pullBanner(
    bannerType: 'classic' | 'enchanted' | 'featured' | 'event',
    count: 1 | 10,
    featuredUnitId?: string
  ): Array<{
    unit: UnitDef;
    rarity: RarityId;
    trait: TraitId;
    variant: VariantId;
    isNew: boolean;
    dewdropsGained: number;
  }> | null {
    const singleCost = bannerType === 'classic' ? 100 : bannerType === 'enchanted' ? 200 : bannerType === 'featured' ? 250 : 1;
    const cost = count === 10 ? singleCost * 9 : singleCost;

    if (bannerType === 'event') {
      if (this.data.eventTickets < cost) return null;
      this.data.eventTickets -= cost;
    } else {
      if (this.data.seeds < cost) return null;
      this.data.seeds -= cost;
    }

    const luckBoost = this.getActiveBoosts().doubleLuck;
    const crateKey: 'classic' | 'enchanted' = bannerType === 'classic' ? 'classic' : 'enchanted';
    const def = CRATES[crateKey];
    const results: Array<{
      unit: UnitDef;
      rarity: RarityId;
      trait: TraitId;
      variant: VariantId;
      isNew: boolean;
      dewdropsGained: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      let minRarity: RarityId | null = count === 10 && i === 0 ? 'Rare' : null;
      if (bannerType === 'classic') {
        this.data.pity.classicSinceLeg++;
        this.data.pity.classicSinceMyth++;
        if (this.data.pity.classicSinceMyth >= def.pitySecondaryThreshold) minRarity = 'Mythical';
        else if (this.data.pity.classicSinceLeg >= def.pityPrimaryThreshold) minRarity = 'Legendary';
      } else {
        this.data.pity.enchantedSinceMyth++;
        this.data.pity.enchantedSinceGodly++;
        if (this.data.pity.enchantedSinceGodly >= def.pitySecondaryThreshold) minRarity = 'Godly';
        else if (this.data.pity.enchantedSinceMyth >= def.pityPrimaryThreshold) minRarity = 'Mythical';
      }

      let rarity = this.rollRarity(crateKey, luckBoost);
      if (minRarity && RARITY_ORDER.indexOf(rarity) < RARITY_ORDER.indexOf(minRarity)) {
        rarity = minRarity;
      }

      if (bannerType === 'classic') {
        if (RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf('Legendary')) this.data.pity.classicSinceLeg = 0;
        if (RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf('Mythical')) this.data.pity.classicSinceMyth = 0;
      } else {
        if (RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf('Mythical')) this.data.pity.enchantedSinceMyth = 0;
        if (RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf('Godly')) this.data.pity.enchantedSinceGodly = 0;
      }

      const pool = UNITS.filter((u) => u.rarity === rarity);
      let unit = pool[Math.floor(Math.random() * pool.length)] ?? UNITS[0];
      if (bannerType === 'featured' && featuredUnitId && RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf('Legendary') && Math.random() < 0.5) {
        const feat = UNITS.find((u) => u.id === featuredUnitId);
        if (feat) unit = feat;
      }

      const vRoll = Math.random();
      const variant: VariantId = vRoll < 0.0002 ? 'rainbow' : vRoll < 0.0052 ? 'glass' : 'none';

      const existing = this.data.owned[unit.id];
      const isNew = !existing;
      const trait = isNew ? rollRandomTrait() : existing.trait;
      let dewdropsGained = 0;

      if (isNew) {
        this.grantUnit(unit.id, variant);
        this.data.owned[unit.id].trait = trait;
      } else {
        existing.copies += 1;
        if (variant !== 'none' && (!existing.variant || existing.variant === 'none')) existing.variant = variant;
        dewdropsGained = RARITIES[rarity].dewdropsOnDupe;
        this.data.dewdrops += dewdropsGained;
        if (this.data.autoRecycleCommons && (rarity === 'Common' || rarity === 'Uncommon') && !existing.locked && existing.copies > 1) {
          existing.copies -= 1;
          const extra = RARITIES[rarity].dewdropsOnDupe;
          dewdropsGained += extra;
          this.data.dewdrops += extra;
        }
      }

      if (rarity === 'Godly' || rarity === 'Exclusive') this.unlockAchievement('first_godly');

      this.data.stats.cratesOpened += 1;
      this.data.pullHistory.unshift({
        timestamp: Date.now(),
        banner: bannerType,
        unitId: unit.id,
        rarity,
        variant,
      });
      if (this.data.pullHistory.length > 100) this.data.pullHistory.length = 100;
      results.push({ unit, rarity, trait, variant, isNew, dewdropsGained });
    }

    if (results.length > 1) {
      results.sort((a, b) => RARITIES[a.rarity].order - RARITIES[b.rarity].order);
    }

    this.save();
    return results;
  }

  public pullCrates(
    crateType: 'classic' | 'enchanted',
    count: 1 | 5,
    useFreeKey = false
  ): Array<{
    unit: UnitDef;
    rarity: RarityId;
    trait: TraitId;
    isNew: boolean;
    dewdropsGained: number;
  }> | null {
    if (useFreeKey && crateType === 'enchanted' && count === 1 && this.data.enchantedKeys > 0) {
      this.data.enchantedKeys -= 1;
      this.data.seeds += CRATES.enchanted.costSeeds;
    }
    const pulled = this.pullBanner(crateType, count === 5 ? 10 : 1);
    return pulled?.slice(0, count) ?? null;
  }

  private rollRarity(crateType: 'classic' | 'enchanted', doubleLuck = false): RarityId {
    let total = 0;
    const weights: number[] = [];
    for (const r of RARITY_ORDER) {
      let w = crateType === 'classic' ? RARITIES[r].classicWeight : RARITIES[r].enchantedWeight;
      if (doubleLuck && RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf('Legendary')) {
        w *= 2;
      }
      weights.push(w);
      total += w;
    }
    let roll = Math.random() * total;
    for (let i = 0; i < RARITY_ORDER.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return RARITY_ORDER[i];
    }
    return 'Common';
  }

  public claimDailyQuest(questId: string): boolean {
    const q = this.data.dailyQuests.find((item) => item.id === questId);
    if (!q || q.claimed || q.progress < q.target) return false;
    q.claimed = true;
    if (q.rewardSeeds > 0) this.data.seeds += q.rewardSeeds;
    if (q.rewardEnchantedCrate) this.data.enchantedKeys += q.rewardEnchantedCrate;
    this.data.questGnomeXp += 100;
    this.save();
    return true;
  }

  public unlockAchievement(id: string): void {
    if (this.data.achievements[id]) return;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;
    this.data.achievements[id] = true;
    this.data.seeds += def.rewardSeeds;
    this.save();
    EventBus.emit('achievement:unlocked', {
      id: def.id,
      title: def.title,
      rewardSeeds: def.rewardSeeds,
    });
  }

  public isDifficultyClearEligible(diff: DifficultyId): boolean {
    return DIFFICULTY_LADDER[diff] !== undefined;
  }
}

export const SaveManager = new SaveManagerImpl();
