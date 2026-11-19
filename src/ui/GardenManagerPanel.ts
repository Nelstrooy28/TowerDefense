import { MatchController } from '../simulation/MatchController';
import { InputManager } from '../core/InputManager';
import { InputActions } from '../core/InputActions';
import { Keybinds } from '../core/Keybinds';
import { QualityManager } from '../core/QualityManager';
import { TimeScale } from '../core/TimeScale';
import { SaveManager } from '../core/SaveManager';
import { SynthAudio } from '../audio/SynthAudio';
import { EventBus } from '../core/EventBus';
import { ProceduralTextures } from '../rendering/ProceduralTextures';
import { getUnitRoleCategory } from '../data/UnitRegistry';
import type { TowerEntity, TargetingMode } from '../simulation/TowerEntity';

type ManagerSortKey = 'priority' | 'damage' | 'level' | 'cost' | 'placed';
type ManagerRoleFilter = 'All' | 'Attack' | 'Splash' | 'Support' | 'Farm' | 'Path';

const ROLE_FILTERS: ManagerRoleFilter[] = ['All', 'Attack', 'Splash', 'Support', 'Farm', 'Path'];
const TARGET_MODES: TargetingMode[] = ['First', 'Last', 'Strongest', 'Closest', 'Weakest'];
const CIRCLED_NUMS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

export class GardenManagerPanel {
  public root: HTMLDivElement;
  private match: MatchController;
  private input: InputManager;
  private isOpen = false;
  private sortKey: ManagerSortKey = 'priority';
  private roleFilter: ManagerRoleFilter = 'All';
  private selectedIds = new Set<string>();
  private focusedTowerId: string | null = null;
  private wasAffordableIds = new Set<string>();
  private dragTowerId: string | null = null;
  private pausedByManager = false;
  private contextMenuEl: HTMLDivElement;

  constructor(parent: HTMLElement, match: MatchController, input: InputManager) {
    this.match = match;
    this.input = input;

    this.root = document.createElement('div');
    this.root.className = 'garden-manager-panel paper-panel hidden';
    parent.appendChild(this.root);

    this.contextMenuEl = document.createElement('div');
    this.contextMenuEl.className = 'unit-context-menu paper-panel hidden';
    parent.appendChild(this.contextMenuEl);

    window.addEventListener('pointerdown', (e) => {
      if (!this.contextMenuEl.contains(e.target as Node)) {
        this.contextMenuEl.classList.add('hidden');
      }
    });

    EventBus.on('match:state_changed', () => {
      if (this.isOpen) this.render();
    });
    EventBus.on('match:cash_changed', () => {
      if (this.isOpen) this.render();
    });
    EventBus.on('tower:selected', ({ towerId }) => {
      if (towerId) this.focusedTowerId = towerId;
      if (this.isOpen) this.render();
    });
    EventBus.on('ui:toggle_manager', () => this.toggle());
    EventBus.on('keybinds:changed', () => {
      if (this.isOpen) this.render();
    });

    this.bindKeyboardNav();
  }

  private bindKeyboardNav(): void {
    InputActions.onDown('row_up', (_m, e) => {
      if (!this.isOpen || !this.match.inMatch) return false;
      e?.preventDefault();
      this.stepRowFocus(-1);
      return true;
    });
    InputActions.onDown('row_down', (_m, e) => {
      if (!this.isOpen || !this.match.inMatch) return false;
      e?.preventDefault();
      this.stepRowFocus(1);
      return true;
    });
    InputActions.onDown('prio_up', (_m, e) => {
      if (!this.isOpen || !this.focusedTowerId) return false;
      e?.preventDefault();
      const tw = this.match.towers.find((t) => t.id === this.focusedTowerId);
      if (tw) this.match.setTowerPriority(tw, tw.priority - 1);
      return true;
    });
    InputActions.onDown('prio_down', (_m, e) => {
      if (!this.isOpen || !this.focusedTowerId) return false;
      e?.preventDefault();
      const tw = this.match.towers.find((t) => t.id === this.focusedTowerId);
      if (tw) this.match.setTowerPriority(tw, tw.priority + 1);
      return true;
    });
  }

  private stepRowFocus(delta: number): void {
    const list = this.getFilteredSortedTowers();
    if (list.length === 0) return;
    const cur = this.focusedTowerId ? list.findIndex((t) => t.id === this.focusedTowerId) : -1;
    const next = list[(cur + delta + list.length) % list.length];
    this.focusedTowerId = next.id;
    this.input.selectTower(next);
    this.render();
  }

  public toggle(): void {
    this.setOpen(!this.isOpen);
  }

  public setOpen(open: boolean): void {
    if (this.isOpen === open) return;
    this.isOpen = open;
    this.root.classList.toggle('hidden', !open);
    this.contextMenuEl.classList.add('hidden');

    if (open) {
      if (QualityManager.settings.pauseWhileManagerOpen && !TimeScale.paused) {
        TimeScale.togglePause();
        this.pausedByManager = true;
      }
      this.render();
      SynthAudio.play('click');
    } else if (this.pausedByManager) {
      this.pausedByManager = false;
      if (TimeScale.paused) TimeScale.togglePause();
    }
  }

  private matchesRole(t: TowerEntity): boolean {
    if (this.roleFilter === 'All') return true;
    if (this.roleFilter === 'Path') {
      return Boolean(t.def.terrain === 'PATH' || t.def.isWall || t.def.isTrap || t.def.isRoller);
    }
    const role = getUnitRoleCategory(t.def);
    if (this.roleFilter === 'Attack') return role === 'Attacker' || role === 'DoT' || role === 'Spawner';
    if (this.roleFilter === 'Splash') return role === 'Splash' || role === 'Control';
    if (this.roleFilter === 'Support') return role === 'Support';
    if (this.roleFilter === 'Farm') return role === 'Farm';
    return true;
  }

  private getFilteredSortedTowers(): TowerEntity[] {
    const towers = this.match.towers.filter((t) => this.matchesRole(t));
    towers.sort((a, b) => {
      if (this.sortKey === 'priority') return a.priority - b.priority;
      if (this.sortKey === 'damage') return b.totalDamageDealt - a.totalDamageDealt;
      if (this.sortKey === 'level') return b.level - a.level;
      if (this.sortKey === 'cost') return (b.getNextUpgradeCost() ?? 0) - (a.getNextUpgradeCost() ?? 0);
      return b.placedAtRealTime - a.placedAtRealTime;
    });
    return towers;
  }

  public render(): void {
    if (!this.isOpen || !this.match.inMatch) return;

    const towers = this.getFilteredSortedTowers();
    const maxDmg = Math.max(1, ...this.match.towers.map((t) => t.totalDamageDealt));
    const totalTeamDmg = Math.max(1, this.match.towers.reduce((acc, t) => acc + t.totalDamageDealt, 0));
    const reserve = QualityManager.settings.cashReserve ?? 0;

    // Track bulk sell refund if rows multi-selected
    const bulkTargets =
      this.selectedIds.size > 0
        ? this.match.towers.filter((t) => this.selectedIds.has(t.id))
        : [];

    this.root.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="font-size:18px;font-weight:900;color:#fde047;">
          🌿 UNIT MANAGER (${this.match.towers.length})
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span class="stat-pill">$${this.match.cash.toLocaleString()}</span>
          <button class="btn btn-rose btn-sm" id="gm-close">✕ ${Keybinds.badge('manager')}</button>
        </div>
      </div>

      <div class="leaf-tab-row" style="gap:4px;">
        ${ROLE_FILTERS.map(
          (rf) =>
            `<button class="leaf-tab-btn ${this.roleFilter === rf ? 'active' : ''}" data-gm-role="${rf}" style="padding:4px 9px;min-height:32px;">${rf}</button>`
        ).join('')}
        <select id="gm-sort" class="paper-select" style="margin-left:auto;font-size:14px;min-height:32px;">
          <option value="priority" ${this.sortKey === 'priority' ? 'selected' : ''}>Sort: Priority</option>
          <option value="damage" ${this.sortKey === 'damage' ? 'selected' : ''}>Sort: Damage</option>
          <option value="level" ${this.sortKey === 'level' ? 'selected' : ''}>Sort: Level</option>
          <option value="cost" ${this.sortKey === 'cost' ? 'selected' : ''}>Sort: Cost</option>
          <option value="placed" ${this.sortKey === 'placed' ? 'selected' : ''}>Sort: Placed</option>
        </select>
      </div>

      <div id="gm-list" style="max-height:310px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding-right:2px;">
        ${
          towers.length === 0
            ? `<div style="font-size:14px;color:#94a3b8;padding:16px 0;text-align:center;">No placed units match this filter.</div>`
            : towers
                .map((t) => {
                  const nextCost = t.getNextUpgradeCost();
                  const isNewlyAffordable =
                    nextCost !== null &&
                    (this.match.sandboxInfiniteCash || this.match.cash >= nextCost) &&
                    !this.wasAffordableIds.has(t.id);
                  if (nextCost !== null && (this.match.sandboxInfiniteCash || this.match.cash >= nextCost)) {
                    this.wasAffordableIds.add(t.id);
                  } else {
                    this.wasAffordableIds.delete(t.id);
                  }

                  const sharePct = Math.round((t.totalDamageDealt / totalTeamDmg) * 100);
                  const barPct = Math.round((t.totalDamageDealt / maxDmg) * 100);
                  const isFocused = this.input.selectedTower?.id === t.id || this.focusedTowerId === t.id;
                  const isMulti = this.selectedIds.has(t.id);
                  const dmgText = t.def.isFarm
                    ? `+$${t.getFarmPayout()}/w`
                    : t.def.isWall
                      ? `${Math.round(t.wallHp)} HP`
                      : `${t.totalDamageDealt.toLocaleString()} (${sharePct}%)`;
                  const prioGlyph = t.priority <= 10 ? CIRCLED_NUMS[t.priority - 1] : `${t.priority}`;
                  const canUpgrade =
                    nextCost !== null && (this.match.sandboxInfiniteCash || this.match.cash >= nextCost);
                  const portrait = ProceduralTextures.getUnitPortraitUrl(t.def.id);
                  const abReady = Boolean(t.def.ability && t.level >= 4);

                  return `
                    <div class="gm-row ${isFocused ? 'selected' : ''} ${isMulti ? 'multi-selected' : ''} ${isNewlyAffordable ? 'gm-fresh-afford' : ''}"
                      data-gm-id="${t.id}" draggable="true">
                      <button class="gm-prio-badge" data-gm-prio="${t.id}" title="Click to set priority or drag row">
                        ${prioGlyph}
                      </button>
                      <img src="${portrait}" alt="${t.def.name}" style="width:32px;height:32px;border-radius:6px;flex-shrink:0;"/>
                      <div style="flex:1;min-width:0;">
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
                          <span style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${t.def.name} #${t.instanceNumber}
                          </span>
                          <span style="color:${t.level >= 5 ? '#fde047' : '#fbbf24'};font-size:14px;font-weight:800;">
                            ${t.level >= 5 ? 'MAX' : `Lv.${t.level} ${'★'.repeat(t.level)}`}
                          </span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                          <button class="gm-tgt-btn" data-gm-target="${t.id}" title="Click to cycle targeting">${t.targeting}</button>
                          <div style="flex:1;height:6px;background:rgba(15,23,42,0.85);border-radius:999px;overflow:hidden;">
                            <div style="height:100%;width:${barPct}%;background:#4ade80;"></div>
                          </div>
                          <span style="font-size:14px;color:#cbd5e1;white-space:nowrap;">${dmgText}</span>
                        </div>
                      </div>
                      <button class="gm-upg-square ${canUpgrade ? 'ready' : ''}" data-gm-upg="${t.id}"
                        ${canUpgrade || nextCost === null ? '' : 'disabled'}
                        style="${nextCost === null ? 'background:#fbbf24;color:#1e293b;' : ''}">
                        ${nextCost === null ? 'MAX' : `■ $${nextCost}`}
                      </button>
                      <button class="btn btn-sm ${t.autoUpgrade ? 'btn-green' : 'btn-slate'}" data-gm-auto="${t.id}"
                        style="min-width:34px;padding:4px 6px;" title="Include in Auto-Upgrade Queue">⟳</button>
                      ${
                        abReady
                          ? `<button class="btn btn-sm ${t.isAbilityReady() ? 'btn-gold' : 'btn-slate'}" data-gm-ab="${t.id}"
                              style="min-width:34px;padding:4px 6px;" title="Fire ability">⚡</button>`
                          : ''
                      }
                    </div>
                  `;
                })
                .join('')
        }
      </div>

      <div style="border-top:1px solid rgba(255,255,255,0.14);padding-top:8px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:14px;">
          <button class="btn btn-sm ${this.match.autoUpgradeQueueEnabled ? 'btn-green' : 'btn-slate'}" id="gm-queue-toggle">
            Auto-Upgrade Queue: ${this.match.autoUpgradeQueueEnabled ? 'ON (① first)' : 'OFF'}
          </button>
          <label style="display:flex;align-items:center;gap:6px;">
            <span>Save $: <strong id="gm-res-val">$${reserve}</strong></span>
            <input type="range" id="gm-res-slider" min="0" max="5000" step="100" value="${reserve}" style="width:110px;" />
          </label>
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <button class="btn btn-gold btn-sm" id="gm-upg-priority">Upgrade by Priority ▲</button>
          <select id="gm-bulk-target" class="paper-select" style="font-size:14px;min-height:34px;">
            <option value="">Set targeting…</option>
            ${TARGET_MODES.map((m) => `<option value="${m}">${m}</option>`).join('')}
          </select>
          <button class="btn btn-slate btn-sm" id="gm-bulk-auto">Toggle ⟳</button>
          <button class="btn btn-rose btn-sm" id="gm-bulk-sell" ${bulkTargets.length === 0 ? 'disabled' : ''}>
            Sell (${bulkTargets.length})
          </button>
        </div>
      </div>
    `;

    this.root.querySelector('#gm-close')!.addEventListener('click', () => this.setOpen(false));
    this.root.querySelectorAll('[data-gm-role]').forEach((b) => {
      b.addEventListener('click', () => {
        this.roleFilter = (b as HTMLElement).dataset.gmRole as ManagerRoleFilter;
        this.render();
      });
    });

    (this.root.querySelector('#gm-sort') as HTMLSelectElement).addEventListener('change', (e) => {
      this.sortKey = (e.target as HTMLSelectElement).value as ManagerSortKey;
      this.render();
    });

    this.root.querySelector('#gm-queue-toggle')!.addEventListener('click', () => {
      this.match.autoUpgradeQueueEnabled = !this.match.autoUpgradeQueueEnabled;
      this.render();
      SynthAudio.play('click');
    });

    (this.root.querySelector('#gm-res-slider') as HTMLInputElement).addEventListener('input', (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      QualityManager.applySettings({ cashReserve: val }, false);
      SaveManager.data.settings.cashReserve = val;
      SaveManager.save();
      const span = this.root.querySelector('#gm-res-val');
      if (span) span.textContent = `$${val}`;
    });

    this.root.querySelector('#gm-upg-priority')!.addEventListener('click', () => {
      const n = this.match.upgradeByPriority(QualityManager.settings.cashReserve ?? 0);
      EventBus.emit('toast:show', {
        title: n > 0 ? `Upgraded ${n} unit(s) by priority!` : 'No priority upgrades affordable',
        color: n > 0 ? '#4ade80' : '#fbbf24',
      });
      this.render();
    });

    (this.root.querySelector('#gm-bulk-target') as HTMLSelectElement).addEventListener('change', (e) => {
      const mode = (e.target as HTMLSelectElement).value as TargetingMode;
      if (!mode) return;
      const targets = bulkTargets.length > 0 ? bulkTargets : towers;
      for (const tw of targets) {
        tw.targeting = mode;
        SaveManager.data.targetingMemory[tw.def.id] = mode;
      }
      SaveManager.save();
      this.render();
    });

    this.root.querySelector('#gm-bulk-auto')!.addEventListener('click', () => {
      const targets = bulkTargets.length > 0 ? bulkTargets : towers;
      const anyOff = targets.some((t) => !t.autoUpgrade);
      for (const tw of targets) tw.autoUpgrade = anyOff;
      this.render();
    });

    this.root.querySelector('#gm-bulk-sell')!.addEventListener('click', () => {
      if (bulkTargets.length === 0) return;
      const refund = bulkTargets.reduce((s, tw) => s + tw.getSellRefund(this.match.currentWave), 0);
      if (!window.confirm(`Sell ${bulkTargets.length} selected unit(s) for +$${refund}?`)) return;
      for (const tw of bulkTargets) {
        if (this.input.selectedTower?.id === tw.id) this.input.selectTower(null);
        this.match.sellTower(tw);
      }
      this.selectedIds.clear();
      this.render();
    });

    // Row click / hover / drag / right-click bindings
    this.root.querySelectorAll('[data-gm-id]').forEach((row) => {
      const el = row as HTMLDivElement;
      const id = el.dataset.gmId!;
      const tower = this.match.towers.find((tw) => tw.id === id);
      if (!tower) return;

      el.addEventListener('click', (ev) => {
        if ((ev.target as HTMLElement).closest('button')) return;
        if ((ev as MouseEvent).shiftKey) {
          if (this.selectedIds.has(id)) this.selectedIds.delete(id);
          else this.selectedIds.add(id);
        } else {
          this.selectedIds.clear();
          this.focusedTowerId = id;
          this.input.selectTower(tower);
          this.match.engine.cameraRig.glideTo(tower.position.x, 0, tower.position.z, 16);
        }
        this.render();
      });

      el.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        const mouse = ev as MouseEvent;
        this.openRowContextMenu(tower, mouse.clientX, mouse.clientY);
      });

      el.addEventListener('dragstart', () => {
        this.dragTowerId = id;
      });
      el.addEventListener('dragover', (ev) => ev.preventDefault());
      el.addEventListener('drop', (ev) => {
        ev.preventDefault();
        if (!this.dragTowerId || this.dragTowerId === id) return;
        const dragged = this.match.towers.find((tw) => tw.id === this.dragTowerId);
        if (dragged) this.match.setTowerPriority(dragged, tower.priority);
        this.dragTowerId = null;
      });
    });

    this.root.querySelectorAll('[data-gm-prio]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.gmPrio!;
        const tw = this.match.towers.find((t) => t.id === id);
        if (!tw) return;
        const raw = window.prompt(`Priority for ${tw.def.name} #${tw.instanceNumber} (1-${this.match.towers.length}):`, `${tw.priority}`);
        const num = Number(raw);
        if (Number.isFinite(num) && num >= 1) this.match.setTowerPriority(tw, num);
      });
    });

    this.root.querySelectorAll('[data-gm-target]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tw = this.match.towers.find((t) => t.id === (btn as HTMLElement).dataset.gmTarget);
        if (tw) {
          tw.cycleTargeting();
          this.render();
        }
      });
    });

    this.root.querySelectorAll('[data-gm-upg]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tw = this.match.towers.find((t) => t.id === (btn as HTMLElement).dataset.gmUpg);
        if (tw && tw.level < 5) {
          const r = (btn as HTMLElement).getBoundingClientRect();
          if (this.match.upgradeTower(tw)) {
            EventBus.emit('tower:upgrade_fx_line', {
              towerId: tw.id,
              fromX: r.left + r.width * 0.5,
              fromY: r.top + r.height * 0.5,
            });
          }
          this.render();
        }
      });
    });

    this.root.querySelectorAll('[data-gm-auto]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tw = this.match.towers.find((t) => t.id === (btn as HTMLElement).dataset.gmAuto);
        if (tw) {
          tw.autoUpgrade = !tw.autoUpgrade;
          this.render();
        }
      });
    });

    this.root.querySelectorAll('[data-gm-ab]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tw = this.match.towers.find((t) => t.id === (btn as HTMLElement).dataset.gmAb);
        if (tw) {
          this.match.abilities.activate(tw, this.match.towers, this.match.enemies);
          this.render();
        }
      });
    });
  }

  private openRowContextMenu(tower: TowerEntity, cx: number, cy: number): void {
    this.contextMenuEl.innerHTML = `
      <div style="font-size:14px;font-weight:800;color:#fde047;margin-bottom:4px;">${tower.def.name} #${tower.instanceNumber}</div>
      <button class="btn btn-sm btn-green" id="gm-ctx-type" style="width:100%;">Select all ${tower.def.name}</button>
    `;
    this.contextMenuEl.style.left = `${Math.min(window.innerWidth - 220, cx)}px`;
    this.contextMenuEl.style.top = `${Math.min(window.innerHeight - 90, cy)}px`;
    this.contextMenuEl.classList.remove('hidden');

    this.contextMenuEl.querySelector('#gm-ctx-type')!.addEventListener('click', () => {
      this.selectedIds.clear();
      for (const tw of this.match.towers) {
        if (tw.def.id === tower.def.id) this.selectedIds.add(tw.id);
      }
      this.contextMenuEl.classList.add('hidden');
      this.render();
    });
  }
}
