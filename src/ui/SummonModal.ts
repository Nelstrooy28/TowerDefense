import * as THREE from 'three';
import { getPreviousRarity, RARITIES, RARITY_ORDER, type RarityId } from '../data/RarityConfig';
import { BANNERS, formatCountdownHMS, getFeaturedUnitForClock, type BannerTypeId } from '../data/BannerConfig';
import { VARIANTS, type VariantId } from '../data/BalanceConfig';
import { UNITS, type UnitDef } from '../data/UnitRegistry';
import type { TraitId } from '../data/TraitConfig';
import { SaveManager } from '../core/SaveManager';
import { EventBus } from '../core/EventBus';
import { QualityManager } from '../core/QualityManager';
import { MeshFactory } from '../rendering/MeshFactory';
import { ProceduralTextures } from '../rendering/ProceduralTextures';
import { easeOutBack, easeOutCubic } from '../rendering/Easing';
import { SynthAudio } from '../audio/SynthAudio';

interface PullCardResult {
  unit: UnitDef;
  rarity: RarityId;
  trait: TraitId;
  variant: VariantId;
  isNew: boolean;
  dewdropsGained: number;
}

export class SummonModal {
  public root: HTMLDivElement;
  private isOpen = false;
  private activeBanner: BannerTypeId = 'classic';
  private showSubView: 'none' | 'rates' | 'history' = 'none';

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
  private currentStageRarity: RarityId = 'Common';
  private beatsFired = new Set<string>();
  private summaryEl!: HTMLDivElement;
  private pityWrapEl!: HTMLDivElement;
  private statusBannerEl!: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'modal-backdrop hidden';
    this.root.innerHTML = `
      <div class="modal-card paper-panel" style="width:1060px;">
        <div class="modal-header">
          <div style="font-size:22px;font-weight:800;">🎁 Summon Garden</div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="stat-pill" id="summon-luck-pill"></span>
            <span class="stat-pill" id="summon-seeds-pill">🌱 0</span>
            <span class="stat-pill" id="summon-dews-pill">💧 0</span>
            <span class="stat-pill" id="summon-tix-pill">🎟 0</span>
            <button class="btn btn-rose btn-sm" id="summon-close-btn">Back / Esc</button>
          </div>
        </div>
        <div class="modal-body" style="gap:10px;">
          <div class="leaf-tab-row" id="summon-banner-tabs"></div>
          <div id="summon-banner-info" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;"></div>
          <div class="showcase-stage" id="summon-stage" style="height:250px;">
            <div id="summon-banner" style="position:absolute;top:12px;left:50%;transform:translateX(-50%);font-size:18px;font-weight:800;text-shadow:0 2px 6px #000;pointer-events:none;">Pick a Banner &amp; Summon!</div>
            <div style="position:absolute;bottom:8px;right:12px;font-size:14px;opacity:0.85;pointer-events:none;">Click stage / Space: skip step · Esc: results</div>
          </div>
          <div id="summon-subdrawer" class="hidden" style="background:rgba(0,0,0,0.12);padding:10px;border-radius:10px;max-height:170px;overflow:auto;"></div>
          <div id="summon-results-row" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;"></div>
          <div id="summon-pity-area" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"></div>
          <div style="display:flex;gap:12px;justify-content:space-between;align-items:center;flex-wrap:wrap;">
            <div style="display:flex;gap:8px;">
              <button class="btn btn-slate btn-sm" id="summon-rates-btn">📜 Rates</button>
              <button class="btn btn-slate btn-sm" id="summon-history-btn">🕒 History</button>
            </div>
            <div style="display:flex;gap:10px;">
              <button class="btn btn-green" id="summon-pull-1">Summon ×1</button>
              <button class="btn btn-gold" id="summon-pull-10">Summon ×10 (Guarantees Rare+)</button>
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
    this.root.querySelector('#summon-rates-btn')!.addEventListener('click', () => {
      this.showSubView = this.showSubView === 'rates' ? 'none' : 'rates';
      this.renderSubDrawer();
    });
    this.root.querySelector('#summon-history-btn')!.addEventListener('click', () => {
      this.showSubView = this.showSubView === 'history' ? 'none' : 'history';
      this.renderSubDrawer();
    });
    this.root.querySelector('#summon-pull-1')!.addEventListener('click', () => this.triggerPull(1));
    this.root.querySelector('#summon-pull-10')!.addEventListener('click', () => this.triggerPull(10));

    this.canvasWrap.addEventListener('click', () => this.handleSkipInput());
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Space' && this.animActive) {
        e.preventDefault();
        this.handleSkipInput();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (this.animActive) {
          this.animTime = 2.8;
          this.updateTimeline(0.01);
          this.animActive = false;
        } else {
          this.close();
        }
      }
    });

    EventBus.on('save:updated', () => {
      if (this.isOpen) this.refreshHeaderAndPity();
    });
  }

  public get isAnimating(): boolean {
    return this.animActive;
  }

  private setupThreeStage(): void {
    this.scene.background = new THREE.Color(0x0b1220);
    this.camera.position.set(0, 1.8, 6.4);
    this.camera.lookAt(0, 0.7, 0);
    this.scene.add(new THREE.HemisphereLight(0xcbd5e1, 0x1e293b, 1.1));
    const dir = new THREE.DirectionalLight(0xfffbeb, 1.5);
    dir.position.set(4, 7, 5);
    this.scene.add(dir, this.lightMat);
    this.lightMat.position.set(0, 2.5, 2.5);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 3.0, 0.2, 24),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 })
    );
    floor.position.y = -0.1;
    this.scene.add(floor);

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
      ray.rotation.z = (i / 12) * Math.PI * 2;
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
    const w = this.canvasWrap.clientWidth || 860;
    const h = this.canvasWrap.clientHeight || 250;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(w, h, false);
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

  private resetStageIdle(): void {
    this.podGroup.clear();
    this.revealGroup.clear();
    this.godRaysGroup.visible = false;
    const feat = getFeaturedUnitForClock().unit;
    if (this.activeBanner === 'featured') {
      const rig = MeshFactory.buildTowerRig(feat.id, 5, feat.rarity, 'Golden', 'golden_sand');
      this.podGroup.add(rig.root);
    } else {
      const pod = MeshFactory.buildSeedPodMesh(this.activeBanner === 'enchanted' || this.activeBanner === 'event');
      pod.position.y = 1.0;
      this.podGroup.add(pod);
    }
    this.podGroup.visible = true;
    this.revealGroup.visible = false;
    this.statusBannerEl.textContent = `${BANNERS[this.activeBanner].name} Ready!`;
  }

  private refreshHeaderAndPity(): void {
    const d = SaveManager.data;
    const boost = SaveManager.getActiveBoosts();
    this.root.querySelector('#summon-seeds-pill')!.textContent = `🌱 ${d.seeds.toLocaleString()}`;
    this.root.querySelector('#summon-dews-pill')!.textContent = `💧 ${d.dewdrops}`;
    this.root.querySelector('#summon-tix-pill')!.textContent = `🎟 ${d.eventTickets}`;
    const luckEl = this.root.querySelector('#summon-luck-pill') as HTMLElement;
    if (boost.doubleLuck) {
      luckEl.textContent = `🍀 ×2 LUCK ${formatCountdownHMS(boost.luckCountdownSec)}`;
      luckEl.style.borderColor = '#fbbf24';
    } else {
      luckEl.textContent = `Standard Luck`;
      luckEl.style.borderColor = '';
    }

    const bannerTabs = this.root.querySelector('#summon-banner-tabs')!;
    const order: BannerTypeId[] = ['classic', 'enchanted', 'featured', 'event'];
    bannerTabs.innerHTML = order
      .map(
        (id) =>
          `<button class="leaf-tab-btn ${this.activeBanner === id ? 'active' : ''}" data-banner-id="${id}">${BANNERS[id].name}</button>`
      )
      .join('');
    bannerTabs.querySelectorAll('[data-banner-id]').forEach((b) => {
      b.addEventListener('click', () => {
        this.activeBanner = (b as HTMLElement).dataset.bannerId as BannerTypeId;
        this.resetStageIdle();
        this.refreshHeaderAndPity();
        SynthAudio.play('click');
      });
    });

    const def = BANNERS[this.activeBanner];
    const feat = getFeaturedUnitForClock();
    this.root.querySelector('#summon-banner-info')!.innerHTML = `
      <div style="font-size:15px;">
        <b>${def.name}:</b> ${def.description}
        ${this.activeBanner === 'featured' ? `<span style="color:#b45309;font-weight:800;"> · Spotlight: ${feat.unit.name} (${formatCountdownHMS(feat.remainingSec)})</span>` : ''}
      </div>
    `;

    const cLeg = d.pity.classicSinceLeg;
    const eMyth = d.pity.enchantedSinceMyth;
    this.pityWrapEl.innerHTML = `
      <div class="pity-bar-wrap ${cLeg >= 14 ? 'pity-hot' : ''}">
        <div class="pity-bar-fill" style="width:${Math.min(100, (cLeg / 15) * 100)}%"></div>
        <div class="pity-bar-text">Classic Legendary+ Pity: ${cLeg}/15 (Myth ${d.pity.classicSinceMyth}/40)</div>
      </div>
      <div class="pity-bar-wrap ${eMyth >= 14 ? 'pity-hot' : ''}">
        <div class="pity-bar-fill" style="width:${Math.min(100, (eMyth / 15) * 100)}%"></div>
        <div class="pity-bar-text">Enchanted Mythical+ Pity: ${eMyth}/15 (Godly ${d.pity.enchantedSinceGodly}/35)</div>
      </div>
    `;

    const b1 = this.root.querySelector('#summon-pull-1') as HTMLButtonElement;
    const b10 = this.root.querySelector('#summon-pull-10') as HTMLButtonElement;
    const sym = def.currency === 'tickets' ? '🎟' : '🌱';
    const have = def.currency === 'tickets' ? d.eventTickets : d.seeds;
    b1.textContent = `Summon ×1 (${def.cost1} ${sym})`;
    b10.textContent = `Summon ×10 (${def.cost10} ${sym})`;
    b1.disabled = have < def.cost1;
    b10.disabled = have < def.cost10;
  }

  private renderSubDrawer(): void {
    const drawer = this.root.querySelector('#summon-subdrawer') as HTMLDivElement;
    if (this.showSubView === 'none') {
      drawer.classList.add('hidden');
      return;
    }
    drawer.classList.remove('hidden');
    if (this.showSubView === 'rates') {
      const crateKey = this.activeBanner === 'classic' ? 'classic' : 'enchanted';
      drawer.innerHTML =
        `<div style="font-size:15px;font-weight:800;margin-bottom:6px;">${BANNERS[this.activeBanner].name} Drop Rates (from RarityConfig)</div>` +
        `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px;font-size:14px;">` +
        RARITY_ORDER.map((r) => {
          const w = crateKey === 'classic' ? RARITIES[r].classicWeight : RARITIES[r].enchantedWeight;
          const unitNames = UNITS.filter((u) => u.rarity === r).map((u) => u.name).join(', ');
          return `<div style="border:1px solid ${RARITIES[r].hex};padding:6px;border-radius:6px;"><b style="color:${RARITIES[r].hex}">${r}: ${w}%</b><br/><span>${unitNames}</span></div>`;
        }).join('') +
        `</div>`;
    } else {
      const hist = SaveManager.data.pullHistory;
      drawer.innerHTML =
        `<div style="font-size:15px;font-weight:800;margin-bottom:6px;">Recent Pull History (${hist.length}/100)</div>` +
        (hist.length === 0
          ? `<div style="font-size:14px;">No summons recorded yet.</div>`
          : hist
              .slice(0, 30)
              .map((h) => `<div style="font-size:14px;">[${h.banner}] <b style="color:${RARITIES[h.rarity].hex}">${h.unitId} (${h.rarity})</b>${h.variant !== 'none' ? ` · ${h.variant}` : ''}</div>`)
              .join(''));
    }
  }

  private triggerPull(count: 1 | 10): void {
    const featId = getFeaturedUnitForClock().unit.id;
    const res = SaveManager.pullBanner(this.activeBanner, count, featId);
    if (!res) {
      SynthAudio.play('error');
      return;
    }
    this.currentResults = res;
    this.currentStageRarity = res[res.length - 1].rarity;
    this.beatsFired.clear();
    this.animActive = true;
    this.animTime = 0;
    this.summaryEl.innerHTML = '';

    this.podGroup.clear();
    const isEnch = this.activeBanner === 'enchanted' || this.activeBanner === 'event';
    if (count === 1) {
      const pod = MeshFactory.buildSeedPodMesh(isEnch);
      pod.position.set(0, 1.0, 0);
      this.podGroup.add(pod);
    } else {
      for (let i = 0; i < 10; i++) {
        const pod = MeshFactory.buildSeedPodMesh(isEnch);
        pod.scale.setScalar(0.45);
        const ang = (i / 10) * Math.PI * 2;
        pod.position.set(Math.cos(ang) * 2.2, 0.7, Math.sin(ang) * 1.1);
        this.podGroup.add(pod);
      }
    }
    this.podGroup.visible = true;

    this.revealGroup.clear();
    const top = res[res.length - 1];
    const rig = MeshFactory.buildTowerRig(top.unit.id, 0, top.rarity, top.trait, 'garden_loam', false, top.variant);
    rig.root.scale.setScalar(1.25);
    this.revealGroup.add(rig.root);
    this.revealGroup.visible = false;
    this.godRaysGroup.visible = false;
    this.refreshHeaderAndPity();
  }

  private handleSkipInput(): void {
    if (!this.animActive) return;
    if (this.animTime < 2.3) this.animTime = 2.3;
    else this.animActive = false;
  }

  private startLoop(): void {
    this.lastTickTime = performance.now();
    const tick = (now: number) => {
      if (!this.isOpen) return;
      const dt = Math.min(0.05, (now - this.lastTickTime) / 1000);
      this.lastTickTime = now;
      const speedMult = SaveManager.data.fastSummons ? 2.6 : 1.0;
      this.updateTimeline(dt * speedMult);
      this.renderer?.render(this.scene, this.camera);
      this.animRaf = requestAnimationFrame(tick);
    };
    this.animRaf = requestAnimationFrame(tick);
  }

  private updateTimeline(dt: number): void {
    if (!this.animActive) {
      this.podGroup.rotation.y += dt * 0.7;
      this.revealGroup.rotation.y += dt * THREE.MathUtils.degToRad(30);
      if (this.godRaysGroup.visible) {
        this.godRaysGroup.rotation.z += dt * THREE.MathUtils.degToRad(20);
      }
      return;
    }
    this.animTime += dt;
    const t = this.animTime;
    const rOrder = RARITIES[this.currentStageRarity].order;
    const trueHex = RARITIES[this.currentStageRarity].colorNum;
    const fakeHex = RARITIES[getPreviousRarity(this.currentStageRarity)].colorNum;

    if (t < 0.45) {
      if (!this.beatsFired.has('drop')) {
        this.beatsFired.add('drop');
        SynthAudio.play('crate_thud');
        this.statusBannerEl.textContent = 'Planting Seed...';
      }
      const p = t / 0.45;
      this.podGroup.position.y = p < 0.6 ? THREE.MathUtils.lerp(4.0, 0, easeOutCubic(p / 0.6)) : 0;
    } else if (t < 1.2) {
      if (!this.beatsFired.has('grow')) {
        this.beatsFired.add('grow');
        SynthAudio.play('crate_rattle');
        this.statusBannerEl.textContent = 'Root Veins Glowing...';
      }
      this.podGroup.position.y = 0;
      this.podGroup.rotation.z = Math.sin(t * 25) * 0.14;
    } else if (t < 2.0) {
      if (!this.beatsFired.has('hint')) {
        this.beatsFired.add('hint');
        SynthAudio.play('heartbeat');
        this.statusBannerEl.textContent = rOrder >= 3 ? 'Golden Energy Surging!' : 'Bud Opening...';
      }
      const fakeOut = rOrder >= 3 && Math.random() < 0.25 && t < 1.65;
      this.lightMat.color.setHex(fakeOut ? fakeHex : trueHex);
    } else if (t < 2.3) {
      if (!this.beatsFired.has('burst')) {
        this.beatsFired.add('burst');
        this.podGroup.visible = false;
        this.godRaysGroup.visible = true;
        this.godRaysGroup.children.forEach((c) => {
          ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(trueHex);
        });
        SynthAudio.play('crate_fanfare');
        EventBus.emit('vfx:screen_flash', {
          color: RARITIES[this.currentStageRarity].hex,
          opacity: QualityManager.clampFlashOpacity(0.5),
          duration: 0.15,
        });
      }
      this.godRaysGroup.rotation.z += dt * THREE.MathUtils.degToRad(24);
    } else {
      if (!this.beatsFired.has('reveal')) {
        this.beatsFired.add('reveal');
        this.podGroup.visible = false;
        this.revealGroup.visible = true;
        this.godRaysGroup.visible = true;
        SynthAudio.play('upgrade');
        const top = this.currentResults[this.currentResults.length - 1];
        const vTag = top.variant !== 'none' ? ` · ✨ ${VARIANTS[top.variant].label.toUpperCase()} VARIANT!` : '';
        this.statusBannerEl.innerHTML = `<span style="color:${RARITIES[top.rarity].hex}">${top.rarity.toUpperCase()}</span> — ${top.unit.name}${vTag}`;
        this.renderPullCards();
      }
      const p = Math.min(1, (t - 2.3) / 0.45);
      const s = easeOutBack(p);
      this.revealGroup.scale.set(THREE.MathUtils.lerp(0.1, 1, s), THREE.MathUtils.lerp(1.8, 1, p), THREE.MathUtils.lerp(0.1, 1, s));
      this.revealGroup.rotation.y += dt * THREE.MathUtils.degToRad(30);
      this.godRaysGroup.rotation.z += dt * THREE.MathUtils.degToRad(20);
      if (p >= 1) {
        this.animActive = false;
      }
    }
  }

  private renderPullCards(): void {
    this.summaryEl.innerHTML = this.currentResults
      .map((r) => {
        const hex = RARITIES[r.rarity].hex;
        const portrait = ProceduralTextures.getUnitPortraitUrl(r.unit.id);
        return `
          <div class="unit-tile" style="border-color:${hex};width:118px;padding:8px;cursor:default;">
            <div style="font-size:14px;font-weight:800;color:${r.isNew ? '#fde047' : '#38bdf8'};">
              ${r.isNew ? '✨ NEW' : `+${r.dewdropsGained}💧`}
            </div>
            <img class="unit-portrait" src="${portrait}" alt="${r.unit.name}" style="width:48px;height:48px;" />
            <div style="font-weight:700;font-size:14px;">${r.unit.name}</div>
            <div style="font-size:14px;color:${hex};">${r.rarity}</div>
          </div>
        `;
      })
      .join('');
  }
}
