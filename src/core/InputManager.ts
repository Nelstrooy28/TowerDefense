import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { SaveManager } from '../core/SaveManager';
import { TimeScale } from '../core/TimeScale';
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
      const rig = MeshFactory.buildTowerRig(unitId, 0, unit.rarity, 'Sprouting', 'garden_loam');
      rig.root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).material = this.ghostMat;
          obj.castShadow = false;
        }
      });
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

  private bindEvents(): void {
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.match.inMatch || this.activeSlotIndex === null || e.pointerType === 'touch') return;
      this.updatePreviewAtClientPos(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      // Living Hub Garden click -> open Inventory (§13.1)
      if (!this.match.inMatch && e.button === 0) {
        this.updateNdc(e.clientX, e.clientY);
        this.raycaster.setFromCamera(this.pointerNdc, this.match.engine.cameraRig.camera);
        for (const hp of this.match.hubPlants) {
          if (this.raycaster.intersectObject(hp.root, true).length > 0) {
            EventBus.emit('ui:open_unit_inventory', { unitId: hp.unitId });
            return;
          }
        }
        return;
      }

      if (!this.match.inMatch || e.button !== 0) return;

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

    window.addEventListener('keydown', (e) => {
      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        e.preventDefault();
        if (this.match.inMatch) this.setAltOverlay(true);
      }

      // F2 Photo Mode (§16)
      if (e.code === 'F2') {
        e.preventDefault();
        this.photoMode = !this.photoMode;
        this.match.engine.cameraRig.photoMode = this.photoMode;
        document.getElementById('ui-root')?.classList.toggle('photo-mode-hidden', this.photoMode);
        EventBus.emit('toast:show', {
          title: this.photoMode ? '📷 Photo Mode ON (F2 to exit)' : 'Photo Mode OFF',
          color: '#38bdf8',
        });
        return;
      }

      if (!this.match.inMatch) return;

      if (e.code === 'KeyP') {
        TimeScale.togglePause();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        this.match.undoLastPlacement();
      } else if (e.code === 'Tab') {
        e.preventDefault();
        if (this.match.towers.length > 0) {
          const curIdx = this.selectedTower ? this.match.towers.indexOf(this.selectedTower) : -1;
          const next = this.match.towers[(curIdx + 1) % this.match.towers.length];
          this.selectTower(next);
        }
      } else if (e.code >= 'Digit1' && e.code <= 'Digit6') {
        const idx = Number(e.code.replace('Digit', '')) - 1;
        this.selectSlot(this.activeSlotIndex === idx ? null : idx);
      } else if (e.code === 'Escape') {
        this.selectSlot(null);
        this.selectTower(null);
      } else if ((e.code === 'KeyU' || e.code === 'KeyF') && this.selectedTower) {
        if (e.shiftKey && e.code === 'KeyU') {
          this.match.upgradeMaxAffordable(this.selectedTower);
        } else {
          this.match.upgradeTower(this.selectedTower);
        }
        this.selectTower(this.selectedTower);
      } else if ((e.code === 'KeyX' || e.code === 'Backspace') && this.selectedTower) {
        const t = this.selectedTower;
        this.selectTower(null);
        this.match.sellTower(t);
      } else if (e.code === 'Space') {
        e.preventDefault();
        this.match.skipWave();
      } else if (e.code === 'KeyQ' || e.code === 'KeyE' || e.code === 'KeyR') {
        const idx = e.code === 'KeyQ' ? 0 : e.code === 'KeyE' ? 1 : 2;
        const abilityTowers = this.match.towers.filter((t) => t.def.ability && t.level >= 4);
        if (abilityTowers[idx]) {
          this.match.abilities.activate(abilityTowers[idx], this.match.towers, this.match.enemies);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        this.setAltOverlay(false);
      }
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
      this.match.cash
    );

    this.previewGroup.position.set(pt.x, check.y, pt.z);
    const colHex = check.valid ? 0x38bdf8 : 0xf43f5e;
    this.ghostMat.uniforms.uColor.value.setHex(colHex);
    (this.rangeRing.material as THREE.MeshBasicMaterial).color.setHex(colHex);
    (this.footprintRing.material as THREE.MeshBasicMaterial).color.setHex(colHex);

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
