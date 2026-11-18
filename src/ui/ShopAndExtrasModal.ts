import { getUnitById } from '../data/UnitRegistry';
import { getWeeklyShopOffers } from '../data/GameModesConfig';
import { RARITIES } from '../data/RarityConfig';
import { CURRENT_VERSION, REDEEM_CODES, WHATS_NEW_NOTES } from '../data/BalanceConfig';
import { SaveManager } from '../core/SaveManager';
import { EventBus } from '../core/EventBus';
import { ProceduralTextures } from '../rendering/ProceduralTextures';
import { SynthAudio } from '../audio/SynthAudio';

export type ShopExtrasTab = 'Shop' | 'WhatsNew' | 'Codes' | 'Stats' | 'Credits';

export class ShopAndExtrasModal {
  public root: HTMLDivElement;
  private activeTab: ShopExtrasTab = 'Shop';
  private redeemFeedback = '';

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'modal-backdrop hidden';
    this.root.innerHTML = `
      <div class="modal-card paper-panel" style="width:760px;">
        <div class="modal-header">
          <div style="font-size:22px;font-weight:800;" id="shop-title">🛒 Seed Shop & Garden Extras</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="stat-pill" id="shop-seeds">🌱 0</span>
            <span class="stat-pill" id="shop-dews">💧 0</span>
            <button class="btn btn-rose btn-sm" id="shop-close">Back / Esc</button>
          </div>
        </div>
        <div class="leaf-tab-row" id="shop-tabs" style="padding:8px 18px 0;"></div>
        <div class="modal-body" id="shop-body"></div>
      </div>
    `;
    parent.appendChild(this.root);
    this.root.querySelector('#shop-close')!.addEventListener('click', () => this.close());
    EventBus.on('save:updated', () => {
      if (!this.root.classList.contains('hidden')) this.render();
    });
  }

  public open(initialTab: ShopExtrasTab = 'Shop'): void {
    this.activeTab = initialTab;
    this.redeemFeedback = '';
    if (initialTab === 'WhatsNew') {
      SaveManager.data.whatsNewSeenVersion = CURRENT_VERSION;
      SaveManager.save();
    }
    this.root.classList.remove('hidden');
    this.render();
    SynthAudio.play('click');
  }

  public close(): void {
    this.root.classList.add('hidden');
  }

  private render(): void {
    const d = SaveManager.data;
    this.root.querySelector('#shop-seeds')!.textContent = `🌱 ${d.seeds.toLocaleString()}`;
    this.root.querySelector('#shop-dews')!.textContent = `💧 ${d.dewdrops}`;

    const tabs: Array<{ id: ShopExtrasTab; label: string }> = [
      { id: 'Shop', label: '🛒 Seed Shop' },
      { id: 'WhatsNew', label: "📰 What's New" },
      { id: 'Codes', label: '🎟 Codes' },
      { id: 'Stats', label: '📊 Stats' },
      { id: 'Credits', label: '🌿 Credits' },
    ];
    const tabsEl = this.root.querySelector('#shop-tabs')!;
    tabsEl.innerHTML = tabs
      .map(
        (t) =>
          `<button class="leaf-tab-btn ${this.activeTab === t.id ? 'active' : ''}" data-shop-tab="${t.id}">${t.label}</button>`
      )
      .join('');
    tabsEl.querySelectorAll('[data-shop-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        this.activeTab = (b as HTMLElement).dataset.shopTab as ShopExtrasTab;
        if (this.activeTab === 'WhatsNew') {
          SaveManager.data.whatsNewSeenVersion = CURRENT_VERSION;
          SaveManager.save();
        }
        SynthAudio.play('click');
        this.render();
      });
    });

    const body = this.root.querySelector('#shop-body')!;
    if (this.activeTab === 'Shop') {
      const weekly = getWeeklyShopOffers();
      body.innerHTML = `
        <div style="font-size:15px;">Weekly Rotating Stock (<b>${weekly.weekKey}</b>) — buy guaranteed copies directly with Seeds!</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          ${weekly.offers
            .map((o) => {
              const unit = getUnitById(o.unitId);
              const hex = RARITIES[unit.rarity].hex;
              const stock = d.shop.stock[o.unitId] ?? 0;
              const pct = Math.round((stock / o.maxStock) * 100);
              const portrait = ProceduralTextures.getUnitPortraitUrl(unit.id);
              return `
                <div class="unit-tile" style="align-items:stretch;padding:14px;gap:8px;position:relative;border-color:${hex};">
                  <div style="display:flex;gap:12px;align-items:center;">
                    <img src="${portrait}" alt="${unit.name}" style="width:64px;height:64px;border-radius:10px;border:2px solid ${hex};" />
                    <div style="text-align:left;">
                      <div style="font-size:17px;font-weight:800;">${unit.name}</div>
                      <div style="font-size:14px;color:${hex};font-weight:700;">${unit.rarity} · ${o.label}</div>
                    </div>
                  </div>
                  <div style="font-size:14px;text-align:left;opacity:0.9;">${unit.roleSummary}</div>
                  <div style="height:8px;background:rgba(0,0,0,0.18);border-radius:999px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:#22c55e;"></div>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:14px;font-weight:700;">Stock: ${stock} / ${o.maxStock}</span>
                    <button class="btn btn-green btn-sm" data-buy-offer="${unit.id}" ${stock <= 0 || d.seeds < o.priceSeeds ? 'disabled' : ''}>
                      ${stock <= 0 ? 'SOLD OUT' : `Buy (${o.priceSeeds} 🌱)`}
                    </button>
                  </div>
                  ${stock <= 0 ? `<div class="sold-out-stamp">SOLD OUT</div>` : ''}
                </div>
              `;
            })
            .join('')}
        </div>
      `;
      body.querySelectorAll('[data-buy-offer]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const uid = (btn as HTMLElement).dataset.buyOffer!;
          if (SaveManager.buyShopOffer(uid)) {
            SynthAudio.play('crate_fanfare');
            EventBus.emit('toast:show', { title: `Purchased ${getUnitById(uid).name}!`, color: '#4ade80' });
            this.render();
          }
        });
      });
    } else if (this.activeTab === 'WhatsNew') {
      body.innerHTML = WHATS_NEW_NOTES.map(
        (n) => `
          <div style="font-size:20px;font-weight:800;color:#14532d;">${n.version}</div>
          <ul style="font-size:15px;padding-left:20px;margin:4px 0 10px;display:flex;flex-direction:column;gap:6px;">
            ${n.highlights.map((h) => `<li>${h}</li>`).join('')}
          </ul>
          <div style="font-size:17px;font-weight:800;color:#92400e;">⚖ Balance Changes</div>
          <ul style="font-size:14px;padding-left:20px;margin:4px 0;">
            ${n.balanceNotes.map((b) => `<li>${b}</li>`).join('')}
          </ul>
        `
      ).join('');
    } else if (this.activeTab === 'Codes') {
      const sampleHint = Object.keys(REDEEM_CODES)
        .map((c) => `<code>${c}</code>`)
        .join(', ');
      body.innerHTML = `
        <div style="font-size:15px;">Enter a Garden Reward Code to claim free Seeds, Dewdrops, and Event Tickets (one use per save).</div>
        <div style="display:flex;gap:10px;align-items:center;">
          <input type="text" id="code-input" placeholder="Enter code (e.g. SPROUT)" class="paper-input" style="flex:1;font-size:16px;" />
          <button class="btn btn-green" id="code-submit-btn">Redeem</button>
        </div>
        ${this.redeemFeedback ? `<div style="font-size:15px;font-weight:700;color:#15803d;">${this.redeemFeedback}</div>` : ''}
        <div style="font-size:14px;opacity:0.85;">Active Launch Codes: ${sampleHint}</div>
      `;
      body.querySelector('#code-submit-btn')!.addEventListener('click', () => {
        const val = (body.querySelector('#code-input') as HTMLInputElement).value;
        const res = SaveManager.redeemCode(val);
        this.redeemFeedback = res.message;
        SynthAudio.play(res.ok ? 'crate_fanfare' : 'error');
        this.render();
      });
    } else if (this.activeTab === 'Stats') {
      body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:15px;">
          <div class="stat-pill">🐞 Total Pests Defeated: <b>${d.stats.totalKills.toLocaleString()}</b></div>
          <div class="stat-pill">🏆 Matches Won: <b>${d.stats.matchesWon}</b></div>
          <div class="stat-pill">⚗ Element Synergies: <b>${d.stats.totalSynergies}</b></div>
          <div class="stat-pill">♾ Best Endless Wave: <b>${d.stats.highestEndlessWave}</b></div>
          <div class="stat-pill">🎁 Total Summons: <b>${d.stats.cratesOpened}</b></div>
          <div class="stat-pill">🌱 Player Level: <b>${d.playerLevel}</b></div>
        </div>
      `;
    } else {
      body.innerHTML = `
        <div style="font-size:16px;font-weight:800;">Garden Bastion TD — v${CURRENT_VERSION}</div>
        <div style="font-size:15px;line-height:1.6;">
          Built 100% procedurally with TypeScript, Vite, Three.js WebGL &amp; Web Audio API — zero external image, mesh, or audio assets.
          <br />Inspired by Roblox <i>Garden Tower Defense</i>.
          <br />All plants grow directly in living garden soil with evolution roots and PropKit dioramas.
        </div>
      `;
    }
  }
}
