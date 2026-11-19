import { MatchController } from '../simulation/MatchController';
import { InputManager } from '../core/InputManager';
import { Keybinds } from '../core/Keybinds';
import { EventBus } from '../core/EventBus';
import { RARITIES } from '../data/RarityConfig';
import { TRAITS } from '../data/TraitConfig';
import { getUnitSynergyPartners } from '../data/SynergyConfig';
import { SaveManager } from '../core/SaveManager';
import { getUnitById, getUpgradePreviewLabel } from '../data/UnitRegistry';
import { renderGardenIcon } from './GardenIcons';

export class InspectorPanel {
  public root: HTMLDivElement;
  private match: MatchController;
  private input: InputManager;
  private statDiffEl: HTMLDivElement;

  constructor(parent: HTMLElement, match: MatchController, input: InputManager) {
    this.match = match;
    this.input = input;
    this.root = document.createElement('div');
    this.root.className = 'inspector-panel gloss-panel hidden';
    parent.appendChild(this.root);

    this.statDiffEl = document.createElement('div');
    this.statDiffEl.className = 'stat-diff-float hidden';
    parent.appendChild(this.statDiffEl);

    EventBus.on('keybinds:changed', () => {
      if (this.input.selectedTower) this.render();
    });
  }

  private showStatDiff(dmgDelta: number, rngDelta: number): void {
    const parts: string[] = [];
    if (dmgDelta > 0) parts.push(`DMG +${dmgDelta}`);
    if (rngDelta > 0.05) parts.push(`RNG +${rngDelta.toFixed(1)}`);
    if (parts.length === 0) return;

    this.statDiffEl.textContent = parts.join('  •  ');
    this.statDiffEl.classList.remove('hidden', 'pop-float');
    void this.statDiffEl.offsetWidth;
    this.statDiffEl.classList.add('pop-float');
    setTimeout(() => this.statDiffEl.classList.add('hidden'), 950);
  }

  public render(): void {
    const t = this.input.selectedTower;
    if (!t || !this.match.inMatch) {
      this.root.classList.add('hidden');
      return;
    }
    this.root.className = `inspector-panel gloss-panel rarity-frame-${t.def.rarity}`;

    const rarityHex = RARITIES[t.def.rarity].hex;
    const traitColor = TRAITS[t.trait].color;
    const nextCost = t.getNextUpgradeCost();
    const curDmg = t.def.isFarm ? t.getFarmPayout() : t.getEffectiveDamage();
    const nextDmg =
      t.level < 5
        ? t.def.isFarm
          ? Math.round(t.def.levels[t.level + 1].farmPayout * TRAITS[t.trait].cashMult)
          : Math.round(t.def.levels[t.level + 1].dmg * TRAITS[t.trait].dmgMult * SaveManager.getUnitBonusDamageMult(t.def.id))
        : curDmg;
    const curRng = t.getEffectiveRange();
    const nextRng =
      t.level < 5 ? Number((t.def.levels[t.level + 1].range * TRAITS[t.trait].rangeMult).toFixed(1)) : curRng;

    const allPartners = getUnitSynergyPartners(t.def.name, t.def.elements);
    const ownedNames = Object.keys(SaveManager.data.owned).map((id) => getUnitById(id).name);
    const ownedPartners = allPartners.filter((n) => ownedNames.includes(n));
    const comboText =
      ownedPartners.length > 0
        ? ownedPartners.join(', ')
        : allPartners.length > 0
          ? `${allPartners.slice(0, 2).join(', ')} (unlock in Crates)`
          : 'Support / Economy';

    const activeLinks = this.match.rootNetwork.currentLinks.filter(
      (l) => l.fromId === t.id || l.toId === t.id
    );
    const linksSummary =
      activeLinks.length > 0
        ? activeLinks
            .slice(0, 3)
            .map((l) => l.label)
            .join(' • ')
        : 'None nearby';

    const waveSlice = t.damagePerWave.slice(-8);
    const maxWaveDmg = Math.max(1, ...waveSlice);
    const barsHtml =
      waveSlice.length > 0
        ? `<div class="wave-dmg-bars">${waveSlice
            .map(
              (v, idx) =>
                `<div class="wave-dmg-bar" style="height:${Math.max(12, Math.round((v / maxWaveDmg) * 100))}%;" title="Wave ${idx + 1}: ${v}"></div>`
            )
            .join('')}</div>`
        : '';

    const previewTag = t.level < 5 ? ` (${getUpgradePreviewLabel(t.def, t.level + 1)})` : '';
    const starsHtml = `<span style="color:#fde047;">${'★'.repeat(t.level)}${'☆'.repeat(5 - t.level)}</span>`;

    this.root.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div>
          <div style="font-size:18px;font-weight:800;">
            ${t.def.name} #${t.instanceNumber} ${t.isPrime ? '★' : ''}
          </div>
          <div style="font-size:14px;">
            <span style="color:${rarityHex};font-weight:700;">${t.def.rarity}</span> •
            <span style="color:${traitColor};font-weight:700;">${t.trait}</span> • ${starsHtml}
          </div>
        </div>
        <button class="btn btn-slate btn-sm" id="insp-close" data-tooltip="Deselect tower" data-tooltip-key="cancel">✕</button>
      </div>

      <div style="font-size:14px;background:rgba(15,23,42,0.75);padding:8px;border-radius:10px;display:flex;flex-direction:column;gap:4px;">
        <div>Total Damage: <strong class="chunky-num">${t.totalDamageDealt.toLocaleString()}</strong></div>
        <div>
          ${renderGardenIcon('damage', 15)} ${t.def.isFarm ? 'Payout' : 'DMG'}:
          <strong>${curDmg}</strong> ${t.level < 5 ? `→ <span style="color:#4ade80;font-weight:800;">${nextDmg}</span>` : '(MAX)'}
        </div>
        <div>
          ${renderGardenIcon('range', 15)} Range:
          <strong>${curRng}</strong> ${t.level < 5 && curRng > 0 ? `→ <span style="color:#38bdf8;">${nextRng}</span>` : ''}
          • DPS: <strong>${t.getDisplayedDps()}</strong>
        </div>
        ${barsHtml}
        ${t.stunnedTimer > 0 ? `<div style="color:#f43f5e;font-weight:800;">⚡ STUNNED (${t.stunnedTimer.toFixed(1)} s)</div>` : ''}
        ${t.gnawedTimer > 0 ? `<div style="color:#fb923c;font-weight:800;">🪵 GNAWED (-20% Speed)</div>` : ''}
      </div>

      <div style="font-size:14px;color:#e2e8f0;">
        <span style="color:#c084fc;font-weight:700;">Combos:</span> ${comboText}
      </div>
      <div style="font-size:14px;color:#86efac;">
        <span style="font-weight:700;">Links:</span> ${linksSummary}
      </div>

      <div style="display:flex;gap:8px;">
        <button class="btn btn-slate btn-sm" id="insp-target" style="flex:1;"
          data-tooltip="Cycle target priority (First/Last/Strongest/Closest/Weakest)" data-tooltip-key="target_cycle">
          ${renderGardenIcon('target', 15)} ${t.targeting} ${Keybinds.badge('target_cycle')}
        </button>
        ${
          t.level < 5
            ? `<button class="btn btn-gold btn-sm" id="insp-max-up" data-tooltip="Upgrade as high as current cash allows" data-tooltip-key="upgrade_max">
                Max ${Keybinds.badge('upgrade_max')}
               </button>`
            : ''
        }
      </div>

      <div style="display:flex;gap:8px;">
        <button class="btn btn-green btn-sm" id="insp-upgrade" style="flex:1.5;"
          ${nextCost === null || (!this.match.sandboxInfiniteCash && this.match.cash < nextCost) ? 'disabled' : ''}
          data-tooltip="Hold E or Shift+Click tower to upgrade faster" data-tooltip-key="upgrade">
          ${renderGardenIcon('upgrade', 15)} ${nextCost === null ? 'MAX LEVEL' : `$${nextCost}${previewTag}`} ${nextCost !== null ? Keybinds.badge('upgrade') : ''}
        </button>
        <button class="btn btn-rose btn-sm" id="insp-sell" style="flex:1;"
          data-tooltip="Refunds 80% on same wave or 65% later (Rollers $0)" data-tooltip-key="sell">
          ${renderGardenIcon('sell', 15)} +$${t.getSellRefund(this.match.currentWave)} ${Keybinds.badge('sell')}
        </button>
      </div>
    `;

    this.root.querySelector('#insp-close')!.addEventListener('click', () => this.input.selectTower(null));
    this.root.querySelector('#insp-target')!.addEventListener('click', () => {
      t.cycleTargeting();
      this.render();
    });
    this.root.querySelector('#insp-max-up')?.addEventListener('click', () => {
      const beforeD = curDmg;
      const beforeR = curRng;
      this.match.upgradeMaxAffordable(t);
      const afterD = t.def.isFarm ? t.getFarmPayout() : t.getEffectiveDamage();
      this.showStatDiff(afterD - beforeD, t.getEffectiveRange() - beforeR);
      this.input.selectTower(t);
      this.render();
    });
    this.root.querySelector('#insp-upgrade')!.addEventListener('click', () => {
      const beforeD = curDmg;
      const beforeR = curRng;
      if (this.match.upgradeTower(t)) {
        const afterD = t.def.isFarm ? t.getFarmPayout() : t.getEffectiveDamage();
        this.showStatDiff(afterD - beforeD, t.getEffectiveRange() - beforeR);
      }
      this.input.selectTower(t);
      this.render();
    });
    this.root.querySelector('#insp-sell')!.addEventListener('click', () => {
      this.match.sellTower(t);
      this.input.selectTower(null);
    });
  }
}
