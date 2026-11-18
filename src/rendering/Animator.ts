import * as THREE from 'three';
import { DampedSpring, Vec3Spring, easeOutCubic } from './Easing';
import type { EnemyRigRefs, TowerRigRefs } from './MeshFactory';
import type { EnemyTypeId } from '../data/EnemyRegistry';

export class TowerAnimator {
  public scaleSpring = new Vec3Spring(0.1, 1.8, 0.1, 280, 18);
  public recoilSpring = new DampedSpring(0, 320, 20);
  public pitchSpring = new DampedSpring(0, 280, 18);
  public wiltProgress = 0;
  public isWilting = false;

  private attackTimer = 0;
  private attackDuration = 0.25;
  private attackType: 'projectile' | 'flytrap' | 'golem' | 'sonic' | 'pepper' | 'sprinkler' = 'projectile';
  private upgradeFlashTimer = 0;
  private upgradeSquashTimer = 0;

  private readonly _targetQuat = new THREE.Quaternion();
  private readonly _lookMat = new THREE.Matrix4();
  private readonly _eyePos = new THREE.Vector3();
  private readonly _aimPos = new THREE.Vector3();
  private readonly _up = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.scaleSpring.setTarget(1, 1, 1);
  }

  public triggerUpgradeMoment(): void {
    this.upgradeSquashTimer = 0.3;
    this.upgradeFlashTimer = 0.08;
    this.scaleSpring.setImmediate(1.15, 0.8, 1.15);
    this.scaleSpring.setTarget(1, 1, 1);
    this.scaleSpring.impulse(0.6, 2.2, 0.6);
  }

  public triggerAttack(unitId: string): void {
    if (unitId === 'venus_flytrap') {
      this.attackType = 'flytrap';
      this.attackDuration = 0.34;
    } else if (unitId === 'ancient_moss_golem') {
      this.attackType = 'golem';
      this.attackDuration = 0.45;
    } else if (unitId === 'sonic_bloom') {
      this.attackType = 'sonic';
      this.attackDuration = 0.3;
    } else if (unitId === 'ghost_pepper') {
      this.attackType = 'pepper';
      this.attackDuration = 0.28;
    } else if (unitId === 'speed_sprinkler') {
      this.attackType = 'sprinkler';
      this.attackDuration = 0.35;
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
    hasTarget: boolean,
    isStunned: boolean,
    beatPulse: number
  ): void {
    this.scaleSpring.step(dt);
    this.recoilSpring.step(dt);
    this.pitchSpring.step(dt);

    if (this.upgradeSquashTimer > 0) {
      this.upgradeSquashTimer = Math.max(0, this.upgradeSquashTimer - dt);
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

    // Idle Wind & Breathing (§8.1): phi = 0.7x + 0.5z
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

    // Per-unit idle personalities (§6.1)
    if (unitId === 'tomato_tosser') {
      const baseY = (rig.headTurret.userData.baseY as number | undefined) ?? 0.72;
      rig.headTurret.position.y = baseY + beatPulse * 0.09;
    } else if (unitId === 'cactus_striker') {
      const bristle = hasTarget ? 1.07 + 0.04 * Math.sin(time * 9) : 1.0;
      rig.headTurret.scale.setScalar(bristle);
    } else if (unitId === 'pineapple_cannon' && !hasTarget) {
      rig.headTurret.rotation.y = Math.sin(time * 1.5 + phi) * 0.35;
    } else if (unitId === 'sonic_bloom') {
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

    // Orbit stun stars if stunned
    rig.stunOverlay.visible = isStunned;
    if (isStunned) {
      rig.stunOverlay.rotation.y += dt * 4.5;
    }

    // 3-Stage Attack Keyframes (§8.1)
    if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      const p = 1 - this.attackTimer / this.attackDuration;

      if (this.attackType === 'projectile') {
        rig.headTurret.position.z = this.recoilSpring.value * 0.28;
        rig.stemPivot.rotation.x = this.pitchSpring.value * 0.12;
      } else if (this.attackType === 'flytrap') {
        if (p < 0.3) {
          // Lunge forward + open wide
          const f = p / 0.3;
          rig.stemPivot.position.z = f * 0.45;
          rig.jawUpper.rotation.x = THREE.MathUtils.degToRad(-55);
        } else if (p < 0.48) {
          // 60 ms jaw snap!
          const f = (p - 0.3) / 0.18;
          rig.jawUpper.rotation.x = THREE.MathUtils.lerp(THREE.MathUtils.degToRad(-55), 0, f);
          rig.stemPivot.position.z = 0.45;
        } else {
          // Smooth retract
          const f = (p - 0.48) / 0.52;
          rig.stemPivot.position.z = 0.45 * (1 - easeOutCubic(f));
          rig.jawUpper.rotation.x = THREE.MathUtils.lerp(0, THREE.MathUtils.degToRad(-28), f);
        }
      } else if (this.attackType === 'golem') {
        if (p < 0.6) {
          // Overhead raise (0.35 s)
          const f = easeOutCubic(p / 0.6);
          rig.jawUpper.rotation.x = -f * 1.9;
        } else {
          // Violent ground smash
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

    // Rarity aura rotation
    rig.auraPlane.rotation.y += dt * 0.55;
  }
}

export class EnemyAnimator {
  public hitFlashTimer = 0;
  public knockbackTiltSpring = new DampedSpring(0, 300, 18);
  public hopOffset = 0;
  public hopVel = 0;

  public deathActive = false;
  public deathAge = 0;
  public deathDuration = 0.5;
  public deathElement: 'normal' | 'burn' | 'freeze' | 'devour' | 'arcane' = 'normal';

  public triggerHitFlash(isHeavy: boolean): void {
    this.hitFlashTimer = 0.065; // 65 ms (§8.1)
    this.knockbackTiltSpring.impulse(-4.5); // tilts away ~8°
    if (isHeavy && this.hopOffset <= 0.01) {
      this.hopVel = 3.2;
    }
  }

  public startDeath(duration: number, element: 'normal' | 'burn' | 'freeze' | 'devour' | 'arcane'): void {
    this.deathActive = true;
    this.deathAge = 0;
    this.deathDuration = Math.max(0.25, duration);
    this.deathElement = element;
  }

  public updateAlive(
    rig: EnemyRigRefs,
    type: EnemyTypeId,
    speed: number,
    time: number,
    dt: number,
    isFrozen: boolean,
    isBurrowed: boolean
  ): void {
    this.knockbackTiltSpring.step(dt);

    if (this.hopOffset > 0 || this.hopVel > 0) {
      this.hopOffset += this.hopVel * dt;
      this.hopVel -= 18 * dt;
      if (this.hopOffset <= 0) {
        this.hopOffset = 0;
        this.hopVel = 0;
      }
    }

    // Hit flash (emissive #ffffff, emissiveIntensity 1.4 for 65 ms)
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
      for (const m of rig.bodyMaterials) {
        m.emissive.setHex(0xffffff);
        m.emissiveIntensity = 1.4;
      }
    } else {
      for (const m of rig.bodyMaterials) {
        if (type === 'treant_overlord' && m === rig.bodyMaterials[2]) {
          m.emissive.setHex(0xc084fc);
          m.emissiveIntensity = 1.45;
        } else {
          m.emissiveIntensity = 0;
        }
      }
    }

    rig.frozenShell.visible = isFrozen;
    if (rig.dirtMound) {
      rig.dirtMound.visible = isBurrowed;
      rig.bodyGroup.visible = !isBurrowed;
    }

    // Multi-legged scuttle / wing flap / squash & stretch (§8.1, §8.3.2)
    if (!isFrozen) {
      const cycle = time * speed * 4.5;
      for (let i = 0; i < rig.legs.length; i++) {
        const sign = i % 2 === 0 ? 1 : -1;
        rig.legs[i].rotation.x = Math.sin(cycle) * 0.48 * sign;
      }
      for (let i = 0; i < rig.wings.length; i++) {
        const sign = i % 2 === 0 ? 1 : -1;
        rig.wings[i].rotation.z = Math.sin(time * 42) * 0.45 * sign;
      }
    }

    const stretchZ = type === 'sprinter_mantis' && speed > 4.5 ? 1.15 : 1.0;
    rig.bodyGroup.scale.set(1 / Math.sqrt(stretchZ), 1, stretchZ);
    rig.bodyGroup.position.y = this.hopOffset;
    rig.bodyGroup.rotation.x = THREE.MathUtils.clamp(this.knockbackTiltSpring.value * 0.08, -0.35, 0.35);
  }

  public updateDeath(rig: EnemyRigRefs, type: EnemyTypeId, dt: number): boolean {
    this.deathAge += dt;
    const t = Math.min(1, this.deathAge / this.deathDuration);

    if (this.deathElement === 'devour') {
      rig.bodyGroup.scale.setScalar(Math.max(0.01, 1 - t * 1.4));
      return t >= 1;
    }

    if (type === 'garden_ant') {
      rig.bodyGroup.rotation.z = Math.min(Math.PI, t * Math.PI * 1.5);
      rig.bodyGroup.position.y = Math.sin(t * Math.PI) * 0.45;
    } else if (type === 'sprinter_mantis') {
      rig.bodyGroup.rotation.x = t * Math.PI * 1.4;
      rig.bodyGroup.position.z = t * 0.9;
    } else if (type === 'iron_beetle') {
      if (rig.shellMesh) {
        rig.shellMesh.position.y = 0.36 + t * 0.9;
        rig.shellMesh.rotation.z = t * 2.2;
      }
    } else if (type === 'burrowing_mole') {
      rig.bodyGroup.visible = true;
      if (rig.dirtMound) rig.dirtMound.visible = false;
      rig.bodyGroup.position.y = Math.sin(t * Math.PI) * 1.1;
      rig.bodyGroup.rotation.y = t * Math.PI * 4;
    } else if (type === 'spore_wasp') {
      rig.bodyGroup.rotation.y += dt * 10;
      rig.bodyGroup.rotation.z = t * 1.2;
      rig.bodyGroup.position.y = -t * 1.1;
    } else if (type === 'gargantuan_snail') {
      if (rig.shellMesh) rig.shellMesh.scale.setScalar(Math.max(0.01, 1 - t * 1.8));
      rig.bodyGroup.scale.set(1 + t * 0.5, Math.max(0.15, 1 - t * 0.85), 1 + t * 0.5);
    }

    // Dissolve fade near end
    if (t > 0.6) {
      const fade = 1 - (t - 0.6) / 0.4;
      rig.bodyGroup.scale.multiplyScalar(Math.max(0.02, fade));
    }

    return t >= 1;
  }
}
