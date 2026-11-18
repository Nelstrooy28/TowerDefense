import * as THREE from 'three';
import { QualityManager } from './QualityManager';
import { DampedSpring, easeOutCubic } from '../rendering/Easing';

export class CameraRig {
  public camera: THREE.PerspectiveCamera;
  public baseFov = 46;

  private target = new THREE.Vector3(0, 0, 2);
  private desiredTarget = new THREE.Vector3(0, 0, 2);

  private yaw = 0; // radians
  private desiredYaw = 0;
  private pitch = THREE.MathUtils.degToRad(48);
  private desiredPitch = THREE.MathUtils.degToRad(48);
  private distance = 25;
  private desiredDistance = 25;

  private boundsHalfSize = 21;
  private keysDown = new Set<string>();
  private isOrbitDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private idleTimer = 0;
  public isLobbyMode = true;

  // Feel layers
  private trauma = 0;
  private shakeTime = 0;
  private fovKickSpring = new DampedSpring(0, 280, 18);
  private fovKickTimer = 0;

  private zoomPunchRemaining = 0;
  private zoomPunchDuration = 0.6;
  private zoomPunchFactor = 0.12;

  private nudgeOffset = new THREE.Vector3();
  private nudgeRemaining = 0;
  private nudgeDuration = 0.35;

  // Cinematic Boss Pan
  private cinematicActive = false;
  private cinematicTimer = 0;
  private cinematicDuration = 3.0;
  private cinematicFocus = new THREE.Vector3();

  private readonly _offset = new THREE.Vector3();
  private readonly _shakeVec = new THREE.Vector3();
  private readonly _lookTarget = new THREE.Vector3();

  constructor(aspect: number, domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.2, 220);
    this.bindInputs(domElement);
    this.update(0.016);
  }

  public setBounds(halfSize: number): void {
    this.boundsHalfSize = Math.max(10, halfSize - 2);
  }

  public resetView(): void {
    this.desiredTarget.set(0, 0, 2);
    this.target.set(0, 0, 2);
    this.desiredYaw = 0;
    this.yaw = 0;
    this.desiredPitch = THREE.MathUtils.degToRad(48);
    this.pitch = this.desiredPitch;
    this.desiredDistance = 25;
    this.distance = 25;
    this.trauma = 0;
    this.cinematicActive = false;
  }

  public addTrauma(amount: number): void {
    if (QualityManager.settings.reducedMotion) return;
    const scale = QualityManager.settings.screenShake;
    if (scale <= 0) return;
    this.trauma = Math.min(1, this.trauma + amount * scale);
  }

  public triggerFovKick(degrees = 6, duration = 0.4): void {
    if (QualityManager.settings.reducedMotion) return;
    this.fovKickSpring.value = degrees;
    this.fovKickSpring.target = 0;
    this.fovKickSpring.velocity = 0;
    this.fovKickTimer = duration;
  }

  public triggerZoomPunch(factor = 0.12, duration = 0.6): void {
    if (QualityManager.settings.reducedMotion) return;
    this.zoomPunchFactor = factor;
    this.zoomPunchDuration = duration;
    this.zoomPunchRemaining = duration;
  }

  public triggerFocusNudge(wx: number, wz: number): void {
    if (QualityManager.settings.reducedMotion) return;
    this.nudgeOffset.set((wx - this.desiredTarget.x) * 0.3, 0, (wz - this.desiredTarget.z) * 0.3);
    this.nudgeDuration = 0.35;
    this.nudgeRemaining = 0.35;
  }

  public startBossCinematic(wx: number, wy: number, wz: number, duration = 3.0): void {
    if (!QualityManager.settings.bossCamera || QualityManager.settings.reducedMotion) return;
    this.cinematicActive = true;
    this.cinematicTimer = 0;
    this.cinematicDuration = duration;
    this.cinematicFocus.set(wx, wy + 1.4, wz);
  }

  public stopCinematic(): void {
    this.cinematicActive = false;
  }

  private bindInputs(dom: HTMLElement): void {
    window.addEventListener('keydown', (e) => {
      this.keysDown.add(e.code);
      this.idleTimer = 0;
    });
    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });

    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => {
      this.idleTimer = 0;
      if (e.button === 2) {
        this.isOrbitDragging = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.isOrbitDragging) return;
      this.idleTimer = 0;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.desiredYaw -= dx * 0.0055;
      this.desiredPitch = THREE.MathUtils.clamp(
        this.desiredPitch + dy * 0.0045,
        THREE.MathUtils.degToRad(25),
        THREE.MathUtils.degToRad(80)
      );
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 2) this.isOrbitDragging = false;
    });
    dom.addEventListener(
      'wheel',
      (e) => {
        this.idleTimer = 0;
        this.desiredDistance = THREE.MathUtils.clamp(
          this.desiredDistance + e.deltaY * 0.015,
          8,
          38
        );
      },
      { passive: true }
    );
  }

  public update(dt: number): void {
    this.idleTimer += dt;
    this.shakeTime += dt * 28;

    // WASD / Arrow Keys XZ pan along camera yaw
    if (!this.isLobbyMode && !this.cinematicActive) {
      let forward = 0;
      let right = 0;
      if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) forward += 1;
      if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) forward -= 1;
      if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) right += 1;
      if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) right -= 1;

      if (forward !== 0 || right !== 0) {
        const panSpeed = 18 * dt;
        const sinY = Math.sin(this.yaw);
        const cosY = Math.cos(this.yaw);
        this.desiredTarget.x += (right * cosY - forward * sinY) * panSpeed;
        this.desiredTarget.z += (-right * sinY - forward * cosY) * panSpeed;
        this.desiredTarget.x = THREE.MathUtils.clamp(
          this.desiredTarget.x,
          -this.boundsHalfSize,
          this.boundsHalfSize
        );
        this.desiredTarget.z = THREE.MathUtils.clamp(
          this.desiredTarget.z,
          -this.boundsHalfSize,
          this.boundsHalfSize
        );
      }
    }

    // Lobby Idle Drift (§3.2): 8 s no input in lobby -> slow orbit 4°/s
    if (this.isLobbyMode && this.idleTimer >= 8 && !QualityManager.settings.reducedMotion) {
      this.desiredYaw += THREE.MathUtils.degToRad(4) * dt;
    }

    const damp = 1 - Math.exp(-10 * dt);
    this.target.lerp(this.desiredTarget, damp);
    this.yaw += (this.desiredYaw - this.yaw) * damp;
    this.pitch += (this.desiredPitch - this.pitch) * damp;
    this.distance += (this.desiredDistance - this.distance) * damp;

    // Focus nudge
    let nudgeFrac = 0;
    if (this.nudgeRemaining > 0) {
      this.nudgeRemaining = Math.max(0, this.nudgeRemaining - dt);
      const t = 1 - this.nudgeRemaining / this.nudgeDuration;
      nudgeFrac = Math.sin(t * Math.PI);
    }

    // Zoom punch
    let distScale = 1.0;
    if (this.zoomPunchRemaining > 0) {
      this.zoomPunchRemaining = Math.max(0, this.zoomPunchRemaining - dt);
      const t = 1 - this.zoomPunchRemaining / this.zoomPunchDuration;
      const env = t < 0.25 ? easeOutCubic(t / 0.25) : 1 - easeOutCubic((t - 0.25) / 0.75);
      distScale = 1.0 - this.zoomPunchFactor * env;
    }

    // FOV Kick
    if (this.fovKickTimer > 0) {
      this.fovKickTimer = Math.max(0, this.fovKickTimer - dt);
    }
    this.fovKickSpring.step(dt);
    const targetFov = this.baseFov + this.fovKickSpring.value;
    if (Math.abs(this.camera.fov - targetFov) > 0.02) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    // Trauma Shake
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - 1.8 * dt);
    }
    const shakeSq = this.trauma * this.trauma;
    const maxOffset = 0.75;
    this._shakeVec.set(
      shakeSq * maxOffset * Math.sin(this.shakeTime * 1.37),
      shakeSq * maxOffset * Math.cos(this.shakeTime * 1.93),
      shakeSq * maxOffset * Math.sin(this.shakeTime * 2.41)
    );

    if (this.cinematicActive) {
      this.cinematicTimer += dt;
      if (this.cinematicTimer >= this.cinematicDuration) {
        this.cinematicActive = false;
      } else {
        const p = this.cinematicTimer / this.cinematicDuration;
        const arcYaw = this.yaw + Math.sin(p * Math.PI) * 0.45;
        const cineDist = 11.5;
        const cinePitch = THREE.MathUtils.degToRad(32);
        this._offset.set(
          Math.sin(arcYaw) * Math.cos(cinePitch) * cineDist,
          Math.sin(cinePitch) * cineDist,
          Math.cos(arcYaw) * Math.cos(cinePitch) * cineDist
        );
        this._lookTarget.copy(this.cinematicFocus);
        this.camera.position.copy(this._lookTarget).add(this._offset).add(this._shakeVec);
        this.camera.lookAt(this._lookTarget);
        return;
      }
    }

    const effDist = this.distance * distScale;
    this._offset.set(
      Math.sin(this.yaw) * Math.cos(this.pitch) * effDist,
      Math.sin(this.pitch) * effDist,
      Math.cos(this.yaw) * Math.cos(this.pitch) * effDist
    );

    this._lookTarget
      .copy(this.target)
      .addScaledVector(this.nudgeOffset, nudgeFrac);

    this.camera.position.copy(this._lookTarget).add(this._offset).add(this._shakeVec);
    this.camera.lookAt(this._lookTarget);
  }
}
