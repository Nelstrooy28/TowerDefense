import * as THREE from 'three';
import { CRATES, getPreviousRarity, RARITIES, type RarityId } from '../data/RarityConfig';
import { SaveManager } from '../core/SaveManager';
import { EventBus } from '../core/EventBus';
import { QualityManager } from '../core/QualityManager';
import { MeshFactory } from '../rendering/MeshFactory';
import { ProceduralTextures } from '../rendering/ProceduralTextures';
import { easeOutBack, easeOutCubic } from '../rendering/Easing';
import { SynthAudio } from '../audio/SynthAudio';
import type { UnitDef } from '../data/UnitRegistry';
import type { TraitId } from '../data/TraitConfig';

interface PullCardResult {
  unit: UnitDef;
  rarity: RarityId;
  trait: TraitId;
  isNew: boolean;
  dewdropsGained: number;
}

export class SummonModal {
  public root: HTMLDivElement;
  private isOpen = false;
  private canvasWrap!: HTMLDivElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 2.2, 0.1, 40);
  private podGroup = new THREE.Group();
  private revealGroup = new THREE.Group();
  private godRaysGroup = new THREE.Group();
  private lightMat = new THREE.PointLight(0xffffff, 2.5, 16);

  private animActive = false;
  private animTime = 0;
  private animRaf = 0;
  private lastTickTime = 0;
  private currentResults: PullCardResult[] = [];
  private isEnchantedPull = false;
  private currentStageRarity: RarityId = 'Common';
  private beatsFired = new Set<string>();
  private summaryEl!: HTMLDivElement;
  private pityWrapEl!: HTMLDivElement;
  private statusBannerEl!: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'modal-backdrop hidden';
    this.root.innerHTML = `
      <div class="modal-card gloss-panel">
        <div class="modal-header">
          <div style="font-size:22px;font-weight:800;">🌱 Seed Summon Crates</div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="stat-pill" id="summon-seeds-pill">🌱 0</span>
            <span class="stat-pill" id="summon-dews-pill">💧 0</span>
            <button class="btn btn-rose btn-sm" id="summon-close-btn">Close</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="showcase-stage" id="summon-stage">
            <div id="summon-banner" style="position:absolute;top:12px;left:50%;transform:translateX(-50%);font-size:18px;font-weight:800;text-shadow:0 2px 6px #000;pointer-events:none;">Click a Crate below to Summon!</div>
            <div style="position:absolute;bottom:10px;right:12px;font-size:14px;opacity:0.8;pointer-events:none;">Click stage or press Space to skip to reveal</div>
          </div>
          <div id="summon-results-row" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;"></div>
          <div id="summon-pity-area" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div class="gloss-panel" style="padding:12px;display:flex;flex-direction:column;gap:8px;">
              <div style="font-size:17px;font-weight:800;color:#4ade80;">Classic Seed Crate (100 Seeds)</div>
              <div style="font-size:14px;color:#cbd5e1;">Pity: Legendary+ @ 15, Mythical+ @ 40</div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-green" id="pull-classic-1" style="flex:1;">Summon 1x (100)</button>
                <button class="btn btn-green" id="pull-classic-5" style="flex:1;">Summon 5x (500)</button>
              </div>
            </div>
            <div class="gloss-panel" style="padding:12px;display:flex;flex-direction:column;gap:8px;border-color:#c084fc;">
              <div style="font-size:17px;font-weight:800;color:#c084fc;">Enchanted Seed Crate (200 Seeds)</div>
              <div style="font-size:14px;color:#cbd5e1;">Pity: Mythical+ @ 15, Godly+ @ 35</div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-purple" id="pull-ench-1" style="flex:1;">Summon 1x (200)</button>
                <button class="btn btn-purple" id="pull-ench-5" style="flex:1;">Summon 5x (1000)</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    parent.appendChild(this.root);

    this.canvasWrap = this.root.querySelector('#summon-stage') as HTMLDivElement;
    this.summaryEl = this.root.querySelector('#summon-results-row') as HTMLDivElement;
    this.pityWrapEl = this.root.querySelector('#summon-pity-area') as HTMLDivElement;
    this.statusBannerEl = this.root.querySelector('#summon-banner') as HTMLDivElement;

    this.setupThreeStage();

    this.root.querySelector('#summon-close-btn')!.addEventListener('click', () => this.close());
    this.root.querySelector('#pull-classic-1')!.addEventListener('click', () => this.triggerPull('classic', 1));
    this.root.querySelector('#pull-classic-5')!.addEventListener('click', () => this.triggerPull('classic', 5));
    this.root.querySelector('#pull-ench-1')!.addEventListener('click', () => this.triggerPull('enchanted', 1));
    this.root.querySelector('#pull-ench-5')!.addEventListener('click', () => this.triggerPull('enchanted', 5));

    this.canvasWrap.addEventListener('click', () => this.skipToReveal());
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.code === 'Space' && this.animActive) {
        e.preventDefault();
        this.skipToReveal();
      }
    });

    EventBus.on('save:updated', () => {
      if (this.isOpen) this.refreshHeaderAndPity();
    });
  }

  private setupThreeStage(): void {
    this.scene.background = new THREE.Color(0x0b1220);
    this.camera.position.set(0, 1.8, 6.4);
    this.camera.lookAt(0, 0.7, 0);

    const hemi = new THREE.HemisphereLight(0xcbd5e1, 0x1e293b, 1.1);
    const dir = new THREE.DirectionalLight(0xfffbeb, 1.5);
    dir.position.set(4, 7, 5);
    this.scene.add(hemi, dir, this.lightMat);
    this.lightMat.position.set(0, 2.5, 2.5);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.8, 0.2, 24),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    );
    floor.position.y = -0.1;
    this.scene.add(floor);

    // 12 radial god ray blades (§4.1.1)
    const rayGeo = new THREE.ConeGeometry(0.45, 5.2, 4, 1, true);
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 12; i++) {
      const ray = new THREE.Mesh(rayGeo, rayMat);
      const a = (i / 12) * Math.PI * 2;
      ray.rotation.z = a;
      ray.position.set(0, 1.0, -0.6);
      this.godRaysGroup.add(ray);
    }
    this.godRaysGroup.visible = false;
    this.scene.add(this.godRaysGroup, this.podGroup, this.revealGroup);
  }

  private ensureRenderer(): void {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.canvasWrap.insertBefore(this.renderer.domElement, this.canvasWrap.firstChild);
  }

  public open(): void {
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.ensureRenderer();
    this.resizeStage();
    this.refreshHeaderAndPity();
    this.resetStageIdle();
    this.startLoop();
    SynthAudio.play('click');
  }

  public close(): void {
    this.isOpen = false;
    this.root.classList.add('hidden');
    cancelAnimationFrame(this.animRaf);
  }

  private resizeStage(): void {
    if (!this.renderer) return;
    const w = this.canvasWrap.clientWidth || 700;
    const h = this.canvasWrap.clientHeight || 290;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private resetStageIdle(): void {
    this.podGroup.clear();
    this.revealGroup.clear();
    this.godRaysGroup.visible = false;
    const idlePod = MeshFactory.buildSeedPodMesh(false);
    idlePod.position.y = 1.0;
    this.podGroup.add(idlePod);
    this.podGroup.visible = true;
    this.revealGroup.visible = false;
    this.statusBannerEl.textContent = 'Choose Classic or Enchanted Seed Crate!';
  }

  private refreshHeaderAndPity(): void {
    const d = SaveManager.data;
    this.root.querySelector('#summon-seeds-pill')!.textContent = `🌱 ${d.seeds}`;
    this.root.querySelector('#summon-dews-pill')!.textContent = `💧 ${d.dewdrops}`;

    const cLeg = d.pity.classicSinceLeg;
    const eMyth = d.pity.enchantedSinceMyth;
    const cHot = cLeg >= CRATES.classic.pityPrimaryThreshold - 1;
    const eHot = eMyth >= CRATES.enchanted.pityPrimaryThreshold - 1;

    this.pityWrapEl.innerHTML = `
      <div class="pity-bar-wrap ${cHot ? 'pity-hot' : ''}">
        <div class="pity-bar-fill" style="width:${Math.min(100, (cLeg / 15) * 100)}%"></div>
        <div class="pity-bar-text">Classic Legendary+ Pity: ${cLeg} / 15 (Myth ${d.pity.classicSinceMyth}/40)</div>
      </div>
      <div class="pity-bar-wrap ${eHot ? 'pity-hot' : ''}">
        <div class="pity-bar-fill" style="width:${Math.min(100, (eMyth / 15) * 100)}%"></div>
        <div class="pity-bar-text">Enchanted Mythical+ Pity: ${eMyth} / 15 (Godly ${d.pity.enchantedSinceGodly}/35)</div>
      </div>
    `;

    const c1 = this.root.querySelector('#pull-classic-1') as HTMLButtonElement;
    const c5 = this.root.querySelector('#pull-classic-5') as HTMLButtonElement;
    const e1 = this.root.querySelector('#pull-ench-1') as HTMLButtonElement;
    const e5 = this.root.querySelector('#pull-ench-5') as HTMLButtonElement;

    c1.disabled = d.seeds < 100;
    c5.disabled = d.seeds < 500;
    e1.textContent = d.enchantedKeys > 0 ? `Free Key (${d.enchantedKeys})` : 'Summon 1x (200)';
    e1.disabled = d.enchantedKeys <= 0 && d.seeds < 200;
    e5.disabled = d.seeds < 1000;
  }

  private triggerPull(type: 'classic' | 'enchanted', count: 1 | 5): void {
    const useKey = type === 'enchanted' && count === 1 && SaveManager.data.enchantedKeys > 0;
    const res = SaveManager.pullCrates(type, count, useKey);
    if (!res) {
      SynthAudio.play('error');
      return;
    }

    this.currentResults = res;
    this.isEnchantedPull = type === 'enchanted';
    this.currentStageRarity = res[res.length - 1].rarity;
    this.beatsFired.clear();
    this.animActive = true;
    this.animTime = 0;
    this.summaryEl.innerHTML = '';

    this.podGroup.clear();
    if (count === 1) {
      const pod = MeshFactory.buildSeedPodMesh(this.isEnchantedPull);
      pod.position.set(0, 1.0, 0);
      this.podGroup.add(pod);
    } else {
      for (let i = 0; i < 5; i++) {
        const pod = MeshFactory.buildSeedPodMesh(this.isEnchantedPull);
        pod.scale.setScalar(0.62);
        pod.position.set((i - 2) * 1.45, 0.8, -Math.abs(i - 2) * 0.25);
        this.podGroup.add(pod);
      }
    }
    this.podGroup.visible = true;

    this.revealGroup.clear();
    const top = res[res.length - 1];
    const unitRig = MeshFactory.buildTowerRig(top.unit.id, 0, top.rarity, top.trait, 'garden_loam');
    unitRig.root.scale.setScalar(1.25);
    this.revealGroup.add(unitRig.root);
    this.revealGroup.visible = false;
    this.godRaysGroup.visible = false;

    this.refreshHeaderAndPity();
  }

  private skipToReveal(): void {
    if (!this.animActive || this.animTime >= 2.3) return;
    this.animTime = 2.3;
  }

  private startLoop(): void {
    this.lastTickTime = performance.now();
    const tick = (now: number) => {
      if (!this.isOpen) return;
      const dt = Math.min(0.05, (now - this.lastTickTime) / 1000);
      this.lastTickTime = now;
      this.updateTimeline(dt);
      this.renderer?.render(this.scene, this.camera);
      this.animRaf = requestAnimationFrame(tick);
    };
    this.animRaf = requestAnimationFrame(tick);
  }

  private updateTimeline(dt: number): void {
    if (!this.animActive) {
      this.podGroup.rotation.y += dt * 0.7;
      this.revealGroup.rotation.y += dt * THREE.MathUtils.degToRad(30);
      return;
    }

    this.animTime += dt;
    const t = this.animTime;
    const rOrder = RARITIES[this.currentStageRarity].order;
    const trueHex = RARITIES[this.currentStageRarity].colorNum;
    const fakeHex = RARITIES[getPreviousRarity(this.currentStageRarity)].colorNum;

    // 0.00 s: Drop + squash (1.3, 0.7, 1.3)
    if (t < 0.4) {
      if (!this.beatsFired.has('drop')) {
        this.beatsFired.add('drop');
        SynthAudio.play('crate_thud');
        this.statusBannerEl.textContent = 'Dropping Seed Pod...';
      }
      const p = t / 0.4;
      this.podGroup.position.y = p < 0.6 ? THREE.MathUtils.lerp(4.0, 0, easeOutCubic(p / 0.6)) : 0;
      const sq = p >= 0.6 ? Math.sin(((p - 0.6) / 0.4) * Math.PI) : 0;
      this.podGroup.scale.set(1 + sq * 0.3, 1 - sq * 0.3, 1 + sq * 0.3);
    } else if (t < 1.2) {
      // 0.40 s: Tension wobble 0.05 -> 0.25 rad, 6 -> 14 Hz
      if (!this.beatsFired.has('tension')) {
        this.beatsFired.add('tension');
        SynthAudio.play('crate_rattle');
        this.statusBannerEl.textContent = 'Sprouting Tension...';
      }
      const p = (t - 0.4) / 0.8;
      const amp = THREE.MathUtils.lerp(0.05, 0.25, p);
      const freq = THREE.MathUtils.lerp(6, 14, p);
      this.podGroup.position.y = 0;
      this.podGroup.scale.setScalar(1);
      this.podGroup.rotation.z = Math.sin(t * freq * Math.PI * 2) * amp;
    } else if (t < 1.6) {
      // 1.20 s: Rarity tease (fake-out color one tier below for Legendary+)
      if (!this.beatsFired.has('tease')) {
        this.beatsFired.add('tease');
        SynthAudio.play('heartbeat');
        this.statusBannerEl.textContent = rOrder >= 3 ? 'Something rare is glowing...' : 'Cracking open...';
      }
      this.lightMat.color.setHex(rOrder >= 3 ? fakeHex : trueHex);
      this.podGroup.rotation.z = Math.sin(t * 70) * 0.25;
    } else if (t < 1.8) {
      // 1.60 s: Upgrade flash white -> true color
      if (!this.beatsFired.has('upgrade_flash')) {
        this.beatsFired.add('upgrade_flash');
        if (rOrder >= 3) SynthAudio.play('crate_ting');
      }
      this.lightMat.color.setHex(t < 1.68 ? 0xffffff : trueHex);
    } else if (t < 2.3) {
      // 1.80 s: Burst + 2.00 s: God rays
      if (!this.beatsFired.has('burst')) {
        this.beatsFired.add('burst');
        this.podGroup.visible = false;
        this.godRaysGroup.visible = true;
        this.godRaysGroup.children.forEach((c) => {
          ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(trueHex);
        });
        SynthAudio.play('crate_fanfare');
        const flashOpacity = QualityManager.clampFlashOpacity(0.55);
        EventBus.emit('vfx:screen_flash', { color: RARITIES[this.currentStageRarity].hex, opacity: flashOpacity, duration: 0.15 });
      }
      this.godRaysGroup.rotation.z += dt * THREE.MathUtils.degToRad(20);
    } else {
      // 2.30 s+: Reveal plant spring up (0.1, 1.8, 0.1) -> (1, 1, 1) + showcase turntable 30°/s
      if (!this.beatsFired.has('reveal')) {
        this.beatsFired.add('reveal');
        this.podGroup.visible = false;
        this.revealGroup.visible = true;
        this.godRaysGroup.visible = true;
        SynthAudio.play('upgrade');
        const top = this.currentResults[this.currentResults.length - 1];
        this.statusBannerEl.innerHTML = `<span style="color:${RARITIES[top.rarity].hex}">${top.rarity.toUpperCase()}</span> — ${top.unit.name}!`;
        this.renderPullCards();
      }
      const p = Math.min(1, (t - 2.3) / 0.45);
      const s = easeOutBack(p);
      this.revealGroup.scale.set(
        THREE.MathUtils.lerp(0.1, 1.0, s),
        THREE.MathUtils.lerp(1.8, 1.0, p),
        THREE.MathUtils.lerp(0.1, 1.0, s)
      );
      this.revealGroup.rotation.y += dt * THREE.MathUtils.degToRad(30);
      this.godRaysGroup.rotation.z += dt * THREE.MathUtils.degToRad(20);
    }
  }

  private renderPullCards(): void {
    this.summaryEl.innerHTML = this.currentResults
      .map((r) => {
        const hex = RARITIES[r.rarity].hex;
        const portrait = ProceduralTextures.getUnitPortraitUrl(r.unit.id);
        return `
          <div class="unit-tile" style="border-color:${hex};width:136px;cursor:default;">
            <div style="font-size:14px;font-weight:800;color:${r.isNew ? '#fde047' : '#38bdf8'};">
              ${r.isNew ? '✨ NEW!' : `+${r.dewdropsGained} 💧`}
            </div>
            <img class="unit-portrait" src="${portrait}" alt="${r.unit.name}" />
            <div style="font-weight:700;font-size:14px;">${r.unit.name}</div>
            <div style="font-size:14px;color:${hex};">${r.rarity}</div>
          </div>
        `;
      })
      .join('');
  }
}
