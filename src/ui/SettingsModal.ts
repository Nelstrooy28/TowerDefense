import { QualityManager, type QualityTier } from '../core/QualityManager';
import { SaveManager } from '../core/SaveManager';
import { SynthAudio } from '../audio/SynthAudio';
import { EventBus } from '../core/EventBus';

type SettingsTab = 'Game' | 'Graphics' | 'Audio' | 'Controls' | 'Accessibility' | 'Save';

export class SettingsModal {
  public root: HTMLDivElement;
  private activeTab: SettingsTab = 'Game';

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'modal-backdrop hidden';
    this.root.innerHTML = `
      <div class="modal-card paper-panel" style="width:700px;">
        <div class="modal-header">
          <div style="font-size:22px;font-weight:800;">⚙ Watering Can Settings</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span id="set-saved-tick" style="font-size:14px;color:#15803d;font-weight:700;opacity:0;transition:opacity 0.2s;">🌿 Saved</span>
            <button class="btn btn-rose btn-sm" id="set-close">Back / Esc</button>
          </div>
        </div>
        <div class="leaf-tab-row" id="set-tabs" style="padding:8px 18px 0;"></div>
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

  private flashSavedTick(): void {
    const el = this.root.querySelector('#set-saved-tick') as HTMLElement | null;
    if (!el) return;
    el.style.opacity = '1';
    setTimeout(() => {
      el.style.opacity = '0';
    }, 1100);
  }

  private render(): void {
    const s = QualityManager.settings;
    const tabsEl = this.root.querySelector('#set-tabs')!;
    const body = this.root.querySelector('#set-body')!;
    const allTabs: SettingsTab[] = ['Game', 'Graphics', 'Audio', 'Controls', 'Accessibility', 'Save'];

    tabsEl.innerHTML = allTabs
      .map(
        (tab) =>
          `<button class="leaf-tab-btn ${this.activeTab === tab ? 'active' : ''}" data-set-tab="${tab}">${tab}</button>`
      )
      .join('');

    tabsEl.querySelectorAll('[data-set-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = (btn as HTMLElement).dataset.setTab as SettingsTab;
        SynthAudio.play('click');
        this.render();
      });
    });

    const tiers: QualityTier[] = ['Low', 'Medium', 'High', 'Ultra'];

    if (this.activeTab === 'Game') {
      body.innerHTML = `
        <label class="set-row">
          <span>Default Auto-Skip Waves</span>
          <input type="checkbox" id="set-autoskip" ${s.autoSkipDefault ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
        <label class="set-row">
          <span>Show Floating Damage Numbers</span>
          <input type="checkbox" id="set-dmgnums" ${s.showDamageNumbers !== false ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
        <label class="set-row">
          <span>Show Range Ring on Hover</span>
          <input type="checkbox" id="set-hoverrng" ${s.showRangeOnHover !== false ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
        <label class="set-row">
          <span>Boss Entrance Cinematic Camera</span>
          <input type="checkbox" id="set-bosscam" ${s.bossCamera ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
        <label class="set-row">
          <span>Fast Summon Animations (0.8 s / 1.5 s)</span>
          <input type="checkbox" id="set-fastsum" ${SaveManager.data.fastSummons ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
        <label class="set-row">
          <span>Auto-Recycle Duplicate Common/Uncommon Pulls</span>
          <input type="checkbox" id="set-autorec" ${SaveManager.data.autoRecycleCommons ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
      `;
      body.querySelector('#set-autoskip')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ autoSkipDefault: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-dmgnums')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ showDamageNumbers: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-hoverrng')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ showRangeOnHover: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-bosscam')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ bossCamera: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-fastsum')!.addEventListener('change', (e) => {
        SaveManager.data.fastSummons = (e.target as HTMLInputElement).checked;
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-autorec')!.addEventListener('change', (e) => {
        SaveManager.data.autoRecycleCommons = (e.target as HTMLInputElement).checked;
        SaveManager.save();
        this.flashSavedTick();
      });
    } else if (this.activeTab === 'Graphics') {
      body.innerHTML = `
        <div>
          <div style="font-size:15px;font-weight:700;margin-bottom:6px;">VFX Quality Tier</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
            ${tiers
              .map(
                (t) =>
                  `<button class="btn btn-sm ${s.tier === t ? 'btn-green' : 'btn-slate'}" data-tier="${t}">${t}</button>`
              )
              .join('')}
          </div>
        </div>
        <label class="set-row">
          <span>Auto Quality Scaler (drops tier if FPS &lt; 45)</span>
          <input type="checkbox" id="set-autoscaler" ${s.autoScaler !== false ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
        <label class="set-row">
          <span>Selective Bloom</span>
          <input type="checkbox" id="set-bloom" ${s.bloomEnabled !== false ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
        <label class="set-row">
          <span>Dynamic Shadows</span>
          <input type="checkbox" id="set-shadows" ${s.shadowsEnabled !== false ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
      `;
      body.querySelectorAll('[data-tier]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tier = (btn as HTMLElement).dataset.tier as QualityTier;
          QualityManager.setTier(tier, false);
          SaveManager.save();
          this.flashSavedTick();
          this.render();
        });
      });
      body.querySelector('#set-autoscaler')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ autoScaler: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-bloom')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ bloomEnabled: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-shadows')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ shadowsEnabled: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
    } else if (this.activeTab === 'Audio') {
      body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div style="font-size:15px;">Master: <span id="vol-val">${Math.round(s.masterVolume * 100)}%</span></div>
            <input type="range" id="set-vol" min="0" max="100" value="${Math.round(s.masterVolume * 100)}" style="width:100%;" />
          </div>
          <div>
            <div style="font-size:15px;">Music: <span id="vol-music-val">${Math.round((s.volumeMusic ?? 0.85) * 100)}%</span></div>
            <input type="range" id="set-vol-music" min="0" max="100" value="${Math.round((s.volumeMusic ?? 0.85) * 100)}" style="width:100%;" />
          </div>
          <div>
            <div style="font-size:15px;">SFX: <span id="vol-sfx-val">${Math.round((s.volumeSfx ?? 0.9) * 100)}%</span></div>
            <input type="range" id="set-vol-sfx" min="0" max="100" value="${Math.round((s.volumeSfx ?? 0.9) * 100)}" style="width:100%;" />
          </div>
          <div>
            <div style="font-size:15px;">UI Audio: <span id="vol-ui-val">${Math.round((s.volumeUi ?? 0.8) * 100)}%</span></div>
            <input type="range" id="set-vol-ui" min="0" max="100" value="${Math.round((s.volumeUi ?? 0.8) * 100)}" style="width:100%;" />
          </div>
        </div>
        <label class="set-row">
          <span>Mute When Browser Tab Hidden</span>
          <input type="checkbox" id="set-mutehidden" ${s.muteWhenHidden !== false ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
        <button class="btn btn-slate btn-sm" id="set-mute">${s.muted ? '🔇 Unmute All' : '🔊 Mute All'}</button>
      `;
      const bindVol = (sel: string, spanSel: string, prop: 'masterVolume' | 'volumeMusic' | 'volumeSfx' | 'volumeUi') => {
        (body.querySelector(sel) as HTMLInputElement).addEventListener('input', (e) => {
          const v = Number((e.target as HTMLInputElement).value) / 100;
          QualityManager.applySettings({ [prop]: v });
          SynthAudio.syncVolume();
          body.querySelector(spanSel)!.textContent = `${Math.round(v * 100)}%`;
          SaveManager.save();
          this.flashSavedTick();
        });
      };
      bindVol('#set-vol', '#vol-val', 'masterVolume');
      bindVol('#set-vol-music', '#vol-music-val', 'volumeMusic');
      bindVol('#set-vol-sfx', '#vol-sfx-val', 'volumeSfx');
      bindVol('#set-vol-ui', '#vol-ui-val', 'volumeUi');
      body.querySelector('#set-mutehidden')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ muteWhenHidden: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-mute')!.addEventListener('click', () => {
        QualityManager.applySettings({ muted: !QualityManager.settings.muted });
        SynthAudio.syncVolume();
        SaveManager.save();
        this.render();
      });
    } else if (this.activeTab === 'Controls') {
      body.innerHTML = `
        <div style="font-size:15px;display:grid;grid-template-columns:1fr 1fr;gap:8px;background:rgba(0,0,0,0.06);padding:10px;border-radius:8px;">
          <div><b>1–6</b>: Select Unit Slot</div>
          <div><b>Space</b>: Start / Skip Wave</div>
          <div><b>U / Shift+U</b>: Upgrade / Max</div>
          <div><b>X / Backspace</b>: Sell Tower</div>
          <div><b>Q / E / R</b>: Cast Abilities</div>
          <div><b>P / Esc</b>: Pause / Menu</div>
          <div><b>Tab / M</b>: Cycle Unit / Manager</div>
          <div><b>Alt</b>: All Tower Ranges</div>
          <div><b>Ctrl+Z</b>: Undo Placement</div>
          <div><b>F2</b>: Photo Mode</div>
        </div>
        <label class="set-row">
          <span>Mouse Edge Panning</span>
          <input type="checkbox" id="set-edgepan" ${s.edgePan ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
        <label class="set-row">
          <span>Invert Orbit Rotation</span>
          <input type="checkbox" id="set-invertorb" ${s.invertOrbit ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
      `;
      body.querySelector('#set-edgepan')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ edgePan: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-invertorb')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ invertOrbit: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
    } else if (this.activeTab === 'Accessibility') {
      body.innerHTML = `
        <label class="set-row">
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
        <div>
          <div style="display:flex;justify-content:space-between;font-size:15px;">
            <span>Text Size Scale (100–140%)</span>
            <span id="scale-val">${s.textScale ?? 100}%</span>
          </div>
          <input type="range" id="set-textscale" min="100" max="140" value="${s.textScale ?? 100}" style="width:100%;" />
        </div>
        <label class="set-row">
          <span>Colorblind Shapes on Rarities & Health Bars</span>
          <input type="checkbox" id="set-cb" ${s.colorblindMode ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
        <label class="set-row">
          <span>Flash Reduction (caps full-screen flashes at 40%)</span>
          <input type="checkbox" id="set-flash" ${s.flashReduction ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
      `;
      body.querySelector('#set-reduced')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ reducedMotion: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-shake')!.addEventListener('input', (e) => {
        const v = Number((e.target as HTMLInputElement).value) / 100;
        QualityManager.applySettings({ screenShake: v });
        body.querySelector('#shake-val')!.textContent = `${Math.round(v * 100)}%`;
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-textscale')!.addEventListener('input', (e) => {
        const v = Number((e.target as HTMLInputElement).value);
        QualityManager.applySettings({ textScale: v });
        body.querySelector('#scale-val')!.textContent = `${v}%`;
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-cb')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ colorblindMode: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-flash')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ flashReduction: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
    } else {
      body.innerHTML = `
        <div style="font-size:15px;">Export or restore your <b>Garden Bastion TD v4</b> save data via Base64 backup code.</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-green btn-sm" id="set-export">📋 Export Save Code</button>
          <button class="btn btn-gold btn-sm" id="set-import">📥 Import Save Code</button>
          <button class="btn btn-rose btn-sm" id="set-reset-save">🗑 Reset All Save Data</button>
        </div>
      `;
      body.querySelector('#set-export')!.addEventListener('click', () => {
        const b64 = SaveManager.exportSaveBase64();
        void navigator.clipboard?.writeText(b64);
        window.prompt('Copy your Base64 Save Backup:', b64);
      });
      body.querySelector('#set-import')!.addEventListener('click', () => {
        const code = window.prompt('Paste Base64 Save Backup:');
        if (code && SaveManager.importSaveBase64(code)) {
          EventBus.emit('toast:show', { title: 'Save imported cleanly!', color: '#4ade80' });
          this.render();
        } else if (code) {
          EventBus.emit('toast:show', { title: 'Invalid save backup code', color: '#f43f5e' });
        }
      });
      body.querySelector('#set-reset-save')!.addEventListener('click', () => {
        const typed = window.prompt('Type RESET to erase all Seeds, Units, Quests, and Stats:');
        if (typed === 'RESET') {
          SaveManager.resetSave();
          EventBus.emit('toast:show', { title: 'Save data reset', color: '#38bdf8' });
          this.render();
        }
      });
    }
  }
}
