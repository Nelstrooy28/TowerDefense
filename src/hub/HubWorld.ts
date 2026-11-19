import * as THREE from 'three';
import { SaveManager } from '../core/SaveManager';
import { QualityManager } from '../core/QualityManager';
import { InputActions } from '../core/InputActions';
import { EventBus } from '../core/EventBus';
import type { CameraRig } from '../core/CameraRig';
import { getUnitById } from '../data/UnitRegistry';
import { MeshFactory } from '../rendering/MeshFactory';
import { PropKit } from '../rendering/props/PropKit';
import { VFXManager } from '../rendering/VFXManager';
import { BugRigKit, type EnemyRigRefs } from '../rendering/bugs/BugRigKit';
import { AdaptiveMusic } from '../audio/AdaptiveMusic';
import { SynthAudio } from '../audio/SynthAudio';
import { Avatar } from './Avatar';
import { HUB_STATION_DEFS, HubStation, type HubStationId } from './Station';

interface SneakingHubAnt {
  rig: EnemyRigRefs;
  angle: number;
  radius: number;
  dir: number;
  timer: number;
}

export class HubWorld {
  public readonly group = new THREE.Group();
  public readonly avatar: Avatar;
  public readonly stations: HubStation[] = [];
  public hubPlants: Array<{ unitId: string; root: THREE.Group }> = [];

  private readonly vfx: VFXManager;
  private readonly scene: THREE.Scene;
  private readonly plantBedGroup = new THREE.Group();
  private readonly lanternBulbs: THREE.MeshStandardMaterial[] = [];
  private readonly lanternLight: THREE.PointLight;
  private readonly sneakingAnts: SneakingHubAnt[] = [];

  private active = true;
  private modalPaused = false;
  private focusedStation: HubStation | null = null;
  private activeStation: HubStation | null = null;
  private pendingClickStation: HubStation | null = null;

  private elapsed = 0;
  private dayCheckTimer = 99;
  private interactHoldConsumed = false;
  private introTimer = 0;
  private introDone = false;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly _rayHit = new THREE.Vector3();
  private readonly _projVec = new THREE.Vector3();

  constructor(scene: THREE.Scene, vfx: VFXManager) {
    this.scene = scene;
    this.vfx = vfx;

    this.avatar = new Avatar();
    this.group.add(this.avatar.root);
    this.group.add(this.plantBedGroup);

    this.lanternLight = new THREE.PointLight(0xfbbf24, 0, 26);
    this.lanternLight.position.set(0, 5.5, 0);
    this.group.add(this.lanternLight);

    this.buildPlazaEnvironment();
    for (const def of HUB_STATION_DEFS) {
      const st = new HubStation(def);
      this.stations.push(st);
      this.group.add(st.root);
    }
    this.spawnAmbientAnts();

    this.scene.add(this.group);

    EventBus.on('hub:celebrate', () => {
      if (this.active) this.avatar.triggerCelebrate();
    });
    EventBus.on('save:updated', () => {
      this.avatar.refreshColors();
    });
  }

  private buildPlazaEnvironment(): void {
    // Ground diorama island (single crisp lawn + soil skirt — zero flowerpots)
    const lawn = new THREE.Mesh(
      new THREE.BoxGeometry(34, 0.32, 34),
      new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.9 })
    );
    lawn.position.y = -0.16;
    lawn.receiveShadow = true;
    this.group.add(lawn);

    const soil = new THREE.Mesh(
      new THREE.BoxGeometry(34.3, 1.5, 34.3),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 })
    );
    soil.position.y = -1.07;
    this.group.add(soil);

    // Central circular stone plaza
    const stoneCenter = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.6, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.88 })
    );
    stoneCenter.position.y = 0.02;
    stoneCenter.receiveShadow = true;
    this.group.add(stoneCenter);

    // Instanced stepping stone paths linking center to the 4 cardinal directions (1 draw call)
    const tileGeo = new THREE.CylinderGeometry(0.68, 0.72, 0.06, 8);
    const tileMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85 });
    const tiles = new THREE.InstancedMesh(tileGeo, tileMat, 28);
    tiles.receiveShadow = true;
    const dummy = new THREE.Object3D();
    let idx = 0;
    const dirs: Array<[number, number]> = [
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 0],
    ];
    for (const [dx, dz] of dirs) {
      for (let s = 1; s <= 7; s++) {
        dummy.position.set(dx * (2.6 + s * 1.1), 0.02, dz * (2.6 + s * 1.1));
        dummy.rotation.y = s * 0.4;
        dummy.updateMatrix();
        tiles.setMatrixAt(idx++, dummy.matrix);
      }
    }
    tiles.instanceMatrix.needsUpdate = true;
    this.group.add(tiles);

    // Instanced white perimeter garden picket posts (1 draw call)
    const postGeo = new THREE.BoxGeometry(0.24, 0.88, 0.24);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.78 });
    const posts = new THREE.InstancedMesh(postGeo, postMat, 48);
    posts.castShadow = true;
    let pIdx = 0;
    for (let i = -14; i <= 14; i += 2.8) {
      if (pIdx + 4 > 48) break;
      const coords: Array<[number, number]> = [
        [i, -14.5],
        [i, 14.5],
        [-14.5, i],
        [14.5, i],
      ];
      for (const [x, z] of coords) {
        if (Math.abs(x) === 14.5 && Math.abs(z) === 14.5) continue;
        dummy.position.set(x, 0.44, z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        posts.setMatrixAt(pIdx++, dummy.matrix);
      }
    }
    posts.count = pIdx;
    posts.instanceMatrix.needsUpdate = true;
    this.group.add(posts);

    // 4 Corner Garden Trees + 4 Plaza Lanterns via PropKit
    const corners: Array<[number, number]> = [
      [-13.5, -13.5],
      [13.5, -13.5],
      [-13.5, 13.5],
      [13.5, 13.5],
    ];
    for (const [cx, cz] of corners) {
      const tree = PropKit.buildProp('tree');
      tree.position.set(cx, 0, cz);
      this.group.add(tree);
    }

    const lanternCoords: Array<[number, number]> = [
      [-5.5, -5.5],
      [5.5, -5.5],
      [-5.5, 5.5],
      [5.5, 5.5],
    ];
    for (const [lx, lz] of lanternCoords) {
      const lantern = PropKit.buildProp('lantern');
      lantern.position.set(lx, 0, lz);
      lantern.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.material instanceof THREE.MeshStandardMaterial && mesh.position.y > 1.0) {
          this.lanternBulbs.push(mesh.material);
        }
      });
      this.group.add(lantern);
    }
  }

  private spawnAmbientAnts(): void {
    for (let i = 0; i < 2; i++) {
      const rig = BugRigKit.buildBugRig('garden_ant');
      rig.root.scale.setScalar(0.65);
      this.group.add(rig.root);
      this.sneakingAnts.push({
        rig,
        angle: i * Math.PI,
        radius: 7.4,
        dir: i === 0 ? 1 : -1,
        timer: i * 1.8,
      });
    }
  }

  public rebuildOwnedPlants(): void {
    while (this.plantBedGroup.children.length > 0) {
      this.plantBedGroup.remove(this.plantBedGroup.children[0]);
    }
    this.hubPlants = [];

    const ownedIds = Object.keys(SaveManager.data.owned).slice(0, 12);
    const spots: Array<[number, number]> = [
      [-6.8, -6.5],
      [-4.2, -6.8],
      [-6.8, -4.0],
      [6.8, -6.5],
      [4.2, -6.8],
      [6.8, -4.0],
      [-6.8, 6.5],
      [-4.2, 6.8],
      [-6.8, 4.0],
      [6.8, 6.5],
      [4.2, 6.8],
      [6.8, 4.0],
    ];

    ownedIds.forEach((uId, idx) => {
      const unit = getUnitById(uId);
      const owned = SaveManager.data.owned[uId];
      const rig = MeshFactory.buildTowerRig(
        uId,
        Math.min(5, Math.floor(owned.masteryLevel / 2)),
        unit.rarity,
        owned.trait,
        owned.soilSkin,
        owned.isPrime,
        owned.variant ?? 'none'
      );
      const [px, pz] = spots[idx % spots.length];
      rig.root.position.set(px, 0, pz);
      rig.root.scale.setScalar(0.82);
      rig.root.userData.hubUnitId = uId;
      this.plantBedGroup.add(rig.root);
      this.hubPlants.push({ unitId: uId, root: rig.root });
    });
  }

  public setActive(active: boolean, cameraRig?: CameraRig): void {
    this.active = active;
    this.group.visible = active;
    if (active && cameraRig) {
      cameraRig.isLobbyMode = true;
      cameraRig.hubFollowActive = true;
      if (!this.introDone && !QualityManager.settings.reducedMotion) {
        this.introTimer = 1.25;
        cameraRig.glideTo(0, 8, -14, 34, 0, 26);
      } else {
        this.introDone = true;
        cameraRig.glideTo(this.avatar.position.x, 1.1, this.avatar.position.z, 15, 0, 38);
      }
    } else if (!active) {
      this.focusedStation = null;
      this.pendingClickStation = null;
      EventBus.emit('hub:station_prompt', {
        stationId: null,
        label: '',
        keyHint: '',
        screenX: 0,
        screenY: 0,
        holdProgress: 0,
      });
    }
  }

  public setModalPaused(paused: boolean): void {
    this.modalPaused = paused;
    if (paused) {
      EventBus.emit('hub:station_prompt', {
        stationId: null,
        label: '',
        keyHint: '',
        screenX: 0,
        screenY: 0,
        holdProgress: 0,
      });
    }
  }

  public teleportToStation(id: HubStationId, cameraRig: CameraRig, focusCamera = true): void {
    const st = this.stations.find((s) => s.def.id === id);
    if (!st) return;
    const tx = st.def.x === 0 ? 0 : st.def.x * 0.72;
    const tz = st.def.z === 0 ? 2.4 : st.def.z * 0.72;
    this.avatar.teleportTo(tx, tz, this.vfx);
    this.avatar.facePoint(st.def.x, st.def.z);
    if (focusCamera) {
      this.focusedStation = st;
      cameraRig.glideTo(
        st.def.camTarget[0],
        st.def.camTarget[1],
        st.def.camTarget[2],
        st.def.camDist,
        st.def.camYaw,
        st.def.camPitchDeg
      );
    }
  }

  public exitStationFocus(): void {
    this.focusedStation = null;
  }

  public handleCanvasClick(
    clientX: number,
    clientY: number,
    camera: THREE.PerspectiveCamera,
    onStationOpen: (id: HubStationId) => void
  ): boolean {
    if (!this.active || this.modalPaused) return false;
    this.pointerNdc.x = (clientX / window.innerWidth) * 2 - 1;
    this.pointerNdc.y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, camera);

    // 1. Check direct station click
    for (const st of this.stations) {
      if (this.raycaster.intersectObject(st.root, true).length > 0) {
        const dist = Math.hypot(
          st.def.x - this.avatar.position.x,
          st.def.z - this.avatar.position.z
        );
        if (dist <= st.def.radius + 1.0) {
          this.avatar.facePoint(st.def.x, st.def.z);
          onStationOpen(st.def.id);
        } else {
          this.pendingClickStation = st;
          const dirX = st.def.x - this.avatar.position.x;
          const dirZ = st.def.z - this.avatar.position.z;
          const d = Math.max(0.01, Math.hypot(dirX, dirZ));
          const approachDist = Math.max(0, d - (st.def.radius - 0.6));
          this.avatar.setMoveTarget(
            this.avatar.position.x + (dirX / d) * approachDist,
            this.avatar.position.z + (dirZ / d) * approachDist
          );
        }
        return true;
      }
    }

    // 2. Check owned Hub plant click -> open unit inventory
    for (const hp of this.hubPlants) {
      if (this.raycaster.intersectObject(hp.root, true).length > 0) {
        EventBus.emit('ui:open_unit_inventory', { unitId: hp.unitId });
        return true;
      }
    }

    // 3. Click-to-walk on ground plane
    if (this.raycaster.ray.intersectPlane(this.groundPlane, this._rayHit)) {
      this.pendingClickStation = null;
      const gx = THREE.MathUtils.clamp(this._rayHit.x, -13.0, 13.0);
      const gz = THREE.MathUtils.clamp(this._rayHit.z, -13.0, 13.0);
      this.avatar.setMoveTarget(gx, gz);
      this.vfx.spawnRecipe('ui_leaf_puff', gx, 0.25, gz);
      return true;
    }

    return false;
  }

  private updateRealClockAtmosphere(): void {
    const hr = new Date().getHours();
    const isNight = hr >= 20 || hr < 6;
    const isSunset = hr >= 17 && hr < 20;

    for (const bulb of this.lanternBulbs) {
      bulb.emissiveIntensity = isNight ? 0.39 : isSunset ? 0.28 : 0.1;
    }
    this.lanternLight.intensity = isNight ? 1.5 : isSunset ? 0.65 : 0;

    if (isNight) {
      (this.scene.background as THREE.Color).setHex(0x1e293b);
      if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.color.setHex(0x1e293b);
    } else if (isSunset) {
      (this.scene.background as THREE.Color).setHex(0xfb923c);
      if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.color.setHex(0xfb923c);
    } else {
      (this.scene.background as THREE.Color).setHex(0x87ceeb);
      if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.color.setHex(0x87ceeb);
    }
  }

  public update(
    dt: number,
    cameraRig: CameraRig,
    onStationOpen: (id: HubStationId) => void
  ): void {
    if (!this.active) return;

    // Update real-clock day/night sky & lantern state periodically
    this.dayCheckTimer += dt;
    if (this.dayCheckTimer >= 5) {
      this.dayCheckTimer = 0;
      this.updateRealClockAtmosphere();
    }

    if (this.introTimer > 0) {
      this.introTimer = Math.max(0, this.introTimer - dt);
      if (this.introTimer === 0) {
        this.introDone = true;
      }
    }

    if (this.modalPaused) {
      return;
    }

    this.elapsed += dt;
    this.avatar.update(dt, cameraRig.getYaw(), true);

    // Check Old Mossbeard / Quest ready flag for floating "!"
    const d = SaveManager.data;
    const hasQuestReady =
      d.dailyQuests.some((q) => !q.claimed && q.progress >= q.target) ||
      (d.questGnomeXp >= 100 && !d.questGnomeClaimed.includes(100)) ||
      (d.questGnomeXp >= 300 && !d.questGnomeClaimed.includes(300)) ||
      (d.questGnomeXp >= 600 && !d.questGnomeClaimed.includes(600));

    // Find closest station within trigger radius
    let nearest: HubStation | null = null;
    let bestDist = Infinity;
    for (const st of this.stations) {
      st.update(dt, this.elapsed, st.def.id === 'mossbeard' && hasQuestReady);
      const dist = Math.hypot(
        st.def.x - this.avatar.position.x,
        st.def.z - this.avatar.position.z
      );
      const inRange = dist <= st.def.radius;
      st.setHighlighted(inRange);
      if (inRange && dist < bestDist) {
        bestDist = dist;
        nearest = st;
      }
    }

    this.activeStation = nearest;
    this.avatar.triggerWave(nearest?.def.id === 'mossbeard');

    // Area music shift based on nearest station / plaza zone
    if (nearest?.def.musicZone === 'greenhouse') {
      AdaptiveMusic.mapId = 'enchanted_jungle';
    } else if (nearest?.def.musicZone === 'pads') {
      AdaptiveMusic.mapId = 'pond_isle';
    } else {
      AdaptiveMusic.mapId = 'sunny_backyard';
    }

    // Complete click-to-station arrival auto-open
    if (this.pendingClickStation && nearest === this.pendingClickStation) {
      const targetId = this.pendingClickStation.def.id;
      this.pendingClickStation = null;
      this.avatar.clearMoveTarget();
      this.avatar.facePoint(nearest.def.x, nearest.def.z);
      onStationOpen(targetId);
    }

    // [E] Interact (press or Hold-to-Interact ring)
    let holdProgress = 0;
    if (nearest) {
      const needHold = QualityManager.settings.holdToInteract;
      if (InputActions.isDown('hub_interact')) {
        if (!needHold && !this.interactHoldConsumed) {
          this.interactHoldConsumed = true;
          this.avatar.facePoint(nearest.def.x, nearest.def.z);
          this.focusedStation = nearest;
          cameraRig.glideTo(
            nearest.def.camTarget[0],
            nearest.def.camTarget[1],
            nearest.def.camTarget[2],
            nearest.def.camDist,
            nearest.def.camYaw,
            nearest.def.camPitchDeg
          );
          SynthAudio.play('click');
          onStationOpen(nearest.def.id);
        } else if (needHold && !this.interactHoldConsumed) {
          holdProgress = Math.min(1, InputActions.getHoldMs('hub_interact') / 350);
          if (holdProgress >= 1) {
            this.interactHoldConsumed = true;
            this.avatar.facePoint(nearest.def.x, nearest.def.z);
            this.focusedStation = nearest;
            cameraRig.glideTo(
              nearest.def.camTarget[0],
              nearest.def.camTarget[1],
              nearest.def.camTarget[2],
              nearest.def.camDist,
              nearest.def.camYaw,
              nearest.def.camPitchDeg
            );
            SynthAudio.play('click');
            onStationOpen(nearest.def.id);
          }
        }
      } else {
        this.interactHoldConsumed = false;
      }

      // Project floating world prompt coordinates
      this._projVec.set(nearest.def.x, 2.75, nearest.def.z);
      this._projVec.project(cameraRig.camera);
      const sx = (this._projVec.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-this._projVec.y * 0.5 + 0.5) * window.innerHeight;
      EventBus.emit('hub:station_prompt', {
        stationId: nearest.def.id,
        label: nearest.def.label,
        keyHint: nearest.def.screenHint,
        screenX: THREE.MathUtils.clamp(sx, 110, window.innerWidth - 110),
        screenY: THREE.MathUtils.clamp(sy, 72, window.innerHeight - 130),
        holdProgress,
      });
    } else {
      this.interactHoldConsumed = false;
      EventBus.emit('hub:station_prompt', {
        stationId: null,
        label: '',
        keyHint: '',
        screenX: 0,
        screenY: 0,
        holdProgress: 0,
      });
    }

    // Idle plant sway + playful bug sneaking/zapping around plaza
    for (let i = 0; i < this.hubPlants.length; i++) {
      this.hubPlants[i].root.rotation.y = Math.sin(this.elapsed * 0.8 + i) * 0.14;
    }

    for (const ant of this.sneakingAnts) {
      ant.angle += dt * 0.32 * ant.dir;
      ant.timer += dt;
      const ax = Math.cos(ant.angle) * ant.radius;
      const az = Math.sin(ant.angle) * ant.radius;
      ant.rig.root.position.set(ax, 0, az);
      ant.rig.root.rotation.y = -ant.angle + (ant.dir > 0 ? 0 : Math.PI);
      BugRigKit.animateAlive(ant.rig, 1.5, this.elapsed, dt, false, false, 0, 1.0, false, false);
      if (ant.timer >= 5.5 && this.hubPlants.length > 0) {
        ant.timer = 0;
        this.vfx.spawnRecipe('muzzle_ring_flash', ax, 0.45, az);
      }
    }

    // Camera glides smoothly behind walking Avatar when not zoomed to a station or intro
    if (this.introDone && !this.focusedStation) {
      cameraRig.glideTo(
        this.avatar.position.x,
        1.1,
        this.avatar.position.z,
        15.5,
        undefined,
        38
      );
    }
  }

  public getActiveStation(): HubStation | null {
    return this.activeStation;
  }
}
