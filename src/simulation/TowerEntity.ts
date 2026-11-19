import * as THREE from 'three';
import { getUnitById, type UnitDef } from '../data/UnitRegistry';
import { TRAITS, type TraitId } from '../data/TraitConfig';
import { ECONOMY_CONFIG, type VariantId } from '../data/BalanceConfig';
import { SaveManager, type SoilSkinId, type TargetingModeValue } from '../core/SaveManager';
import { QualityManager } from '../core/QualityManager';
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
  public readonly variant: VariantId;
  public readonly position: THREE.Vector3;

  public level = 0; // 0..5
  public totalSpentCash: number;
  public totalDamageDealt = 0;
  public damagePerWave: number[] = []; // §14 mini wave chart
  public targeting: TargetingMode = 'First';
  public placedOrUpgradedWave = 0;
  public autoUpgrade = Boolean(QualityManager.settings.autoUpgradeDefault);
  public priority = 1;
  public instanceNumber = 1;

  public rig: TowerRigRefs;
  public readonly anim = new TowerAnimator();

  public cooldownRemaining = 0;
  public abilityCooldownRemaining = 0;
  public stunnedTimer = 0;
  public overdriveBuffTimer = 0;
  public chronoApmBuffTimer = 0;
  public solarFlareTimer = 0;
  public gnawedTimer = 0;
  public frostSlowTimer = 0;

  // Support & Root Network buffs (§5)
  public buffDmg = 0;
  public buffCd = 0;
  public buffRange = 0;
  public buffCrit = 0;
  public kinDmgBonus = 0;
  public comboDmgBonus = 0;
  public stunImmuneAura = false;
  public blizzardRangePenalty = 0;

  // Modifier Board multipliers (Doc 06 §3)
  public modDmgMult = 1.0;
  public modCdMult = 1.0;
  public modRangeMult = 1.0;
  public modCostMult = 1.0;

  // Undo tracking
  public placedAtRealTime = 0;
  public hasAttacked = false;

  // Unit-specific combat state
  public laserTargetId: string | null = null;
  public laserRampStacks = 0; // Doc 02 §7 cap 2.0x over 4 s
  public iceHitCounter = 0;
  public chronoCycleIndex = 0;
  public farmMidWaveTimer = 10;

  // v4 Doc 06 §1 Path / Spawner / Collect Farm unit states
  public wallHp = 0;
  public wallMaxHp = 0;
  public trapHitsLeft = 0;
  public rollerProgress = 0;
  public rollerSplineIndex = 0;
  public rollerHitEnemyIds = new Set<string>();
  public spawnerTimer = 1.5;
  public coinTimer = 6.0;
  public splineIdx = 0;
  public pathT = 0.5;

  private scene: THREE.Scene;

  constructor(
    unitId: string,
    x: number,
    y: number,
    z: number,
    scene: THREE.Scene,
    currentWave = 0,
    costPaid?: number,
    splineIdx = 0,
    pathT = 0.5
  ) {
    this.id = `tw_${NEXT_TOWER_ID++}`;
    this.def = getUnitById(unitId);
    const owned = SaveManager.data.owned[unitId];
    this.trait = owned?.trait ?? 'Keen I';
    this.soilSkin = owned?.soilSkin ?? 'garden_loam';
    this.isPrime = Boolean(owned?.isPrime);
    this.variant = owned?.variant ?? 'none';
    this.targeting = SaveManager.data.targetingMemory[unitId] ?? 'First';
    this.position = new THREE.Vector3(x, y, z);
    this.totalSpentCash = costPaid ?? this.def.cost;
    this.placedAtRealTime = performance.now() * 0.001;
    this.placedOrUpgradedWave = currentWave;
    this.splineIdx = splineIdx;
    this.pathT = pathT;
    this.rollerSplineIndex = splineIdx;
    this.rollerProgress = pathT;
    this.scene = scene;

    this.syncRoleDurability();

    this.rig = MeshFactory.buildTowerRig(
      this.def.id,
      this.level,
      this.def.rarity,
      this.trait,
      this.soilSkin,
      this.isPrime,
      this.variant
    );
    this.rig.root.position.copy(this.position);
    this.anim.startPlacementTimeline();
    this.scene.add(this.rig.root);
  }

  private syncRoleDurability(): void {
    const f = this.level / 5;
    if (this.def.isWall && this.def.wallHpBase && this.def.wallHpMax) {
      const nextMax = Math.round(this.def.wallHpBase + (this.def.wallHpMax - this.def.wallHpBase) * Math.pow(f, 1.3));
      const gained = Math.max(0, nextMax - this.wallMaxHp);
      this.wallMaxHp = nextMax;
      this.wallHp = this.wallHp <= 0 ? nextMax : this.wallHp + gained;
    }
    if (this.def.isTrap && this.def.trapHitsBase && this.def.trapHitsMax) {
      this.trapHitsLeft = Math.round(this.def.trapHitsBase + (this.def.trapHitsMax - this.def.trapHitsBase) * f);
    }
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
    return Math.round(base * tDmg * linkDmg * bonusMult * this.modDmgMult);
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
    return Math.max(0.08, baseCd * tCd * primeCdMult * (1 - totalCdReduction) * debuffSlow * this.modCdMult);
  }

  public getEffectiveRange(weatherRangeMult = 1.0): number {
    const baseRng = this.def.levels[this.level].range;
    if (baseRng <= 0) return 0;
    const tRng = TRAITS[this.trait].rangeMult;
    const primeMult = this.isPrime ? 1.12 : 1.0;
    const blizzardMult = 1 - this.blizzardRangePenalty;
    return Number(
      (baseRng * tRng * primeMult * (1 + this.buffRange) * weatherRangeMult * blizzardMult * this.modRangeMult).toFixed(1)
    );
  }

  public getEffectiveSplashRadius(): number {
    const tr = TRAITS[this.trait];
    return this.def.levels[this.level].splashRadius * tr.aoeMult + tr.splashBonus;
  }

  public getDebuffDurationMult(): number {
    return TRAITS[this.trait].debuffDurMult;
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
    return Math.min(
      1.0,
      ECONOMY_CONFIG.baseCritChance + TRAITS[this.trait].critChanceBonus + this.buffCrit + weatherCritBonus
    );
  }

  public getDisplayedDps(): number {
    if (this.def.isFarm || this.def.isSupport || this.def.isWall) return 0;
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
    const raw =
      this.def.levels[this.level + 1].upgradeCost *
      TRAITS[this.trait].upgradeCostMult *
      this.modCostMult;
    return Math.max(25, Math.round(raw / 25) * 25);
  }

  public getSellRefund(currentWave = this.placedOrUpgradedWave): number {
    if (this.def.isRoller) return 0; // Doc 06 §1 No sell refund
    const withinUndoWindow = !this.hasAttacked && performance.now() * 0.001 - this.placedAtRealTime <= 3.0;
    if (withinUndoWindow) return this.totalSpentCash;
    const ratio =
      currentWave === this.placedOrUpgradedWave
        ? ECONOMY_CONFIG.sellRefundSameWave
        : ECONOMY_CONFIG.sellRefundLater;
    return Math.round(this.totalSpentCash * ratio);
  }

  public getAbilityMaxCooldown(): number {
    if (!this.def.ability) return 0;
    return Number((this.def.ability.cooldown * TRAITS[this.trait].abilityCdMult).toFixed(1));
  }

  public isAbilityReady(): boolean {
    return !!this.def.ability && this.level >= 4 && this.abilityCooldownRemaining <= 0 && this.stunnedTimer <= 0;
  }

  public cycleTargeting(): TargetingMode {
    const order: TargetingMode[] = ['First', 'Last', 'Strongest', 'Closest', 'Weakest'];
    const idx = (order.indexOf(this.targeting) + 1) % order.length;
    this.targeting = order[idx];
    SaveManager.data.targetingMemory[this.def.id] = this.targeting;
    SaveManager.save();
    return this.targeting;
  }

  public upgrade(costPaid: number, currentWave = this.placedOrUpgradedWave): void {
    if (this.level >= 5) return;
    this.level++;
    this.totalSpentCash += costPaid;
    this.placedOrUpgradedWave = currentWave;
    this.syncRoleDurability();

    this.scene.remove(this.rig.root);
    this.rig = MeshFactory.buildTowerRig(
      this.def.id,
      this.level,
      this.def.rarity,
      this.trait,
      this.soilSkin,
      this.isPrime,
      this.variant
    );
    this.rig.root.position.copy(this.position);
    this.scene.add(this.rig.root);
    this.anim.triggerUpgradeMoment();

    if (this.level === 5) {
      EventBus.emit('quest:progress', { type: 'upgrade_max', amount: 1 });
    }
  }

  public applyStun(duration: number): boolean {
    if (this.stunImmuneAura || TRAITS[this.trait].stunImmune) return false;
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
