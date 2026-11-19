import { QualityManager, type QualityTier } from '../core/QualityManager';
import { SaveManager } from '../core/SaveManager';
import { KEY_ACTION_META, Keybinds, type KeyAction, type KeyPresetId } from '../core/Keybinds';
import { InputActions } from '../core/InputActions';
import { SynthAudio } from '../audio/SynthAudio';
import { EventBus } from '../core/EventBus';

type SettingsTab = 'Game' | 'Graphics' | 'Audio' | 'Controls' | 'Accessibility' | 'Save';

export class SettingsModal {
  public root: HTMLDivElement;
  private activeTab: SettingsTab = 'Game';
  private rebindTarget: { action: KeyAction; slotIndex: 0 | 1 } | null = null;
  private conflictState: {
    targetAction: KeyAction;
    targetSlot: 0 | 1;
    newBinding: string;
    conflictAction: KeyAction;
    conflictSlot: 0 | 1;
    conflictLabel: string;
  } | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'modal-backdrop hidden';
    this.root.innerHTML = `
      <div class="modal-card paper-panel" style="width:760px;">
        <div class="modal-header">
          <div style="font-size:22px;font-weight:800;">⚙ Watering Can Settings</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span id="set-saved-tick" style="font-size:14px;color:#4ade80;font-weight:700;opacity:0;transition:opacity 0.2s;">🌿 Saved</span>
            <button class="btn btn-rose btn-sm" id="set-close">Back ${Keybinds.badge('cancel')}</button>
          </div>
        </div>
        <div class="leaf-tab-row" id="set-tabs" style="padding:8px 18px 0;"></div>
        <div class="modal-body" id="set-body"></div>
      </div>
    `;
    parent.appendChild(this.root);
    this.root.querySelector('#set-close')!.addEventListener('click', () => this.close());
    EventBus.on('keybinds:changed', () => {
      if (!this.root.classList.contains('hidden') && this.activeTab === 'Controls') this.render();
    });
  }

  public open(initialTab?: SettingsTab): void {
    if (initialTab) this.activeTab = initialTab;
    this.rebindTarget = null;
    this.conflictState = null;
    this.root.classList.remove('hidden');
    this.render();
    SynthAudio.play('click');
  }

  public close(): void {
    InputActions.cancelCapture();
    this.rebindTarget = null;
    this.conflictState = null;
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
        InputActions.cancelCapture();
        this.rebindTarget = null;
        this.conflictState = null;
        this.activeTab = (btn as HTMLElement).dataset.setTab as SettingsTab;
        SynthAudio.play('click');
        this.render();
      });
    });

    const tiers: QualityTier[] = ['Low', 'Medium', 'High', 'Ultra'];

    if (this.activeTab === 'Game') {
      const dmgMode = s.damageNumberMode ?? 'all';
      const cashReserve = s.cashReserve ?? 0;
      body.innerHTML = `
        <label class="set-row">
          <span>Default Auto-Skip Waves</span>
          <input type="checkbox" id="set-autoskip" ${s.autoSkipDefault ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
        <div class="set-row">
          <span>Damage Numbers Mode</span>
          <select id="set-dmgmode" class="paper-select" style="font-size:14px;">
            <option value="all" ${dmgMode === 'all' ? 'selected' : ''}>All Hits</option>
            <option value="big" ${dmgMode === 'big' ? 'selected' : ''}>Big Crits & Skills Only</option>
            <option value="off" ${dmgMode === 'off' ? 'selected' : ''}>Off</option>
          </select>
        </div>
        <label class="set-row">
          <span>Auto-Upgrade Queue Default ON</span>
          <input type="checkbox" id="set-autoupg" ${s.autoUpgradeDefault ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
        <div class="set-row">
          <span>Default Auto-Upgrade Cash Reserve ($0–$5000)</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span id="set-res-lbl" style="font-weight:800;">$${cashReserve}</span>
            <input type="range" id="set-cashres" min="0" max="5000" step="100" value="${cashReserve}" style="width:140px;" />
          </div>
        </div>
        <label class="set-row">
          <span>Pause Simulation While Unit Manager Open</span>
          <input type="checkbox" id="set-pausemgr" ${s.pauseWhileManagerOpen ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
        <label class="set-row">
          <span>Start in Fast Wooden Sign Menu (skip walking Plaza)</span>
          <input type="checkbox" id="set-fastmenu" ${s.startInFastMenu ? 'checked' : ''} style="width:20px;height:20px;" />
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
          <span>Fast Summon Animations</span>
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
      body.querySelector('#set-dmgmode')!.addEventListener('change', (e) => {
        const mode = (e.target as HTMLSelectElement).value as 'all' | 'big' | 'off';
        QualityManager.applySettings({ damageNumberMode: mode, showDamageNumbers: mode !== 'off' });
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-autoupg')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ autoUpgradeDefault: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-cashres')!.addEventListener('input', (e) => {
        const v = Number((e.target as HTMLInputElement).value);
        QualityManager.applySettings({ cashReserve: v });
        body.querySelector('#set-res-lbl')!.textContent = `$${v}`;
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-pausemgr')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ pauseWhileManagerOpen: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-fastmenu')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ startInFastMenu: (e.target as HTMLInputElement).checked });
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
      const curPreset = Keybinds.getPreset();
      const presets: Array<{ id: KeyPresetId; label: string }> = [
        { id: 'gtd', label: 'GTD (Default)' },
        { id: 'classic', label: 'Classic Bastion' },
        { id: 'left_hand', label: 'Left Hand' },
      ];
      const conflictHtml = this.conflictState
        ? `<div class="gloss-panel" style="padding:10px;border-color:#ef4444;background:rgba(127,29,29,0.5);display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:14px;">
            <span>⚠ <b>${Keybinds.formatBinding(this.conflictState.newBinding)}</b> conflicts with "${this.conflictState.conflictLabel}".</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-gold btn-sm" id="set-swap-conflict">Swap?</button>
              <button class="btn btn-slate btn-sm" id="set-dismiss-conflict">Cancel</button>
            </div>
          </div>`
        : '';

      const rowsHtml = KEY_ACTION_META.filter((m) => m.rebindable !== false)
        .map((m) => {
          const slots = Keybinds.getSlots(m.action);
          const slotBtn = (slotIdx: 0 | 1) => {
            const listening =
              this.rebindTarget?.action === m.action && this.rebindTarget.slotIndex === slotIdx;
            const txt = listening ? 'Press key...' : Keybinds.formatBinding(slots[slotIdx]);
            return `<button class="btn btn-sm ${listening ? 'btn-gold' : 'btn-slate'}" data-rebind="${m.action}" data-slot="${slotIdx}" style="min-width:96px;">${txt}</button>`;
          };
          return `
            <div style="display:grid;grid-template-columns:1.2fr 1fr auto auto;gap:6px;align-items:center;font-size:14px;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.08);">
              <span><b>${m.label}</b> <span style="color:#94a3b8;">(${m.category})</span></span>
              <span></span>
              ${slotBtn(0)}
              ${slotBtn(1)}
            </div>
          `;
        })
        .join('');

      body.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <div class="leaf-tab-row">
            ${presets
              .map(
                (p) =>
                  `<button class="leaf-tab-btn ${curPreset === p.id ? 'active' : ''}" data-preset-id="${p.id}">${p.label}</button>`
              )
              .join('')}
          </div>
          <button class="btn btn-rose btn-sm" id="set-reset-keys">↺ Reset to Preset</button>
        </div>
        ${conflictHtml}
        <div style="max-height:240px;overflow-y:auto;background:rgba(15,23,42,0.55);border-radius:10px;padding:6px;">
          ${rowsHtml}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <label class="set-row">
            <span>Hold to Sell (0.4 s)</span>
            <input type="checkbox" id="set-holdsell" ${s.holdToSell ? 'checked' : ''} style="width:20px;height:20px;" />
          </label>
          <label class="set-row">
            <span>Hold to Interact</span>
            <input type="checkbox" id="set-holdint" ${s.holdToInteract ? 'checked' : ''} style="width:20px;height:20px;" />
          </label>
          <label class="set-row">
            <span>Mouse Edge Panning</span>
            <input type="checkbox" id="set-edgepan" ${s.edgePan ? 'checked' : ''} style="width:20px;height:20px;" />
          </label>
          <label class="set-row">
            <span>Invert Orbit Rotation</span>
            <input type="checkbox" id="set-invertorb" ${s.invertOrbit ? 'checked' : ''} style="width:20px;height:20px;" />
          </label>
        </div>
      `;

      body.querySelectorAll('[data-preset-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Keybinds.setPreset((btn as HTMLElement).dataset.presetId as KeyPresetId);
          SaveManager.data.settings.keybinds = QualityManager.settings.keybinds;
          SaveManager.save();
          this.conflictState = null;
          this.render();
        });
      });

      body.querySelector('#set-reset-keys')!.addEventListener('click', () => {
        Keybinds.resetToPreset();
        SaveManager.data.settings.keybinds = QualityManager.settings.keybinds;
        SaveManager.save();
        this.conflictState = null;
        this.render();
      });

      body.querySelector('#set-swap-conflict')?.addEventListener('click', () => {
        if (!this.conflictState) return;
        const c = this.conflictState;
        Keybinds.swapBinding(c.targetAction, c.targetSlot, c.conflictAction, c.conflictSlot, c.newBinding);
        SaveManager.data.settings.keybinds = QualityManager.settings.keybinds;
        SaveManager.save();
        this.conflictState = null;
        this.flashSavedTick();
        this.render();
      });
      body.querySelector('#set-dismiss-conflict')?.addEventListener('click', () => {
        this.conflictState = null;
        this.render();
      });

      body.querySelectorAll('[data-rebind]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = (btn as HTMLElement).dataset.rebind as KeyAction;
          const slotIndex = Number((btn as HTMLElement).dataset.slot) as 0 | 1;
          this.rebindTarget = { action, slotIndex };
          this.conflictState = null;
          this.render();
          InputActions.startCapture((combo) => {
            this.rebindTarget = null;
            const conflicts = Keybinds.findConflicts(combo, action);
            if (conflicts.length > 0) {
              this.conflictState = {
                targetAction: action,
                targetSlot: slotIndex,
                newBinding: combo,
                conflictAction: conflicts[0].action,
                conflictSlot: conflicts[0].slotIndex,
                conflictLabel: conflicts[0].label,
              };
            } else {
              Keybinds.setSlot(action, slotIndex, combo);
              SaveManager.data.settings.keybinds = QualityManager.settings.keybinds;
              SaveManager.save();
              this.flashSavedTick();
            }
            this.render();
          });
        });
      });

      body.querySelector('#set-holdsell')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ holdToSell: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-holdint')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ holdToInteract: (e.target as HTMLInputElement).checked });
        SaveManager.save();
        this.flashSavedTick();
      });
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
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div style="display:flex;justify-content:space-between;font-size:15px;">
              <span>Text Size Scale (100–140%)</span>
              <span id="scale-val">${s.textScale ?? 100}%</span>
            </div>
            <input type="range" id="set-textscale" min="100" max="140" value="${s.textScale ?? 100}" style="width:100%;" />
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:15px;">
              <span>HUD UI Scale (80–120%)</span>
              <span id="uiscale-val">${s.uiScale ?? 100}%</span>
            </div>
            <input type="range" id="set-uiscale" min="80" max="120" value="${s.uiScale ?? 100}" style="width:100%;" />
          </div>
        </div>
        <label class="set-row">
          <span>Boss &amp; Ability Subtitles</span>
          <input type="checkbox" id="set-subtitles" ${s.subtitlesEnabled !== false ? 'checked' : ''} style="width:20px;height:20px;" />
        </label>
        <label class="set-row">
          <span>Colorblind Shapes on Rarities &amp; Health Bars</span>
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
      body.querySelector('#set-uiscale')!.addEventListener('input', (e) => {
        const v = Number((e.target as HTMLInputElement).value);
        QualityManager.applySettings({ uiScale: v });
        body.querySelector('#uiscale-val')!.textContent = `${v}%`;
        SaveManager.save();
        this.flashSavedTick();
      });
      body.querySelector('#set-subtitles')!.addEventListener('change', (e) => {
        QualityManager.applySettings({ subtitlesEnabled: (e.target as HTMLInputElement).checked });
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
        <div style="font-size:15px;">Export or restore your <b>Garden Bastion TD v5</b> save data via Base64 backup code.</div>
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
