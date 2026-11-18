import * as THREE from 'three';
import { getUnitById, getUnitRoleCategory, UNITS, type ElementTag, type TerrainTag, type UnitRoleCategory } from '../data/UnitRegistry';
import { RARITIES, type RarityId } from '../data/RarityConfig';
import { getTraitOddsText, isHighRarityTrait, TRAITS, TRAIT_ORDER, type TraitId } from '../data/TraitConfig';
import { ALL_RARITY_FILTERS, computeTeamPower, computeUnitPower, queryUnits, type UnitSortKey } from '../data/UnitQuery';
import { VARIANTS } from '../data/BalanceConfig';
import { SaveManager, type SoilSkinId } from '../core/SaveManager';
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
  private compareUnitId: string | null = null;
  private activeTab: 'unit' | 'reroll' = 'unit';
  private previewLevel = 5;

  private searchStr = '';
  private sortKey: UnitSortKey = 'rarity';
  private filterRarity: RarityId | 'All' = 'All';
  private filterRole: UnitRoleCategory | 'All' = 'All';
  private filterTerrain: TerrainTag | 'All' = 'All';
  private filterElement: ElementTag | 'All' = 'All';
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
      <div class="modal-card paper-panel" style="width:1160px;">
        <div class="modal-header">
          <div style="font-size:22px;font-weight:800;">🌿 Unit Collection &amp; Team Presets</div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="stat-pill" id="inv-count">2 / 20</span>
            <span class="stat-pill" id="inv-seeds">🌱 0</span>
            <span class="stat-pill" id="inv-dews">💧 0</span>
            <button class="btn btn-rose btn-sm" id="inv-close">Back / Esc</button>
          </div>
        </div>
        <div class="modal-body">
          <div id="inv-presets-row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"></div>
          <div id="inv-loadout-strip" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;"></div>
          <div id="inv-query-bar" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"></div>
          <div class="inv-layout">
            <div>
              <div style="font-size:14px;opacity:0.85;margin-bottom:6px;">Click a unit to inspect · Shift+Click to compare</div>
              <div class="unit-grid" id="inv-grid"></div>
            </div>
            <div class="gloss-panel" style="padding:12px;display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;gap:8px;">
                <button class="btn btn-sm" id="tab-unit-btn" style="flex:1;">Detail &amp; Soil Skins</button>
                <button class="btn btn-purple btn-sm" id="tab-reroll-btn" style="flex:1;">Traits 2.0 Machine</button>
              </div>
              <div class="showcase-stage" id="inv-stage" style="height:190px;cursor:grab;"></div>
              <div id="inv-level-bar" style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;"></div>
              <div id="inv-detail-pane"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    parent.appendChild(this.root);

    this.stageWrap = this.root.querySelector('#inv-stage') as HTMLDivElement;
    this.wheelMesh = MeshFactory.buildTraitWheelMesh();
    this.setupThree();

    this.root.querySelector('#inv-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('#tab-unit-btn')!.addEventListener('click', () => {
      this.activeTab = 'unit';
      this.syncStageModel();
      this.renderDetails();
    });
    this.root.querySelector('#tab-reroll-btn')!.addEventListener('click', () => {
      this.activeTab = 'reroll';
      this.syncStageModel();
      this.renderDetails();
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
    const h = this.stageWrap.clientHeight || 190;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(w, h, false);
    this.renderAll();
    this.startLoop();
    SynthAudio.play('click');
  }

  public close(): void {
    this.isOpen = false;
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
    this.renderQueryBar();
    this.renderGrid();
    this.syncStageModel();
    this.renderLevelButtons();
    this.renderDetails();
  }

  private renderPresetsAndLoadout(): void {
    const d = SaveManager.data;
    const presetsEl = this.root.querySelector('#inv-presets-row')!;
    const { power, warnings } = computeTeamPower(d.loadout, d.owned);

    presetsEl.innerHTML =
      `<span style="font-size:14px;font-weight:800;">Presets:</span>` +
      d.teamPresets
        .map(
          (p, idx) =>
            `<button class="btn btn-sm ${d.activePreset === idx ? 'btn-green' : 'btn-slate'}" data-preset="${idx}">${p.name}</button>`
        )
        .join('') +
      `<button class="btn btn-sm btn-slate" id="inv-rename-preset">✎ Rename</button>` +
      `<span class="stat-pill" style="margin-left:auto;">Team Power: ${power.toLocaleString()}</span>` +
      warnings.map((w) => `<span style="font-size:14px;color:#b45309;font-weight:700;">${w}</span>`).join('');

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
      `<strong style="font-size:15px;">Team Slots (click slot to clear):</strong>` +
      d.loadout
        .map((id, i) => {
          if (!id) {
            return `<div class="stat-pill" style="opacity:0.55;font-size:14px;">Slot ${i + 1}: Empty</div>`;
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

  private renderQueryBar(): void {
    const bar = this.root.querySelector('#inv-query-bar')!;
    if (bar.children.length > 0) return; // Keep focus intact on search input!

    const roles: Array<UnitRoleCategory | 'All'> = ['All', 'Attacker', 'Splash', 'DoT', 'Control', 'Support', 'Farm', 'Trap', 'Roller', 'Spawner', 'Wall'];
    bar.innerHTML = `
      <input type="text" id="inv-search" placeholder="Search unit, role, element..." class="paper-input" style="font-size:14px;width:210px;" />
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
      <label style="font-size:14px;display:flex;align-items:center;gap:4px;"><input type="checkbox" id="inv-owned-only" /> Owned</label>
      <label style="font-size:14px;display:flex;align-items:center;gap:4px;"><input type="checkbox" id="inv-fav-only" /> ★ Favorites</label>
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
    });

    grid.innerHTML = filtered
      .map((u) => {
        const owned = d.owned[u.id];
        const hex = RARITIES[u.rarity].hex;
        const portrait = ProceduralTextures.getUnitPortraitUrl(u.id);
        const equipped = d.loadout.includes(u.id);
        const pwr = computeUnitPower(u, owned);
        const varLabel = owned?.variant && owned.variant !== 'none' ? VARIANTS[owned.variant].label : '';
        return `
          <button class="unit-tile ${owned ? '' : 'locked'} ${this.selectedUnitId === u.id ? 'selected' : ''}" data-unit-id="${u.id}" style="border-color:${hex};">
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
        if ((ev as MouseEvent).shiftKey && uid !== this.selectedUnitId) {
          this.compareUnitId = uid;
        } else {
          this.compareUnitId = null;
          this.selectedUnitId = uid;
          SaveManager.markUnitSeen(uid);
        }
        this.renderAll();
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
    bar.innerHTML =
      [0, 1, 2, 3, 4, 5]
        .map(
          (lvl) =>
            `<button class="btn btn-sm ${this.previewLevel === lvl ? 'btn-green' : 'btn-slate'}" data-plvl="${lvl}">Lv.${lvl}</button>`
        )
        .join('') + `<button class="btn btn-gold btn-sm" id="inv-play-atk">▶ Attack Anim</button>`;

    bar.querySelectorAll('[data-plvl]').forEach((b) => {
      b.addEventListener('click', () => {
        this.previewLevel = Number((b as HTMLElement).dataset.plvl);
        this.syncStageModel();
        this.renderLevelButtons();
      });
    });
    bar.querySelector('#inv-play-atk')!.addEventListener('click', () => {
      this.previewAnimator.triggerAttack(this.selectedUnitId);
      SynthAudio.play('tomato');
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

    if (this.compareUnitId) {
      const b = getUnitById(this.compareUnitId);
      const oa = owned;
      const ob = SaveManager.data.owned[b.id];
      const pa = computeUnitPower(unit, oa);
      const pb = computeUnitPower(b, ob);
      pane.innerHTML = `
        <div style="font-size:16px;font-weight:800;">Compare Units <button class="btn btn-slate btn-sm" id="cmp-clear">Done</button></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:14px;">
          <div><b>${unit.name}</b><br/>Cost: $${unit.cost}<br/>Lv0→5 Dmg: ${unit.dmgBase}→${unit.dmgMax}<br/>Power: ${pa}</div>
          <div><b>${b.name}</b><br/>Cost: $${b.cost}<br/>Lv0→5 Dmg: ${b.dmgBase}→${b.dmgMax}<br/>Power: <span style="color:${pb >= pa ? '#16a34a' : '#dc2626'}">${pb}</span></div>
        </div>
      `;
      pane.querySelector('#cmp-clear')!.addEventListener('click', () => {
        this.compareUnitId = null;
        this.renderDetails();
      });
      return;
    }

    if (!owned) {
      pane.innerHTML = `
        <div style="font-size:18px;font-weight:800;">${unit.name}</div>
        <div style="font-size:14px;color:${RARITIES[unit.rarity].hex};font-weight:700;">${unit.rarity} · Not Owned</div>
        <div style="font-size:14px;">${unit.roleSummary}</div>
        <div style="font-size:14px;color:#b45309;">Found in Summon Crates or Weekly Seed Shop!</div>
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
      const lv0 = unit.levels[0];
      const lv5 = unit.levels[5];

      pane.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <strong style="font-size:17px;">${unit.name} ${owned.isPrime ? '★PRIME' : ''}</strong>
          <span style="font-size:14px;color:${tr.color};font-weight:700;">${owned.trait}</span>
        </div>
        <div style="font-size:14px;">${unit.roleSummary}</div>
        <div style="font-size:14px;background:rgba(0,0,0,0.12);padding:6px 8px;border-radius:6px;">
          Dmg: <b>${lv0.dmg} → ${lv5.dmg}</b> · CD: <b>${lv0.cd}s → ${lv5.cd}s</b> · Rng: <b>${lv0.range} → ${lv5.range}</b>
          <br/>Mastery ${owned.masteryLevel}/10 · Fusion +${owned.fusedStacks * 5}% · Copies ${owned.copies}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn ${equipped ? 'btn-slate' : 'btn-green'} btn-sm" id="btn-equip-toggle">${equipped ? 'Unequip' : 'Equip'}</button>
          <button class="btn btn-gold btn-sm" id="btn-fuse" ${owned.copies < 4 ? 'disabled' : ''}>Fuse (${owned.copies - 1}/3)</button>
          <button class="btn btn-slate btn-sm" id="btn-lock">${owned.locked ? '🔒 Locked' : '🔓 Lock'}</button>
          <button class="btn btn-slate btn-sm" id="btn-fav">${owned.favorite ? '★ Fav' : '☆ Fav'}</button>
          <button class="btn btn-rose btn-sm" id="btn-recycle" ${owned.locked || owned.copies <= 1 ? 'disabled' : ''}>♻ Recycle (+💧)</button>
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
              return `<button class="btn btn-sm ${active ? 'btn-green' : 'btn-slate'}" data-skin="${skin}" ${unlocked ? '' : 'disabled'}>${skinLabels[skin]}</button>`;
            })
            .join('')}
        </div>
      `;
      pane.querySelector('#btn-equip-toggle')!.addEventListener('click', () => {
        SaveManager.toggleLoadoutUnit(unit.id);
        SynthAudio.play('click');
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
