import { ACHIEVEMENTS, SaveManager } from '../core/SaveManager';
import { EventBus } from '../core/EventBus';
import { SynthAudio } from '../audio/SynthAudio';

export class QuestPanel {
  public root: HTMLDivElement;
  private isOpen = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'modal-backdrop hidden';
    this.root.innerHTML = `
      <div class="modal-card gloss-panel" style="width:760px;">
        <div class="modal-header">
          <div style="font-size:22px;font-weight:800;">📜 Daily Quests & Achievements</div>
          <button class="btn btn-rose btn-sm" id="quest-close">Close</button>
        </div>
        <div class="modal-body" id="quest-body"></div>
      </div>
    `;
    parent.appendChild(this.root);

    this.root.querySelector('#quest-close')!.addEventListener('click', () => this.close());
    EventBus.on('save:updated', () => {
      if (this.isOpen) this.render();
    });
  }

  public open(): void {
    SaveManager.checkDailyReset();
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
    const body = this.root.querySelector('#quest-body')!;
    const quests = SaveManager.data.dailyQuests;

    body.innerHTML = `
      <div style="font-size:17px;font-weight:800;color:#4ade80;">Daily Quests (Resets Midnight)</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${quests
          .map((q) => {
            const pct = Math.min(100, (q.progress / q.target) * 100);
            const done = q.progress >= q.target;
            const rewardLabel = q.rewardEnchantedCrate
              ? `+${q.rewardEnchantedCrate} Enchanted Crate`
              : `+${q.rewardSeeds} Seeds`;
            return `
              <div class="gloss-panel" style="padding:12px;display:flex;align-items:center;justify-content:space-between;gap:14px;">
                <div style="flex:1;">
                  <div style="font-size:16px;font-weight:700;">${q.title}</div>
                  <div style="font-size:14px;color:#cbd5e1;">${q.progress} / ${q.target} • Reward: ${rewardLabel}</div>
                  <div class="pity-bar-wrap" style="height:14px;margin-top:6px;">
                    <div class="pity-bar-fill" style="width:${pct}%;"></div>
                  </div>
                </div>
                <button class="btn btn-sm ${q.claimed ? 'btn-slate' : done ? 'btn-green' : 'btn-slate'}" data-qid="${q.id}" ${!done || q.claimed ? 'disabled' : ''}>
                  ${q.claimed ? 'Claimed' : done ? 'Claim' : 'In Progress'}
                </button>
              </div>
            `;
          })
          .join('')}
      </div>
      <div style="font-size:17px;font-weight:800;color:#fbbf24;margin-top:6px;">Achievements</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${ACHIEVEMENTS.map((a) => {
          const unlocked = !!SaveManager.data.achievements[a.id];
          return `
            <div class="gloss-panel" style="padding:10px;opacity:${unlocked ? 1 : 0.6};border-color:${unlocked ? '#fbbf24' : 'rgba(255,255,255,0.2)'};">
              <div style="font-size:16px;font-weight:700;">${a.icon} ${a.title}</div>
              <div style="font-size:14px;color:#cbd5e1;">${a.description}</div>
              <div style="font-size:14px;color:${unlocked ? '#4ade80' : '#fbbf24'};">${unlocked ? '✓ Unlocked' : `+${a.rewardSeeds} Seeds`}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    body.querySelectorAll('[data-qid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qid = (btn as HTMLElement).dataset.qid!;
        if (SaveManager.claimDailyQuest(qid)) {
          SynthAudio.play('crate_fanfare');
          this.render();
        }
      });
    });
  }
}
