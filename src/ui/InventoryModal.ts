import * as THREE from 'three';
import {
  getUnitById,
  getUnitRoleCategory,
  UNITS,
  type ElementTag,
  type TerrainTag,
  type UnitRoleCategory,
} from '../data/UnitRegistry';
import { RARITIES, type RarityId } from '../data/RarityConfig';
import { getTraitOddsText, isHighRarityTrait, TRAITS, TRAIT_ORDER, type TraitId, type TraitTier } from '../data/TraitConfig';
import { ALL_RARITY_FILTERS, computeTeamPower, computeUnitPower, queryUnits, type UnitSortKey } from '../data/UnitQuery';
import { VARIANTS, type VariantId } from '../data/BalanceConfig';
import { SaveManager, type SoilSkinId } from '../core/SaveManager';
import { Keybinds } from '../core/Keybinds';
import { EventBus } from '../core/EventBus';
import { MeshFactory, type TowerRigRefs } from '../rendering/MeshFactory';
import { TowerAnimator } from '../rendering/Animator';
import { ProceduralTextures } from '../rendering/ProceduralTextures';
import { easeOutBack } from '../rendering/Easing';
import { SynthAudio } from '../audio/SynthAudio';

export class InventoryModal {
  public root: HTMLDivElement;
  private isOpen = false;
  private selectedUnitId = 'tomato_tosser';
  private pinnedCompareIds: string[] = [];
  private activeTab: 'unit' | 'reroll' = 'unit';
  private previewLevel = 5;

  private searchStr = '';
  private sortKey: UnitSortKey = 'rarity';
  private filterRarity: RarityId | 'All' = 'All';
  private filterRole: UnitRoleCategory | 'All' = 'All';
  private filterTraitTier: TraitTier | 'All' = 'All';
  private filterVariant: VariantId | 'All' = 'All';
  private filterTerrain: TerrainTag | 'All' = 'All';
  private filterElement: ElementTag | 'All' = 'All';
  private filterCapability: 'All' | 'air' | 'burrow' | 'boss' = 'All';
  private ownedOnly = false;
  private favoritesOnly = false;

  private stageWrap!: HTMLDivElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1.5, 0.1, 30);
  private previewGroup = new THREE.Group();
  private currentRig: TowerRigRefs | null = null;
  private previewAnimator = new TowerAnimator();
  private wheelMesh: THREE.Group;
  private contextMenuEl: HTMLDivElement;

  private draggingTurntable = false;
  private lastDragX = 0;
  private turntableAngle = 0;
  private wheelSpinning = false;
  private wheelTime = 0;
  private wheelStartAngle = 0;
  private wheelTargetAngle = 0;
  private wheelLastIconIdx = -1;
  private wheelResultTrait: TraitId | null = null;
  private rafId = 0;
  private lastTime = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'modal-backdrop hidden';
    this.root.innerHTML = `
      <div class="modal-card paper-panel" style="width:1180px;">
        <div class="modal-header">
          <div style="font-size:22px;font-weight:800;">🌿 Unit Collection &amp; Team Presets</div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="stat-pill" id="inv-count">2 / 20</span>
            <span class="stat-pill" id="inv-seeds">🌱 0</span>
            <span class="stat-pill" id="inv-dews">💧 0</span>
            <button class="btn btn-rose btn-sm" id="inv-close">Back ${Keybinds.badge('cancel')}</button>
          </div>
        </div>
        <div class="modal-body" style="gap:10px;">
          <div id="inv-presets-row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"></div>
          <div id="inv-loadout-strip" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"></div>
          <div id="inv-coverage-bar" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"></div>
          <div id="inv-query-bar" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"></div>
          <div class="inv-layout">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">
                <span style="font-size:14px;color:#cbd5e1;">Click to inspect · Shift+Click to pin compare (max 3) · Right-click to Equip</span>
                <button class="btn btn-rose btn-sm" id="inv-mass-recycle">♻ Mass Recycle Spares</button>
              </div>
              <div class="unit-grid" id="inv-grid"></div>
            </div>
            <div class="gloss-panel" style="padding:12px;display:flex;flex-direction:column;gap:8px;">
              <div class="leaf-tab-row">
                <button class="leaf-tab-btn active" id="tab-unit-btn" style="flex:1;">Detail &amp; Soil Skins</button>
                <button class="leaf-tab-btn" id="tab-reroll-btn" style="flex:1;">Traits 2.0 Machine</button>
              </div>
              <div class="showcase-stage" id="inv-stage" style="height:185px;cursor:grab;"></div>
              <div id="inv-level-bar" style="display:flex;gap:6px;justify-content:center;align-items:center;flex-wrap:wrap;"></div>
              <div id="inv-detail-pane"></div>
            </div>
          </div>
          <div id="inv-compare-drawer" class="gloss-panel hidden" style="padding:10px;"></div>
        </div>
      </div>
    `;
    parent.appendChild(this.root);

    this.contextMenuEl = document.createElement('div');
    this.contextMenuEl.className = 'unit-context-menu paper-panel hidden';
    parent.appendChild(this.contextMenuEl);
    window.addEventListener('pointerdown', (e) => {
      if (!this.contextMenuEl.contains(e.target as Node)) {
        this.contextMenuEl.classList.add('hidden');
      }
    });

    this.stageWrap = this.root.querySelector('#inv-stage') as HTMLDivElement;
    this.wheelMesh = MeshFactory.buildTraitWheelMesh();
    this.setupThree();

    this.root.querySelector('#inv-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('#tab-unit-btn')!.addEventListener('click', () => {
      this.activeTab = 'unit';
      this.root.querySelector('#tab-unit-btn')!.classList.add('active');
      this.root.querySelector('#tab-reroll-btn')!.classList.remove('active');
      this.syncStageModel();
      this.renderLevelButtons();
      this.renderDetails();
    });
    this.root.querySelector('#tab-reroll-btn')!.addEventListener('click', () => {
      this.activeTab = 'reroll';
      this.root.querySelector('#tab-reroll-btn')!.classList.add('active');
      this.root.querySelector('#tab-unit-btn')!.classList.remove('active');
      this.syncStageModel();
      this.renderLevelButtons();
      this.renderDetails();
    });

    this.root.querySelector('#inv-mass-recycle')!.addEventListener('click', () => {
      this.performMassRecycle();
    });

    this.stageWrap.addEventListener('pointerdown', (e) => {
      this.draggingTurntable = true;
      this.lastDragX = e.clientX;
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.draggingTurntable) return;
      this.turntableAngle += (e.clientX - this.lastDragX) * 0.015;
      this.lastDragX = e.clientX;
    });
    window.addEventListener('pointerup', () => {
      this.draggingTurntable = false;
    });
    this.stageWrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z + e.deltaY * 0.003, 2.5, 6.2);
    });

    EventBus.on('save:updated', () => {
      if (this.isOpen) this.renderAll();
    });
  }

  private performMassRecycle(): void {
    const owned = SaveManager.data.owned;
    const candidates = Object.values(owned).filter(
      (o) => !o.locked && o.copies > 1 && RARITIES[getUnitById(o.unitId).rarity].order <= 3
    );
    if (candidates.length === 0) {
      EventBus.emit('toast:show', { title: 'No unlocked duplicate Common–Legendary copies to recycle!', color: '#fbbf24' });
      return;
    }
    const hasLeg = candidates.some((o) => RARITIES[getUnitById(o.unitId).rarity].order >= 3);
    const totalSpares = candidates.reduce((s, o) => s + (o.copies - 1), 0);
    if (
      hasLeg &&
      !window.confirm(`Recycle ${totalSpares} unlocked duplicate copies (includes Legendary)?`)
    ) {
      return;
    } else if (
      !hasLeg &&
      !window.confirm(`Recycle all ${totalSpares} unlocked Common/Uncommon/Rare duplicate copies for Dewdrops?`)
    ) {
      return;
    }

    let gained = 0;
    for (const o of candidates) {
      const rar = getUnitById(o.unitId).rarity;
      while (o.copies > 1) {
        const res = SaveManager.recycleSpareCopy(o.unitId, rar);
        if (res <= 0) break;
        gained += res;
      }
    }
    EventBus.emit('toast:show', { title: `♻ Mass Recycled ${totalSpares} Copies`, subtitle: `+${gained} Dewdrops!`, color: '#38bdf8' });
    SynthAudio.play('coin');
  }

  private setupThree(): void {
    this.scene.background = new THREE.Color(0x0b1220);
    this.camera.position.set(0, 1.35, 4.3);
    this.camera.lookAt(0, 0.75, 0);
    this.scene.add(new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 1.25));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(3, 5, 4);
    this.scene.add(dir);
    this.scene.add(this.previewGroup);
  }

  private ensureRenderer(): void {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.stageWrap.appendChild(this.renderer.domElement);
  }

  public open(focusUnitId?: string): void {
    this.isOpen = true;
    if (focusUnitId) {
      this.selectedUnitId = focusUnitId;
      SaveManager.markUnitSeen(focusUnitId);
    }
    this.root.classList.remove('hidden');
    this.ensureRenderer();
    const w = this.stageWrap.clientWidth || 380;
    const h = this.stageWrap.clientHeight || 185;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(w, h, false);
    this.renderAll();
    this.startLoop();
    SynthAudio.play('click');
  }

  public close(): void {
    this.isOpen = false;
    this.contextMenuEl.classList.add('hidden');
    this.root.classList.add('hidden');
    cancelAnimationFrame(this.rafId);
  }

  private renderAll(): void {
    const d = SaveManager.data;
    const ownedCount = Object.keys(d.owned).length;
    this.root.querySelector('#inv-count')!.textContent = `Owned ${ownedCount} / ${UNITS.length}`;
    this.root.querySelector('#inv-seeds')!.textContent = `🌱 ${d.seeds.toLocaleString()}`;
    this.root.querySelector('#inv-dews')!.textContent = `💧 ${d.dewdrops}`;
    this.renderPresetsAndLoadout();
    this.renderCoverageBar();
    this.renderQueryBar();
    this.renderGrid();
    this.syncStageModel();
    this.renderLevelButtons();
    this.renderDetails();
    this.renderCompareDrawer();
  }

  private renderPresetsAndLoadout(): void {
    const d = SaveManager.data;
    const presetsEl = this.root.querySelector('#inv-presets-row')!;
    const { power } = computeTeamPower(d.loadout, d.owned);

    const equippedUnits = d.loadout.filter(Boolean).map((id) => getUnitById(id!));
    const totalCost = equippedUnits.reduce((s, u) => s + u.cost, 0);
    const minCost = equippedUnits.length > 0 ? Math.min(...equippedUnits.map((u) => u.cost)) : 0;

    presetsEl.innerHTML =
      `<span style="font-size:14px;font-weight:800;">Presets:</span>` +
      d.teamPresets
        .map(
          (p, idx) =>
            `<button class="leaf-tab-btn ${d.activePreset === idx ? 'active' : ''}" data-preset="${idx}">${p.name}</button>`
        )
        .join('') +
      `<button class="btn btn-sm btn-slate" id="inv-rename-preset">✎ Rename</button>` +
      `<span class="stat-pill" style="margin-left:auto;">Team Power: ${power.toLocaleString()} • Deck Total $${totalCost} (Min Start $${minCost})</span>`;

    presetsEl.querySelectorAll('[data-preset]').forEach((b) => {
      b.addEventListener('click', () => {
        SaveManager.switchTeamPreset(Number((b as HTMLElement).dataset.preset));
        SynthAudio.play('click');
      });
    });
    presetsEl.querySelector('#inv-rename-preset')!.addEventListener('click', () => {
      const name = window.prompt('Rename Team Preset:', d.teamPresets[d.activePreset]?.name ?? 'Squad');
      if (name) SaveManager.renameTeamPreset(d.activePreset, name);
    });

    const strip = this.root.querySelector('#inv-loadout-strip')!;
    strip.innerHTML =
      `<strong style="font-size:14px;">Slots:</strong>` +
      d.loadout
        .map((id, i) => {
          if (!id) {
            return `<div class="stat-pill" style="opacity:0.55;font-size:14px;">${i + 1}: Empty</div>`;
          }
          const u = getUnitById(id);
          return `<button class="btn btn-slate btn-sm" data-unequip-slot="${i}" style="border-color:${RARITIES[u.rarity].hex};">${i + 1}. ${u.name} ✕</button>`;
        })
        .join('');

    strip.querySelectorAll('[data-unequip-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        SaveManager.setLoadoutSlot(Number((btn as HTMLElement).dataset.unequipSlot), null);
        SynthAudio.play('click');
      });
    });
  }

  private renderCoverageBar(): void {
    const el = this.root.querySelector('#inv-coverage-bar')!;
    const units = SaveManager.data.loadout.filter(Boolean).map((id) => getUnitById(id!));
    const hasSplash = units.some((u) => u.splashRadius >= 1.5);
    const hasAir = units.some((u) => u.canHitFlying);
    const hasBurrow = units.some((u) => u.canHitBurrowed || u.splashRadius >= 1.5 || u.isTrap);
    const hasFarm = units.some((u) => u.isFarm);
    const hasBossKiller = units.some((u) => {
      const l5 = u.levels[5];
      return l5.cd > 0 && (l5.dmg * Math.max(1, l5.projectiles)) / l5.cd >= 160;
    });

    const chips: Array<{ id: string; ok: boolean; label: string }> = [
      { id: 'splash', ok: hasSplash, label: 'Splash' },
      { id: 'air', ok: hasAir, label: 'Anti-Air' },
      { id: 'burrow', ok: hasBurrow, label: 'Burrow-Hit' },
      { id: 'farm', ok: hasFarm, label: 'Farm' },
      { id: 'boss', ok: hasBossKiller, label: 'Boss DPS' },
    ];

    el.innerHTML =
      `<span style="font-size:14px;font-weight:800;color:#cbd5e1;">Team Coverage:</span>` +
      chips
        .map(
          (c) => `
        <button class="btn btn-sm ${c.ok ? 'btn-green' : 'btn-rose'}" data-cov-fix="${c.id}"
          title="${c.ok ? `${c.label} covered` : `Click to filter units that cover ${c.label}`}">
          ${c.label} ${c.ok ? '✓' : '✗'}
        </button>`
        )
        .join('') +
      (this.filterCapability !== 'All'
        ? `<button class="btn btn-slate btn-sm" id="inv-clear-cov">Clear Fix Filter</button>`
        : '');

    el.querySelectorAll('[data-cov-fix]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).dataset.covFix!;
        this.filterRole = 'All';
        this.filterCapability = 'All';
        if (key === 'splash') this.filterRole = 'Splash';
        else if (key === 'farm') this.filterRole = 'Farm';
        else if (key === 'air' || key === 'burrow' || key === 'boss') this.filterCapability = key;
        const roleSel = this.root.querySelector('#inv-filter-role') as HTMLSelectElement | null;
        if (roleSel) roleSel.value = this.filterRole;
        this.renderGrid();
        this.renderCoverageBar();
      });
    });

    el.querySelector('#inv-clear-cov')?.addEventListener('click', () => {
      this.filterCapability = 'All';
      this.filterRole = 'All';
      const roleSel = this.root.querySelector('#inv-filter-role') as HTMLSelectElement | null;
      if (roleSel) roleSel.value = 'All';
      this.renderGrid();
      this.renderCoverageBar();
    });
  }

  private renderQueryBar(): void {
    const bar = this.root.querySelector('#inv-query-bar')!;
    if (bar.children.length > 0) return;

    const roles: Array<UnitRoleCategory | 'All'> = ['All', 'Attacker', 'Splash', 'DoT', 'Control', 'Support', 'Farm', 'Trap', 'Roller', 'Spawner', 'Wall'];
    const traitTiers: Array<TraitTier | 'All'> = ['All', 'I', 'II', 'III', 'Legendary', 'Godly'];
    const variants: Array<VariantId | 'All'> = ['All', 'none', 'glass', 'bronze', 'silver', 'gold', 'rainbow'];

    bar.innerHTML = `
      <input type="text" id="inv-search" placeholder="Search unit, role, element..." class="paper-input" style="font-size:14px;width:190px;" />
      <select id="inv-sort" class="paper-select" style="font-size:14px;">
        <option value="rarity">Sort: Rarity</option>
        <option value="power">Sort: Power</option>
        <option value="cost">Sort: Cost</option>
        <option value="mastery">Sort: Mastery</option>
        <option value="newest">Sort: Newest</option>
        <option value="name">Sort: Name</option>
      </select>
      <select id="inv-filter-rarity" class="paper-select" style="font-size:14px;">
        ${ALL_RARITY_FILTERS.map((r) => `<option value="${r}">Rarity: ${r}</option>`).join('')}
      </select>
      <select id="inv-filter-role" class="paper-select" style="font-size:14px;">
        ${roles.map((r) => `<option value="${r}">Role: ${r}</option>`).join('')}
      </select>
      <select id="inv-filter-tier" class="paper-select" style="font-size:14px;">
        ${traitTiers.map((t) => `<option value="${t}">Trait: ${t}</option>`).join('')}
      </select>
      <select id="inv-filter-var" class="paper-select" style="font-size:14px;">
        ${variants.map((v) => `<option value="${v}">Var: ${v}</option>`).join('')}
      </select>
      <label style="font-size:14px;display:flex;align-items:center;gap:4px;"><input type="checkbox" id="inv-owned-only" /> Owned</label>
      <label style="font-size:14px;display:flex;align-items:center;gap:4px;"><input type="checkbox" id="inv-fav-only" /> ★ Fav</label>
    `;

    bar.querySelector('#inv-search')!.addEventListener('input', (e) => {
      this.searchStr = (e.target as HTMLInputElement).value;
      this.renderGrid();
    });
    bar.querySelector('#inv-sort')!.addEventListener('change', (e) => {
      this.sortKey = (e.target as HTMLSelectElement).value as UnitSortKey;
      this.renderGrid();
    });
    bar.querySelector('#inv-filter-rarity')!.addEventListener('change', (e) => {
      this.filterRarity = (e.target as HTMLSelectElement).value as RarityId | 'All';
      this.renderGrid();
    });
    bar.querySelector('#inv-filter-role')!.addEventListener('change', (e) => {
      this.filterRole = (e.target as HTMLSelectElement).value as UnitRoleCategory | 'All';
      this.filterCapability = 'All';
      this.renderGrid();
    });
    bar.querySelector('#inv-filter-tier')!.addEventListener('change', (e) => {
      this.filterTraitTier = (e.target as HTMLSelectElement).value as TraitTier | 'All';
      this.renderGrid();
    });
    bar.querySelector('#inv-filter-var')!.addEventListener('change', (e) => {
      this.filterVariant = (e.target as HTMLSelectElement).value as VariantId | 'All';
      this.renderGrid();
    });
    bar.querySelector('#inv-owned-only')!.addEventListener('change', (e) => {
      this.ownedOnly = (e.target as HTMLInputElement).checked;
      this.renderGrid();
    });
    bar.querySelector('#inv-fav-only')!.addEventListener('change', (e) => {
      this.favoritesOnly = (e.target as HTMLInputElement).checked;
      this.renderGrid();
    });
  }

  private renderGrid(): void {
    const grid = this.root.querySelector('#inv-grid')!;
    const d = SaveManager.data;
    const filtered = queryUnits(d.owned, this.sortKey, {
      search: this.searchStr,
      rarity: this.filterRarity,
      role: this.filterRole,
      terrain: this.filterTerrain,
      element: this.filterElement,
      ownedOnly: this.ownedOnly,
      favoritesOnly: this.favoritesOnly,
    }).filter((u) => {
      const own = d.owned[u.id];
      if (this.filterTraitTier !== 'All') {
        if (!own || TRAITS[own.trait].tier !== this.filterTraitTier) return false;
      }
      if (this.filterVariant !== 'All') {
        if (!own || (own.variant ?? 'none') !== this.filterVariant) return false;
      }
      if (this.filterCapability === 'air' && !u.canHitFlying) return false;
      if (this.filterCapability === 'burrow' && !u.canHitBurrowed && u.splashRadius < 1.5 && !u.isTrap) return false;
      if (this.filterCapability === 'boss') {
        const l5 = u.levels[5];
        if (l5.cd <= 0 || (l5.dmg * Math.max(1, l5.projectiles)) / l5.cd < 160) return false;
      }
      return true;
    });

    grid.innerHTML = filtered
      .map((u) => {
        const owned = d.owned[u.id];
        const hex = RARITIES[u.rarity].hex;
        const portrait = ProceduralTextures.getUnitPortraitUrl(u.id);
        const equipped = d.loadout.includes(u.id);
        const pwr = computeUnitPower(u, owned);
        const varLabel = owned?.variant && owned.variant !== 'none' ? VARIANTS[owned.variant].label : '';
        const isPinned = this.pinnedCompareIds.includes(u.id);
        return `
          <button class="unit-tile rarity-frame-${u.rarity} ${owned ? '' : 'locked'} ${this.selectedUnitId === u.id ? 'selected' : ''} ${isPinned ? 'pinned-compare' : ''}" data-unit-id="${u.id}" style="border-color:${hex};">
            <img class="unit-portrait" src="${portrait}" alt="${u.name}" />
            <div style="font-size:14px;font-weight:700;">${u.name}</div>
            <div style="font-size:14px;color:${hex};">${u.rarity} · ${getUnitRoleCategory(u)}</div>
            <div style="font-size:14px;">
              ${
                owned
                  ? `${owned.favorite ? '★ ' : ''}${owned.locked ? '🔒 ' : ''}${equipped ? '✔ ' : ''}Lv.${owned.masteryLevel} · ⚡${pwr}`
                  : 'Classic / Shop'
              }
            </div>
            ${owned && !owned.seen ? `<span class="badge-new">NEW</span>` : ''}
            ${varLabel ? `<div style="font-size:14px;color:${VARIANTS[owned!.variant!].color};font-weight:800;">✨ ${varLabel}</div>` : ''}
          </button>
        `;
      })
      .join('');

    grid.querySelectorAll('[data-unit-id]').forEach((card) => {
      card.addEventListener('click', (ev) => {
        const uid = (card as HTMLElement).dataset.unitId!;
        if ((ev as MouseEvent).shiftKey) {
          this.toggleComparePin(uid);
        } else {
          this.selectedUnitId = uid;
          SaveManager.markUnitSeen(uid);
        }
        this.renderAll();
        SynthAudio.play('click');
      });

      card.addEventListener('contextmenu', (ev) => {
        const uid = (card as HTMLElement).dataset.unitId!;
        if (!SaveManager.data.owned[uid]) return;
        ev.preventDefault();
        const mouse = ev as MouseEvent;
        this.openEquipContextMenu(uid, mouse.clientX, mouse.clientY);
      });
    });
  }

  private toggleComparePin(uid: string): void {
    const idx = this.pinnedCompareIds.indexOf(uid);
    if (idx >= 0) {
      this.pinnedCompareIds.splice(idx, 1);
    } else {
      if (this.pinnedCompareIds.length >= 3) this.pinnedCompareIds.shift();
      this.pinnedCompareIds.push(uid);
    }
  }

  private openEquipContextMenu(unitId: string, cx: number, cy: number): void {
    const u = getUnitById(unitId);
    this.contextMenuEl.innerHTML = `
      <div style="font-size:14px;font-weight:800;color:#fde047;margin-bottom:6px;">Equip ${u.name}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">
        ${[0, 1, 2, 3, 4, 5]
          .map((s) => `<button class="btn btn-sm btn-green" data-inv-slot="${s}">Slot ${s + 1}</button>`)
          .join('')}
      </div>
    `;
    this.contextMenuEl.style.left = `${Math.min(window.innerWidth - 220, cx)}px`;
    this.contextMenuEl.style.top = `${Math.min(window.innerHeight - 130, cy)}px`;
    this.contextMenuEl.classList.remove('hidden');

    this.contextMenuEl.querySelectorAll('[data-inv-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = Number((btn as HTMLElement).dataset.invSlot);
        SaveManager.setLoadoutSlot(slot, unitId);
        this.contextMenuEl.classList.add('hidden');
        SynthAudio.play('click');
      });
    });
  }

  private renderLevelButtons(): void {
    const bar = this.root.querySelector('#inv-level-bar')!;
    if (this.activeTab !== 'unit') {
      bar.innerHTML = '';
      return;
    }
    const vfxTierNote = this.previewLevel >= 5 ? 'Awakened VFX' : this.previewLevel >= 3 ? 'Upgraded VFX' : 'Base VFX';
    bar.innerHTML = `
      <label style="font-size:14px;display:flex;align-items:center;gap:8px;flex:1;">
        <span><b>Lv.${this.previewLevel}</b> (${vfxTierNote})</span>
        <input type="range" id="inv-lvl-slider" min="0" max="5" step="1" value="${this.previewLevel}" style="flex:1;" />
      </label>
      <button class="btn btn-gold btn-sm" id="inv-play-atk">▶ Attack</button>
      <button class="seed-pod-btn" id="inv-try-btn" style="min-height:36px;padding:6px 12px;font-size:14px;">🧪 Try It (20 s)</button>
    `;

    (bar.querySelector('#inv-lvl-slider') as HTMLInputElement).addEventListener('input', (e) => {
      this.previewLevel = Number((e.target as HTMLInputElement).value);
      this.syncStageModel();
      this.renderLevelButtons();
      this.renderDetails();
    });
    bar.querySelector('#inv-play-atk')!.addEventListener('click', () => {
      this.previewAnimator.triggerAttack(this.selectedUnitId);
      SynthAudio.play('tomato');
    });
    bar.querySelector('#inv-try-btn')!.addEventListener('click', () => {
      const uid = this.selectedUnitId;
      this.close();
      EventBus.emit('ui:try_unit', { unitId: uid });
    });
  }

  private syncStageModel(): void {
    this.previewGroup.clear();
    if (this.activeTab === 'reroll') {
      this.currentRig = null;
      this.previewGroup.add(this.wheelMesh);
      return;
    }
    const unit = getUnitById(this.selectedUnitId);
    const owned = SaveManager.data.owned[unit.id];
    const rig = MeshFactory.buildTowerRig(
      unit.id,
      this.previewLevel,
      unit.rarity,
      owned?.trait ?? 'Keen I',
      owned?.soilSkin ?? 'garden_loam',
      Boolean(owned?.isPrime),
      owned?.variant ?? 'none'
    );
    this.currentRig = rig;
    this.previewGroup.add(rig.root);
  }

  private renderDetails(): void {
    const pane = this.root.querySelector('#inv-detail-pane')!;
    const unit = getUnitById(this.selectedUnitId);
    const owned = SaveManager.data.owned[unit.id];
    const equipped = SaveManager.data.loadout.includes(unit.id);

    if (!owned) {
      pane.innerHTML = `
        <div style="font-size:18px;font-weight:800;">${unit.name}</div>
        <div style="font-size:14px;color:${RARITIES[unit.rarity].hex};font-weight:700;">${unit.rarity} · Not Owned</div>
        <div style="font-size:14px;">${unit.roleSummary}</div>
        <div style="font-size:14px;color:#fbbf24;">Found in Summon Crates or Weekly Seed Shop!</div>
      `;
      return;
    }

    if (this.activeTab === 'unit') {
      const unlockedSkins = SaveManager.getUnlockedSoilSkins(unit.id);
      const skinLabels: Record<SoilSkinId, string> = {
        garden_loam: 'Loam',
        mossy_stone: 'Mossy',
        crystal_bed: 'Crystal',
        golden_sand: 'Gold',
        galaxy_soil: 'Galaxy',
        lava_rock: 'Lava',
      };
      const canPrime =
        !owned.isPrime &&
        (unit.rarity === 'Godly' || unit.rarity === 'Exclusive') &&
        owned.masteryLevel >= 10 &&
        SaveManager.data.dewdrops >= 3;
      const tr = TRAITS[owned.trait];
      const traitMult = tr.dmgMult / tr.cdMult;

      const dpsRows = unit.levels.map((lv) => {
        const base = lv.cd > 0 ? Math.round((lv.dmg * Math.max(1, lv.projectiles)) / lv.cd) : lv.farmPayout;
        return { base, withTrait: Math.round(base * traitMult) };
      });
      const maxBarDps = Math.max(1, ...dpsRows.map((r) => r.withTrait));

      pane.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <strong style="font-size:17px;">${unit.name} ${owned.isPrime ? '★PRIME' : ''}</strong>
          <span style="font-size:14px;color:${tr.color};font-weight:700;">${owned.trait}</span>
        </div>
        <div style="font-size:14px;">${unit.roleSummary}</div>

        <div style="font-size:14px;background:rgba(0,0,0,0.2);padding:6px 8px;border-radius:8px;">
          <div style="font-weight:700;margin-bottom:4px;">Lv.0–5 ${unit.isFarm ? 'Payout' : 'DPS'} Curve (Green = w/ Trait)</div>
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;align-items:end;height:52px;">
            ${dpsRows
              .map(
                (r, lvIdx) => `
              <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                <div style="width:100%;height:34px;display:flex;align-items:flex-end;gap:2px;">
                  <div style="flex:1;height:${Math.max(12, Math.round((r.base / maxBarDps) * 100))}%;background:#64748b;border-radius:2px;" title="Base ${r.base}"></div>
                  <div style="flex:1;height:${Math.max(12, Math.round((r.withTrait / maxBarDps) * 100))}%;background:#4ade80;border-radius:2px;" title="Trait ${r.withTrait}"></div>
                </div>
                <span style="font-size:14px;">${lvIdx}</span>
              </div>`
              )
              .join('')}
          </div>
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn ${equipped ? 'btn-slate' : 'btn-green'} btn-sm" id="btn-equip-toggle">${equipped ? 'Unequip' : 'Equip'}</button>
          <button class="btn btn-slate btn-sm" id="btn-pin-cmp">${this.pinnedCompareIds.includes(unit.id) ? 'Pinned ✓' : '📌 Compare'}</button>
          <button class="btn btn-gold btn-sm" id="btn-fuse" ${owned.copies < 4 ? 'disabled' : ''}>Fuse (${owned.copies - 1}/3)</button>
          <button class="btn btn-slate btn-sm" id="btn-lock">${owned.locked ? '🔒' : '🔓'}</button>
          <button class="btn btn-slate btn-sm" id="btn-fav">${owned.favorite ? '★' : '☆'}</button>
          <button class="btn btn-rose btn-sm" id="btn-recycle" ${owned.locked || owned.copies <= 1 ? 'disabled' : ''}>♻</button>
          ${
            unit.rarity === 'Godly' || unit.rarity === 'Exclusive'
              ? `<button class="btn btn-purple btn-sm" id="btn-prime" ${canPrime ? '' : 'disabled'}>${owned.isPrime ? '★ Prime' : 'Prime (M10+3💧)'}</button>`
              : ''
          }
        </div>
        <div style="font-size:14px;font-weight:700;">Soil Skins:</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          ${(['garden_loam', 'mossy_stone', 'crystal_bed', 'golden_sand', 'galaxy_soil', 'lava_rock'] as SoilSkinId[])
            .map((skin) => {
              const unlocked = unlockedSkins.includes(skin);
              const active = owned.soilSkin === skin;
              return `<button class="leaf-tab-btn ${active ? 'active' : ''}" style="min-height:32px;padding:4px 10px;" data-skin="${skin}" ${unlocked ? '' : 'disabled'}>${skinLabels[skin]}</button>`;
            })
            .join('')}
        </div>
      `;
      pane.querySelector('#btn-equip-toggle')!.addEventListener('click', () => {
        SaveManager.toggleLoadoutUnit(unit.id);
        SynthAudio.play('click');
      });
      pane.querySelector('#btn-pin-cmp')!.addEventListener('click', () => {
        this.toggleComparePin(unit.id);
        this.renderAll();
      });
      pane.querySelector('#btn-fuse')!.addEventListener('click', () => {
        if (SaveManager.fuseUnitCopies(unit.id)) SynthAudio.play('upgrade');
      });
      pane.querySelector('#btn-lock')!.addEventListener('click', () => SaveManager.toggleUnitLock(unit.id));
      pane.querySelector('#btn-fav')!.addEventListener('click', () => SaveManager.toggleUnitFavorite(unit.id));
      pane.querySelector('#btn-recycle')!.addEventListener('click', () => {
        if (RARITIES[unit.rarity].order >= 3 && !window.confirm(`Recycle a spare ${unit.name}?`)) return;
        const gain = SaveManager.recycleSpareCopy(unit.id, unit.rarity);
        if (gain > 0) EventBus.emit('toast:show', { title: `Recycled for +${gain} 💧!`, color: '#38bdf8' });
      });
      pane.querySelector('#btn-prime')?.addEventListener('click', () => {
        if (SaveManager.evolveUnitToPrime(unit.id)) {
          SynthAudio.play('upgrade_max');
          this.syncStageModel();
        }
      });
      pane.querySelectorAll('[data-skin]').forEach((btn) => {
        btn.addEventListener('click', () => {
          SaveManager.setSoilSkin(unit.id, (btn as HTMLElement).dataset.skin as SoilSkinId);
          this.syncStageModel();
          SynthAudio.play('click');
        });
      });
    } else {
      const trait = TRAITS[owned.trait];
      pane.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:17px;">Trait: <span style="color:${trait.color}">${trait.id}</span> (${trait.tier})</strong>
          <label style="font-size:14px;display:flex;align-items:center;gap:6px;"><input type="checkbox" id="chk-trait-lock" ${owned.traitLocked ? 'checked' : ''} /> Lock</label>
        </div>
        <div style="font-size:14px;">${trait.description} · Odds: <b>${getTraitOddsText(trait.id)}</b></div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-green btn-sm" id="btn-reroll-seeds" ${SaveManager.data.seeds < 50 || this.wheelSpinning ? 'disabled' : ''} style="flex:1;">Reroll (50 🌱)</button>
          <button class="btn btn-purple btn-sm" id="btn-reroll-dew" ${SaveManager.data.dewdrops < 1 || this.wheelSpinning ? 'disabled' : ''} style="flex:1;">Reroll (1 💧)</button>
        </div>
      `;
      const chk = pane.querySelector('#chk-trait-lock') as HTMLInputElement;
      chk.addEventListener('change', () => {
        owned.traitLocked = chk.checked;
        SaveManager.save();
      });
      const doReroll = (currency: 'seeds' | 'dewdrops') => {
        if (owned.traitLocked && isHighRarityTrait(owned.trait)) {
          if (!window.confirm(`Keep rolling past ${owned.trait}?`)) return;
        }
        const rolled = SaveManager.rerollUnitTrait(unit.id, currency);
        if (rolled) this.spinTraitWheel(rolled);
      };
      pane.querySelector('#btn-reroll-seeds')!.addEventListener('click', () => doReroll('seeds'));
      pane.querySelector('#btn-reroll-dew')!.addEventListener('click', () => doReroll('dewdrops'));
    }
  }

  private renderCompareDrawer(): void {
    const drawer = this.root.querySelector('#inv-compare-drawer') as HTMLDivElement;
    if (this.pinnedCompareIds.length === 0) {
      drawer.classList.add('hidden');
      return;
    }
    drawer.classList.remove('hidden');
    drawer.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <strong style="font-size:15px;color:#fde047;">📌 Side-by-Side Compare (${this.pinnedCompareIds.length}/3)</strong>
        <button class="btn btn-slate btn-sm" id="inv-cmp-clear">Clear</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(${this.pinnedCompareIds.length},1fr);gap:8px;font-size:14px;">
        ${this.pinnedCompareIds
          .map((id) => {
            const u = getUnitById(id);
            const own = SaveManager.data.owned[id];
            const pwr = computeUnitPower(u, own);
            return `
              <div style="background:rgba(15,23,42,0.75);padding:8px;border-radius:8px;border:1px solid ${RARITIES[u.rarity].hex};">
                <b>${u.name}</b> (${u.rarity})<br/>
                Cost: $${u.cost} · Cap: ${u.cap} · Terrain: ${u.terrain}<br/>
                Lv0→5 Dmg: ${u.dmgBase}→${u.dmgMax} · Rng: ${u.levels[0].range}→${u.levels[5].range}<br/>
                Power: <strong style="color:#4ade80;">${pwr.toLocaleString()}</strong> · Trait: ${own?.trait ?? 'None'}
              </div>`;
          })
          .join('')}
      </div>
    `;
    drawer.querySelector('#inv-cmp-clear')!.addEventListener('click', () => {
      this.pinnedCompareIds = [];
      this.renderAll();
    });
  }

  private spinTraitWheel(targetTrait: TraitId): void {
    const idx = TRAIT_ORDER.indexOf(targetTrait);
    const step = (Math.PI * 2) / TRAIT_ORDER.length;
    this.wheelSpinning = true;
    this.wheelTime = 0;
    this.wheelLastIconIdx = -1;
    this.wheelResultTrait = targetTrait;
    this.wheelStartAngle = this.wheelMesh.rotation.z;
    this.wheelTargetAngle = this.wheelStartAngle + Math.PI * 6 + idx * step;
    this.renderDetails();
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      if (!this.isOpen) return;
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;

      if (this.activeTab === 'unit') {
        if (!this.draggingTurntable) this.turntableAngle += dt * 0.6;
        this.previewGroup.rotation.y = this.turntableAngle;
        if (this.currentRig) {
          this.previewAnimator.update(this.currentRig, this.selectedUnitId, 0, 0, now * 0.001, dt, dt, false, false, 0);
        }
      } else if (this.wheelSpinning) {
        this.wheelTime += dt;
        const dur = 1.4;
        const t = Math.min(1, this.wheelTime / dur);
        this.wheelMesh.rotation.z = THREE.MathUtils.lerp(this.wheelStartAngle, this.wheelTargetAngle, easeOutBack(t, 1.35));
        const iconIdx = Math.floor((this.wheelMesh.rotation.z / (Math.PI * 2)) * TRAIT_ORDER.length);
        if (iconIdx !== this.wheelLastIconIdx) {
          this.wheelLastIconIdx = iconIdx;
          SynthAudio.play('wheel_tick');
        }
        if (t >= 1) {
          this.wheelSpinning = false;
          if (this.wheelResultTrait && isHighRarityTrait(this.wheelResultTrait)) {
            SynthAudio.play('crate_fanfare');
            EventBus.emit('toast:show', {
              title: `★ ${this.wheelResultTrait} Rolled!`,
              color: TRAITS[this.wheelResultTrait].color,
            });
          } else {
            SynthAudio.play('upgrade');
          }
          this.renderDetails();
        }
      }
      this.renderer?.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
