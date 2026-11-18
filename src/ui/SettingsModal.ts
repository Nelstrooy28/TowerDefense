import { QualityManager, type QualityTier } from '../core/QualityManager';
import { SaveManager } from '../core/SaveManager';
import { SynthAudio } from '../audio/SynthAudio';
import { EventBus } from '../core/EventBus';

export class SettingsModal {
  public root: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'modal-backdrop hidden';
    this.root.innerHTML = `
      <div class="modal-card gloss-panel" style="width:620px;">
        <div class="modal-header">
          <div style="font-size:22px;font-weight:800;">⚙️ Settings & Accessibility</div>
          <button class="btn btn-rose btn-sm" id="set-close">Close</button>
        </div>
        <div class="modal-body" id="set-body"></div>
      </div>
    `;
    parent.appendChild(this.root);
    this.root.querySelector('#set-close')!.addEventListener('click', () => this.close());
  }

  public open(): void {
    this.root.classList.remove('hidden');
    this.render();
    SynthAudio.play('click');
  }

  public close(): void {
    this.root.classList.add('hidden');
  }

  private render(): void {
    const s = QualityManager.settings;
    const body = this.root.querySelector('#set-body')!;
    const tiers: QualityTier[] = ['Low', 'Medium', 'High', 'Ultra'];

    body.innerHTML = `
      <div>
        <div style="font-size:15px;font-weight:700;margin-bottom:6px;">VFX Quality Tier</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
          ${tiers
            .map(
              (t) => `<button class="btn btn-sm ${s.tier === t ? 'btn-green' : 'btn-slate'}" data-tier="${t}">${t}</button>`
            )
            .join('')}
        </div>
      </div>

      <label style="display:flex;justify-content:space-between;align-items:center;font-size:15px;">
        <span>Reduced Motion (disables shake, FOV kick, slow-mo)</span>
        <input type="checkbox" id="set-reduced" ${s.reducedMotion ? 'checked' : ''} style="width:20px;height:20px;" />
      </label>

      <div>
        <div style="display:flex;justify-content:space-between;font-size:15px;">
          <span>Screen Shake Intensity</span>
          <span id="shake-val">${Math.round(s.screenShake * 100)}%</span>
        </div>
        <input type="range" id="set-shake" min="0" max="100" value="${Math.round(s.screenShake * 100)}" style="width:100%;" />
      </div>

      <label style="display:flex;justify-content:space-between;align-items:center;font-size:15px;">
        <span>Colorblind Symbols on Rarities & Health Bars</span>
        <input type="checkbox" id="set-cb" ${s.colorblindMode ? 'checked' : ''} style="width:20px;height:20px;" />
      </label>

      <label style="display:flex;justify-content:space-between;align-items:center;font-size:15px;">
        <span>Flash Reduction (caps full-screen flashes at 40%)</span>
        <input type="checkbox" id="set-flash" ${s.flashReduction ? 'checked' : ''} style="width:20px;height:20px;" />
      </label>

      <label style="display:flex;justify-content:space-between;align-items:center;font-size:15px;">
        <span>Boss Entrance Cinematic Camera</span>
        <input type="checkbox" id="set-bosscam" ${s.bossCamera ? 'checked' : ''} style="width:20px;height:20px;" />
      </label>

      <div>
        <div style="display:flex;justify-content:space-between;font-size:15px;">
          <span>Master Audio Volume</span>
          <span id="vol-val">${Math.round(s.masterVolume * 100)}%</span>
        </div>
        <input type="range" id="set-vol" min="0" max="100" value="${Math.round(s.masterVolume * 100)}" style="width:100%;" />
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid rgba(255,255,255,0.15);">
        <button class="btn btn-slate btn-sm" id="set-mute">${s.muted ? 'Unmute Audio' : 'Mute Audio'}</button>
        <button class="btn btn-rose btn-sm" id="set-reset-save">Reset Save Data</button>
      </div>
    `;

    body.querySelectorAll('[data-tier]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tier = (btn as HTMLElement).dataset.tier as QualityTier;
        QualityManager.setTier(tier, false);
        SaveManager.save();
        this.render();
      });
    });

    (body.querySelector('#set-reduced') as HTMLInputElement).addEventListener('change', (e) => {
      QualityManager.applySettings({ reducedMotion: (e.target as HTMLInputElement).checked });
      SaveManager.save();
    });
    (body.querySelector('#set-shake') as HTMLInputElement).addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value) / 100;
      QualityManager.applySettings({ screenShake: v });
      body.querySelector('#shake-val')!.textContent = `${Math.round(v * 100)}%`;
      SaveManager.save();
    });
    (body.querySelector('#set-cb') as HTMLInputElement).addEventListener('change', (e) => {
      QualityManager.applySettings({ colorblindMode: (e.target as HTMLInputElement).checked });
      SaveManager.save();
    });
    (body.querySelector('#set-flash') as HTMLInputElement).addEventListener('change', (e) => {
      QualityManager.applySettings({ flashReduction: (e.target as HTMLInputElement).checked });
      SaveManager.save();
    });
    (body.querySelector('#set-bosscam') as HTMLInputElement).addEventListener('change', (e) => {
      QualityManager.applySettings({ bossCamera: (e.target as HTMLInputElement).checked });
      SaveManager.save();
    });
    (body.querySelector('#set-vol') as HTMLInputElement).addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value) / 100;
      QualityManager.applySettings({ masterVolume: v });
      SynthAudio.syncVolume();
      body.querySelector('#vol-val')!.textContent = `${Math.round(v * 100)}%`;
      SaveManager.save();
    });
    body.querySelector('#set-mute')!.addEventListener('click', () => {
      QualityManager.applySettings({ muted: !QualityManager.settings.muted });
      SynthAudio.syncVolume();
      SaveManager.save();
      this.render();
    });
    body.querySelector('#set-reset-save')!.addEventListener('click', () => {
      if (window.confirm('Reset all Seeds, Units, Quests, and Stats?')) {
        SaveManager.resetSave();
        EventBus.emit('toast:show', { title: 'Save data reset', color: '#38bdf8' });
        this.render();
      }
    });
  }
}
