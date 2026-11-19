import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { SaveManager } from '../core/SaveManager';
import { TimeScale, type GameSpeed } from '../core/TimeScale';
import { QualityManager } from '../core/QualityManager';
import { InputActions } from '../core/InputActions';
import { getUnitById } from '../data/UnitRegistry';
import { createHologramGhostMaterial } from '../rendering/ShaderLib';
import { MeshFactory } from '../rendering/MeshFactory';
import { MatchController } from '../simulation/MatchController';
import type { TowerEntity } from '../simulation/TowerEntity';

export class InputManager {
  private match: MatchController;
  private canvas: HTMLCanvasElement;
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();

  public activeSlotIndex: number | null = null;
  public selectedTower: TowerEntity | null = null;
  public photoMode = false;
  public altOverlayActive = false;
  public placementYaw = 0;

  // Hologram placement preview group
  private previewGroup = new THREE.Group();
  private ghostMeshGroup: THREE.Group | null = null;
  private ghostMat: THREE.ShaderMaterial;
  private rangeRing: THREE.Mesh;
  private footprintRing: THREE.Mesh;
  private sprinklerLines: THREE.LineSegments;
  private sprinklerPositions = new Float32Array(24 * 3);

  // Alt-held all-ranges pool (up to 40 towers) (§16)
  private allRangeRings: THREE.Mesh[] = [];
  private selectedRangeRing: THREE.Mesh;

  // Blocked placement cursor label (Doc 03 §4)
  private reasonTipEl: HTMLDivElement;

  // Touch confirmation state (§15)
  private touchPendingPos: { x: number; z: number } | null = null;
  private touchConfirmBtn: HTMLButtonElement;
  private longPressTimer = 0;

  private readonly _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly _hitPt = new THREE.Vector3();

  constructor(match: MatchController, canvas: HTMLCanvasElement) {
    this.match = match;
    this.canvas = canvas;

    this.ghostMat = createHologramGhostMaterial();
    this.rangeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.0, 48),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
    );
    this.rangeRing.rotation.x = -Math.PI / 2;

    this.footprintRing = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
    );
    this.footprintRing.rotation.x = -Math.PI / 2;

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(this.sprinklerPositions, 3));
    this.sprinklerLines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.85 })
    );
    this.sprinklerLines.frustumCulled = false;

    this.previewGroup.add(this.rangeRing, this.footprintRing);
    this.previewGroup.visible = false;
    this.match.engine.scene.add(this.previewGroup);
    this.match.engine.scene.add(this.sprinklerLines);

    this.selectedRangeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1.0, 48),
      new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
    );
    this.selectedRangeRing.rotation.x = -Math.PI / 2;
    this.selectedRangeRing.visible = false;
    this.match.engine.scene.add(this.selectedRangeRing);

    const ringGeo = new THREE.RingGeometry(0.96, 1.0, 36);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      );
      m.visible = false;
      this.match.engine.scene.add(m);
      this.allRangeRings.push(m);
    }

    this.reasonTipEl = document.createElement('div');
    this.reasonTipEl.className = 'cursor-reason-tip hidden';
    document.body.appendChild(this.reasonTipEl);

    this.touchConfirmBtn = document.createElement('button');
    this.touchConfirmBtn.className = 'btn btn-green hidden touch-place-btn';
    this.touchConfirmBtn.textContent = '✓ Place Unit';
    document.body.appendChild(this.touchConfirmBtn);
    this.touchConfirmBtn.addEventListener('click', () => {
      if (this.activeSlotIndex !== null && this.touchPendingPos) {
        const uId = SaveManager.data.loadout[this.activeSlotIndex];
        if (uId) {
          const placed = this.match.placeTower(uId, this.touchPendingPos.x, this.touchPendingPos.z);
          if (placed) {
            placed.rig.root.rotation.y = this.placementYaw;
            this.selectSlot(null);
            this.selectTower(placed);
          }
        }
      }
      this.clearTouchConfirm();
    });

    this.bindEvents();
  }

  private clearTouchConfirm(): void {
    this.touchPendingPos = null;
    this.touchConfirmBtn.classList.add('hidden');
  }

  public selectSlot(slotIndex: number | null): void {
    this.activeSlotIndex = slotIndex;
    this.clearTouchConfirm();
    this.reasonTipEl.classList.add('hidden');
    if (this.ghostMeshGroup) {
      this.previewGroup.remove(this.ghostMeshGroup);
      this.ghostMeshGroup = null;
    }

    if (slotIndex !== null) {
      const unitId = SaveManager.data.loadout[slotIndex];
      if (!unitId) {
        this.activeSlotIndex = null;
        this.previewGroup.visible = false;
        this.sprinklerLines.visible = false;
        this.match.rootNetwork.computeLinks(this.match.towers);
        EventBus.emit('placement:slot_selected', { slotIndex: null });
        return;
      }
      const unit = getUnitById(unitId);
      const rig = MeshFactory.buildTowerRig(unitId, 0, unit.rarity, 'Keen I', 'garden_loam');
      rig.root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).material = this.ghostMat;
          obj.castShadow = false;
        }
      });
      rig.root.rotation.y = this.placementYaw;
      this.ghostMeshGroup = rig.root;
      this.previewGroup.add(this.ghostMeshGroup);
      this.rangeRing.scale.setScalar(Math.max(1, unit.rangeBase));
      this.rangeRing.visible = unit.rangeBase > 0;
      this.footprintRing.scale.setScalar(unit.footprintRadius);
      this.previewGroup.visible = true;
    } else {
      this.previewGroup.visible = false;
      this.sprinklerLines.visible = false;
      this.match.rootNetwork.computeLinks(this.match.towers);
    }

    EventBus.emit('placement:slot_selected', { slotIndex: this.activeSlotIndex });
  }

  public selectTower(tower: TowerEntity | null): void {
    this.selectedTower = tower;
    if (tower) {
      const rng = tower.getEffectiveRange(this.match.weather.activeDef?.rangeMult ?? 1);
      this.selectedRangeRing.position.set(tower.position.x, tower.position.y + 0.08, tower.position.z);
      this.selectedRangeRing.scale.setScalar(Math.max(0.8, rng));
      this.selectedRangeRing.visible = rng > 0;
      EventBus.emit('camera:focus_nudge', { x: tower.position.x, z: tower.position.z });
    } else {
      this.selectedRangeRing.visible = false;
    }
    EventBus.emit('tower:selected', { towerId: tower?.id ?? null });
  }

  private setAltOverlay(active: boolean): void {
    this.altOverlayActive = active;
    this.match.rootNetwork.altHeld = active;
    this.match.rootNetwork.computeLinks(this.match.towers);
    for (let i = 0; i < this.allRangeRings.length; i++) {
      const ring = this.allRangeRings[i];
      if (!active || i >= this.match.towers.length) {
        ring.visible = false;
        continue;
      }
      const t = this.match.towers[i];
      const rng = t.getEffectiveRange(this.match.weather.activeDef?.rangeMult ?? 1);
      if (rng <= 0) {
        ring.visible = false;
        continue;
      }
      ring.position.set(t.position.x, t.position.y + 0.07, t.position.z);
      ring.scale.setScalar(rng);
      ring.visible = true;
    }
  }

  public update(_dt: number): void {
    if (!this.match.inMatch || this.match.matchEnded) return;
    if (this.selectedTower) {
      if (
        InputActions.isDown('upgrade') &&
        !InputActions.wasHoldFired('upgrade') &&
        InputActions.getHoldMs('upgrade') >= 250
      ) {
        InputActions.consumeHoldFire('upgrade');
        this.match.upgradeTower(this.selectedTower);
        this.selectTower(this.selectedTower);
      }
      if (
        QualityManager.settings.holdToSell &&
        InputActions.isDown('sell') &&
        !InputActions.wasHoldFired('sell') &&
        InputActions.getHoldMs('sell') >= 400
      ) {
        InputActions.consumeHoldFire('sell');
        const t = this.selectedTower;
        this.selectTower(null);
        this.match.sellTower(t);
      }
    }
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.match.inMatch || e.pointerType === 'touch') return;
      const pt = this.raycastGroundOrCliff(e.clientX, e.clientY);
      if (pt) this.match.collectSunCoinsNearPoint(pt.x, pt.z, 2.2);
      if (this.activeSlotIndex !== null) {
        this.updatePreviewAtClientPos(e.clientX, e.clientY);
      } else {
        this.reasonTipEl.classList.add('hidden');
      }
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.match.inMatch && e.button === 0) {
        this.match.hubWorld.handleCanvasClick(
          e.clientX,
          e.clientY,
          this.match.engine.cameraRig.camera,
          (id) => this.match.onHubStationInteract?.(id)
        );
        return;
      }

      if (!this.match.inMatch) return;

      // Right-click in placement mode cancels cleanly (GTD Doc 04 §2.1)
      if (e.button === 2 && this.activeSlotIndex !== null) {
        this.selectSlot(null);
        return;
      }

      if (e.button !== 0) return;

      // Touch two-step placement (§15)
      if (e.pointerType === 'touch' && this.activeSlotIndex !== null) {
        const pt = this.raycastGroundOrCliff(e.clientX, e.clientY);
        if (pt) {
          if (
            this.touchPendingPos &&
            Math.hypot(pt.x - this.touchPendingPos.x, pt.z - this.touchPendingPos.z) < 1.2
          ) {
            this.touchConfirmBtn.click();
          } else {
            this.touchPendingPos = { x: pt.x, z: pt.z };
            this.updatePreviewAtClientPos(e.clientX, e.clientY);
            this.touchConfirmBtn.classList.remove('hidden');
          }
        }
        return;
      }

      if (this.activeSlotIndex !== null) {
        const unitId = SaveManager.data.loadout[this.activeSlotIndex];
        if (!unitId) return;
        const pos = this.raycastGroundOrCliff(e.clientX, e.clientY);
        if (pos) {
          const placed = this.match.placeTower(unitId, pos.x, pos.z);
          if (placed) {
            placed.rig.root.rotation.y = this.placementYaw;
            this.selectSlot(null);
            this.selectTower(placed);
          }
        }
        return;
      }

      this.updateNdc(e.clientX, e.clientY);
      this.raycaster.setFromCamera(this.pointerNdc, this.match.engine.cameraRig.camera);
      let hitTower: TowerEntity | null = null;
      let bestDist = Infinity;
      for (const t of this.match.towers) {
        const hits = this.raycaster.intersectObject(t.rig.root, true);
        if (hits.length > 0 && hits[0].distance < bestDist) {
          bestDist = hits[0].distance;
          hitTower = t;
        }
      }

      // GTD Shift+Click on tower -> instant upgrade (Doc 04 §2.1)
      if (hitTower && e.shiftKey) {
        this.selectTower(hitTower);
        this.match.upgradeTower(hitTower);
        this.selectTower(hitTower);
        return;
      }

      this.selectTower(hitTower);

      if (e.pointerType === 'touch' && hitTower) {
        this.longPressTimer = window.setTimeout(() => this.setAltOverlay(true), 450);
      }
    });

    window.addEventListener('pointerup', () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = 0;
        this.setAltOverlay(false);
      }
    });

    // Centralized Keybinds via InputActions (AGENTS Rule 22)
    InputActions.onDown('show_ranges', (_m, e) => {
      if (!this.match.inMatch) return false;
      e?.preventDefault();
      this.setAltOverlay(true);
      return false;
    });
    InputActions.onUp('show_ranges', () => {
      this.setAltOverlay(false);
    });

    InputActions.onDown('photo_mode', (_m, e) => {
      e?.preventDefault();
      this.photoMode = !this.photoMode;
      this.match.engine.cameraRig.photoMode = this.photoMode;
      document.getElementById('ui-root')?.classList.toggle('photo-mode-hidden', this.photoMode);
      EventBus.emit('toast:show', {
        title: this.photoMode ? '📷 Photo Mode ON' : 'Photo Mode OFF',
        color: '#38bdf8',
      });
      return true;
    });

    InputActions.onDown('pause', () => {
      if (!this.match.inMatch) return false;
      TimeScale.togglePause();
      return true;
    });

    InputActions.onDown('undo_place', (_m, e) => {
      if (!this.match.inMatch) return false;
      e?.preventDefault();
      this.match.undoLastPlacement();
      return true;
    });

    InputActions.onDown('rotate', () => {
      if (!this.match.inMatch || this.activeSlotIndex === null) return false;
      this.placementYaw = (this.placementYaw + Math.PI / 4) % (Math.PI * 2);
      if (this.ghostMeshGroup) this.ghostMeshGroup.rotation.y = this.placementYaw;
      return true;
    });

    InputActions.onDown(
      'cancel',
      (_m, e) => {
        if (!this.match.inMatch) return false;
        if (this.activeSlotIndex !== null || this.selectedTower !== null) {
          e?.preventDefault();
          this.selectSlot(null);
          this.selectTower(null);
          return true;
        }
        return false;
      },
      10
    );

    const slots: Array<'hotbar_1' | 'hotbar_2' | 'hotbar_3' | 'hotbar_4' | 'hotbar_5' | 'hotbar_6'> = [
      'hotbar_1',
      'hotbar_2',
      'hotbar_3',
      'hotbar_4',
      'hotbar_5',
      'hotbar_6',
    ];
    slots.forEach((act, idx) => {
      InputActions.onDown(act, () => {
        if (!this.match.inMatch) return false;
        this.selectSlot(this.activeSlotIndex === idx ? null : idx);
        return true;
      });
    });

    InputActions.onDown('select_next_tower', (_m, e) => {
      if (!this.match.inMatch || this.match.towers.length === 0) return false;
      e?.preventDefault();
      const curIdx = this.selectedTower ? this.match.towers.indexOf(this.selectedTower) : -1;
      const next = this.match.towers[(curIdx + 1) % this.match.towers.length];
      this.selectTower(next);
      return true;
    });

    InputActions.onDown('manager', (_m, e) => {
      if (!this.match.inMatch) return false;
      e?.preventDefault();
      EventBus.emit('ui:toggle_manager', undefined);
      return true;
    });

    InputActions.onDown('upgrade_max', () => {
      if (!this.match.inMatch || !this.selectedTower) return false;
      this.match.upgradeMaxAffordable(this.selectedTower);
      this.selectTower(this.selectedTower);
      return true;
    });

    // Release tap (< 250ms) also upgrades cleanly if hold didn't fire yet
    InputActions.onUp('upgrade', () => {
      if (!this.match.inMatch || !this.selectedTower) return false;
      if (!InputActions.wasHoldFired('upgrade')) {
        this.match.upgradeTower(this.selectedTower);
        this.selectTower(this.selectedTower);
      }
      return true;
    });

    InputActions.onDown('sell', () => {
      if (!this.match.inMatch || !this.selectedTower) return false;
      if (QualityManager.settings.holdToSell) return false; // Handled in update()
      const t = this.selectedTower;
      this.selectTower(null);
      this.match.sellTower(t);
      return true;
    });

    InputActions.onDown('target_cycle', () => {
      if (!this.match.inMatch || !this.selectedTower) return false;
      this.selectedTower.cycleTargeting();
      this.selectTower(this.selectedTower);
      return true;
    });

    InputActions.onDown('speed_cycle', () => {
      if (!this.match.inMatch) return false;
      const next: GameSpeed = TimeScale.speed === 1 ? 2 : TimeScale.speed === 2 ? 3 : 1;
      TimeScale.setSpeed(next);
      EventBus.emit('match:state_changed', undefined);
      return true;
    });

    InputActions.onDown('start_wave', (_m, e) => {
      if (!this.match.inMatch) return false;
      if (this.match.gameMode === 'survival' && InputActions.isDown('survival_dash')) return false;
      e?.preventDefault();
      this.match.skipWave();
      return true;
    });

    const abilityActions: Array<'ability_1' | 'ability_2' | 'ability_3'> = ['ability_1', 'ability_2', 'ability_3'];
    abilityActions.forEach((act, idx) => {
      InputActions.onDown(act, () => {
        if (!this.match.inMatch) return false;
        const abilityTowers = this.match.towers.filter((t) => t.def.ability && t.level >= 4);
        if (abilityTowers[idx]) {
          this.match.abilities.activate(abilityTowers[idx], this.match.towers, this.match.enemies);
          return true;
        }
        return false;
      });
    });
  }

  private updateNdc(cx: number, cy: number): void {
    this.pointerNdc.x = (cx / window.innerWidth) * 2 - 1;
    this.pointerNdc.y = -(cy / window.innerHeight) * 2 + 1;
  }

  private raycastGroundOrCliff(cx: number, cy: number): THREE.Vector3 | null {
    this.updateNdc(cx, cy);
    this.raycaster.setFromCamera(this.pointerNdc, this.match.engine.cameraRig.camera);
    if (this.match.mapHandles) {
      const cliffHits = this.raycaster.intersectObjects(this.match.mapHandles.cliffMeshes, false);
      if (cliffHits.length > 0) {
        return cliffHits[0].point;
      }
    }
    const hit = this.raycaster.ray.intersectPlane(this._plane, this._hitPt);
    return hit ? this._hitPt : null;
  }

  private updatePreviewAtClientPos(cx: number, cy: number): void {
    if (this.activeSlotIndex === null) return;
    const unitId = SaveManager.data.loadout[this.activeSlotIndex];
    if (!unitId) return;
    const unit = getUnitById(unitId);
    const pt = this.raycastGroundOrCliff(cx, cy);
    if (!pt) return;

    const check = this.match.placement.validate(
      unit,
      pt.x,
      pt.z,
      this.match.getPlacedFootprints(),
      this.match.sandboxInfiniteCash ? 999999 : this.match.cash,
      this.match.modifierEffects.maxTowers,
      this.match.modifierEffects.towerCostMult
    );

    this.previewGroup.position.set(pt.x, check.y, pt.z);
    const colHex = check.valid ? 0x38bdf8 : 0xf43f5e;
    this.ghostMat.uniforms.uColor.value.setHex(colHex);
    (this.rangeRing.material as THREE.MeshBasicMaterial).color.setHex(colHex);
    (this.footprintRing.material as THREE.MeshBasicMaterial).color.setHex(colHex);

    if (!check.valid && check.reason) {
      this.reasonTipEl.textContent = check.reason;
      this.reasonTipEl.style.left = `${Math.min(window.innerWidth - 220, cx + 16)}px`;
      this.reasonTipEl.style.top = `${Math.min(window.innerHeight - 44, cy + 16)}px`;
      this.reasonTipEl.classList.remove('hidden');
    } else {
      this.reasonTipEl.classList.add('hidden');
    }

    // §5 Root Network Ghost Link Preview
    this.match.rootNetwork.computeLinks(this.match.towers, unitId, pt.x, pt.z);

    let lineCount = 0;
    for (const t of this.match.towers) {
      if (lineCount >= 12) break;
      const isLink =
        (t.def.isSupport && Math.hypot(t.position.x - pt.x, t.position.z - pt.z) <= t.getEffectiveRange()) ||
        (unit.isSupport && Math.hypot(t.position.x - pt.x, t.position.z - pt.z) <= unit.rangeBase);
      if (isLink) {
        const base = lineCount * 6;
        this.sprinklerPositions[base] = pt.x;
        this.sprinklerPositions[base + 1] = check.y + 0.8;
        this.sprinklerPositions[base + 2] = pt.z;
        this.sprinklerPositions[base + 3] = t.position.x;
        this.sprinklerPositions[base + 4] = t.position.y + 0.8;
        this.sprinklerPositions[base + 5] = t.position.z;
        lineCount++;
      }
    }
    this.sprinklerLines.visible = lineCount > 0;
    this.sprinklerLines.geometry.setDrawRange(0, lineCount * 2);
    this.sprinklerLines.geometry.attributes.position.needsUpdate = true;
  }
}
