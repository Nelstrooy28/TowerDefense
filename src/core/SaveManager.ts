import { EventBus } from './EventBus';
import { QualityManager, type QualitySettings } from './QualityManager';
import { rollRandomTrait, type TraitId } from '../data/TraitConfig';
import { UNITS, type UnitDef } from '../data/UnitRegistry';
import { CRATES, RARITIES, RARITY_ORDER, type RarityId } from '../data/RarityConfig';
import type { MapId, DifficultyId } from '../data/MapRegistry';

const SAVE_KEY = 'garden_bastion_save_v1';

export type PotSkinId = 'default' | 'striped_ceramic' | 'mossy_stone' | 'crystal' | 'golden' | 'galaxy';

export interface OwnedUnitData {
  unitId: string;
  copies: number;
  fusedStacks: number; // +5% permanent damage per stack (3 copies -> +1 stack)
  trait: TraitId;
  traitLocked: boolean;
  masteryXp: number;
  masteryLevel: number; // 0..10 (+1% damage/level)
  potSkin: PotSkinId;
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

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_godly', title: 'Divine Sprout', description: 'Pull your first Godly or Exclusive unit', icon: '✨', rewardSeeds: 150 },
  { id: 'beat_insane', title: 'Master Gardener', description: 'Clear any map on Insane difficulty', icon: '🏆', rewardSeeds: 300 },
  { id: 'endless_50', title: 'Eternal Bloom', description: 'Reach Endless Wave 50', icon: '♾️', rewardSeeds: 400 },
  { id: 'max_unit', title: 'Awakened Flora', description: 'Upgrade a unit to Lv.5 in a match', icon: '🌟', rewardSeeds: 100 },
  { id: 'synergy_master', title: 'Alchemist', description: 'Trigger 25 Element Synergies', icon: '⚗️', rewardSeeds: 120 },
  { id: 'trait_gold', title: 'Midas Touch', description: 'Roll a Golden or Celestial trait', icon: '👑', rewardSeeds: 150 },
];

export interface SaveStateV1 {
  version: 1;
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

function createDefaultSave(): SaveStateV1 {
  return {
    version: 1,
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
        potSkin: 'default',
      },
      cactus_striker: {
        unitId: 'cactus_striker',
        copies: 1,
        fusedStacks: 0,
        trait: 'Thorny',
        traitLocked: false,
        masteryXp: 0,
        masteryLevel: 0,
        potSkin: 'default',
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
    tutorialCompleted: false,
    tutorialSkipped: false,
    settings: { ...QualityManager.settings },
  };
}

class SaveManagerImpl {
  public data: SaveStateV1 = createDefaultSave();

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
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        this.data = createDefaultSave();
        this.save();
        return;
      }
      const parsed = JSON.parse(raw) as Partial<SaveStateV1>;
      this.data = this.migrate(parsed);
      this.checkDailyReset();
      QualityManager.applySettings(this.data.settings, false);
    } catch {
      this.data = createDefaultSave();
      this.save();
    }
  }

  private migrate(parsed: Partial<SaveStateV1>): SaveStateV1 {
    const def = createDefaultSave();
    const merged: SaveStateV1 = {
      ...def,
      ...parsed,
      version: 1,
      pity: { ...def.pity, ...(parsed.pity ?? {}) },
      stats: { ...def.stats, ...(parsed.stats ?? {}) },
      settings: { ...def.settings, ...(parsed.settings ?? {}) },
      owned: { ...def.owned, ...(parsed.owned ?? {}) },
      loadout: Array.isArray(parsed.loadout) && parsed.loadout.length === 6 ? parsed.loadout : def.loadout,
      dailyQuests:
        Array.isArray(parsed.dailyQuests) && parsed.dailyQuests.length === 3
          ? parsed.dailyQuests
          : def.dailyQuests,
      achievements: { ...(parsed.achievements ?? {}) },
    };
    return merged;
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
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore storage quota errors cleanly
    }
    EventBus.emit('save:updated', undefined);
  }

  public resetSave(): void {
    this.data = createDefaultSave();
    QualityManager.applySettings(this.data.settings, true);
    this.save();
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
    this.save();
  }

  public getUnitBonusDamageMult(unitId: string): number {
    const owned = this.data.owned[unitId];
    if (!owned) return 1.0;
    return 1 + owned.fusedStacks * 0.05 + owned.masteryLevel * 0.01;
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
      if (owned.masteryLevel === 5 && owned.potSkin === 'default') {
        owned.potSkin = 'striped_ceramic';
      }
      if (owned.masteryLevel === 10) {
        owned.potSkin = 'golden';
      }
    }
  }

  public getUnlockedPotSkins(unitId: string): PotSkinId[] {
    const owned = this.data.owned[unitId];
    const skins: PotSkinId[] = ['default'];
    if (!owned) return skins;
    if (owned.masteryLevel >= 5) {
      skins.push('striped_ceramic', 'mossy_stone');
    }
    if (owned.masteryLevel >= 10) {
      skins.push('crystal', 'golden', 'galaxy');
    }
    return skins;
  }

  public setPotSkin(unitId: string, skin: PotSkinId): void {
    const owned = this.data.owned[unitId];
    if (!owned) return;
    owned.potSkin = skin;
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
          potSkin: 'default',
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

    // Sort 5x results so highest rarity opens last for suspense (§4.1.1)
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
