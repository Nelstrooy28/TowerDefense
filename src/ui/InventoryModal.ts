import * as THREE from 'three';
import { UNITS, getUnitById } from '../data/UnitRegistry';
import { RARITIES } from '../data/RarityConfig';
import { isHighRarityTrait, TRAITS, TRAIT_ORDER, type TraitId } from '../data/TraitConfig';
import { SaveManager, type SoilSkinId } from '../core/SaveManager';
import { EventBus } from '../core/EventBus';
import { MeshFactory } from '../rendering/MeshFactory';
import { ProceduralTextures } from '../rendering/ProceduralTextures';
import { easeOutBack } from '../rendering/Easing';
import { SynthAudio } from '../audio/SynthAudio';

export class InventoryModal {
  public root: HTMLDivElement;
  private isOpen = false;
  private selectedUnitId = 'tomato_tosser';
  private activeTab: 'unit' | 'reroll' = 'unit';

  private stageWrap!: HTMLDivElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1.5, 0.1, 30);
  private previewGroup = new THREE.Group();
  private wheelMesh: THREE.Group;

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
      <div class="modal-card gloss-panel">
        <div class="modal-header">
          <div style="font-size:22px;font-weight:800;">🌿 Units, Loadout & Trait Reroll</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="stat-pill" id="inv-seeds">🌱 0</span>
            <span class="stat-pill" id="inv-dews">💧 0</span>
            <button class="btn btn-rose btn-sm" id="inv-close">Close</button>
          </div>
        </div>
        <div class="modal-body">
          <div id="inv-loadout-strip" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;"></div>
          <div class="inv-layout">
            <div>
              <div style="font-size:16px;font-weight:700;margin-bottom:8px;">All Garden Units (${UNITS.length})</div>
              <div class="unit-grid" id="inv-grid"></div>
            </div>
            <div class="gloss-panel" style="padding:12px;display:flex;flex-direction:column;gap:10px;">
              <div style="display:flex;gap:8px;">
                <button class="btn btn-sm" id="tab-unit-btn" style="flex:1;">Unit & Soil Skins</button>
                <button class="btn btn-purple btn-sm" id="tab-reroll-btn" style="flex:1;">Trait Reroll Wheel</button>
              </div>
              <div class="showcase-stage" id="inv-stage" style="height:210px;"></div>
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

    EventBus.on('save:updated', () => {
      if (this.isOpen) this.renderAll();
    });
  }

  private setupThree(): void {
    this.scene.background = new THREE.Color(0x0b1220);
    this.camera.position.set(0, 1.35, 4.3);
    this.camera.lookAt(0, 0.75, 0);
    const hemi = new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 1.2);
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(3, 5, 4);
    this.scene.add(hemi, dir, this.previewGroup);
  }

  public open(focusUnitId?: string): void {
    if (focusUnitId) this.selectedUnitId = focusUnitId;
    this.isOpen = true;
    this.root.classList.remove('hidden');
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.stageWrap.appendChild(this.renderer.domElement);
    }
    const w = this.stageWrap.clientWidth || 340;
    const h = this.stageWrap.clientHeight || 210;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);

    this.renderAll();
    this.syncStageModel();
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
    this.root.querySelector('#inv-seeds')!.textContent = `🌱 ${d.seeds}`;
    this.root.querySelector('#inv-dews')!.textContent = `💧 ${d.dewdrops}`;

    const strip = this.root.querySelector('#inv-loadout-strip')!;
    strip.innerHTML =
      `<span style="font-weight:800;">Loadout (6):</span>` +
      d.loadout
        .map((uId, idx) => {
          if (!uId) {
            return `<div class="stat-pill" style="opacity:0.5;">Slot ${idx + 1}: Empty</div>`;
          }
          const u = getUnitById(uId);
          return `<div class="stat-pill" style="border-color:${RARITIES[u.rarity].hex};">${idx + 1}. ${u.name}</div>`;
        })
        .join('');

    const grid = this.root.querySelector('#inv-grid')!;
    grid.innerHTML = UNITS.map((u) => {
      const owned = d.owned[u.id];
      const equipped = d.loadout.includes(u.id);
      const hex = RARITIES[u.rarity].hex;
      const portrait = ProceduralTextures.getUnitPortraitUrl(u.id);
      const isSel = u.id === this.selectedUnitId;
      return `
        <button class="unit-tile ${owned ? '' : 'locked'} ${isSel ? 'selected' : ''}" data-uid="${u.id}" style="border-color:${hex};">
          <img class="unit-portrait" src="${portrait}" alt="${u.name}" />
          <div style="font-weight:700;font-size:14px;">${u.name}${owned?.isPrime ? ' ★' : ''}</div>
          <div style="font-size:14px;color:${hex};">${u.rarity}</div>
          <div style="font-size:14px;color:${equipped ? '#4ade80' : '#94a3b8'};">
            ${owned ? (equipped ? '✓ Equipped' : `Copies: ${owned.copies}`) : 'Locked'}
          </div>
        </button>
      `;
    }).join('');

    grid.querySelectorAll('.unit-tile').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = (btn as HTMLElement).dataset.uid!;
        this.selectedUnitId = uid;
        SynthAudio.play('click');
        this.renderAll();
        this.syncStageModel();
      });
    });

    this.renderDetails();
  }

  private syncStageModel(): void {
    this.previewGroup.clear();
    if (this.activeTab === 'reroll') {
      this.wheelMesh.position.set(0, 0.85, 0);
      this.previewGroup.add(this.wheelMesh);
      return;
    }
    const unit = getUnitById(this.selectedUnitId);
    const owned = SaveManager.data.owned[unit.id];
    const rig = MeshFactory.buildTowerRig(
      unit.id,
      5,
      unit.rarity,
      owned?.trait ?? 'Sprouting',
      owned?.soilSkin ?? 'garden_loam',
      Boolean(owned?.isPrime)
    );
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
        <div style="font-size:14px;color:${RARITIES[unit.rarity].hex};">${unit.rarity} • Locked</div>
        <div style="font-size:14px;color:#cbd5e1;">${unit.roleSummary}</div>
        <div style="font-size:14px;color:#fbbf24;">Pull from Seed Summon Crates to unlock!</div>
      `;
      return;
    }

    if (this.activeTab === 'unit') {
      const unlockedSkins = SaveManager.getUnlockedSoilSkins(unit.id);
      const skinLabels: Record<SoilSkinId, string> = {
        garden_loam: 'Garden Loam',
        mossy_stone: 'Mossy Stone (M5)',
        crystal_bed: 'Crystal Bed (M10)',
        golden_sand: 'Golden Sand (M10)',
        galaxy_soil: 'Galaxy Soil (M10)',
        lava_rock: 'Lava Rock (Volcano)',
      };
      const canPrime =
        !owned.isPrime &&
        (unit.rarity === 'Godly' || unit.rarity === 'Exclusive') &&
        owned.masteryLevel >= 10 &&
        SaveManager.data.dewdrops >= 3;

      pane.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:18px;">${unit.name} ${owned.isPrime ? '<span style="color:#fde047;">[PRIME]</span>' : ''}</strong>
          <span style="font-size:14px;color:${TRAITS[owned.trait].color};">${owned.trait}</span>
        </div>
        <div style="font-size:14px;color:#cbd5e1;">${unit.roleSummary}</div>
        <div style="font-size:14px;">Mastery Lv.${owned.masteryLevel}/10 (+${owned.masteryLevel}% DMG) • Fusion: +${owned.fusedStacks * 5}% DMG</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn ${equipped ? 'btn-slate' : 'btn-green'} btn-sm" id="btn-equip-toggle">
            ${equipped ? 'Unequip' : 'Equip to Loadout'}
          </button>
          <button class="btn btn-gold btn-sm" id="btn-fuse" ${owned.copies < 4 ? 'disabled' : ''}>
            Fuse 3 Copies (${owned.copies - 1} spare)
          </button>
          ${
            unit.rarity === 'Godly' || unit.rarity === 'Exclusive'
              ? `<button class="btn btn-purple btn-sm" id="btn-prime" ${canPrime ? '' : 'disabled'}>
                  ${owned.isPrime ? '★ Prime Evolved' : 'Evolve Prime (M10 + 3 💧)'}
                 </button>`
              : ''
          }
        </div>
        <div style="font-size:14px;font-weight:700;">Soil Skins:</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
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
      pane.querySelector('#btn-prime')?.addEventListener('click', () => {
        if (SaveManager.evolveUnitToPrime(unit.id)) {
          SynthAudio.play('upgrade_max');
          this.syncStageModel();
          EventBus.emit('toast:show', {
            title: `★ ${unit.name} Evolved to PRIME!`,
            subtitle: '+12% all stats + Golden Roots',
            color: '#fde047',
          });
        }
      });
      pane.querySelectorAll('[data-skin]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const skin = (btn as HTMLElement).dataset.skin as SoilSkinId;
          SaveManager.setSoilSkin(unit.id, skin);
          this.syncStageModel();
          SynthAudio.play('click');
        });
      });
    } else {
      const trait = TRAITS[owned.trait];
      pane.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:17px;">Current Trait: <span style="color:${trait.color}">${trait.id}</span></strong>
          <label style="font-size:14px;display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" id="chk-trait-lock" ${owned.traitLocked ? 'checked' : ''} /> Keep Lock
          </label>
        </div>
        <div style="font-size:14px;color:#cbd5e1;">${trait.description} (${trait.visualIndicator})</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-green btn-sm" id="btn-reroll-seeds" ${SaveManager.data.seeds < 50 || this.wheelSpinning ? 'disabled' : ''} style="flex:1;">
            Reroll (50 🌱)
          </button>
          <button class="btn btn-purple btn-sm" id="btn-reroll-dew" ${SaveManager.data.dewdrops < 1 || this.wheelSpinning ? 'disabled' : ''} style="flex:1;">
            Reroll (1 💧)
          </button>
        </div>
      `;

      const chk = pane.querySelector('#chk-trait-lock') as HTMLInputElement;
      chk.addEventListener('change', () => {
        owned.traitLocked = chk.checked;
        SaveManager.save();
      });

      const doReroll = (currency: 'seeds' | 'dewdrops') => {
        if (owned.traitLocked && isHighRarityTrait(owned.trait)) {
          if (!window.confirm(`Your unit has ${owned.trait}! Are you sure you want to reroll?`)) {
            return;
          }
        }
        const rolled = SaveManager.rerollUnitTrait(unit.id, currency);
        if (!rolled) return;
        this.spinTraitWheel(rolled);
      };

      pane.querySelector('#btn-reroll-seeds')!.addEventListener('click', () => doReroll('seeds'));
      pane.querySelector('#btn-reroll-dew')!.addEventListener('click', () => doReroll('dewdrops'));
    }
  }

  private spinTraitWheel(targetTrait: TraitId): void {
    const idx = TRAIT_ORDER.indexOf(targetTrait);
    const step = (Math.PI * 2) / 8;
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
        this.previewGroup.rotation.y += dt * 0.75;
      } else if (this.wheelSpinning) {
        this.wheelTime += dt;
        const dur = 1.4;
        const t = Math.min(1, this.wheelTime / dur);
        const eased = easeOutBack(t, 1.35);
        this.wheelMesh.rotation.z = THREE.MathUtils.lerp(this.wheelStartAngle, this.wheelTargetAngle, eased);

        const iconIdx = Math.floor((this.wheelMesh.rotation.z / (Math.PI * 2)) * 8);
        if (iconIdx !== this.wheelLastIconIdx) {
          this.wheelLastIconIdx = iconIdx;
          SynthAudio.play('wheel_tick');
        }
        if (t >= 1) {
          this.wheelSpinning = false;
          if (this.wheelResultTrait && isHighRarityTrait(this.wheelResultTrait)) {
            SynthAudio.play('crate_fanfare');
            EventBus.emit('toast:show', {
              title: `★ ${this.wheelResultTrait} Trait Rolled!`,
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
