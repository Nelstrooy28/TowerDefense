import * as THREE from 'three';
import { getUnitById, type UnitDef } from '../data/UnitRegistry';
import { TRAITS, type TraitId } from '../data/TraitConfig';
import { SaveManager, type PotSkinId } from '../core/SaveManager';
import { MeshFactory, type TowerRigRefs } from '../rendering/MeshFactory';
import { TowerAnimator } from '../rendering/Animator';
import { EventBus } from '../core/EventBus';

export type TargetingMode = 'First' | 'Strongest' | 'Last' | 'Closest';

let NEXT_TOWER_ID = 1;

export class TowerEntity {
  public readonly id: string;
  public readonly def: UnitDef;
  public readonly trait: TraitId;
  public readonly potSkin: PotSkinId;
  public readonly position: THREE.Vector3;

  public level = 0; // 0..5
  public totalSpentCash: number;
  public totalDamageDealt = 0;
  public targeting: TargetingMode = 'First';

  public rig: TowerRigRefs;
  public readonly anim = new TowerAnimator();

  public cooldownRemaining = 0;
  public abilityCooldownRemaining = 0;
  public stunnedTimer = 0;
  public overdriveBuffTimer = 0;
  public chronoApmBuffTimer = 0;

  // Support buffs (strongest non-stacking per category §5.3)
  public buffDmg = 0;
  public buffCd = 0;
  public buffRange = 0;
  public stunImmuneAura = false;

  // Unit-specific combat state
  public laserTargetId: string | null = null;
  public laserRampStacks = 0; // up to 2.5x
  public iceHitCounter = 0;
  public chronoCycleIndex = 0; // 0: Solar, 1: Frost, 2: Arcane
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
    this.potSkin = owned?.potSkin ?? 'default';
    this.position = new THREE.Vector3(x, y, z);
    this.totalSpentCash = this.def.cost;
    this.scene = scene;

    this.rig = MeshFactory.buildTowerRig(
      this.def.id,
      this.level,
      this.def.rarity,
      this.trait,
      this.potSkin
    );
    this.rig.root.position.copy(this.position);
    this.scene.add(this.rig.root);
  }

  public getEffectiveDamage(): number {
    const base = this.def.levels[this.level].dmg;
    const tDmg = TRAITS[this.trait].dmgMult;
    const bonusMult = SaveManager.getUnitBonusDamageMult(this.def.id);
    return Math.round(base * tDmg * (1 + this.buffDmg) * bonusMult);
  }

  public getEffectiveCooldown(): number {
    const baseCd = this.def.levels[this.level].cd;
    if (baseCd <= 0) return 0;
    const tCd = TRAITS[this.trait].cdMult;
    const totalCdReduction = Math.min(0.7, this.buffCd + (this.overdriveBuffTimer > 0 ? 0.35 : 0) + (this.chronoApmBuffTimer > 0 ? 0.2 : 0));
    return Math.max(0.08, baseCd * tCd * (1 - totalCdReduction));
  }

  public getEffectiveRange(weatherRangeMult = 1.0): number {
    const baseRng = this.def.levels[this.level].range;
    if (baseRng <= 0) return 0;
    const tRng = TRAITS[this.trait].rangeMult;
    return Number((baseRng * tRng * (1 + this.buffRange) * weatherRangeMult).toFixed(1));
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
    return 0.05 + TRAITS[this.trait].critChanceBonus + weatherCritBonus;
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
    return Math.round((dmg * projs) / cd + dotDps);
  }

  public getNextUpgradeCost(): number | null {
    if (this.level >= 5) return null;
    const raw = this.def.levels[this.level + 1].upgradeCost * TRAITS[this.trait].upgradeCostMult;
    return Math.max(25, Math.round(raw / 25) * 25);
  }

  public getSellRefund(): number {
    return Math.round(this.totalSpentCash * 0.65);
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
    return this.targeting;
  }

  public upgrade(costPaid: number): void {
    if (this.level >= 5) return;
    this.level++;
    this.totalSpentCash += costPaid;

    // Rebuild evolved 3D rig behind white flash (§6.2)
    this.scene.remove(this.rig.root);
    this.rig = MeshFactory.buildTowerRig(
      this.def.id,
      this.level,
      this.def.rarity,
      this.trait,
      this.potSkin
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
