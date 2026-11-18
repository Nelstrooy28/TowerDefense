import * as THREE from 'three';
import { ENEMIES, type EnemyDef, type EnemyTypeId } from '../data/EnemyRegistry';
import { ELITE_MODIFIERS, type EliteModifierId } from '../data/ModifierConfig';
import { MeshFactory, type EnemyRigRefs } from '../rendering/MeshFactory';
import { EnemyAnimator, type HitReactionType } from '../rendering/Animator';
import { QualityManager } from '../core/QualityManager';
import { EventBus } from '../core/EventBus';

let NEXT_ENEMY_ID = 1;

export class EnemyEntity {
  public readonly id: string;
  public readonly def: EnemyDef;
  public readonly type: EnemyTypeId;
  public readonly rig: EnemyRigRefs;
  public readonly anim = new EnemyAnimator();
  public readonly spline: THREE.CatmullRomCurve3;
  public readonly splineLength: number;

  public progress = 0;
  public position = new THREE.Vector3();
  public ageSeconds = 0;

  public maxHp: number;
  public hp: number;
  public chipHp: number;
  private chipDelayTimer = 0;

  public maxArmor: number;
  public armor: number;

  // Boss Stagger Meter (§9.1)
  public staggerValue = 0;
  public staggerMax = 0;
  public staggerTimer = 0;

  public isElite: boolean;
  public eliteMod: EliteModifierId | null;
  public eliteShieldHp = 0;
  public eliteShieldMax = 0;
  public swarmClumpCount = 1;

  // Status timers
  public burnTimer = 0;
  public burnDps = 0;
  public bleedTimer = 0;
  public bleedDps = 0;
  public chillTimer = 0;
  public freezeTimer = 0;
  public blindSlowTimer = 0;
  public blindSlowRatio = 0;
  public wetTimer = 0;
  public poisonTimer = 0;
  public poisonDps = 0;
  public poisonStacks = 0;
  public outOfCombatTimer = 0;
  public synergyCooldowns: Record<string, number> = {};
  public statusPulseTimers: Record<string, number> = {};

  // Special behaviors
  public isBurrowed = false;
  private burrowCycleTimer = 0;
  public waspBombTimer = 4.5;
  public snailShattered = false;
  public isCocooned = false;
  public cocoonHatchTimer = 0;
  public hatchedToMoth = false;
  public gnawCooldown = 0;

  // Boss AI
  public bossPhase = 1;
  public bossSkillTimer = 6.5;
  public bossSummonTimer = 11.0;
  public bossHydraRegenTimer = 0;
  public bossSplitDone = false;
  private cleanserTimer = 4.0;
  public onIcePond = false;
  public speedOverrideMult = 1.0;

  // Death state
  public isDead = false;
  public deathFinished = false;
  public reachedGoal = false;
  public lastHitElement: 'normal' | 'burn' | 'freeze' | 'devour' | 'arcane' | 'poison' = 'normal';
  public killerTowerId: string | null = null;

  // Readability DOM Health Bar (§7.2)
  private hpEl: HTMLDivElement;
  private hpFillEl: HTMLDivElement;
  private chipFillEl: HTMLDivElement;
  private armorFillEl: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private eliteTagEl: HTMLSpanElement;
  private hasTakenDamage = false;

  private readonly _tangent = new THREE.Vector3();
  private readonly _proj = new THREE.Vector3();

  constructor(
    type: EnemyTypeId,
    spline: THREE.CatmullRomCurve3,
    scaledHp: number,
    isElite = false,
    eliteMod: EliteModifierId | null = null,
    scene: THREE.Scene,
    uiContainer: HTMLElement,
    speedMult = 1.0
  ) {
    this.id = `en_${NEXT_ENEMY_ID++}`;
    this.type = type;
    this.def = ENEMIES[type];
    this.spline = spline;
    this.splineLength = Math.max(1, spline.getLength());
    this.isElite = isElite;
    this.eliteMod = eliteMod;
    this.speedOverrideMult = speedMult;

    let hp = scaledHp;
    if (isElite) {
      hp *= 1.8;
      if (eliteMod) hp *= ELITE_MODIFIERS[eliteMod].hpMult;
    }
    this.maxHp = Math.round(hp);
    this.hp = this.maxHp;
    this.chipHp = this.maxHp;

    this.maxArmor = this.def.armorRatio > 0 ? Math.round(this.maxHp * this.def.armorRatio) : 0;
    this.armor = this.maxArmor;

    if (this.def.isBoss) {
      this.staggerMax = Math.round(this.maxHp * 0.18);
    }

    if (isElite && eliteMod === 'Shielded') {
      this.eliteShieldMax = Math.round(this.maxHp * 0.25);
      this.eliteShieldHp = this.eliteShieldMax;
    }

    this.rig = MeshFactory.buildEnemyRig(type, isElite, eliteMod);
    scene.add(this.rig.root);

    this.hpEl = document.createElement('div');
    this.hpEl.className = 'enemy-hpbar';
    this.hpEl.style.display = 'none';
    this.hpEl.innerHTML = `
      <div class="enemy-hp-meta">
        <span class="cb-symbol"></span>
        <span class="elite-badge"></span>
        <span class="status-icons"></span>
      </div>
      <div class="enemy-bar-track">
        <div class="enemy-bar-chip"></div>
        <div class="enemy-bar-fill"></div>
        <div class="enemy-bar-armor"></div>
      </div>
    `;
    uiContainer.appendChild(this.hpEl);
    this.hpFillEl = this.hpEl.querySelector('.enemy-bar-fill') as HTMLDivElement;
    this.chipFillEl = this.hpEl.querySelector('.enemy-bar-chip') as HTMLDivElement;
    this.armorFillEl = this.hpEl.querySelector('.enemy-bar-armor') as HTMLDivElement;
    this.statusEl = this.hpEl.querySelector('.status-icons') as HTMLDivElement;
    this.eliteTagEl = this.hpEl.querySelector('.elite-badge') as HTMLSpanElement;

    if (isElite && eliteMod) {
      this.eliteTagEl.textContent = eliteMod.toUpperCase();
      this.eliteTagEl.style.color = ELITE_MODIFIERS[eliteMod].color;
    }

    this.updateTransform();
  }

  public mergeSwarmAnt(extraHp: number): void {
    this.swarmClumpCount += 1;
    this.maxHp += extraHp;
    this.hp += extraHp;
    this.chipHp += extraHp;
    this.rig.root.scale.setScalar(this.def.scale * Math.min(1.55, 1 + (this.swarmClumpCount - 1) * 0.12));
  }

  public refreshStatusPulse(key: string): void {
    this.statusPulseTimers[key] = 0.18;
  }

  public applyPoison(dps: number): void {
    this.poisonStacks = Math.min(3, this.poisonStacks + 1);
    this.poisonTimer = 4.0;
    this.poisonDps = Math.max(this.poisonDps, dps);
    this.refreshStatusPulse('poison');
  }

  public getEffectiveSpeed(weatherFlyingMult: number): number {
    if (this.freezeTimer > 0 || this.staggerTimer > 0) return 0;
    if (this.isCocooned) return 0;
    let spd = this.def.speed * this.speedOverrideMult;
    if (this.isElite && this.eliteMod) {
      spd *= ELITE_MODIFIERS[this.eliteMod].speedMult;
    }
    if (this.def.isFlying) {
      spd *= weatherFlyingMult;
    }
    if (this.onIcePond && !this.def.isFlying) {
      spd *= 1.2; // §10.1 Enemies on ice slide +20% faster
    }
    if (this.chillTimer > 0) {
      const chillPower = 0.4 * (1 - this.def.chillResist);
      spd *= 1 - chillPower;
    }
    if (this.blindSlowTimer > 0) {
      spd *= 1 - this.blindSlowRatio;
    }
    return Math.max(0.25, spd);
  }

  public applySlow(duration: number, ratio: number): void {
    this.blindSlowTimer = Math.max(this.blindSlowTimer, duration);
    this.blindSlowRatio = Math.max(this.blindSlowRatio, ratio);
  }

  public applyKnockback(units: number, mult = 1): void {
    if (this.def.isBoss) return;
    const delta = (units * mult) / this.splineLength;
    this.progress = Math.max(0, this.progress - delta);
  }

  public applyDamage(
    rawAmount: number,
    options: {
      isExplosive?: boolean;
      isBeam?: boolean;
      isCrit?: boolean;
      element?: 'normal' | 'burn' | 'freeze' | 'devour' | 'arcane' | 'poison';
      reaction?: HitReactionType;
      sourceTowerId?: string | null;
      skipFlash?: boolean;
    } = {}
  ): { hpDamage: number; shieldShattered: boolean; killed: boolean; wasOverkill: boolean } {
    if (this.isDead) return { hpDamage: 0, shieldShattered: false, killed: false, wasOverkill: false };

    this.hasTakenDamage = true;
    this.outOfCombatTimer = 0;
    this.chipDelayTimer = 0.3;

    let dmg = rawAmount;

    // Magma Beetle Queen Phase 3: white-hot shell immune to fire, weak to ice x1.5 (§9)
    if (this.type === 'magma_beetle_queen' && this.bossPhase >= 3) {
      if (options.element === 'burn') dmg = 0;
      else if (options.element === 'freeze') dmg *= 1.5;
    }

    // Caterpillar Cocoon takes 50% damage while spinning cocoon (§8)
    if (this.isCocooned) {
      dmg *= 0.5;
    }

    // Staggered boss takes +25% damage (§9.1)
    if (this.staggerTimer > 0) {
      dmg *= 1.25;
    }

    let shieldShattered = false;

    if (this.eliteShieldHp > 0) {
      const absorbed = Math.min(this.eliteShieldHp, dmg);
      this.eliteShieldHp -= absorbed;
      dmg -= absorbed;
      if (this.eliteShieldHp <= 0 && this.rig.eliteShieldMesh) {
        this.rig.eliteShieldMesh.visible = false;
        shieldShattered = true;
      }
    }

    if (this.armor > 0 && dmg > 0) {
      const armorDmg = options.isExplosive ? dmg * 2.0 : dmg;
      if (!options.isExplosive && !options.isBeam) {
        dmg *= 0.65;
      }
      this.armor = Math.max(0, this.armor - armorDmg);
      if (this.armor <= 0) {
        shieldShattered = true;
        if (this.rig.shellMesh && this.type === 'iron_beetle') {
          this.rig.shellMesh.visible = false;
        }
      }
    }

    const hpBefore = this.hp;
    const actualHpDmg = Math.min(this.hp, Math.max(0, dmg));
    this.hp -= actualHpDmg;

    // Boss Stagger buildup (§9.1)
    if (this.def.isBoss && this.staggerTimer <= 0 && this.staggerMax > 0) {
      const stagMult = options.isExplosive || options.isCrit ? 1.5 : 0.65;
      this.staggerValue += actualHpDmg * stagMult;
      if (this.staggerValue >= this.staggerMax) {
        this.staggerValue = 0;
        this.staggerTimer = 2.0;
        EventBus.emit('match:boss_staggered', undefined);
      }
    }

    if (!options.skipFlash && actualHpDmg > 0) {
      const isHeavy = actualHpDmg > this.maxHp * 0.15;
      this.anim.triggerHitFlash(isHeavy, options.reaction ?? 'physical');
    }

    if (options.element) this.lastHitElement = options.element;
    if (options.sourceTowerId) this.killerTowerId = options.sourceTowerId;

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      const wasOverkill = !this.def.isBoss && dmg > hpBefore * 2;
      this.anim.startDeath(this.def.deathDuration, this.lastHitElement, wasOverkill);
      this.hpEl.style.display = 'none';
      return { hpDamage: actualHpDmg, shieldShattered, killed: true, wasOverkill };
    }

    return { hpDamage: actualHpDmg, shieldShattered, killed: false, wasOverkill: false };
  }

  public update(
    dt: number,
    weatherFlyingMult: number,
    allEnemiesWet: boolean,
    cameraPos: THREE.Vector3
  ): {
    burnTickDmg: number;
    bleedTickDmg: number;
    poisonTickDmg: number;
  } {
    if (this.isDead) {
      this.deathFinished = this.anim.updateDeath(this.rig, this.type, this.def.primaryColor, dt);
      return { burnTickDmg: 0, bleedTickDmg: 0, poisonTickDmg: 0 };
    }

    this.ageSeconds += dt;
    this.outOfCombatTimer += dt;
    if (this.gnawCooldown > 0) this.gnawCooldown = Math.max(0, this.gnawCooldown - dt);
    if (this.staggerTimer > 0) this.staggerTimer = Math.max(0, this.staggerTimer - dt);

    for (const key of Object.keys(this.statusPulseTimers)) {
      if (this.statusPulseTimers[key] > 0) {
        this.statusPulseTimers[key] = Math.max(0, this.statusPulseTimers[key] - dt);
      }
    }

    if (allEnemiesWet) {
      this.wetTimer = Math.max(this.wetTimer, 0.5);
    } else if (this.wetTimer > 0) {
      this.wetTimer = Math.max(0, this.wetTimer - dt);
    }

    if (this.chipDelayTimer > 0) {
      this.chipDelayTimer = Math.max(0, this.chipDelayTimer - dt);
    } else if (this.chipHp > this.hp) {
      this.chipHp = Math.max(this.hp, this.chipHp - this.maxHp * 0.9 * dt);
    }

    let burnTickDmg = 0;
    let bleedTickDmg = 0;
    let poisonTickDmg = 0;
    if (this.burnTimer > 0) {
      this.burnTimer = Math.max(0, this.burnTimer - dt);
      burnTickDmg = this.burnDps * dt;
    }
    if (this.bleedTimer > 0) {
      this.bleedTimer = Math.max(0, this.bleedTimer - dt);
      bleedTickDmg = this.bleedDps * dt;
    }
    if (this.poisonTimer > 0) {
      this.poisonTimer = Math.max(0, this.poisonTimer - dt);
      poisonTickDmg = this.poisonDps * this.poisonStacks * dt;
      if (this.poisonTimer <= 0) this.poisonStacks = 0;
    }
    if (this.chillTimer > 0) this.chillTimer = Math.max(0, this.chillTimer - dt);
    if (this.freezeTimer > 0) this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    if (this.blindSlowTimer > 0) this.blindSlowTimer = Math.max(0, this.blindSlowTimer - dt);

    if (this.isElite && this.eliteMod === 'Regenerating' && this.outOfCombatTimer >= 1.5) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.02 * dt);
    }
    if (this.isElite && this.eliteMod === 'Cleanser') {
      this.cleanserTimer -= dt;
      if (this.cleanserTimer <= 0) {
        this.cleanserTimer = 4.0;
        this.burnTimer = 0;
        this.bleedTimer = 0;
        this.chillTimer = 0;
        this.freezeTimer = 0;
        this.blindSlowTimer = 0;
        this.poisonTimer = 0;
        this.poisonStacks = 0;
      }
    }

    // Caterpillar Cocoon evolution after 12 s (§8)
    if (this.type === 'caterpillar_cocoon' && !this.hatchedToMoth) {
      if (!this.isCocooned && this.ageSeconds >= 12.0) {
        this.isCocooned = true;
        this.cocoonHatchTimer = 2.0;
        if (this.rig.cocoonMesh) this.rig.cocoonMesh.visible = true;
      } else if (this.isCocooned) {
        this.cocoonHatchTimer -= dt;
        if (this.cocoonHatchTimer <= 0) {
          this.hatchedToMoth = true;
        }
      }
    }

    // Burrowing Mole
    if (this.def.canBurrow) {
      this.burrowCycleTimer += dt;
      const cyclePos = this.burrowCycleTimer % 7.0;
      this.isBurrowed = cyclePos >= 4.5;
    }

    // Advance along spline
    const speed = this.getEffectiveSpeed(weatherFlyingMult);
    this.progress += (speed * dt) / this.splineLength;
    if (this.progress >= 1.0) {
      this.progress = 1.0;
      this.reachedGoal = true;
      this.hpEl.style.display = 'none';
    }

    this.updateTransform();
    const distSq = cameraPos.distanceToSquared(this.position);
    const skipLodSubAnim = distSq > 625; // §19 LOD > 25 units

    this.anim.updateAlive(
      this.rig,
      this.type,
      speed,
      this.ageSeconds,
      dt,
      this.freezeTimer > 0,
      this.isBurrowed,
      this.staggerTimer > 0,
      skipLodSubAnim
    );

    return { burnTickDmg, bleedTickDmg, poisonTickDmg };
  }

  private updateTransform(): void {
    const t = THREE.MathUtils.clamp(this.progress, 0, 1);
    this.spline.getPointAt(t, this.position);
    this.spline.getTangentAt(t, this._tangent);
    this.rig.root.position.copy(this.position);
    const lookX = this.position.x + this._tangent.x;
    const lookZ = this.position.z + this._tangent.z;
    this.rig.root.lookAt(lookX, this.position.y, lookZ);
  }

  public updateBillboardUI(camera: THREE.Camera): void {
    if (this.isDead || this.reachedGoal || !this.hasTakenDamage || this.def.isBoss) {
      this.hpEl.style.display = 'none';
      return;
    }

    this._proj.set(this.position.x, this.position.y + 1.45 * this.def.scale, this.position.z).project(camera);
    if (this._proj.z > 1) {
      this.hpEl.style.display = 'none';
      return;
    }

    const sx = (this._proj.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-this._proj.y * 0.5 + 0.5) * window.innerHeight;
    this.hpEl.style.display = 'block';
    this.hpEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;

    const hpPct = Math.max(0, Math.min(100, (this.hp / this.maxHp) * 100));
    const chipPct = Math.max(hpPct, Math.min(100, (this.chipHp / this.maxHp) * 100));
    this.hpFillEl.style.width = `${hpPct.toFixed(1)}%`;
    this.chipFillEl.style.width = `${chipPct.toFixed(1)}%`;

    if (this.maxArmor > 0 && this.armor > 0) {
      this.armorFillEl.style.display = 'block';
      this.armorFillEl.style.width = `${((this.armor / this.maxArmor) * 100).toFixed(1)}%`;
    } else {
      this.armorFillEl.style.display = 'none';
    }

    const cbEl = this.hpEl.querySelector('.cb-symbol') as HTMLSpanElement;
    cbEl.textContent = QualityManager.settings.colorblindMode ? this.def.colorblindSymbol : '';

    // 3D InstancedMesh renders status icons in VFXManager; keep DOM text only for multi-stack poison counter
    this.statusEl.textContent =
      this.poisonTimer > 0 && this.poisonStacks > 1 ? `☠×${this.poisonStacks}` : '';
  }

  public destroy(scene: THREE.Scene): void {
    this.anim.releaseDissolve();
    scene.remove(this.rig.root);
    this.hpEl.remove();
  }
}
