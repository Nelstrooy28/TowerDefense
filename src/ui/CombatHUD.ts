import * as THREE from 'three';
import { MatchController } from '../simulation/MatchController';
import { InputManager } from '../core/InputManager';
import { Keybinds } from '../core/Keybinds';
import { SaveManager } from '../core/SaveManager';
import { TimeScale, type GameSpeed } from '../core/TimeScale';
import { QualityManager } from '../core/QualityManager';
import { EventBus } from '../core/EventBus';
import { getUnitById, getUnitRoleCategory } from '../data/UnitRegistry';
import { RARITIES } from '../data/RarityConfig';
import { TRAITS } from '../data/TraitConfig';
import { MODIFIER_FAMILIES, VARIANTS } from '../data/BalanceConfig';
import { ProceduralTextures } from '../rendering/ProceduralTextures';
import { SynthAudio } from '../audio/SynthAudio';
import { renderGardenIcon } from './GardenIcons';
import { TooltipManager } from './TooltipManager';
import { WavePreview } from './WavePreview';
import { InspectorPanel } from './InspectorPanel';
import { GardenManagerPanel } from './GardenManagerPanel';

export class CombatHUD {
  public root: HTMLDivElement;
  public wavePreview: WavePreview;
  public inspector: InspectorPanel;
  public gardenManager: GardenManagerPanel;

  private match: MatchController;
  private input: InputManager;
  private displayedCash = 0;

  private cashEl!: HTMLElement;
  private hpEl!: HTMLElement;
  private waveEl!: HTMLElement;
  private timelineEl!: HTMLDivElement;
  private modifiersBar!: HTMLDivElement;
  private modeBannerEl!: HTMLDivElement;
  private sandboxBar!: HTMLDivElement;
  private rivalBar!: HTMLDivElement;
  private killFeedEl!: HTMLDivElement;
  private skipBtn!: HTMLButtonElement;
  private autoSkipBtn!: HTMLButtonElement;
  private speedBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private muteBtn!: HTMLButtonElement;
  private dmgToggleBtn!: HTMLButtonElement;
  private hotbarRow!: HTMLDivElement;
  private abilityBar!: HTMLDivElement;
  private bossBar!: HTMLDivElement;
  private dmgMeterPanel!: HTMLDivElement;
  private managerBtn!: HTMLButtonElement;
  private presetBannerEl!: HTMLDivElement;
  private subtitleEl!: HTMLDivElement;
  private holdRingEl!: HTMLDivElement;
  private fxSvgEl!: SVGSVGElement;
  private altBadgePool: HTMLSpanElement[] = [];
  private subtitleTimer = 0;
  private readonly _proj = new THREE.Vector3();

  private activeBossMaxHp = 1;
  private activeBossMaxShield = 0;
  private tipShownThisMatch = false;

  constructor(
    parent: HTMLElement,
    match: MatchController,
    input: InputManager,
    onOpenPause: () => void,
    onExitToLobby: () => void
  ) {
    this.match = match;
    this.input = input;
    TooltipManager.init();

    this.root = document.createElement('div');
    this.root.className = 'hidden';
    this.root.innerHTML = `
      <div class="combat-top-unified">
        <div class="hud-group">
          <div class="stat-pill" id="hud-hp-pill" data-tooltip="Base Garden Health">
            <span class="heart-pulse" id="hud-heart">❤️</span>
            <span id="hud-hp-text" class="chunky-num">150 / 150</span>
          </div>
          <div class="stat-pill" id="hud-cash-pill" data-tooltip="Garden Cash for planting and upgrading">
            ${renderGardenIcon('cash', 18)} $<span id="hud-cash-text" class="chunky-num">600</span>
          </div>
          <div class="stat-pill" id="hud-wave-text">Wave 0 / 20</div>
          <button class="btn btn-gold btn-sm hidden" id="hud-skip-btn" data-tooltip="Start or skip wave early for bonus cash" data-tooltip-key="start_wave">Skip Wave</button>
        </div>

        <div class="hud-group">
          <button class="btn btn-slate btn-sm" id="hud-speed-btn" data-tooltip="Cycle match speed (1x / 2x / 3x)" data-tooltip-key="speed_cycle"></button>
          <button class="btn btn-slate btn-sm" id="hud-pause-btn" data-tooltip="Pause or resume simulation" data-tooltip-key="pause"></button>
          <button class="btn btn-slate btn-sm" id="hud-autoskip-btn">Auto-Skip: OFF</button>
          <button class="btn btn-slate btn-sm" id="hud-dmg-btn" data-tooltip="Toggle live Damage Meter">DPS</button>
          <button class="btn btn-slate btn-sm" id="hud-photo-btn" data-tooltip="Capture screenshot">📷</button>
          <button class="btn btn-slate btn-sm" id="hud-mute-btn" data-tooltip="Mute/Unmute sound">🔊</button>
          <button class="btn btn-slate btn-sm" id="hud-help-btn" data-tooltip="Match Quick Help">${renderGardenIcon('help', 16)}</button>
          <button class="btn btn-slate btn-sm" id="hud-settings-btn" data-tooltip="Open Pause Menu / Settings" data-tooltip-key="pause_menu">⚙ Menu</button>
          <button class="btn btn-rose btn-sm" id="hud-lobby-btn" data-tooltip="Return to Lobby Hub">Hub</button>
        </div>
      </div>

      <div class="wave-timeline-strip gloss-panel" id="hud-wave-timeline"></div>
      <div class="hud-modifiers-bar hidden" id="hud-modifiers-bar"></div>
      <div class="hud-mode-tip gloss-panel hidden" id="hud-mode-banner"></div>
      <div class="hud-sandbox-bar gloss-panel hidden" id="hud-sandbox-bar"></div>
      <div class="hud-rival-bar gloss-panel hidden" id="hud-rival-bar"></div>

      <div class="control-preset-toast paper-panel hidden" id="hud-preset-toast">
        <div style="font-size:14px;font-weight:800;color:#fde047;">⌨ Controls Updated for GTD Style!</div>
        <div style="font-size:14px;color:#cbd5e1;">Hold [E] or Shift+Click upgrades · [Q] cancels · [Z/C/V] fire abilities · [Tab] opens Manager. Keep new or switch?</div>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <button class="btn btn-green btn-sm" id="preset-keep-gtd">Use GTD Controls</button>
          <button class="btn btn-slate btn-sm" id="preset-use-classic">Use Classic Bastion</button>
        </div>
      </div>

      <div class="boss-bar-panel gloss-panel hidden" id="hud-boss-bar">
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;">
          <span id="boss-name-text">BLIGHTED TREANT OVERLORD</span>
          <span id="boss-hp-text" class="chunky-num">24,000 / 24,000</span>
        </div>
        <div class="boss-bar-track">
          <div class="boss-bar-hp" id="boss-hp-fill" style="width:100%"></div>
          <div class="boss-bar-shield" id="boss-shield-fill" style="width:0%"></div>
        </div>
        <div class="boss-stagger-track" title="Stagger Meter">
          <div class="boss-stagger-fill" id="boss-stagger-fill" style="width:0%"></div>
        </div>
      </div>

      <div class="damage-meter-panel gloss-panel hidden" id="hud-dmg-meter"></div>
      <div class="kill-feed" id="hud-kill-feed"></div>
      <div class="subtitle-banner gloss-panel hidden" id="hud-subtitles"></div>

      <div class="combat-bottom">
        <div class="ability-bar" id="hud-ability-bar"></div>
        <div style="display:flex;align-items:flex-end;gap:10px;">
          <div class="hotbar-row gloss-panel" id="hud-hotbar-row"></div>
          <button class="seed-pod-btn" id="hud-manager-btn" data-tooltip="Open GTD Unit Manager Drawer" data-tooltip-key="manager" style="min-height:56px;">
            ${renderGardenIcon('manager', 18)} Manager ${Keybinds.badge('manager')}
          </button>
        </div>
      </div>

      <div class="hold-progress-ring hidden" id="hud-hold-ring"></div>
      <svg id="hud-upgrade-fx-svg" style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:29;"></svg>
    `;
    parent.appendChild(this.root);

    this.wavePreview = new WavePreview(this.root, match);
    this.inspector = new InspectorPanel(this.root, match, input);
    this.gardenManager = new GardenManagerPanel(this.root, match, input);

    for (let i = 0; i < 40; i++) {
      const b = document.createElement('span');
      b.className = 'alt-target-badge hidden';
      this.root.appendChild(b);
      this.altBadgePool.push(b);
    }

    this.cashEl = this.root.querySelector('#hud-cash-text')!;
    this.hpEl = this.root.querySelector('#hud-hp-text')!;
    this.waveEl = this.root.querySelector('#hud-wave-text')!;
    this.timelineEl = this.root.querySelector('#hud-wave-timeline') as HTMLDivElement;
    this.modifiersBar = this.root.querySelector('#hud-modifiers-bar') as HTMLDivElement;
    this.modeBannerEl = this.root.querySelector('#hud-mode-banner') as HTMLDivElement;
    this.sandboxBar = this.root.querySelector('#hud-sandbox-bar') as HTMLDivElement;
    this.rivalBar = this.root.querySelector('#hud-rival-bar') as HTMLDivElement;
    this.killFeedEl = this.root.querySelector('#hud-kill-feed') as HTMLDivElement;
    this.skipBtn = this.root.querySelector('#hud-skip-btn') as HTMLButtonElement;
    this.autoSkipBtn = this.root.querySelector('#hud-autoskip-btn') as HTMLButtonElement;
    this.speedBtn = this.root.querySelector('#hud-speed-btn') as HTMLButtonElement;
    this.pauseBtn = this.root.querySelector('#hud-pause-btn') as HTMLButtonElement;
    this.muteBtn = this.root.querySelector('#hud-mute-btn') as HTMLButtonElement;
    this.dmgToggleBtn = this.root.querySelector('#hud-dmg-btn') as HTMLButtonElement;
    this.hotbarRow = this.root.querySelector('#hud-hotbar-row') as HTMLDivElement;
    this.abilityBar = this.root.querySelector('#hud-ability-bar') as HTMLDivElement;
    this.bossBar = this.root.querySelector('#hud-boss-bar') as HTMLDivElement;
    this.dmgMeterPanel = this.root.querySelector('#hud-dmg-meter') as HTMLDivElement;
    this.managerBtn = this.root.querySelector('#hud-manager-btn') as HTMLButtonElement;
    this.presetBannerEl = this.root.querySelector('#hud-preset-toast') as HTMLDivElement;
    this.subtitleEl = this.root.querySelector('#hud-subtitles') as HTMLDivElement;
    this.holdRingEl = this.root.querySelector('#hud-hold-ring') as HTMLDivElement;
    this.fxSvgEl = this.root.querySelector('#hud-upgrade-fx-svg') as unknown as SVGSVGElement;

    this.managerBtn.addEventListener('click', () => {
      this.gardenManager.toggle();
    });

    this.skipBtn.addEventListener('click', () => {
      SynthAudio.play('click');
      this.match.skipWave();
    });

    this.pauseBtn.addEventListener('click', () => {
      TimeScale.togglePause();
      SynthAudio.play('click');
    });

    this.speedBtn.addEventListener('click', () => {
      const next: GameSpeed = TimeScale.speed === 1 ? 2 : TimeScale.speed === 2 ? 3 : 1;
      TimeScale.setSpeed(next);
      this.refreshKeyBadges();
      SynthAudio.play('click');
    });

    this.autoSkipBtn.addEventListener('click', () => {
      this.match.autoSkip = !this.match.autoSkip;
      this.autoSkipBtn.textContent = `Auto-Skip: ${this.match.autoSkip ? 'ON' : 'OFF'}`;
      this.autoSkipBtn.classList.toggle('btn-green', this.match.autoSkip);
      this.autoSkipBtn.classList.toggle('btn-slate', !this.match.autoSkip);
      SynthAudio.play('click');
    });

    this.dmgToggleBtn.addEventListener('click', () => {
      QualityManager.settings.damageMeter = !QualityManager.settings.damageMeter;
      this.dmgMeterPanel.classList.toggle('hidden', !QualityManager.settings.damageMeter);
      SynthAudio.play('click');
    });

    this.root.querySelector('#hud-photo-btn')!.addEventListener('click', () => {
      this.match.engine.captureScreenshot();
      EventBus.emit('toast:show', { title: '📷 Screenshot Saved!', color: '#4ade80' });
    });

    this.muteBtn.addEventListener('click', () => {
      QualityManager.applySettings({ muted: !QualityManager.settings.muted });
      SynthAudio.syncVolume();
      this.muteBtn.textContent = QualityManager.settings.muted ? '🔇' : '🔊';
    });

    this.root.querySelector('#hud-help-btn')!.addEventListener('click', () => {
      TooltipManager.showHelpCard('Match Controls & Tips', [
        `Select slot keys [${Keybinds.getHint('hotbar_1')}–${Keybinds.getHint('hotbar_6')}] and click lawn/path/cliff to plant.`,
        `Upgrade: hold [${Keybinds.getHint('upgrade')}] or Shift+Click any planted unit!`,
        `Cancel placement: [${Keybinds.getHint('cancel')}] or Right-Click.`,
        `Rotate ghost: [${Keybinds.getHint('rotate')}] · Sell: [${Keybinds.getHint('sell')}] · Speed: [${Keybinds.getHint('speed_cycle')}].`,
        `Open Unit Manager for priority numbers & auto-upgrade queue: [${Keybinds.getHint('manager')}].`,
        `Hold [Alt] anytime to see all range circles and targeting tags! Hold [F1] for all hotkeys.`,
      ]);
    });

    this.root.querySelector('#hud-settings-btn')!.addEventListener('click', onOpenPause);
    this.root.querySelector('#hud-lobby-btn')!.addEventListener('click', onExitToLobby);

    this.root.querySelector('#preset-keep-gtd')!.addEventListener('click', () => {
      Keybinds.markPromptSeen();
      SaveManager.save();
      this.presetBannerEl.classList.add('hidden');
    });
    this.root.querySelector('#preset-use-classic')!.addEventListener('click', () => {
      Keybinds.setPreset('classic');
      SaveManager.save();
      this.presetBannerEl.classList.add('hidden');
    });

    EventBus.on('keybinds:changed', () => {
      this.refreshKeyBadges();
      this.refreshHotbar();
    });

    EventBus.on('match:paused_changed', () => this.refreshKeyBadges());
    EventBus.on('match:killfeed', ({ text, color }) => this.pushKillFeed(text, color));
    EventBus.on('match:mode_tip', ({ text }) => {
      this.modeBannerEl.textContent = `💡 ${text}`;
      this.modeBannerEl.classList.remove('hidden');
      setTimeout(() => this.modeBannerEl.classList.add('hidden'), 6500);
    });
    EventBus.on('ui:subtitle', ({ speaker, text, duration }) => {
      if (QualityManager.settings.subtitlesEnabled === false) return;
      this.subtitleEl.innerHTML = `<strong style="color:#fde047;">[${speaker}]</strong> ${text}`;
      this.subtitleEl.classList.remove('hidden');
      this.subtitleTimer = duration ?? 2.4;
    });
    EventBus.on('ui:hold_progress', ({ active, progress, label, x, y }) => {
      if (!active || !this.match.inMatch) {
        this.holdRingEl.classList.add('hidden');
        return;
      }
      this.holdRingEl.classList.remove('hidden');
      this.holdRingEl.style.left = `${x}px`;
      this.holdRingEl.style.top = `${y}px`;
      const pct = Math.round(progress * 100);
      this.holdRingEl.style.background = `conic-gradient(#4ade80 ${pct}%, rgba(15,23,42,0.75) 0%)`;
      this.holdRingEl.textContent = label;
    });
    EventBus.on('tower:upgrade_fx_line', ({ towerId, fromX, fromY }) => {
      const tw = this.match.towers.find((t) => t.id === towerId);
      if (!tw) return;
      this._proj.copy(tw.position).add(new THREE.Vector3(0, 0.8, 0)).project(this.match.engine.cameraRig.camera);
      if (this._proj.z > 1) return;
      const toX = (this._proj.x * 0.5 + 0.5) * window.innerWidth;
      const toY = (-this._proj.y * 0.5 + 0.5) * window.innerHeight;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', `${fromX}`);
      line.setAttribute('y1', `${fromY}`);
      line.setAttribute('x2', `${toX}`);
      line.setAttribute('y2', `${toY}`);
      line.setAttribute('stroke', '#4ade80');
      line.setAttribute('stroke-width', '3');
      line.setAttribute('stroke-dasharray', '6 4');
      this.fxSvgEl.appendChild(line);
      setTimeout(() => line.remove(), 380);
    });

    EventBus.on('match:survival_hp', ({ hp, maxHp, dashCd, splashCd }) => {
      if (this.match.gameMode === 'survival') {
        this.hpEl.textContent = `🧑‍🌾 ${hp}/${maxHp} | Dash ${dashCd > 0 ? `${dashCd.toFixed(1)}s` : 'READY'} | Splash ${splashCd > 0 ? `${splashCd.toFixed(1)}s` : 'READY'}`;
      }
    });
    EventBus.on('match:rival_state', () => this.refreshModePanels());

    EventBus.on('match:boss_spawned', ({ name, maxHp, maxShield }) => {
      this.activeBossMaxHp = maxHp;
      this.activeBossMaxShield = maxShield;
      this.root.querySelector('#boss-name-text')!.textContent = name.toUpperCase();
      this.bossBar.classList.remove('hidden');
    });

    EventBus.on('match:boss_defeated', () => {
      this.bossBar.classList.add('hidden');
    });

    EventBus.on('match:cash_changed', ({ delta }) => {
      const pill = this.root.querySelector('#hud-cash-pill')!;
      if (delta > 0) {
        pill.classList.remove('cash-pulse');
        void (pill as HTMLElement).offsetWidth;
        pill.classList.add('cash-pulse');
      }
      this.refreshHotbar();
      this.inspector.render();
    });

    EventBus.on('match:insufficient_cash', () => {
      const pill = this.root.querySelector('#hud-cash-pill')!;
      pill.classList.remove('cash-shake');
      void (pill as HTMLElement).offsetWidth;
      pill.classList.add('cash-shake');
    });

    EventBus.on('match:base_hp_changed', ({ hp, maxHp, delta }) => {
      if (this.match.gameMode !== 'survival') this.hpEl.textContent = `${hp} / ${maxHp}`;
      const heart = this.root.querySelector('#hud-heart')!;
      heart.textContent = hp < maxHp * 0.5 ? '💔' : '❤️';
      heart.classList.toggle('heart-fast', hp > 0 && hp < maxHp * 0.25);
      if (delta < 0) {
        this.root.querySelector('#hud-hp-pill')!.classList.add('cash-shake');
      }
    });

    EventBus.on('match:state_changed', () => this.refreshAll());
    EventBus.on('tower:selected', () => this.inspector.render());
    EventBus.on('placement:slot_selected', () => this.refreshHotbar());
  }

  private refreshKeyBadges(): void {
    this.speedBtn.innerHTML = `${renderGardenIcon('speed', 16)} ${TimeScale.speed}x ${Keybinds.badge('speed_cycle')}`;
    this.pauseBtn.innerHTML = TimeScale.paused
      ? `${renderGardenIcon('play', 16)} Resume ${Keybinds.badge('pause')}`
      : `${renderGardenIcon('pause', 16)} Pause ${Keybinds.badge('pause')}`;
    this.pauseBtn.classList.toggle('btn-gold', TimeScale.paused);
    this.pauseBtn.classList.toggle('btn-slate', !TimeScale.paused);
    this.managerBtn.innerHTML = `${renderGardenIcon('manager', 18)} Manager ${Keybinds.badge('manager')}`;
  }

  private pushKillFeed(text: string, color = '#f8fafc'): void {
    const item = document.createElement('div');
    item.className = 'kill-feed-item';
    item.style.color = color;
    item.textContent = text;
    this.killFeedEl.appendChild(item);
    while (this.killFeedEl.children.length > 4) {
      this.killFeedEl.firstElementChild?.remove();
    }
    setTimeout(() => item.remove(), 3000);
  }

  public show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
    this.wavePreview.show(visible);
    if (!visible) {
      this.gardenManager.setOpen(false);
      this.presetBannerEl.classList.add('hidden');
      this.holdRingEl.classList.add('hidden');
      for (const b of this.altBadgePool) b.classList.add('hidden');
    } else {
      this.displayedCash = this.match.cash;
      this.bossBar.classList.add('hidden');
      this.killFeedEl.innerHTML = '';
      this.refreshAll();
      if (!Keybinds.isPromptSeen() && Object.keys(SaveManager.data.owned).length >= 2) {
        this.presetBannerEl.classList.remove('hidden');
        setTimeout(() => {
          this.presetBannerEl.classList.add('hidden');
          Keybinds.markPromptSeen();
        }, 9000);
      }
      if (!this.tipShownThisMatch && !this.match.tryUnitMode) {
        this.tipShownThisMatch = true;
        const tipText =
          SaveManager.data.stats.matchesWon === 0
            ? 'Hold [E] or Shift+Click any planted tower for quick upgrades!'
            : `Tip: Press [${Keybinds.getHint('manager')}] to prioritize which units auto-upgrade first!`;
        this.modeBannerEl.textContent = `💡 ${tipText}`;
        this.modeBannerEl.classList.remove('hidden');
        setTimeout(() => this.modeBannerEl.classList.add('hidden'), 6000);
      }
    }
  }

  public refreshAll(): void {
    if (!this.match.inMatch) return;
    if (this.match.gameMode !== 'survival') {
      this.hpEl.textContent = `${this.match.baseHp} / ${this.match.maxBaseHp}`;
    }
    this.waveEl.textContent = this.match.tryUnitMode
      ? `Try Mode (${Math.ceil(this.match.tryUnitTimer)}s)`
      : this.match.isEndless
        ? `Endless Wave ${this.match.currentWave}`
        : `Wave ${this.match.currentWave} / ${this.match.totalWaves}`;
    this.muteBtn.textContent = QualityManager.settings.muted ? '🔇' : '🔊';
    this.refreshKeyBadges();
    this.refreshModifiersBar();
    this.refreshModePanels();
    this.refreshWaveTimeline();
    this.refreshHotbar();
    this.wavePreview.update();
    this.inspector.render();
    this.gardenManager.render();
  }

  private refreshModifiersBar(): void {
    const entries = Object.entries(this.match.activeModifiers).filter(([, lvl]) => lvl > 0);
    if (entries.length === 0) {
      this.modifiersBar.classList.add('hidden');
      return;
    }
    this.modifiersBar.classList.remove('hidden');
    this.modifiersBar.innerHTML = entries
      .map(([id, lvl]) => {
        const fam = MODIFIER_FAMILIES.find((f) => f.id === id);
        if (!fam) return '';
        return `<span class="mod-chip" data-tooltip="${fam.name} Lv.${lvl}: ${fam.effectDescriptions[lvl - 1]}">${fam.icon} ${fam.name} ${lvl}</span>`;
      })
      .join('');
  }

  private refreshModePanels(): void {
    if (this.match.gameMode === 'sandbox' && !this.match.tryUnitMode) {
      this.sandboxBar.classList.remove('hidden');
      this.sandboxBar.innerHTML = `
        <span style="font-size:14px;font-weight:800;color:#fbbf24;">🛠 Sandbox</span>
        <button class="btn btn-sm ${this.match.sandboxInfiniteCash ? 'btn-green' : 'btn-slate'}" id="sb-inf">∞ Cash</button>
        <button class="btn btn-sm ${this.match.sandboxBaseGodMode ? 'btn-green' : 'btn-slate'}" id="sb-god">Base God</button>
        <button class="btn btn-sm btn-slate" id="sb-ant">+5 Ants</button>
        <button class="btn btn-sm btn-slate" id="sb-boss">+Boss</button>
        <button class="btn btn-sm btn-gold" id="sb-w10">Wave 10</button>
      `;
      this.sandboxBar.querySelector('#sb-inf')!.addEventListener('click', () => {
        this.match.sandboxInfiniteCash = !this.match.sandboxInfiniteCash;
        this.refreshModePanels();
      });
      this.sandboxBar.querySelector('#sb-god')!.addEventListener('click', () => {
        this.match.sandboxBaseGodMode = !this.match.sandboxBaseGodMode;
        this.refreshModePanels();
      });
      this.sandboxBar.querySelector('#sb-ant')!.addEventListener('click', () => this.match.sandboxSpawnEnemy('garden_ant', 5));
      this.sandboxBar.querySelector('#sb-boss')!.addEventListener('click', () => this.match.sandboxSpawnEnemy(this.match.mapDef.bossId, 1));
      this.sandboxBar.querySelector('#sb-w10')!.addEventListener('click', () => this.match.sandboxJumpToWave(10));
    } else {
      this.sandboxBar.classList.add('hidden');
    }

    if (this.match.gameMode === 'rival') {
      this.rivalBar.classList.remove('hidden');
      this.rivalBar.innerHTML = `
        <span style="font-size:14px;font-weight:800;">⚔ Rival HP: ${this.match.rivalHp}/${this.match.rivalMaxHp} | Score ${this.match.playerWaveScore} vs ${this.match.rivalWaveScore}</span>
        <button class="btn btn-sm btn-gold" id="rv-send-mouse">Send Mouse ($120)</button>
        <button class="btn btn-sm btn-rose" id="rv-send-beetle">Send Beetle ($240)</button>
      `;
      this.rivalBar.querySelector('#rv-send-mouse')!.addEventListener('click', () => this.match.sendRivalEnemy('pocket_mouse', 120));
      this.rivalBar.querySelector('#rv-send-beetle')!.addEventListener('click', () => this.match.sendRivalEnemy('iron_beetle', 240));
    } else {
      this.rivalBar.classList.add('hidden');
    }
  }

  private refreshWaveTimeline(): void {
    const items: string[] = [];
    for (let offset = 1; offset <= 5; offset++) {
      const w = this.match.currentWave + offset;
      if (!this.match.isEndless && w > this.match.totalWaves) break;
      const isBoss =
        this.match.gameMode === 'boss_rush'
          ? w % 2 === 0
          : !this.match.isEndless && w === this.match.totalWaves;
      const isMini = w % 10 === 0 && !isBoss;
      const icon = isBoss ? '💀' : isMini ? '👑' : w >= 12 ? '⚡' : '🐜';
      items.push(`<span style="color:${isBoss ? '#f43f5e' : isMini ? '#fde047' : '#e2e8f0'};">W${w} ${icon}</span>`);
    }
    this.timelineEl.innerHTML =
      items.length > 0 ? `<span>Upcoming:</span> ${items.join(' • ')}` : `<span>Final Wave!</span>`;
  }

  public refreshHotbar(): void {
    const loadout = SaveManager.data.loadout;
    const slotKeys = ['hotbar_1', 'hotbar_2', 'hotbar_3', 'hotbar_4', 'hotbar_5', 'hotbar_6'] as const;

    this.hotbarRow.innerHTML = loadout
      .map((uId, idx) => {
        const keyTxt = Keybinds.getHint(slotKeys[idx]) || `${idx + 1}`;
        if (!uId) {
          return `<div class="hotbar-card" style="opacity:0.35;cursor:default;"><span class="hotbar-hotkey">${keyTxt}</span><div style="margin:auto;">Empty</div></div>`;
        }
        const unit = getUnitById(uId);
        const owned = SaveManager.data.owned[uId];
        const placed = this.match.getUnitPlacedCount(uId);
        const capReached = placed >= unit.cap;
        const hex = RARITIES[unit.rarity].hex;
        const cb = QualityManager.settings.colorblindMode ? RARITIES[unit.rarity].symbolChar : '';
        const portrait = ProceduralTextures.getUnitPortraitUrl(uId);
        const isActive = this.input.activeSlotIndex === idx;
        const effectiveCost = Math.round((unit.cost * this.match.modifierEffects.towerCostMult) / 5) * 5;
        const cantAfford = (!this.match.sandboxInfiniteCash && this.match.cash < effectiveCost) || capReached;
        const varId = owned?.variant ?? 'none';
        const varTag = varId !== 'none' ? ` · ${VARIANTS[varId].label}` : '';
        const roleCat = getUnitRoleCategory(unit);
        const lv0 = unit.levels[0];
        const dps0 = lv0.cd > 0 ? Math.round((lv0.dmg * Math.max(1, lv0.projectiles)) / lv0.cd) : 0;

        return `
          <button class="hotbar-card rarity-frame-${unit.rarity} ${isActive ? 'active' : ''} ${cantAfford ? 'unaffordable' : 'affordable-glow'}"
            data-slot="${idx}"
            data-tooltip-title="${unit.name}"
            data-tooltip="${roleCat} (${unit.terrain})${unit.canHitFlying ? ' · Anti-Air' : ''}"
            data-tooltip-shift="DPS ${dps0} · Range ${lv0.range} · Lv5 Max Dmg ${unit.dmgMax}${varTag}"
            data-tooltip-key="${slotKeys[idx]}"
            style="border-color:${hex};">
            <span class="hotbar-hotkey">${keyTxt}</span>
            <span class="card-cost-top">$${effectiveCost}</span>
            <img src="${portrait}" alt="${unit.name}" style="width:48px;height:48px;border-radius:8px;border:2px solid ${hex};margin-top:6px;" />
            <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${cb}${unit.name.split(' ')[0]}</div>
            <div style="font-size:14px;display:flex;justify-content:space-between;width:100%;align-items:center;">
              <span style="color:${owned ? TRAITS[owned.trait].color : '#94a3b8'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${owned?.trait?.split(' ')[0] ?? ''}</span>
              <span style="color:${capReached ? '#fb7185' : '#e2e8f0'};font-weight:800;">${capReached ? '🔒' : ''}${placed}/${unit.cap}</span>
            </div>
          </button>
        `;
      })
      .join('');

    this.hotbarRow.querySelectorAll('[data-slot]').forEach((btn) => {
      const el = btn as HTMLElement;
      el.addEventListener('click', () => {
        const slot = Number(el.dataset.slot);
        this.input.selectSlot(this.input.activeSlotIndex === slot ? null : slot);
        SynthAudio.play('click');
      });
      el.addEventListener('mousemove', (ev) => {
        if (QualityManager.settings.reducedMotion) return;
        const r = el.getBoundingClientRect();
        const rx = ((ev.clientY - r.top) / r.height - 0.5) * -12;
        const ry = ((ev.clientX - r.left) / r.width - 0.5) * 12;
        el.style.transform = `translateY(-6px) perspective(400px) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  public updateFrame(dt: number): void {
    if (!this.match.inMatch) return;

    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) this.subtitleEl.classList.add('hidden');
    }

    if (Math.abs(this.displayedCash - this.match.cash) > 0.5) {
      this.displayedCash += (this.match.cash - this.displayedCash) * Math.min(1, dt * 16);
      this.cashEl.textContent = `${Math.round(this.displayedCash).toLocaleString()}`;
    } else if (this.displayedCash !== this.match.cash) {
      this.displayedCash = this.match.cash;
      this.cashEl.textContent = `${this.match.cash.toLocaleString()}`;
    }

    if (this.match.tryUnitMode) {
      this.waveEl.textContent = `Try Mode (${Math.max(0, Math.ceil(this.match.tryUnitTimer))}s)`;
    }

    const waveKeyHtml = Keybinds.badge('start_wave');
    if (!this.match.waveActive) {
      this.skipBtn.classList.remove('hidden');
      this.skipBtn.innerHTML = `Start Wave ${this.match.currentWave + 1} (${Math.ceil(this.match.waveCountdown)}s) ${waveKeyHtml}`;
    } else if (this.match.skipBonusAvailable) {
      this.skipBtn.classList.remove('hidden');
      this.skipBtn.innerHTML = `Skip [+ $${this.match.getEarlySkipBonus()}] ${waveKeyHtml}`;
    } else {
      this.skipBtn.classList.add('hidden');
    }

    const boss = this.match.enemies.find((e) => !e.isDead && e.def.isBoss);
    if (boss) {
      this.bossBar.classList.remove('hidden');
      const hpPct = Math.max(0, (boss.hp / Math.max(1, this.activeBossMaxHp)) * 100);
      const shPct = this.activeBossMaxShield > 0 ? Math.max(0, (boss.armor / this.activeBossMaxShield) * 100) : 0;
      const stagPct = boss.staggerMax > 0 ? Math.min(100, (boss.staggerValue / boss.staggerMax) * 100) : 0;
      (this.root.querySelector('#boss-hp-fill') as HTMLElement).style.width = `${hpPct}%`;
      (this.root.querySelector('#boss-shield-fill') as HTMLElement).style.width = `${shPct}%`;
      (this.root.querySelector('#boss-stagger-fill') as HTMLElement).style.width = `${stagPct}%`;
      this.root.querySelector('#boss-hp-text')!.textContent =
        boss.staggerTimer > 0
          ? `STAGGERED (${boss.staggerTimer.toFixed(1)}s)`
          : `${Math.round(boss.hp).toLocaleString()} / ${this.activeBossMaxHp.toLocaleString()}`;
    }

    const abilityTowers = this.match.towers.filter((t) => t.def.ability && t.level >= 4);
    const abKeys: Array<'ability_1' | 'ability_2' | 'ability_3'> = ['ability_1', 'ability_2', 'ability_3'];
    this.abilityBar.innerHTML = abilityTowers
      .slice(0, 3)
      .map((t, i) => {
        const ab = t.def.ability!;
        const ready = t.isAbilityReady();
        const cdStr = ready ? 'READY' : `${t.abilityCooldownRemaining.toFixed(1)}s`;
        return `
          <button class="ability-btn ${ready ? 'ready ability-ready-ring' : ''}" data-ab-idx="${i}">
            ${Keybinds.badge(abKeys[i])} ⚡ ${ab.name} (${cdStr})
          </button>
        `;
      })
      .join('');

    this.abilityBar.querySelectorAll('[data-ab-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number((btn as HTMLElement).dataset.abIdx);
        if (abilityTowers[idx]) {
          this.match.abilities.activate(abilityTowers[idx], this.match.towers, this.match.enemies);
        }
      });
    });

    // Hold Alt targeting badges over placed towers
    for (let i = 0; i < this.altBadgePool.length; i++) {
      const badge = this.altBadgePool[i];
      if (!this.input.altOverlayActive || i >= this.match.towers.length) {
        badge.classList.add('hidden');
        continue;
      }
      const tw = this.match.towers[i];
      this._proj.set(tw.position.x, tw.position.y + 1.9, tw.position.z).project(this.match.engine.cameraRig.camera);
      if (this._proj.z > 1) {
        badge.classList.add('hidden');
        continue;
      }
      const sx = (this._proj.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-this._proj.y * 0.5 + 0.5) * window.innerHeight;
      badge.textContent = `${tw.targeting} · Lv.${tw.level}`;
      badge.style.left = `${sx.toFixed(0)}px`;
      badge.style.top = `${sy.toFixed(0)}px`;
      badge.classList.remove('hidden');
    }

    if (QualityManager.settings.damageMeter) {
      const sorted = [...this.match.towers].sort((a, b) => b.totalDamageDealt - a.totalDamageDealt).slice(0, 6);
      const topDmg = Math.max(1, sorted[0]?.totalDamageDealt ?? 1);
      this.dmgMeterPanel.innerHTML =
        `<div style="font-size:15px;font-weight:800;margin-bottom:6px;">Damage Meter</div>` +
        (sorted.length === 0
          ? `<div style="font-size:14px;color:#94a3b8;">No towers placed</div>`
          : sorted
              .map((t) => {
                const pct = Math.round((t.totalDamageDealt / topDmg) * 100);
                return `
                  <div style="margin-bottom:6px;font-size:14px;">
                    <div style="display:flex;justify-content:space-between;">
                      <span>${t.def.name}</span>
                      <span>${t.totalDamageDealt.toLocaleString()}</span>
                    </div>
                    <div style="height:6px;background:rgba(255,255,255,0.12);border-radius:999px;overflow:hidden;">
                      <div style="height:100%;width:${pct}%;background:#4ade80;"></div>
                    </div>
                  </div>
                `;
              })
              .join(''));
    }
  }
}
