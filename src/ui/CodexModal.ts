import * as THREE from 'three';
import { ALL_ENEMY_IDS, ENEMIES, type EnemyTypeId } from '../data/EnemyRegistry';
import { SYNERGIES } from '../data/SynergyConfig';
import { MAP_LIST, type DifficultyId } from '../data/MapRegistry';
import { SaveManager } from '../core/SaveManager';
import { MeshFactory } from '../rendering/MeshFactory';
import { SynthAudio } from '../audio/SynthAudio';

export class CodexModal {
  public root: HTMLDivElement;
  private isOpen = false;
  private tab: 'bestiary' | 'synergies' | 'leaderboard' = 'bestiary';
  private selectedEnemy: EnemyTypeId = 'garden_ant';

  private stageWrap!: HTMLDivElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1.5, 0.1, 30);
  private previewGroup = new THREE.Group();
  private rafId = 0;
  private lastTime = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'modal-backdrop hidden';
    this.root.innerHTML = `
      <div class="modal-card gloss-panel">
        <div class="modal-header">
          <div style="font-size:22px;font-weight:800;">📖 Bestiary, Synergies & Leaderboard</div>
          <button class="btn btn-rose btn-sm" id="codex-close">Close</button>
        </div>
        <div class="modal-body">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-sm" id="codex-tab-best">Enemy Bestiary</button>
            <button class="btn btn-purple btn-sm" id="codex-tab-syn">Synergy Codex</button>
            <button class="btn btn-gold btn-sm" id="codex-tab-lb">Local Leaderboard</button>
          </div>
          <div id="codex-content"></div>
        </div>
      </div>
    `;
    parent.appendChild(this.root);

    this.scene.background = new THREE.Color(0x0b1220);
    this.camera.position.set(0, 1.6, 4.6);
    this.camera.lookAt(0, 0.7, 0);
    this.scene.add(new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(3, 5, 4);
    this.scene.add(dir, this.previewGroup);

    this.root.querySelector('#codex-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('#codex-tab-best')!.addEventListener('click', () => {
      this.tab = 'bestiary';
      this.render();
    });
    this.root.querySelector('#codex-tab-syn')!.addEventListener('click', () => {
      this.tab = 'synergies';
      this.render();
    });
    this.root.querySelector('#codex-tab-lb')!.addEventListener('click', () => {
      this.tab = 'leaderboard';
      this.render();
    });
  }

  public open(): void {
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.render();
    this.startLoop();
    SynthAudio.play('click');
  }

  public close(): void {
    this.isOpen = false;
    this.root.classList.add('hidden');
    cancelAnimationFrame(this.rafId);
  }

  private render(): void {
    const content = this.root.querySelector('#codex-content')!;
    if (this.tab === 'bestiary') {
      const seen = SaveManager.data.bestiarySeen;
      const eDef = ENEMIES[this.selectedEnemy];
      const isSeen = seen.includes(this.selectedEnemy);

      content.innerHTML = `
        <div class="inv-layout">
          <div class="unit-grid">
            ${ALL_ENEMY_IDS.map((id) => {
              const e = ENEMIES[id];
              const unlocked = seen.includes(id);
              return `
                <button class="unit-tile ${this.selectedEnemy === id ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-eid="${id}">
                  <div style="font-weight:700;font-size:14px;">${unlocked ? e.name : '??? (Unseen)'}</div>
                  <div style="font-size:14px;color:#94a3b8;">Wave ${e.appearsWave}+</div>
                </button>
              `;
            }).join('')}
          </div>
          <div class="gloss-panel" style="padding:12px;display:flex;flex-direction:column;gap:8px;">
            <div class="showcase-stage" id="codex-stage" style="height:200px;"></div>
            <div style="font-size:18px;font-weight:800;">${isSeen ? eDef.name : 'Unknown Pest'}</div>
            <div style="font-size:14px;">Base HP: ${eDef.baseHP} • Speed: ${eDef.speed} u/s</div>
            <div style="font-size:14px;color:#cbd5e1;">${eDef.traitSummary}</div>
            <div style="font-size:14px;color:#4ade80;"><strong>Best counters:</strong> ${eDef.bestCounters}</div>
          </div>
        </div>
      `;

      content.querySelectorAll('[data-eid]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.selectedEnemy = (btn as HTMLElement).dataset.eid as EnemyTypeId;
          this.render();
        });
      });

      this.stageWrap = content.querySelector('#codex-stage') as HTMLDivElement;
      if (!this.renderer) {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      }
      this.stageWrap.appendChild(this.renderer.domElement);
      const w = this.stageWrap.clientWidth || 320;
      const h = this.stageWrap.clientHeight || 200;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);

      this.previewGroup.clear();
      const rig = MeshFactory.buildEnemyRig(this.selectedEnemy);
      if (!isSeen) {
        for (const m of rig.bodyMaterials) {
          m.color.setHex(0x090d16);
          m.emissive.setHex(0x000000);
        }
      }
      this.previewGroup.add(rig.root);
    } else if (this.tab === 'synergies') {
      const seen = SaveManager.data.codexSeen;
      content.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${SYNERGIES.map((s) => {
            const disc = seen.includes(s.id);
            return `
              <div class="gloss-panel" style="padding:12px;border-color:${s.color};">
                <div style="font-size:17px;font-weight:800;color:${s.color};">${s.name} ${disc ? '✓' : '(Undiscovered)'}</div>
                <div style="font-size:14px;color:#fde047;">${s.requires[0].toUpperCase()} + ${s.requires[1].toUpperCase()}</div>
                <div style="font-size:14px;color:#cbd5e1;">${s.effectDesc}</div>
                <div style="font-size:14px;color:#94a3b8;">Units: ${s.partnerUnitNames.join(', ')}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      const lb = SaveManager.data.leaderboard;
      const diffs: DifficultyId[] = ['Easy', 'Normal', 'Hard', 'Insane'];
      content.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${MAP_LIST.map((m) => `
            <div class="gloss-panel" style="padding:12px;">
              <div style="font-size:17px;font-weight:800;color:#4ade80;">${m.name}</div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:6px;">
                ${diffs
                  .map((d) => {
                    const rec = lb[m.id]?.[d];
                    return `
                      <div style="background:rgba(15,23,42,0.7);padding:8px;border-radius:8px;font-size:14px;">
                        <div style="font-weight:700;">${d}</div>
                        <div>Wave: ${rec?.bestWave ?? 0}</div>
                        <div>Time: ${rec?.fastestClearSec ? `${rec.fastestClearSec}s` : '—'}</div>
                        <div>Top Hit: ${rec?.topHit ?? 0}</div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      if (!this.isOpen) return;
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      if (this.tab === 'bestiary' && this.renderer) {
        this.previewGroup.rotation.y += dt * 0.7;
        this.renderer.render(this.scene, this.camera);
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
