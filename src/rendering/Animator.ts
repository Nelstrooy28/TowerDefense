import * as THREE from 'three';
import { DampedSpring, Vec3Spring, easeOutBack, easeOutCubic } from './Easing';
import type { EnemyRigRefs, TowerRigRefs } from './MeshFactory';
import type { EnemyTypeId } from '../data/EnemyRegistry';
import { DissolveMaterialPool } from './ShaderLib';
import { BugRigKit } from './bugs/BugRigKit';

export type HitReactionType = 'physical' | 'burn' | 'freeze' | 'beam' | 'lightning';

export class TowerAnimator {
  public scaleSpring = new Vec3Spring(0.1, 1.8, 0.1, 280, 18);
  public recoilSpring = new DampedSpring(0, 320, 20);
  public pitchSpring = new DampedSpring(0, 280, 18);
  public rootGripSpring = new DampedSpring(1.0, 320, 20); // §3.3 attack grip
  public wiltProgress = 0;
  public isWilting = false;

  // §4.1 Placement "Seed to Plant" 0.9 s timeline (runs in real UI time)
  public placementTimer = -1;
  public isSelling = false;
  public sellTimer = 0;
  public sellFinished = false;

  private attackTimer = 0;
  private attackDuration = 0.25;
  private attackType:
    | 'projectile'
    | 'cactus'
    | 'pitcher'
    | 'lily'
    | 'flytrap'
    | 'golem'
    | 'sonic'
    | 'pepper'
    | 'sprinkler'
    | 'bamboo'
    | 'mushroom' = 'projectile';
  private upgradeFlashTimer = 0;
  private upgradeSquashTimer = 0;
  private rootSurgeTimer = 0;
  private groundGrowthTimer = 0;
  public termiteGnawFlashTimer = 0;

  private readonly _targetQuat = new THREE.Quaternion();
  private readonly _lookMat = new THREE.Matrix4();
  private readonly _eyePos = new THREE.Vector3();
  private readonly _aimPos = new THREE.Vector3();
  private readonly _up = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.scaleSpring.setTarget(1, 1, 1);
  }

  public startPlacementTimeline(): void {
    this.placementTimer = 0;
  }

  public startSellAnimation(): void {
    this.isSelling = true;
    this.sellTimer = 0;
    this.sellFinished = false;
  }

  public triggerUpgradeMoment(): void {
    this.upgradeSquashTimer = 0.3;
    this.upgradeFlashTimer = 0.08;
    this.rootSurgeTimer = 0.2;
    this.groundGrowthTimer = 0.3;
    this.scaleSpring.setImmediate(1.15, 0.8, 1.15);
    this.scaleSpring.setTarget(1, 1, 1);
    this.scaleSpring.impulse(0.6, 2.2, 0.6);
  }

  public triggerAttack(unitId: string): void {
    if (unitId === 'venus_flytrap') {
      this.attackType = 'flytrap';
      this.attackDuration = 0.34;
      this.rootGripSpring.value = 0.92;
    } else if (unitId === 'ancient_moss_golem') {
      this.attackType = 'golem';
      this.attackDuration = 0.45;
      this.rootGripSpring.value = 0.92;
    } else if (unitId === 'pineapple_cannon') {
      this.attackType = 'pitcher';
      this.attackDuration = 0.34;
      this.recoilSpring.impulse(-2.2);
      this.pitchSpring.impulse(2.6);
      this.rootGripSpring.value = 0.92;
    } else if (unitId === 'cactus_striker') {
      this.attackType = 'cactus';
      this.attackDuration = 0.26;
      this.recoilSpring.impulse(-1.8);
    } else if (unitId === 'ice_buds') {
      this.attackType = 'lily';
      this.attackDuration = 0.28;
    } else if (unitId === 'sonic_bloom') {
      this.attackType = 'sonic';
      this.attackDuration = 0.3;
    } else if (unitId === 'ghost_pepper') {
      this.attackType = 'pepper';
      this.attackDuration = 0.28;
    } else if (unitId === 'speed_sprinkler' || unitId === 'sunflower_beacon') {
      this.attackType = 'sprinkler';
      this.attackDuration = 0.35;
    } else if (unitId === 'bamboo_archer') {
      this.attackType = 'bamboo';
      this.attackDuration = 0.26;
    } else if (unitId === 'puffball_mushroom') {
      this.attackType = 'mushroom';
      this.attackDuration = 0.22;
    } else {
      this.attackType = 'projectile';
      this.attackDuration = 0.24;
      this.recoilSpring.impulse(-2.8);
      this.pitchSpring.impulse(3.5);
    }
    this.attackTimer = this.attackDuration;
  }

  public aimToward(rig: TowerRigRefs, worldX: number, _worldY: number, worldZ: number, dt: number): void {
    rig.headTurret.getWorldPosition(this._eyePos);
    this._aimPos.set(worldX, this._eyePos.y, worldZ);
    if (this._aimPos.distanceToSquared(this._eyePos) < 0.001) return;
    this._lookMat.lookAt(this._aimPos, this._eyePos, this._up);
    this._targetQuat.setFromRotationMatrix(this._lookMat);
    const alpha = 1 - Math.exp(-16 * dt);
    rig.headTurret.quaternion.slerp(this._targetQuat, alpha);
  }

  public update(
    rig: TowerRigRefs,
    unitId: string,
    wx: number,
    wz: number,
    time: number,
    dt: number,
    uiDt: number,
    hasTarget: boolean,
    isStunned: boolean,
    beatPulse: number
  ): void {
    // §4.3 Sell "Return to Soil" (0.6 s)
    if (this.isSelling) {
      this.sellTimer += uiDt;
      const p = Math.min(1, this.sellTimer / 0.6);
      rig.stemPivot.rotation.x = p * THREE.MathUtils.degToRad(40);
      const shrink = Math.max(0.01, 1 - easeOutCubic(p));
      rig.stemPivot.scale.setScalar(shrink);
      for (const r of rig.roots) {
        r.scale.setScalar(Math.max(0.01, 1 - p));
      }
      if (p >= 1) this.sellFinished = true;
      return;
    }

    // §4.1 Placement "Seed to Plant" (0.9 s in UI time)
    if (this.placementTimer >= 0 && this.placementTimer < 0.9) {
      this.placementTimer += uiDt;
      const t = this.placementTimer;
      if (t < 0.25) {
        rig.fallingSeed.visible = true;
        rig.fallingSeed.position.y = THREE.MathUtils.lerp(3.0, 0.1, t / 0.25);
        rig.stemPivot.visible = false;
        rig.auraPlane.visible = false;
        for (const r of rig.roots) r.scale.setScalar(0.01);
        return;
      } else if (t < 0.5) {
        rig.fallingSeed.visible = false;
        const rp = easeOutBack((t - 0.25) / 0.25);
        for (const r of rig.roots) r.scale.setScalar(Math.max(0.05, rp));
        rig.stemPivot.visible = false;
        rig.auraPlane.visible = false;
        return;
      } else {
        rig.fallingSeed.visible = false;
        rig.stemPivot.visible = true;
        rig.auraPlane.visible = true;
        for (const r of rig.roots) r.scale.setScalar(1);
        if (t >= 0.9) this.placementTimer = -1;
      }
    }

    this.scaleSpring.step(dt);
    this.recoilSpring.step(dt);
    this.pitchSpring.step(dt);
    this.rootGripSpring.step(dt);

    if (this.upgradeSquashTimer > 0) this.upgradeSquashTimer = Math.max(0, this.upgradeSquashTimer - dt);
    if (this.rootSurgeTimer > 0) this.rootSurgeTimer = Math.max(0, this.rootSurgeTimer - dt);
    if (this.termiteGnawFlashTimer > 0) this.termiteGnawFlashTimer = Math.max(0, this.termiteGnawFlashTimer - dt);

    if (this.groundGrowthTimer > 0) {
      this.groundGrowthTimer = Math.max(0, this.groundGrowthTimer - dt);
      const gp = easeOutBack(1 - this.groundGrowthTimer / 0.3);
      for (const d of rig.groundDetails) d.scale.multiplyScalar(0.999).setY(Math.max(0.05, d.scale.y) * Math.min(1.15, gp));
    }

    // §3.3 Root Breathing (1 ± 0.03, period 3.2 s) + Stun Droop + Veins Pulse + Termite Gnaw Flash
    for (let i = 0; i < rig.roots.length; i++) {
      const r = rig.roots[i];
      const rMat = rig.rootMats[i];
      const breath = 1 + 0.03 * Math.sin((time * Math.PI * 2) / 3.2 + i * 0.9);
      r.scale.set(breath * this.rootGripSpring.value, breath, breath);
      r.rotation.x = isStunned ? THREE.MathUtils.degToRad(15) : 0;

      const baseEm = (rMat.userData.baseEmissiveInt as number) ?? 0;
      if (this.termiteGnawFlashTimer > 0) {
        rMat.emissive.setHex(0xef4444);
        rMat.emissiveIntensity = 1.4;
      } else if (this.rootSurgeTimer > 0) {
        rMat.emissiveIntensity = 1.8;
      } else {
        const pulse = 0.8 + 0.25 * Math.sin((time * Math.PI * 2) / 1.2);
        rMat.emissiveIntensity = isStunned ? baseEm * 0.2 : baseEm * pulse;
      }
    }

    if (this.upgradeFlashTimer > 0) {
      this.upgradeFlashTimer = Math.max(0, this.upgradeFlashTimer - dt);
      for (const m of rig.emissiveParts) {
        m.emissive.setHex(0xffffff);
        m.emissiveIntensity = 2.6;
      }
    }

    if (this.isWilting) {
      this.wiltProgress = Math.min(1, this.wiltProgress + dt / 1.5);
      rig.stemPivot.rotation.x = this.wiltProgress * 1.1;
      rig.root.scale.set(
        this.scaleSpring.x.value,
        this.scaleSpring.y.value * (1 - this.wiltProgress * 0.25),
        this.scaleSpring.z.value
      );
      return;
    }

    // Idle Wind & Breathing (§8.1)
    const phi = 0.7 * wx + 0.5 * wz;
    const sway = 0.045 * Math.sin(2.4 * time + phi);
    const breathY = 1 + 0.025 * Math.sin(3.6 * time + phi);

    rig.stemPivot.rotation.z = sway;
    rig.stemPivot.rotation.x = sway * 0.5;
    rig.root.scale.set(
      this.scaleSpring.x.value,
      this.scaleSpring.y.value * breathY,
      this.scaleSpring.z.value
    );

    // Per-unit idle personalities (§6.1 + §7.1 + v6 art sheet)
    if (unitId === 'tomato_tosser') {
      const baseY = (rig.headTurret.userData.baseY as number | undefined) ?? 0.88;
      rig.headTurret.position.y = baseY + beatPulse * 0.08;
    } else if (unitId === 'cactus_striker') {
      const breathe = 1 + 0.02 * Math.sin(time * 3.2 + phi);
      rig.headTurret.scale.set(1, breathe, 1);
      if (!hasTarget) {
        rig.jawUpper.rotation.y += dt * 0.55;
      }
    } else if (unitId === 'pineapple_cannon' && !hasTarget) {
      const swell = 1 + 0.025 * Math.sin(time * 2.4 + phi);
      rig.headTurret.scale.set(swell, 1, swell);
      rig.headTurret.rotation.y = Math.sin(time * 1.3 + phi) * 0.35;
      rig.jawUpper.rotation.x = -0.14 + Math.sin(time * 3.8 + phi) * 0.1;
    } else if (unitId === 'ice_buds') {
      const spinMult = this.attackTimer > 0 ? 5.6 : 1.05;
      for (const orb of rig.orbiters) {
        const dir = (orb.userData.spinDir as number | undefined) ?? 1;
        orb.rotation.y += dt * spinMult * dir;
      }
    } else if (unitId === 'sonic_bloom' || unitId === 'sunflower_beacon') {
      const pulse = 1 + beatPulse * 0.14;
      rig.headTurret.scale.setScalar(pulse);
    } else if (unitId === 'speed_sprinkler') {
      const spinRate = this.attackTimer > 0 ? 11 : 2.2;
      for (const orb of rig.orbiters) orb.rotation.y += dt * spinRate;
    } else {
      for (let i = 0; i < rig.orbiters.length; i++) {
        rig.orbiters[i].rotation.y += dt * (1.6 + i * 0.35);
      }
    }

    rig.stunOverlay.visible = isStunned;
    if (isStunned) {
      rig.stunOverlay.rotation.y += dt * 4.5;
    }

    // 3-Stage Attack Keyframes
    if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      const p = 1 - this.attackTimer / this.attackDuration;

      if (this.attackType === 'projectile') {
        rig.headTurret.position.z = this.recoilSpring.value * 0.28;
        rig.stemPivot.rotation.x = this.pitchSpring.value * 0.12;
      } else if (this.attackType === 'cactus') {
        const scope = p < 0.4 ? 1 - (p / 0.4) * 0.22 : 0.78 + ((p - 0.4) / 0.6) * 0.22;
        rig.jawUpper.scale.set(scope, 1.0, scope);
        rig.headTurret.position.z = this.recoilSpring.value * 0.15;
      } else if (this.attackType === 'pitcher') {
        if (p < 0.35) {
          const sq = 1 - (p / 0.35) * 0.16;
          rig.headTurret.scale.set(1.08, sq, 1.08);
          rig.jawUpper.rotation.x = -0.95 * (p / 0.35);
        } else {
          const rec = (p - 0.35) / 0.65;
          rig.headTurret.scale.set(1.0, 0.84 + rec * 0.16, 1.0);
          rig.jawUpper.rotation.x = -0.95 * (1 - easeOutCubic(rec));
        }
      } else if (this.attackType === 'lily') {
        const surge = 1 + Math.sin(p * Math.PI) * 0.14;
        rig.headTurret.scale.setScalar(surge);
      } else if (this.attackType === 'bamboo') {
        const bend = p < 0.65 ? -(p / 0.65) * 0.42 : (1 - p) * 0.6;
        rig.stemPivot.rotation.x = bend;
      } else if (this.attackType === 'mushroom') {
        const sq = p < 0.45 ? 1 - (p / 0.45) * 0.35 : 0.65 + ((p - 0.45) / 0.55) * 0.35;
        rig.headTurret.scale.set(1.25 - sq * 0.25, sq, 1.25 - sq * 0.25);
      } else if (this.attackType === 'flytrap') {
        if (p < 0.3) {
          const f = p / 0.3;
          rig.stemPivot.position.z = f * 0.45;
          rig.jawUpper.rotation.x = THREE.MathUtils.degToRad(-55);
        } else if (p < 0.48) {
          const f = (p - 0.3) / 0.18;
          rig.jawUpper.rotation.x = THREE.MathUtils.lerp(THREE.MathUtils.degToRad(-55), 0, f);
          rig.stemPivot.position.z = 0.45;
        } else {
          const f = (p - 0.48) / 0.52;
          rig.stemPivot.position.z = 0.45 * (1 - easeOutCubic(f));
          rig.jawUpper.rotation.x = THREE.MathUtils.lerp(0, THREE.MathUtils.degToRad(-28), f);
        }
      } else if (this.attackType === 'golem') {
        if (p < 0.6) {
          const f = easeOutCubic(p / 0.6);
          rig.jawUpper.rotation.x = -f * 1.9;
        } else {
          const f = (p - 0.6) / 0.4;
          rig.jawUpper.rotation.x = THREE.MathUtils.lerp(-1.9, 0.35, Math.min(1, f * 2));
        }
      } else if (this.attackType === 'pepper') {
        const inhale = p < 0.35 ? 1 + (p / 0.35) * 0.24 : 1.24 - ((p - 0.35) / 0.65) * 0.24;
        rig.headTurret.scale.setScalar(inhale);
      } else if (this.attackType === 'sonic') {
        const fold = p < 0.25 ? 0.78 : 1.28 - (p - 0.25) * 0.37;
        rig.headTurret.scale.setScalar(fold);
      }
    } else {
      rig.headTurret.position.z *= Math.max(0, 1 - dt * 14);
      rig.stemPivot.position.z *= Math.max(0, 1 - dt * 10);
      rig.jawUpper.rotation.x *= Math.max(0, 1 - dt * 8);
    }

    rig.auraPlane.rotation.y += dt * 0.55;
  }
}

export class EnemyAnimator {
  public hitFlashTimer = 0;
  public knockbackTiltSpring = new DampedSpring(0, 300, 18);
  public hopOffset = 0;
  public hopVel = 0;

  // §6.2 Damage-Type Hit Reactions
  public fireShakeTimer = 0;
  public iceAnimSlowTimer = 0;
  public lightningFreezeTimer = 0;
  public beamHotTimer = 0;

  public deathActive = false;
  public deathAge = 0;
  public deathDuration = 0.5;
  public deathElement: 'normal' | 'burn' | 'freeze' | 'devour' | 'arcane' | 'poison' = 'normal';
  public dissolveMat: THREE.ShaderMaterial | null = null;
  private dissolveAttached = false;
  private readonly _dummy = new THREE.Object3D();

  public triggerHitFlash(isHeavy: boolean, reaction: HitReactionType = 'physical'): void {
    this.hitFlashTimer = 0.065;
    if (reaction === 'physical') {
      this.knockbackTiltSpring.impulse(-4.5);
      if (isHeavy && this.hopOffset <= 0.01) this.hopVel = 3.2;
    } else if (reaction === 'burn') {
      this.fireShakeTimer = 0.15;
    } else if (reaction === 'freeze') {
      this.iceAnimSlowTimer = 0.2;
    } else if (reaction === 'beam') {
      this.beamHotTimer = 0.16;
    } else if (reaction === 'lightning') {
      this.lightningFreezeTimer = 0.06;
    }
  }

  public startDeath(
    duration: number,
    element: 'normal' | 'burn' | 'freeze' | 'devour' | 'arcane' | 'poison',
    isOverkill = false
  ): void {
    this.deathActive = true;
    this.deathAge = 0;
    this.deathDuration = isOverkill ? 0.35 : Math.max(0.42, duration + 0.35);
    this.deathElement = element;
    this.dissolveAttached = false;
  }

  public releaseDissolve(): void {
    if (this.dissolveMat) {
      DissolveMaterialPool.release(this.dissolveMat);
      this.dissolveMat = null;
      this.dissolveAttached = false;
    }
  }

  public updateAlive(
    rig: EnemyRigRefs,
    type: EnemyTypeId,
    speed: number,
    time: number,
    dt: number,
    isFrozen: boolean,
    isBurrowed: boolean,
    isStaggered: boolean,
    skipLodSubAnim: boolean,
    hpRatio = 1.0,
    turnDeltaRad = 0
  ): void {
    this.knockbackTiltSpring.step(dt);
    if (this.fireShakeTimer > 0) this.fireShakeTimer = Math.max(0, this.fireShakeTimer - dt);
    if (this.iceAnimSlowTimer > 0) this.iceAnimSlowTimer = Math.max(0, this.iceAnimSlowTimer - dt);
    if (this.lightningFreezeTimer > 0) this.lightningFreezeTimer = Math.max(0, this.lightningFreezeTimer - dt);
    if (this.beamHotTimer > 0) this.beamHotTimer = Math.max(0, this.beamHotTimer - dt);

    if (this.hopOffset > 0 || this.hopVel > 0) {
      this.hopOffset += this.hopVel * dt;
      this.hopVel -= 18 * dt;
      if (this.hopOffset <= 0) {
        this.hopOffset = 0;
        this.hopVel = 0;
      }
    }

    // Hit Flash / Lightning Skeleton Flash / Beam Hot Glow
    if (this.lightningFreezeTimer > 0) {
      for (const m of rig.bodyMaterials) {
        m.emissive.setHex(0xe0e7ff);
        m.emissiveIntensity = 2.2;
      }
    } else if (this.hitFlashTimer > 0 || this.beamHotTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
      for (const m of rig.bodyMaterials) {
        m.emissive.setHex(this.beamHotTimer > 0 ? 0xfb923c : 0xffffff);
        m.emissiveIntensity = 1.4;
      }
    } else {
      for (const m of rig.bodyMaterials) {
        m.emissive.setHex((m.userData.baseEmissiveHex as number | undefined) ?? 0x000000);
        m.emissiveIntensity = (m.userData.baseEmissiveInt as number | undefined) ?? 0;
      }
    }

    rig.frozenShell.visible = isFrozen;
    if (rig.dirtMound) {
      rig.dirtMound.visible = isBurrowed;
      rig.bodyGroup.visible = !isBurrowed;
    }

    // Locust Swarm 20-boid flock update in 1 InstancedMesh (§8, §19)
    if (rig.locustFlock) {
      for (let i = 0; i < 20; i++) {
        const a = time * 4.5 + i * 0.62;
        this._dummy.position.set(
          Math.sin(a * 1.3 + i) * 0.85,
          1.25 + Math.cos(a * 1.7 + i) * 0.35,
          Math.cos(a + i * 0.7) * 0.85
        );
        this._dummy.rotation.set(0, Math.sin(a) * 0.3, 0);
        this._dummy.scale.setScalar(1);
        this._dummy.updateMatrix();
        rig.locustFlock.setMatrixAt(i, this._dummy.matrix);
      }
      rig.locustFlock.instanceMatrix.needsUpdate = true;
    }

    const animMult = this.iceAnimSlowTimer > 0 ? 0.5 : 1.0;
    const isStopped = isFrozen || isStaggered || this.lightningFreezeTimer > 0 || speed <= 0.05;
    BugRigKit.animateAlive(
      rig,
      speed * animMult,
      time,
      dt,
      isFrozen || this.lightningFreezeTimer > 0,
      isStopped,
      turnDeltaRad,
      hpRatio,
      isStaggered,
      skipLodSubAnim
    );

    const stretchZ = type === 'sprinter_mantis' && speed > 4.5 ? 1.15 : 1.0;
    rig.bodyGroup.scale.set(1 / Math.sqrt(stretchZ), isStaggered ? 0.78 : rig.bodyGroup.scale.y, stretchZ);
    rig.bodyGroup.position.y += this.hopOffset;
    rig.bodyGroup.position.x = this.fireShakeTimer > 0 ? Math.sin(time * 65) * 0.12 : 0;
    rig.bodyGroup.rotation.x =
      (isStaggered ? 0.25 : 0) + THREE.MathUtils.clamp(this.knockbackTiltSpring.value * 0.08, -0.35, 0.35);
  }

  public updateDeath(rig: EnemyRigRefs, type: EnemyTypeId, baseColor: number, dt: number): boolean {
    this.deathAge += dt;
    const totalT = Math.min(1, this.deathAge / this.deathDuration);

    if (this.deathElement === 'devour') {
      rig.bodyGroup.scale.setScalar(Math.max(0.01, 1 - totalT * 1.4));
      return totalT >= 1;
    }

    const poseDur = Math.max(0.15, this.deathDuration - 0.4);
    const poseT = Math.min(1, this.deathAge / poseDur);
    BugRigKit.animateDeathPose(rig, type, poseT, dt);

    // Fix F1 (§2): Swap to pooled dissolve ShaderMaterial for the final 0.4 s
    const dissolveStart = Math.max(0, this.deathDuration - 0.4);
    if (this.deathAge >= dissolveStart) {
      if (!this.dissolveAttached) {
        this.dissolveAttached = true;
        const edgeCol =
          this.deathElement === 'burn'
            ? 0xf97316
            : this.deathElement === 'freeze'
              ? 0x38bdf8
              : this.deathElement === 'arcane'
                ? 0xa855f7
                : this.deathElement === 'poison'
                  ? 0x84cc16
                  : 0x4ade80;
        this.dissolveMat = DissolveMaterialPool.acquire(baseColor, edgeCol);
        if (this.dissolveMat) {
          rig.bodyGroup.traverse((o) => {
            if (o.userData.isCartoonOutline) o.visible = false;
          });
          for (const m of rig.bodyMeshes) m.material = this.dissolveMat;
        }
      }
      const dT = Math.min(1, (this.deathAge - dissolveStart) / 0.4);
      if (this.dissolveMat) {
        this.dissolveMat.uniforms.uThreshold.value = dT;
      } else {
        rig.bodyGroup.scale.setScalar(Math.max(0.02, 1 - dT));
      }
    }

    if (totalT >= 1) {
      this.releaseDissolve();
      return true;
    }
    return false;
  }
}
