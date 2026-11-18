import { EventBus } from './EventBus';
import { QualityManager, type QualitySettings } from './QualityManager';
import { rollRandomTrait, type TraitId } from '../data/TraitConfig';
import { UNITS, type UnitDef } from '../data/UnitRegistry';
import { CRATES, RARITIES, RARITY_ORDER, type RarityId } from '../data/RarityConfig';
import type { MapId, DifficultyId } from '../data/MapRegistry';
import { GARDEN_PASS_TIERS } from '../data/GameModesConfig';

export const SAVE_KEY_V1 = 'garden_bastion_save_v1';
export const SAVE_KEY_V2 = 'garden_bastion_save_v2';

export type SoilSkinId =
  | 'garden_loam'
  | 'mossy_stone'
  | 'crystal_bed'
  | 'golden_sand'
  | 'galaxy_soil'
  | 'lava_rock';

export type TargetingModeValue = 'First' | 'Strongest' | 'Last' | 'Closest';

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
  loadout: Array<string | null>; // 6 slots
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

function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function createDailyQuests(): DailyQuestState[] {
  return [
    {
      id: 'q_ants',
      title: 'Defeat 300 Garden Ants',
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
        trait: 'Sprouting',
        traitLocked: false,
        masteryXp: 0,
        masteryLevel: 0,
        soilSkin: 'garden_loam',
      },
      cactus_striker: {
        unitId: 'cactus_striker',
        copies: 1,
        fusedStacks: 0,
        trait: 'Thorny',
        traitLocked: false,
        masteryXp: 0,
        masteryLevel: 0,
        soilSkin: 'garden_loam',
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
      trait: (u.trait as TraitId) ?? 'Sprouting',
      traitLocked: Boolean(u.traitLocked),
      masteryXp: Number(u.masteryXp ?? 0),
      masteryLevel: Number(u.masteryLevel ?? 0),
      soilSkin,
      isPrime: Boolean(u.isPrime),
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

class SaveManagerImpl {
  public data: SaveStateV2 = createDefaultSaveV2();

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
      const rawV2 = localStorage.getItem(SAVE_KEY_V2);
      if (rawV2) {
        const parsed = JSON.parse(rawV2) as Record<string, unknown>;
        this.data = migrateSaveToV2(parsed);
        this.checkDailyReset();
        QualityManager.applySettings(this.data.settings, false);
        return;
      }

      // Migrate v1 -> v2, keeping v1 intact (§21)
      const rawV1 = localStorage.getItem(SAVE_KEY_V1);
      if (rawV1) {
        const parsedV1 = JSON.parse(rawV1) as Record<string, unknown>;
        this.data = migrateSaveToV2(parsedV1);
        this.checkDailyReset();
        QualityManager.applySettings(this.data.settings, false);
        this.save();
        return;
      }

      this.data = createDefaultSaveV2();
      this.save();
    } catch {
      this.data = createDefaultSaveV2();
      this.save();
    }
  }

  public checkDailyReset(): void {
    const today = getTodayDateString();
    if (this.data.dailyQuestDate !== today) {
      this.data.dailyQuestDate = today;
      this.data.dailyQuests = createDailyQuests();
      this.save();
    }
  }

  public save(): void {
    this.data.settings = { ...QualityManager.settings };
    try {
      localStorage.setItem(SAVE_KEY_V2, JSON.stringify(this.data));
    } catch {
      // Ignore storage quota errors
    }
    EventBus.emit('save:updated', undefined);
  }

  public resetSave(): void {
    this.data = createDefaultSaveV2();
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
      this.data = migrateSaveToV2(parsed);
      QualityManager.applySettings(this.data.settings, true);
      this.save();
      return true;
    } catch {
      return false;
    }
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
    if (def.unitId && !this.data.owned[def.unitId]) {
      this.data.owned[def.unitId] = {
        unitId: def.unitId,
        copies: 1,
        fusedStacks: 0,
        trait: rollRandomTrait(),
        traitLocked: false,
        masteryXp: 0,
        masteryLevel: 0,
        soilSkin: 'garden_loam',
      };
    }
    this.save();
    return true;
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

  public getUnitBonusDamageMult(unitId: string): number {
    const owned = this.data.owned[unitId];
    if (!owned) return 1.0;
    const primeMult = owned.isPrime ? 1.12 : 1.0;
    return (1 + owned.fusedStacks * 0.05 + owned.masteryLevel * 0.01) * primeMult;
  }

  public getUnitPrimeStatMult(unitId: string): number {
    return this.data.owned[unitId]?.isPrime ? 1.12 : 1.0;
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
    const def = CRATES[crateType];
    const totalCost = useFreeKey && crateType === 'enchanted' && count === 1 ? 0 : def.costSeeds * count;
    if (totalCost > this.data.seeds) return null;
    if (useFreeKey && crateType === 'enchanted' && count === 1) {
      if (this.data.enchantedKeys <= 0) return null;
      this.data.enchantedKeys -= 1;
    } else {
      this.data.seeds -= totalCost;
    }

    const results: Array<{
      unit: UnitDef;
      rarity: RarityId;
      trait: TraitId;
      isNew: boolean;
      dewdropsGained: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      let minRarity: RarityId | null = null;
      if (crateType === 'classic') {
        this.data.pity.classicSinceLeg++;
        this.data.pity.classicSinceMyth++;
        if (this.data.pity.classicSinceMyth >= def.pitySecondaryThreshold) {
          minRarity = 'Mythical';
        } else if (this.data.pity.classicSinceLeg >= def.pityPrimaryThreshold) {
          minRarity = 'Legendary';
        }
      } else {
        this.data.pity.enchantedSinceMyth++;
        this.data.pity.enchantedSinceGodly++;
        if (this.data.pity.enchantedSinceGodly >= def.pitySecondaryThreshold) {
          minRarity = 'Godly';
        } else if (this.data.pity.enchantedSinceMyth >= def.pityPrimaryThreshold) {
          minRarity = 'Mythical';
        }
      }

      let rarity = this.rollRarity(crateType);
      if (minRarity && RARITY_ORDER.indexOf(rarity) < RARITY_ORDER.indexOf(minRarity)) {
        rarity = minRarity;
      }

      if (crateType === 'classic') {
        if (RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf('Legendary')) {
          this.data.pity.classicSinceLeg = 0;
        }
        if (RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf('Mythical')) {
          this.data.pity.classicSinceMyth = 0;
        }
      } else {
        if (RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf('Mythical')) {
          this.data.pity.enchantedSinceMyth = 0;
        }
        if (RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf('Godly')) {
          this.data.pity.enchantedSinceGodly = 0;
        }
      }

      const pool = UNITS.filter((u) => u.rarity === rarity);
      const unit = pool[Math.floor(Math.random() * pool.length)] ?? UNITS[0];
      const existing = this.data.owned[unit.id];
      const isNew = !existing;
      const trait = isNew ? rollRandomTrait() : existing.trait;
      let dewdropsGained = 0;

      if (isNew) {
        this.data.owned[unit.id] = {
          unitId: unit.id,
          copies: 1,
          fusedStacks: 0,
          trait,
          traitLocked: false,
          masteryXp: 0,
          masteryLevel: 0,
          soilSkin: 'garden_loam',
        };
        const emptySlot = this.data.loadout.indexOf(null);
        if (emptySlot !== -1) {
          this.data.loadout[emptySlot] = unit.id;
        }
      } else {
        existing.copies += 1;
        dewdropsGained = RARITIES[rarity].dewdropsOnDupe;
        this.data.dewdrops += dewdropsGained;
      }

      if (rarity === 'Godly' || rarity === 'Exclusive') {
        this.unlockAchievement('first_godly');
      }

      this.data.stats.cratesOpened += 1;
      results.push({ unit, rarity, trait, isNew, dewdropsGained });
    }

    if (results.length > 1) {
      results.sort((a, b) => RARITIES[a.rarity].order - RARITIES[b.rarity].order);
    }

    this.save();
    return results;
  }

  private rollRarity(crateType: 'classic' | 'enchanted'): RarityId {
    let total = 0;
    for (const r of RARITY_ORDER) {
      total += crateType === 'classic' ? RARITIES[r].classicWeight : RARITIES[r].enchantedWeight;
    }
    let roll = Math.random() * total;
    for (const r of RARITY_ORDER) {
      const w = crateType === 'classic' ? RARITIES[r].classicWeight : RARITIES[r].enchantedWeight;
      roll -= w;
      if (roll <= 0) return r;
    }
    return 'Common';
  }

  public claimDailyQuest(questId: string): boolean {
    const q = this.data.dailyQuests.find((item) => item.id === questId);
    if (!q || q.claimed || q.progress < q.target) return false;
    q.claimed = true;
    if (q.rewardSeeds > 0) this.data.seeds += q.rewardSeeds;
    if (q.rewardEnchantedCrate) this.data.enchantedKeys += q.rewardEnchantedCrate;
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
}

export const SaveManager = new SaveManagerImpl();
