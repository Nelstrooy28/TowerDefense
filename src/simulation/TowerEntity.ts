import * as THREE from 'three';
import { getUnitById, type UnitDef } from '../data/UnitRegistry';
import { TRAITS, type TraitId } from '../data/TraitConfig';
import { SaveManager, type SoilSkinId, type TargetingModeValue } from '../core/SaveManager';
import { MeshFactory, type TowerRigRefs } from '../rendering/MeshFactory';
import { TowerAnimator } from '../rendering/Animator';
import { EventBus } from '../core/EventBus';

export type TargetingMode = TargetingModeValue;

let NEXT_TOWER_ID = 1;

export class TowerEntity {
  public readonly id: string;
  public readonly def: UnitDef;
  public readonly trait: TraitId;
  public readonly soilSkin: SoilSkinId;
  public readonly isPrime: boolean;
  public readonly position: THREE.Vector3;

  public level = 0; // 0..5
  public totalSpentCash: number;
  public totalDamageDealt = 0;
  public damagePerWave: number[] = []; // §14 mini wave chart
  public targeting: TargetingMode = 'First';

  public rig: TowerRigRefs;
  public readonly anim = new TowerAnimator();

  public cooldownRemaining = 0;
  public abilityCooldownRemaining = 0;
  public stunnedTimer = 0;
  public overdriveBuffTimer = 0;
  public chronoApmBuffTimer = 0;
  public solarFlareTimer = 0; // §7 Sunflower Solar Beacon guaranteed crits
  public gnawedTimer = 0; // §8 Termite -20% attack speed
  public frostSlowTimer = 0; // §9 Frost Moth Empress -30% attack speed

  // Support & Root Network buffs (§5)
  public buffDmg = 0;
  public buffCd = 0;
  public buffRange = 0;
  public buffCrit = 0;
  public kinDmgBonus = 0;
  public comboDmgBonus = 0;
  public stunImmuneAura = false;
  public blizzardRangePenalty = 0;

  // Undo tracking (§16 Ctrl+Z within 3 s before first attack)
  public placedAtRealTime = 0;
  public hasAttacked = false;

  // Unit-specific combat state
  public laserTargetId: string | null = null;
  public laserRampStacks = 0; // up to 2.5x
  public iceHitCounter = 0;
  public chronoCycleIndex = 0;
  public farmMidWaveTimer = 10;

  private scene: THREE.Scene;

  constructor(
    unitId: string,
    x: number,
    y: number,
    z: number,
    scene: THREE.Scene
  ) {
    this.id = `tw_${NEXT_TOWER_ID++}`;
    this.def = getUnitById(unitId);
    const owned = SaveManager.data.owned[unitId];
    this.trait = owned?.trait ?? 'Sprouting';
    this.soilSkin = owned?.soilSkin ?? 'garden_loam';
    this.isPrime = Boolean(owned?.isPrime);
    this.targeting = SaveManager.data.targetingMemory[unitId] ?? 'First';
    this.position = new THREE.Vector3(x, y, z);
    this.totalSpentCash = this.def.cost;
    this.placedAtRealTime = performance.now() * 0.001;
    this.scene = scene;

    this.rig = MeshFactory.buildTowerRig(
      this.def.id,
      this.level,
      this.def.rarity,
      this.trait,
      this.soilSkin,
      this.isPrime
    );
    this.rig.root.position.copy(this.position);
    this.anim.startPlacementTimeline();
    this.scene.add(this.rig.root);
  }

  public recordWaveDamage(waveIdx: number, dmg: number): void {
    const idx = Math.max(0, waveIdx - 1);
    while (this.damagePerWave.length <= idx) this.damagePerWave.push(0);
    this.damagePerWave[idx] += Math.round(dmg);
  }

  public getEffectiveDamage(): number {
    const base = this.def.levels[this.level].dmg;
    const tDmg = TRAITS[this.trait].dmgMult;
    const bonusMult = SaveManager.getUnitBonusDamageMult(this.def.id);
    const linkDmg = 1 + this.buffDmg + this.kinDmgBonus;
    return Math.round(base * tDmg * linkDmg * bonusMult);
  }

  public getEffectiveCooldown(): number {
    const baseCd = this.def.levels[this.level].cd;
    if (baseCd <= 0) return 0;
    const tCd = TRAITS[this.trait].cdMult;
    const primeCdMult = this.isPrime ? 0.89 : 1.0;
    const totalCdReduction = Math.min(
      0.7,
      this.buffCd + (this.overdriveBuffTimer > 0 ? 0.35 : 0) + (this.chronoApmBuffTimer > 0 ? 0.2 : 0)
    );
    const debuffSlow = 1 + (this.gnawedTimer > 0 ? 0.2 : 0) + (this.frostSlowTimer > 0 ? 0.3 : 0);
    return Math.max(0.08, baseCd * tCd * primeCdMult * (1 - totalCdReduction) * debuffSlow);
  }

  public getEffectiveRange(weatherRangeMult = 1.0): number {
    const baseRng = this.def.levels[this.level].range;
    if (baseRng <= 0) return 0;
    const tRng = TRAITS[this.trait].rangeMult;
    const primeMult = this.isPrime ? 1.12 : 1.0;
    const blizzardMult = 1 - this.blizzardRangePenalty;
    return Number((baseRng * tRng * primeMult * (1 + this.buffRange) * weatherRangeMult * blizzardMult).toFixed(1));
  }

  public getEffectiveSplashRadius(): number {
    return this.def.levels[this.level].splashRadius * TRAITS[this.trait].aoeMult;
  }

  public getProjectilesCount(): number {
    return this.def.levels[this.level].projectiles;
  }

  public getFarmPayout(weatherFarmMult = 1.0): number {
    const base = this.def.levels[this.level].farmPayout;
    return Math.round(base * TRAITS[this.trait].cashMult * weatherFarmMult);
  }

  public getCritChance(weatherCritBonus = 0): number {
    if (this.solarFlareTimer > 0) return 1.0;
    return Math.min(1.0, 0.05 + TRAITS[this.trait].critChanceBonus + this.buffCrit + weatherCritBonus);
  }

  public getDisplayedDps(): number {
    if (this.def.isFarm || this.def.isSupport) return 0;
    const cd = this.getEffectiveCooldown();
    if (cd <= 0) return 0;
    const dmg = this.getEffectiveDamage();
    const projs = this.getProjectilesCount();
    let dotDps = 0;
    if (this.def.id === 'ghost_pepper') dotDps = dmg * 0.35;
    if (this.def.id === 'cactus_striker') dotDps = dmg * 0.2;
    if (this.def.id === 'puffball_mushroom') dotDps = dmg;
    return Math.round((dmg * projs) / cd + dotDps);
  }

  public getNextUpgradeCost(): number | null {
    if (this.level >= 5) return null;
    const raw = this.def.levels[this.level + 1].upgradeCost * TRAITS[this.trait].upgradeCostMult;
    return Math.max(25, Math.round(raw / 25) * 25);
  }

  public getSellRefund(): number {
    const withinUndoWindow = !this.hasAttacked && performance.now() * 0.001 - this.placedAtRealTime <= 3.0;
    return withinUndoWindow ? this.totalSpentCash : Math.round(this.totalSpentCash * 0.65);
  }

  public getAbilityMaxCooldown(): number {
    if (!this.def.ability) return 0;
    return Number((this.def.ability.cooldown * TRAITS[this.trait].abilityCdMult).toFixed(1));
  }

  public isAbilityReady(): boolean {
    return !!this.def.ability && this.level >= 4 && this.abilityCooldownRemaining <= 0 && this.stunnedTimer <= 0;
  }

  public cycleTargeting(): TargetingMode {
    const order: TargetingMode[] = ['First', 'Strongest', 'Last', 'Closest'];
    const idx = (order.indexOf(this.targeting) + 1) % order.length;
    this.targeting = order[idx];
    SaveManager.data.targetingMemory[this.def.id] = this.targeting;
    SaveManager.save();
    return this.targeting;
  }

  public upgrade(costPaid: number): void {
    if (this.level >= 5) return;
    this.level++;
    this.totalSpentCash += costPaid;

    this.scene.remove(this.rig.root);
    this.rig = MeshFactory.buildTowerRig(
      this.def.id,
      this.level,
      this.def.rarity,
      this.trait,
      this.soilSkin,
      this.isPrime
    );
    this.rig.root.position.copy(this.position);
    this.scene.add(this.rig.root);
    this.anim.triggerUpgradeMoment();

    if (this.level === 5) {
      EventBus.emit('quest:progress', { type: 'upgrade_max', amount: 1 });
    }
  }

  public applyStun(duration: number): boolean {
    if (this.stunImmuneAura) return false;
    this.stunnedTimer = Math.max(this.stunnedTimer, duration);
    return true;
  }

  public cleanseStun(): void {
    this.stunnedTimer = 0;
  }

  public destroy(): void {
    this.scene.remove(this.rig.root);
  }
}
