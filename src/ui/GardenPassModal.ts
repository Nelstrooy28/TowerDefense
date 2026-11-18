import { GARDEN_PASS_TIERS } from '../data/GameModesConfig';
import { SaveManager } from '../core/SaveManager';
import { EventBus } from '../core/EventBus';
import { SynthAudio } from '../audio/SynthAudio';

export class GardenPassModal {
  public root: HTMLDivElement;
  private isOpen = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'modal-backdrop hidden';
    this.root.innerHTML = `
      <div class="modal-card gloss-panel" style="width:760px;">
        <div class="modal-header">
          <div style="font-size:22px;font-weight:800;">🌸 Garden Pass — Season 1 (Free)</div>
          <button class="btn btn-rose btn-sm" id="gp-close">Close</button>
        </div>
        <div class="modal-body" id="gp-body"></div>
      </div>
    `;
    parent.appendChild(this.root);
    this.root.querySelector('#gp-close')!.addEventListener('click', () => this.close());
    EventBus.on('save:updated', () => {
      if (this.isOpen) this.render();
    });
  }

  public open(): void {
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.render();
    SynthAudio.play('click');
  }

  public close(): void {
    this.isOpen = false;
    this.root.classList.add('hidden');
  }

  private render(): void {
    const gp = SaveManager.data.gardenPass;
    const body = this.root.querySelector('#gp-body')!;
    body.innerHTML = `
      <div class="gloss-panel" style="padding:12px;">
        <div style="font-size:17px;font-weight:800;">Current Tier: ${gp.tier} / 30 (${gp.xp} Season XP)</div>
        <div style="font-size:14px;color:#cbd5e1;">Earn XP by clearing waves, completing quests, and defeating bosses.</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${GARDEN_PASS_TIERS.map((t) => {
          const unlocked = gp.tier >= t.tier;
          const claimed = gp.claimed.includes(t.tier);
          return `
            <div class="gloss-panel" style="padding:10px;display:flex;justify-content:space-between;align-items:center;border-color:${unlocked ? '#4ade80' : 'rgba(255,255,255,0.2)'};">
              <div>
                <div style="font-weight:800;font-size:15px;">Tier ${t.tier} (${t.xpRequired} XP)</div>
                <div style="font-size:14px;color:#fde047;">${t.rewardLabel}</div>
              </div>
              <button class="btn btn-sm ${claimed ? 'btn-slate' : unlocked ? 'btn-green' : 'btn-slate'}" data-gptier="${t.tier}" ${!unlocked || claimed ? 'disabled' : ''}>
                ${claimed ? 'Claimed' : unlocked ? 'Claim' : 'Locked'}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;

    body.querySelectorAll('[data-gptier]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tier = Number((btn as HTMLElement).dataset.gptier);
        if (SaveManager.claimGardenPassTier(tier)) {
          SynthAudio.play('crate_fanfare');
          this.render();
        }
      });
    });
  }
}
