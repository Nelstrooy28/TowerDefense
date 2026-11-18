import { MatchController } from '../simulation/MatchController';
import { InputManager } from '../core/InputManager';
import { RARITIES } from '../data/RarityConfig';
import { TRAITS } from '../data/TraitConfig';
import { getUnitSynergyPartners } from '../data/SynergyConfig';
import { SaveManager } from '../core/SaveManager';
import { getUnitById, getUpgradePreviewLabel } from '../data/UnitRegistry';

export class InspectorPanel {
  public root: HTMLDivElement;
  private match: MatchController;
  private input: InputManager;

  constructor(parent: HTMLElement, match: MatchController, input: InputManager) {
    this.match = match;
    this.input = input;
    this.root = document.createElement('div');
    this.root.className = 'inspector-panel gloss-panel hidden';
    parent.appendChild(this.root);
  }

  public render(): void {
    const t = this.input.selectedTower;
    if (!t || !this.match.inMatch) {
      this.root.classList.add('hidden');
      return;
    }
    this.root.classList.remove('hidden');

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

    // §5 & §14 Root Network Links row
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

    // §14 Mini damage-per-wave bar chart
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

    this.root.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:18px;font-weight:800;">${t.def.name}${t.isPrime ? ' ★' : ''}</div>
          <div style="font-size:14px;">
            <span style="color:${rarityHex};font-weight:700;">${t.def.rarity}</span> •
            <span style="color:${traitColor};font-weight:700;">${t.trait}</span> • Lv.${t.level}/5
          </div>
        </div>
        <button class="btn btn-slate btn-sm" id="insp-close">✕</button>
      </div>

      <div style="font-size:14px;background:rgba(15,23,42,0.75);padding:8px;border-radius:10px;display:flex;flex-direction:column;gap:4px;">
        <div>Total Damage: <strong>${t.totalDamageDealt.toLocaleString()}</strong></div>
        <div>${t.def.isFarm ? 'Payout' : 'DMG'}: <strong>${curDmg}</strong> ${t.level < 5 ? `→ <span style="color:#4ade80;">${nextDmg}</span>` : '(MAX)'}</div>
        <div>Range: <strong>${curRng}</strong> ${t.level < 5 && curRng > 0 ? `→ <span style="color:#38bdf8;">${nextRng}</span>` : ''} • DPS: <strong>${t.getDisplayedDps()}</strong></div>
        ${barsHtml}
        ${t.stunnedTimer > 0 ? `<div style="color:#f43f5e;font-weight:800;">⚡ STUNNED (${t.stunnedTimer.toFixed(1)} s)</div>` : ''}
        ${t.gnawedTimer > 0 ? `<div style="color:#fb923c;font-weight:800;">🪵 GNAWED (-20% Speed)</div>` : ''}
      </div>

      <div style="font-size:14px;color:#e2e8f0;">
        <span style="color:#c084fc;font-weight:700;">Combos with:</span> ${comboText}
      </div>
      <div style="font-size:14px;color:#86efac;">
        <span style="font-weight:700;">Links:</span> ${linksSummary}
      </div>

      <div style="display:flex;gap:8px;">
        <button class="btn btn-slate btn-sm" id="insp-target" style="flex:1;">Target: ${t.targeting}</button>
        ${t.level < 5 ? `<button class="btn btn-gold btn-sm" id="insp-max-up" title="Shift+U">Max</button>` : ''}
      </div>

      <div style="display:flex;gap:8px;">
        <button class="btn btn-green btn-sm" id="insp-upgrade" style="flex:1.5;" ${nextCost === null || this.match.cash < nextCost ? 'disabled' : ''}>
          ${nextCost === null ? 'MAX LEVEL' : `Upgrade $${nextCost}${previewTag}`}
        </button>
        <button class="btn btn-rose btn-sm" id="insp-sell" style="flex:1;">
          Sell +$${t.getSellRefund()}
        </button>
      </div>
    `;

    this.root.querySelector('#insp-close')!.addEventListener('click', () => this.input.selectTower(null));
    this.root.querySelector('#insp-target')!.addEventListener('click', () => {
      t.cycleTargeting();
      this.render();
    });
    this.root.querySelector('#insp-max-up')?.addEventListener('click', () => {
      this.match.upgradeMaxAffordable(t);
      this.input.selectTower(t);
      this.render();
    });
    this.root.querySelector('#insp-upgrade')!.addEventListener('click', () => {
      this.match.upgradeTower(t);
      this.input.selectTower(t);
      this.render();
    });
    this.root.querySelector('#insp-sell')!.addEventListener('click', () => {
      this.match.sellTower(t);
      this.input.selectTower(null);
    });
  }
}
