import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SaveManager } from '../core/SaveManager';
import { InputActions } from '../core/InputActions';
import { QualityManager } from '../core/QualityManager';
import { VFXManager } from '../rendering/VFXManager';
import { SynthAudio } from '../audio/SynthAudio';

export type AvatarAnimState = 'idle' | 'walk' | 'run' | 'jump' | 'wave' | 'celebrate';

const AVATAR_GEO = {
  torso: new RoundedBoxGeometry(0.68, 0.72, 0.44, 2, 0.12),
  head: new RoundedBoxGeometry(0.56, 0.54, 0.54, 2, 0.14),
  brim: new THREE.CylinderGeometry(0.68, 0.72, 0.08, 16),
  crown: new THREE.CylinderGeometry(0.32, 0.4, 0.28, 12),
  limb: new RoundedBoxGeometry(0.22, 0.52, 0.22, 2, 0.06),
  boot: new RoundedBoxGeometry(0.25, 0.18, 0.32, 2, 0.05),
  eye: new THREE.BoxGeometry(0.08, 0.12, 0.04),
  canBody: new THREE.CylinderGeometry(0.2, 0.23, 0.38, 10),
  canSpout: new THREE.CylinderGeometry(0.04, 0.07, 0.26, 8),
  canHandle: new THREE.TorusGeometry(0.14, 0.035, 6, 12, Math.PI),
};

export class Avatar {
  public readonly root = new THREE.Group();
  public readonly position = new THREE.Vector3(0, 0, 4.2);
  public yaw = Math.PI;
  public isMoving = false;
  public isRunning = false;

  private readonly bodyPivot = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly leftArmPivot = new THREE.Group();
  private readonly rightArmPivot = new THREE.Group();
  private readonly leftLegPivot = new THREE.Group();
  private readonly rightLegPivot = new THREE.Group();
  private readonly eyeMeshes: THREE.Mesh[] = [];

  private readonly shirtMat: THREE.MeshStandardMaterial;
  private readonly hatMat: THREE.MeshStandardMaterial;
  private readonly canMat: THREE.MeshStandardMaterial;

  private velY = 0;
  private grounded = true;
  private walkPhase = 0;
  private idleClock = 0;
  private blinkTimer = 3.2;
  private celebrateTimer = 0;
  private waving = false;

  private moveTarget: { x: number; z: number } | null = null;
  private readonly _moveDir = new THREE.Vector3();

  constructor() {
    const colors = SaveManager.data.avatarColors ?? {
      hat: 0xfde047,
      shirt: 0x22c55e,
      can: 0x38bdf8,
    };

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.72 });
    const overallMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.65 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35 });
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 });

    this.shirtMat = new THREE.MeshStandardMaterial({ color: colors.shirt, roughness: 0.6 });
    this.hatMat = new THREE.MeshStandardMaterial({ color: colors.hat, roughness: 0.68 });
    this.canMat = new THREE.MeshStandardMaterial({
      color: colors.can,
      roughness: 0.35,
      metalness: 0.45,
    });

    this.root.add(this.bodyPivot);

    // Overalls + shirt torso
    const torso = new THREE.Mesh(AVATAR_GEO.torso, this.shirtMat);
    torso.position.y = 0.82;
    torso.castShadow = true;

    const bib = new THREE.Mesh(AVATAR_GEO.torso, overallMat);
    bib.scale.set(0.92, 0.56, 1.04);
    bib.position.y = 0.68;
    bib.castShadow = true;
    this.bodyPivot.add(torso, bib);

    // Legs + boots
    this.leftLegPivot.position.set(-0.18, 0.48, 0);
    this.rightLegPivot.position.set(0.18, 0.48, 0);

    for (const [legPivot] of [[this.leftLegPivot], [this.rightLegPivot]] as const) {
      const leg = new THREE.Mesh(AVATAR_GEO.limb, overallMat);
      leg.scale.set(1, 0.82, 1);
      leg.position.y = -0.22;
      leg.castShadow = true;

      const boot = new THREE.Mesh(AVATAR_GEO.boot, bootMat);
      boot.position.set(0, -0.42, 0.04);
      boot.castShadow = true;
      legPivot.add(leg, boot);
      this.bodyPivot.add(legPivot);
    }

    // Arms
    this.leftArmPivot.position.set(-0.44, 1.05, 0);
    this.rightArmPivot.position.set(0.44, 1.05, 0);

    for (const armPivot of [this.leftArmPivot, this.rightArmPivot]) {
      const sleeve = new THREE.Mesh(AVATAR_GEO.limb, this.shirtMat);
      sleeve.scale.set(0.88, 0.72, 0.88);
      sleeve.position.y = -0.18;
      sleeve.castShadow = true;
      const hand = new THREE.Mesh(AVATAR_GEO.boot, skinMat);
      hand.scale.set(0.66, 0.75, 0.52);
      hand.position.y = -0.4;
      armPivot.add(sleeve, hand);
      this.bodyPivot.add(armPivot);
    }

    // Head + blinking eyes + straw hat
    this.headGroup.position.set(0, 1.44, 0);
    const headMesh = new THREE.Mesh(AVATAR_GEO.head, skinMat);
    headMesh.castShadow = true;

    const leftEye = new THREE.Mesh(AVATAR_GEO.eye, eyeMat);
    leftEye.position.set(-0.12, 0.02, 0.27);
    const rightEye = new THREE.Mesh(AVATAR_GEO.eye, eyeMat);
    rightEye.position.set(0.12, 0.02, 0.27);
    this.eyeMeshes.push(leftEye, rightEye);

    const brim = new THREE.Mesh(AVATAR_GEO.brim, this.hatMat);
    brim.position.y = 0.22;
    brim.castShadow = true;

    const crown = new THREE.Mesh(AVATAR_GEO.crown, this.hatMat);
    crown.position.y = 0.36;
    crown.castShadow = true;

    const band = new THREE.Mesh(AVATAR_GEO.crown, ribbonMat);
    band.scale.set(1.06, 0.22, 1.06);
    band.position.y = 0.27;

    this.headGroup.add(headMesh, leftEye, rightEye, brim, crown, band);
    this.bodyPivot.add(this.headGroup);

    // Watering can strapped on the back
    const canGroup = new THREE.Group();
    canGroup.position.set(0.06, 0.86, -0.34);
    canGroup.rotation.z = 0.35;
    const canBody = new THREE.Mesh(AVATAR_GEO.canBody, this.canMat);
    canBody.castShadow = true;
    const canSpout = new THREE.Mesh(AVATAR_GEO.canSpout, this.canMat);
    canSpout.position.set(0.22, 0.08, 0);
    canSpout.rotation.z = -0.85;
    const canHandle = new THREE.Mesh(AVATAR_GEO.canHandle, this.canMat);
    canHandle.position.set(-0.2, 0.04, 0);
    canHandle.rotation.z = Math.PI * 0.5;
    canGroup.add(canBody, canSpout, canHandle);
    this.bodyPivot.add(canGroup);

    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
  }

  public refreshColors(): void {
    const c = SaveManager.data.avatarColors;
    if (!c) return;
    this.hatMat.color.setHex(c.hat);
    this.shirtMat.color.setHex(c.shirt);
    this.canMat.color.setHex(c.can);
  }

  public setMoveTarget(x: number, z: number): void {
    this.moveTarget = { x, z };
  }

  public clearMoveTarget(): void {
    this.moveTarget = null;
  }

  public facePoint(x: number, z: number): void {
    const dx = x - this.position.x;
    const dz = z - this.position.z;
    if (dx * dx + dz * dz > 0.001) {
      this.yaw = Math.atan2(dx, dz);
      this.root.rotation.y = this.yaw;
    }
  }

  public triggerCelebrate(): void {
    this.celebrateTimer = 2.6;
    if (this.grounded) {
      this.velY = 6.2;
      this.grounded = false;
    }
  }

  public triggerWave(active: boolean): void {
    this.waving = active;
  }

  public teleportTo(x: number, z: number, vfx?: VFXManager): void {
    if (vfx) {
      vfx.spawnRecipe('ui_leaf_puff', this.position.x, 0.8, this.position.z);
    }
    this.position.set(x, 0, z);
    this.velY = 0;
    this.grounded = true;
    this.moveTarget = null;
    this.root.position.copy(this.position);
    if (vfx) {
      vfx.spawnRecipe('ui_leaf_puff', x, 0.9, z);
    }
  }

  public update(dt: number, cameraYaw: number, canMove: boolean): void {
    this.idleClock += dt;

    // Eye blinking (GTD expressive character feel)
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 3.1 + Math.random() * 2.2;
    }
    const blinkScale = this.blinkTimer < 0.14 ? 0.15 : 1.0;
    for (const eye of this.eyeMeshes) {
      eye.scale.y = blinkScale;
    }

    if (this.celebrateTimer > 0) {
      this.celebrateTimer = Math.max(0, this.celebrateTimer - dt);
    }

    let moveX = 0;
    let moveZ = 0;
    let wantRun = false;

    if (canMove) {
      let forward = 0;
      let right = 0;
      if (InputActions.isDown('cam_up')) forward += 1;
      if (InputActions.isDown('cam_down')) forward -= 1;
      if (InputActions.isDown('cam_right')) right += 1;
      if (InputActions.isDown('cam_left')) right -= 1;

      if (forward !== 0 || right !== 0) {
        this.moveTarget = null;
        const sinY = Math.sin(cameraYaw);
        const cosY = Math.cos(cameraYaw);
        moveX = right * cosY - forward * sinY;
        moveZ = -right * sinY - forward * cosY;
      } else if (this.moveTarget) {
        const dx = this.moveTarget.x - this.position.x;
        const dz = this.moveTarget.z - this.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= 0.36) {
          this.moveTarget = null;
        } else {
          moveX = dx / dist;
          moveZ = dz / dist;
        }
      }

      wantRun = InputActions.isDown('hub_run');

      if (InputActions.isDown('hub_jump') && this.grounded) {
        this.velY = 7.4;
        this.grounded = false;
        SynthAudio.play('click');
      }
    } else {
      this.moveTarget = null;
    }

    const mag = Math.hypot(moveX, moveZ);
    this.isMoving = mag > 0.05;
    this.isRunning = this.isMoving && wantRun;

    if (this.isMoving) {
      this._moveDir.set(moveX / mag, 0, moveZ / mag);
      const speed = this.isRunning ? 9.2 : 5.4;
      this.position.x += this._moveDir.x * speed * dt;
      this.position.z += this._moveDir.z * speed * dt;

      // Plaza fence bounds
      this.position.x = THREE.MathUtils.clamp(this.position.x, -13.2, 13.2);
      this.position.z = THREE.MathUtils.clamp(this.position.z, -13.2, 13.2);

      // Push gently around central fountain obstacle at (0, 0)
      const distCenter = Math.hypot(this.position.x, this.position.z);
      if (distCenter > 0.001 && distCenter < 2.05) {
        const push = 2.05 / distCenter;
        this.position.x *= push;
        this.position.z *= push;
      }

      const targetYaw = Math.atan2(this._moveDir.x, this._moveDir.z);
      let diff = targetYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 14);
      this.root.rotation.y = this.yaw;
    }

    // Vertical jump / landing physics
    if (!this.grounded) {
      this.velY -= 22 * dt;
      this.position.y += this.velY * dt;
      if (this.position.y <= 0) {
        this.position.y = 0;
        this.velY = 0;
        this.grounded = true;
      }
    } else if (this.celebrateTimer > 0 && Math.floor(this.celebrateTimer * 4) % 2 === 1) {
      this.velY = 5.4;
      this.grounded = false;
    }

    this.root.position.copy(this.position);

    // Limb & body animations (honors Reduced Motion by attenuating bob)
    const motionMult = QualityManager.settings.reducedMotion ? 0.35 : 1.0;

    if (!this.grounded) {
      this.leftArmPivot.rotation.x = -2.1;
      this.rightArmPivot.rotation.x = -2.1;
      this.leftLegPivot.rotation.x = 0.45;
      this.rightLegPivot.rotation.x = -0.35;
      this.bodyPivot.position.y = 0;
      this.headGroup.rotation.y = 0;
    } else if (this.celebrateTimer > 0) {
      const s = Math.sin(this.idleClock * 12) * 0.4 * motionMult;
      this.leftArmPivot.rotation.x = -2.5 + s;
      this.rightArmPivot.rotation.x = -2.5 - s;
      this.leftLegPivot.rotation.x = 0;
      this.rightLegPivot.rotation.x = 0;
      this.bodyPivot.position.y = Math.abs(Math.sin(this.idleClock * 8)) * 0.12 * motionMult;
    } else if (this.isMoving) {
      this.walkPhase += dt * (this.isRunning ? 15.5 : 10.5);
      const swing = Math.sin(this.walkPhase) * (this.isRunning ? 0.85 : 0.62) * motionMult;
      this.leftLegPivot.rotation.x = swing;
      this.rightLegPivot.rotation.x = -swing;
      this.leftArmPivot.rotation.x = -swing * 0.9;
      this.rightArmPivot.rotation.x = swing * 0.9;
      this.bodyPivot.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.08 * motionMult;
      this.headGroup.rotation.y = Math.sin(this.walkPhase * 0.5) * 0.06 * motionMult;
    } else {
      // Idle breath + wave near NPC
      const damp = 1 - Math.min(1, dt * 10);
      this.leftLegPivot.rotation.x *= damp;
      this.rightLegPivot.rotation.x *= damp;
      this.leftArmPivot.rotation.x *= damp;
      this.bodyPivot.position.y = Math.sin(this.idleClock * 2.4) * 0.025 * motionMult;
      this.headGroup.rotation.y = Math.sin(this.idleClock * 0.9) * 0.14 * motionMult;
      if (this.waving) {
        this.rightArmPivot.rotation.z = -2.3 + Math.sin(this.idleClock * 9) * 0.28 * motionMult;
        this.rightArmPivot.rotation.x = -0.3;
      } else {
        this.rightArmPivot.rotation.z *= damp;
        this.rightArmPivot.rotation.x = Math.sin(this.idleClock * 2.4) * 0.06 * motionMult;
      }
    }
  }
}
