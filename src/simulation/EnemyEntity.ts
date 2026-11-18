import * as THREE from 'three';
import { ENEMIES, type EnemyDef, type EnemyTypeId } from '../data/EnemyRegistry';
import { ELITE_MODIFIERS, type EliteModifierId } from '../data/ModifierConfig';
import { MeshFactory, type EnemyRigRefs } from '../rendering/MeshFactory';
import { EnemyAnimator } from '../rendering/Animator';
import { QualityManager } from '../core/QualityManager';

let NEXT_ENEMY_ID = 1;

export class EnemyEntity {
  public readonly id: string;
  public readonly def: EnemyDef;
  public readonly type: EnemyTypeId;
  public readonly rig: EnemyRigRefs;
  public readonly anim = new EnemyAnimator();
  public readonly spline: THREE.CatmullRomCurve3;
  public readonly splineLength: number;

  public progress = 0; // 0..1 along spline
  public position = new THREE.Vector3();
  public ageSeconds = 0;

  public maxHp: number;
  public hp: number;
  public chipHp: number;
  private chipDelayTimer = 0;

  public maxArmor: number;
  public armor: number;

  public isElite: boolean;
  public eliteMod: EliteModifierId | null;
  public eliteShieldHp = 0;
  public eliteShieldMax = 0;
  public swarmClumpCount = 1; // For >150 live ant merging (§17)

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
  public outOfCombatTimer = 0;
  public synergyCooldowns: Record<string, number> = {};

  // Special behaviors
  public isBurrowed = false;
  private burrowCycleTimer = 0;
  public waspBombTimer = 4.5;
  public snailShattered = false;
  public bossPhase = 1;
  public bossRootSlamTimer = 7.0;
  public bossSummonTimer = 11.0;
  private cleanserTimer = 4.0;

  // Death state
  public isDead = false;
  public deathFinished = false;
  public reachedGoal = false;
  public lastHitElement: 'normal' | 'burn' | 'freeze' | 'devour' | 'arcane' = 'normal';
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
    uiContainer: HTMLElement
  ) {
    this.id = `en_${NEXT_ENEMY_ID++}`;
    this.type = type;
    this.def = ENEMIES[type];
    this.spline = spline;
    this.splineLength = Math.max(1, spline.getLength());
    this.isElite = isElite;
    this.eliteMod = eliteMod;

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

    if (isElite && eliteMod === 'Shielded') {
      this.eliteShieldMax = Math.round(this.maxHp * 0.25);
      this.eliteShieldHp = this.eliteShieldMax;
    }

    this.rig = MeshFactory.buildEnemyRig(type, isElite, eliteMod);
    scene.add(this.rig.root);

    // Health Bar DOM (§7.2)
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

    this.updateTransform(0);
  }

  public mergeSwarmAnt(extraHp: number): void {
    this.swarmClumpCount += 1;
    this.maxHp += extraHp;
    this.hp += extraHp;
    this.chipHp += extraHp;
    this.rig.root.scale.setScalar(this.def.scale * Math.min(1.55, 1 + (this.swarmClumpCount - 1) * 0.12));
  }

  public getEffectiveSpeed(weatherFlyingMult: number): number {
    if (this.freezeTimer > 0) return 0;
    let spd = this.def.speed;
    if (this.isElite && this.eliteMod) {
      spd *= ELITE_MODIFIERS[this.eliteMod].speedMult;
    }
    if (this.def.isFlying) {
      spd *= weatherFlyingMult;
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
      element?: 'normal' | 'burn' | 'freeze' | 'devour' | 'arcane';
      sourceTowerId?: string | null;
      skipFlash?: boolean;
    } = {}
  ): { hpDamage: number; shieldShattered: boolean; killed: boolean } {
    if (this.isDead) return { hpDamage: 0, shieldShattered: false, killed: false };

    this.hasTakenDamage = true;
    this.outOfCombatTimer = 0;
    this.chipDelayTimer = 0.3;

    let dmg = rawAmount;
    let shieldShattered = false;

    // Elite Shielded bubble absorbs first
    if (this.eliteShieldHp > 0) {
      const absorbed = Math.min(this.eliteShieldHp, dmg);
      this.eliteShieldHp -= absorbed;
      dmg -= absorbed;
      if (this.eliteShieldHp <= 0 && this.rig.eliteShieldMesh) {
        this.rig.eliteShieldMesh.visible = false;
        shieldShattered = true;
      }
    }

    // Iron-Shell Beetle / Armor bar (§7)
    if (this.armor > 0 && dmg > 0) {
      const armorDmg = options.isExplosive ? dmg * 2.0 : dmg;
      if (!options.isExplosive && !options.isBeam) {
        dmg *= 0.65; // -35% non-explosive/non-beam until shattered
      }
      this.armor = Math.max(0, this.armor - armorDmg);
      if (this.armor <= 0) {
        shieldShattered = true;
        if (this.rig.shellMesh && this.type === 'iron_beetle') {
          this.rig.shellMesh.visible = false;
        }
      }
    }

    const actualHpDmg = Math.min(this.hp, Math.max(0, dmg));
    this.hp -= actualHpDmg;

    if (!options.skipFlash && actualHpDmg > 0) {
      const isHeavy = actualHpDmg > this.maxHp * 0.15;
      this.anim.triggerHitFlash(isHeavy);
    }

    if (options.element) {
      this.lastHitElement = options.element;
    }
    if (options.sourceTowerId) {
      this.killerTowerId = options.sourceTowerId;
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.anim.startDeath(this.def.deathDuration, this.lastHitElement);
      this.hpEl.style.display = 'none';
      return { hpDamage: actualHpDmg, shieldShattered, killed: true };
    }

    return { hpDamage: actualHpDmg, shieldShattered, killed: false };
  }

  public update(dt: number, weatherFlyingMult: number, allEnemiesWet: boolean): {
    burnTickDmg: number;
    bleedTickDmg: number;
  } {
    if (this.isDead) {
      this.deathFinished = this.anim.updateDeath(this.rig, this.type, dt);
      return { burnTickDmg: 0, bleedTickDmg: 0 };
    }

    this.ageSeconds += dt;
    this.outOfCombatTimer += dt;

    if (allEnemiesWet) {
      this.wetTimer = Math.max(this.wetTimer, 0.5);
    } else if (this.wetTimer > 0) {
      this.wetTimer = Math.max(0, this.wetTimer - dt);
    }

    // Chip bar delay (0.3 s)
    if (this.chipDelayTimer > 0) {
      this.chipDelayTimer = Math.max(0, this.chipDelayTimer - dt);
    } else if (this.chipHp > this.hp) {
      this.chipHp = Math.max(this.hp, this.chipHp - this.maxHp * 0.9 * dt);
    }

    // Status DoT ticks
    let burnTickDmg = 0;
    let bleedTickDmg = 0;
    if (this.burnTimer > 0) {
      this.burnTimer = Math.max(0, this.burnTimer - dt);
      burnTickDmg = this.burnDps * dt;
    }
    if (this.bleedTimer > 0) {
      this.bleedTimer = Math.max(0, this.bleedTimer - dt);
      bleedTickDmg = this.bleedDps * dt;
    }
    if (this.chillTimer > 0) this.chillTimer = Math.max(0, this.chillTimer - dt);
    if (this.freezeTimer > 0) this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    if (this.blindSlowTimer > 0) this.blindSlowTimer = Math.max(0, this.blindSlowTimer - dt);

    // Elite Regenerating & Cleanser (§15.3)
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
      }
    }

    // Burrowing Mole cycle: burrows 2.5 s every 7 s
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

    this.updateTransform(dt);
    this.anim.updateAlive(
      this.rig,
      this.type,
      speed,
      this.ageSeconds,
      dt,
      this.freezeTimer > 0,
      this.isBurrowed
    );

    return { burnTickDmg, bleedTickDmg };
  }

  private updateTransform(_dt: number): void {
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

    let icons = '';
    if (this.burnTimer > 0) icons += '🔥';
    if (this.freezeTimer > 0) icons += '🧊';
    else if (this.chillTimer > 0) icons += '❄️';
    if (this.bleedTimer > 0) icons += '🩸';
    if (this.wetTimer > 0) icons += '💧';
    this.statusEl.textContent = icons;
  }

  public destroy(scene: THREE.Scene): void {
    scene.remove(this.rig.root);
    this.hpEl.remove();
  }
}
