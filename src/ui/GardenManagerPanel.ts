import { MatchController } from '../simulation/MatchController';
import { InputManager } from '../core/InputManager';
import { SynthAudio } from '../audio/SynthAudio';
import { EventBus } from '../core/EventBus';

export class GardenManagerPanel {
  public root: HTMLDivElement;
  private match: MatchController;
  private input: InputManager;
  private isOpen = false;
  private sortKey: 'damage' | 'level' | 'cost' = 'damage';
  private groupUnitId = 'all';

  constructor(parent: HTMLElement, match: MatchController, input: InputManager) {
    this.match = match;
    this.input = input;

    this.root = document.createElement('div');
    this.root.className = 'garden-manager-panel gloss-panel hidden';
    parent.appendChild(this.root);

    EventBus.on('match:state_changed', () => {
      if (this.isOpen) this.render();
    });
    EventBus.on('tower:selected', () => {
      if (this.isOpen) this.render();
    });
    EventBus.on('ui:toggle_manager', () => this.toggle());
  }

  public toggle(): void {
    this.setOpen(!this.isOpen);
  }

  public setOpen(open: boolean): void {
    this.isOpen = open;
    this.root.classList.toggle('hidden', !open);
    if (open) {
      this.render();
      SynthAudio.play('click');
    }
  }

  public render(): void {
    if (!this.isOpen || !this.match.inMatch) return;

    const towers = [...this.match.towers];
    const maxDmg = Math.max(1, ...towers.map((t) => t.totalDamageDealt));

    towers.sort((a, b) => {
      if (this.sortKey === 'damage') return b.totalDamageDealt - a.totalDamageDealt;
      if (this.sortKey === 'level') return b.level - a.level;
      return b.totalSpentCash - a.totalSpentCash;
    });

    const uniqueUnitIds = Array.from(new Set(this.match.towers.map((t) => t.def.id)));

    this.root.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="font-size:18px;font-weight:800;">🌿 Garden Manager (${towers.length})</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-gold btn-sm" id="gm-upg-all">Upgrade All ▲</button>
          <button class="btn btn-rose btn-sm" id="gm-close">✕</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
        <label style="font-size:14px;">Sort:</label>
        <select id="gm-sort" class="paper-select" style="font-size:14px;">
          <option value="damage" ${this.sortKey === 'damage' ? 'selected' : ''}>Damage</option>
          <option value="level" ${this.sortKey === 'level' ? 'selected' : ''}>Level</option>
          <option value="cost" ${this.sortKey === 'cost' ? 'selected' : ''}>Cash Spent</option>
        </select>
        <select id="gm-group" class="paper-select" style="font-size:14px;">
          <option value="all">Group: All (${towers.length})</option>
          ${uniqueUnitIds
            .map((uid) => {
              const name = this.match.towers.find((t) => t.def.id === uid)?.def.name ?? uid;
              return `<option value="${uid}" ${this.groupUnitId === uid ? 'selected' : ''}>All ${name}</option>`;
            })
            .join('')}
        </select>
        <button class="btn btn-slate btn-sm" id="gm-grp-target">Cycle Target</button>
      </div>

      <div style="max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
        ${
          towers.length === 0
            ? `<div style="font-size:14px;color:#94a3b8;padding:12px 0;">No towers placed yet.</div>`
            : towers
                .map((t, i) => {
                  const nextCost = t.getNextUpgradeCost();
                  const sharePct = Math.round((t.totalDamageDealt / maxDmg) * 100);
                  const isSel = this.input.selectedTower?.id === t.id;
                  const dmgText =
                    t.def.isFarm
                      ? `+$${t.getFarmPayout()}/w`
                      : t.def.isWall
                        ? `${Math.round(t.wallHp)} HP`
                        : `${t.totalDamageDealt.toLocaleString()}`;
                  return `
                    <div class="gm-row ${isSel ? 'selected' : ''}" data-gm-select="${t.id}">
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                        <span style="font-size:14px;font-weight:700;">#${i + 1} ${t.def.name} · Lv.${t.level}</span>
                        <span style="font-size:14px;color:#cbd5e1;">${t.targeting} · ${dmgText}</span>
                      </div>
                      <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:999px;margin:4px 0;">
                        <div style="height:100%;width:${sharePct}%;background:#4ade80;border-radius:999px;"></div>
                      </div>
                      <div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;">
                        <label style="font-size:14px;margin-right:auto;display:flex;align-items:center;gap:4px;">
                          <input type="checkbox" data-gm-auto="${t.id}" ${t.autoUpgrade ? 'checked' : ''} /> Auto
                        </label>
                        ${t.isAbilityReady() ? `<button class="btn btn-gold btn-sm" data-gm-ab="${t.id}">⚡ Cast</button>` : ''}
                        ${
                          nextCost !== null
                            ? `<button class="btn btn-green btn-sm" data-gm-upg="${t.id}" ${this.match.cash < nextCost && !this.match.sandboxInfiniteCash ? 'disabled' : ''}>▲ $${nextCost}</button>`
                            : `<span style="font-size:14px;color:#fde047;font-weight:700;">MAX</span>`
                        }
                      </div>
                    </div>
                  `;
                })
                .join('')
        }
      </div>
    `;

    this.root.querySelector('#gm-close')!.addEventListener('click', () => this.setOpen(false));
    this.root.querySelector('#gm-upg-all')!.addEventListener('click', () => {
      this.match.upgradeAllAffordable();
      this.render();
    });
    this.root.querySelector('#gm-sort')!.addEventListener('change', (e) => {
      this.sortKey = (e.target as HTMLSelectElement).value as 'damage' | 'level' | 'cost';
      this.render();
    });
    this.root.querySelector('#gm-group')!.addEventListener('change', (e) => {
      this.groupUnitId = (e.target as HTMLSelectElement).value;
    });
    this.root.querySelector('#gm-grp-target')!.addEventListener('click', () => {
      for (const t of this.match.towers) {
        if (this.groupUnitId === 'all' || t.def.id === this.groupUnitId) {
          t.cycleTargeting();
        }
      }
      SynthAudio.play('click');
      this.render();
    });

    this.root.querySelectorAll('[data-gm-select]').forEach((row) => {
      row.addEventListener('click', (ev) => {
        if ((ev.target as HTMLElement).closest('button, input')) return;
        const id = (row as HTMLElement).dataset.gmSelect;
        const t = this.match.towers.find((tw) => tw.id === id) ?? null;
        this.input.selectTower(t);
      });
    });

    this.root.querySelectorAll('[data-gm-upg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.gmUpg;
        const t = this.match.towers.find((tw) => tw.id === id);
        if (t) {
          this.match.upgradeTower(t);
          this.render();
        }
      });
    });

    this.root.querySelectorAll('[data-gm-ab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.gmAb;
        const t = this.match.towers.find((tw) => tw.id === id);
        if (t) {
          this.match.abilities.activate(t, this.match.towers, this.match.enemies);
          this.render();
        }
      });
    });

    this.root.querySelectorAll('[data-gm-auto]').forEach((chk) => {
      chk.addEventListener('change', (ev) => {
        const id = (chk as HTMLElement).dataset.gmAuto;
        const t = this.match.towers.find((tw) => tw.id === id);
        if (t) t.autoUpgrade = (ev.target as HTMLInputElement).checked;
      });
    });
  }
}
