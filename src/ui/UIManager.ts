import { MatchController } from '../simulation/MatchController';
import { InputManager } from '../core/InputManager';
import { SaveManager } from '../core/SaveManager';
import { EventBus } from '../core/EventBus';
import { QualityManager } from '../core/QualityManager';
import { TimeScale } from '../core/TimeScale';
import { InputActions } from '../core/InputActions';
import { Keybinds } from '../core/Keybinds';
import { MAPS, type DifficultyId, type MapId } from '../data/MapRegistry';
import {
  CURRENT_VERSION,
  DIFFICULTY_LADDER,
  computeModifierEffects,
} from '../data/BalanceConfig';
import {
  GARDEN_PUZZLES,
  MODE_CATALOG,
  STORY_CHAPTERS,
  type GameModeId,
} from '../data/GameModesConfig';
import { computeTeamPower } from '../data/UnitQuery';
import type { HubStationId } from '../hub/Station';
import { ScreenRouter } from './ScreenRouter';
import { CombatHUD } from './CombatHUD';
import { FastMenu, type HubWizardStep } from './screens/FastMenu';
import { SynthAudio } from '../audio/SynthAudio';
import type { SummonModal } from './SummonModal';
import type { InventoryModal } from './InventoryModal';
import type { QuestPanel } from './QuestPanel';
import type { SettingsModal } from './SettingsModal';
import type { CodexModal } from './CodexModal';
import type { GardenPassModal } from './GardenPassModal';
import type { ShopAndExtrasModal, ShopExtrasTab } from './ShopAndExtrasModal';

export class UIManager {
  private root: HTMLElement;
  private match: MatchController;
  private input: InputManager;

  private lobbyEl: HTMLDivElement;
  private stationPromptEl: HTMLDivElement;
  private fastMenu: FastMenu;
  private combatHud: CombatHUD;

  // Lazy-loaded modals to keep initial JS chunk <= 550 KB
  private summonModal: SummonModal | null = null;
  private inventoryModal: InventoryModal | null = null;
  private questPanel: QuestPanel | null = null;
  private settingsModal: SettingsModal | null = null;
  private codexModal: CodexModal | null = null;
  private passModal: GardenPassModal | null = null;
  private shopExtrasModal: ShopAndExtrasModal | null = null;

  private toastStack: HTMLDivElement;
  private flashOverlay: HTMLDivElement;
  private letterTop: HTMLDivElement;
  private letterBot: HTMLDivElement;
  private waveBanner: HTMLDivElement;
  private endModal: HTMLDivElement;
  private pauseModal: HTMLDivElement;
  private tutorialBox: HTMLDivElement;

  private selectedMode: GameModeId = 'standard';
  private selectedPuzzleId = 1;
  private selectedStoryChapterId = 1;
  private selectedModifiers: Record<string, number> = {};
  private hubStep: HubWizardStep = 'mode';
  private activePromptStation: HubStationId | null = null;

  private tutorialStep = 0;
  private confirmRestart = false;
  private confirmQuit = false;
  private lastLaunchCfg: {
    mapId: MapId;
    difficulty: DifficultyId;
    mode: GameModeId;
    puzzleId?: number;
    storyChapterId?: number;
    modifiers: Record<string, number>;
  } | null = null;

  constructor(root: HTMLElement, match: MatchController, input: InputManager) {
    this.root = root;
    this.match = match;
    this.input = input;

    this.lobbyEl = document.createElement('div');
    this.lobbyEl.className = 'lobby-screen hub-hud-overlay';
    this.root.appendChild(this.lobbyEl);

    this.stationPromptEl = document.createElement('div');
    this.stationPromptEl.id = 'hub-station-prompt';
    this.stationPromptEl.className = 'hub-station-prompt paper-panel hidden';
    this.root.appendChild(this.stationPromptEl);
    this.stationPromptEl.addEventListener('click', () => {
      if (this.activePromptStation) {
        this.handleStationOpen(this.activePromptStation);
      }
    });

    this.fastMenu = new FastMenu(this.root, this.match, {
      getWizardState: () => ({
        mode: this.selectedMode,
        puzzleId: this.selectedPuzzleId,
        storyChapterId: this.selectedStoryChapterId,
        modifiers: this.selectedModifiers,
        step: this.hubStep,
      }),
      setWizardState: (patch) => {
        if (patch.mode !== undefined) this.selectedMode = patch.mode;
        if (patch.puzzleId !== undefined) this.selectedPuzzleId = patch.puzzleId;
        if (patch.storyChapterId !== undefined) this.selectedStoryChapterId = patch.storyChapterId;
        if (patch.modifiers !== undefined) this.selectedModifiers = patch.modifiers;
        if (patch.step !== undefined) this.hubStep = patch.step;
        this.renderLobby();
      },
      onNavigateStep: (step) => this.navigateWizard(step),
      onLaunch: () => this.startSelectedMatch(),
      onOpenInventory: () => void this.openInventory(),
      onOpenSummon: () => void this.openSummon(),
      onOpenShop: (tab) => void this.openShopAndExtras(tab),
      onOpenQuests: () => void this.openQuests(),
      onOpenPass: () => void this.openGardenPass(),
      onOpenCodex: () => void this.openCodex(),
      onOpenSettings: () => void this.openSettings(),
      onPushToast: (title, subtitle, color) => this.pushToast(title, subtitle, color),
      onCloseFastMenu: () => ScreenRouter.popAll(),
    });

    this.combatHud = new CombatHUD(
      this.root,
      match,
      input,
      () => this.togglePauseMenu(),
      () => this.exitToLobby()
    );

    this.letterTop = document.createElement('div');
    this.letterTop.className = 'letterbox-bar letterbox-top';
    this.letterBot = document.createElement('div');
    this.letterBot.className = 'letterbox-bar letterbox-bottom';
    this.waveBanner = document.createElement('div');
    this.waveBanner.className = 'wave-banner gloss-panel hidden';
    this.toastStack = document.createElement('div');
    this.toastStack.className = 'toast-stack';
    this.flashOverlay = document.createElement('div');
    this.flashOverlay.className = 'screen-flash';
    this.endModal = document.createElement('div');
    this.endModal.className = 'modal-backdrop hidden';
    this.pauseModal = document.createElement('div');
    this.pauseModal.className = 'modal-backdrop hidden';
    this.tutorialBox = document.createElement('div');
    this.tutorialBox.className = 'tutorial-box gloss-panel hidden';

    this.root.append(
      this.letterTop,
      this.letterBot,
      this.waveBanner,
      this.toastStack,
      this.flashOverlay,
      this.endModal,
      this.pauseModal,
      this.tutorialBox
    );

    this.match.onHubStationInteract = (stationId) => this.handleStationOpen(stationId);

    this.registerScreens();
    if (QualityManager.settings.startInFastMenu) {
      ScreenRouter.replace('hub');
      ScreenRouter.push('fast_menu');
    } else {
      ScreenRouter.replace('hub');
    }

    this.bindEvents();
    this.bindGlobalKeys();
  }

  private registerScreens(): void {
    const enterWizard = (step: HubWizardStep) => {
      this.hubStep = step;
      this.lobbyEl.classList.remove('hidden');
      this.fastMenu.open(step);
      this.renderLobby();
    };

    ScreenRouter.register({
      id: 'hub',
      enter: () => {
        this.fastMenu.close();
        this.lobbyEl.classList.remove('hidden');
        this.match.hubWorld.exitStationFocus();
        this.renderLobby();
      },
      exit: () => {},
    });

    ScreenRouter.register({
      id: 'fast_menu',
      enter: () => enterWizard(this.hubStep),
      exit: () => {
        this.fastMenu.close();
        this.renderLobby();
      },
    });

    ScreenRouter.register({
      id: 'mode_select',
      enter: () => enterWizard('mode'),
      exit: () => {},
    });

    ScreenRouter.register({
      id: 'map_select',
      enter: () => enterWizard('map'),
      exit: () => {},
    });

    ScreenRouter.register({
      id: 'difficulty_mods',
      enter: () => enterWizard('difficulty'),
      exit: () => {},
    });

    ScreenRouter.register({
      id: 'team_pick',
      enter: () => enterWizard('team'),
      exit: () => {},
    });

    ScreenRouter.register({
      id: 'pause_menu',
      enter: () => {
        this.confirmRestart = false;
        this.confirmQuit = false;
        if (this.match.inMatch && !TimeScale.paused) {
          TimeScale.togglePause();
        }
        this.pauseModal.classList.remove('hidden');
        this.renderPauseMenu();
      },
      exit: () => {
        this.pauseModal.classList.add('hidden');
        if (this.match.inMatch && TimeScale.paused && !this.match.matchEnded) {
          TimeScale.togglePause();
        }
      },
    });
  }

  private handleStationOpen(stationId: HubStationId): void {
    if (this.match.inMatch || this.hasOpenModal()) return;
    if (stationId === 'play_pads') {
      ScreenRouter.push('mode_select');
    } else if (stationId === 'greenhouse') {
      void this.openSummon();
    } else if (stationId === 'shed') {
      void this.openInventory();
    } else if (stationId === 'seed_shop') {
      void this.openShopAndExtras('Shop');
    } else if (stationId === 'mossbeard') {
      void this.openQuests();
    } else if (stationId === 'notice_board') {
      void this.openShopAndExtras('WhatsNew');
    } else if (stationId === 'trophy_podium') {
      void this.openCodex();
    } else if (stationId === 'fountain') {
      void this.openSettings();
    }
  }

  private navigateWizard(step: HubWizardStep): void {
    const screenMap: Record<HubWizardStep, string> = {
      mode: 'mode_select',
      map: 'map_select',
      difficulty: 'difficulty_mods',
      team: 'team_pick',
    };
    const id = screenMap[step];
    if (step === 'mode') {
      ScreenRouter.replace('hub');
      ScreenRouter.push('mode_select');
    } else {
      ScreenRouter.push(id);
    }
    SynthAudio.play('click');
  }

  private toggleFastMenu(): void {
    if (this.match.inMatch || this.hasOpenModal()) return;
    if (this.fastMenu.isOpen) {
      ScreenRouter.popAll();
    } else {
      ScreenRouter.push('fast_menu');
    }
    SynthAudio.play('click');
  }

  private async openSummon(): Promise<void> {
    if (!this.summonModal) {
      const { SummonModal } = await import('./SummonModal');
      this.summonModal = new SummonModal(this.root);
    }
    this.summonModal.open();
  }

  private async openInventory(unitId?: string): Promise<void> {
    if (!this.inventoryModal) {
      const { InventoryModal } = await import('./InventoryModal');
      this.inventoryModal = new InventoryModal(this.root);
    }
    this.inventoryModal.open(unitId);
  }

  private async openQuests(): Promise<void> {
    if (!this.questPanel) {
      const { QuestPanel } = await import('./QuestPanel');
      this.questPanel = new QuestPanel(this.root);
    }
    this.questPanel.open();
  }

  private async openSettings(): Promise<void> {
    if (!this.settingsModal) {
      const { SettingsModal } = await import('./SettingsModal');
      this.settingsModal = new SettingsModal(this.root);
    }
    this.settingsModal.open();
  }

  private async openCodex(): Promise<void> {
    if (!this.codexModal) {
      const { CodexModal } = await import('./CodexModal');
      this.codexModal = new CodexModal(this.root);
    }
    this.codexModal.open();
  }

  private async openGardenPass(): Promise<void> {
    if (!this.passModal) {
      const { GardenPassModal } = await import('./GardenPassModal');
      this.passModal = new GardenPassModal(this.root);
    }
    this.passModal.open();
  }

  private async openShopAndExtras(tab: ShopExtrasTab = 'Shop'): Promise<void> {
    if (!this.shopExtrasModal) {
      const { ShopAndExtrasModal } = await import('./ShopAndExtrasModal');
      this.shopExtrasModal = new ShopAndExtrasModal(this.root);
    }
    this.shopExtrasModal.open(tab);
  }

  private hasOpenModal(): boolean {
    const modals = [
      this.summonModal?.root,
      this.inventoryModal?.root,
      this.questPanel?.root,
      this.settingsModal?.root,
      this.codexModal?.root,
      this.passModal?.root,
      this.shopExtrasModal?.root,
    ];
    return modals.some((m) => Boolean(m && !m.classList.contains('hidden')));
  }

  private closeTopModal(): boolean {
    if (this.settingsModal && !this.settingsModal.root.classList.contains('hidden')) {
      this.settingsModal.close();
      return true;
    }
    if (this.shopExtrasModal && !this.shopExtrasModal.root.classList.contains('hidden')) {
      this.shopExtrasModal.close();
      return true;
    }
    if (this.inventoryModal && !this.inventoryModal.root.classList.contains('hidden')) {
      this.inventoryModal.close();
      return true;
    }
    if (this.questPanel && !this.questPanel.root.classList.contains('hidden')) {
      this.questPanel.close();
      return true;
    }
    if (this.codexModal && !this.codexModal.root.classList.contains('hidden')) {
      this.codexModal.close();
      return true;
    }
    if (this.passModal && !this.passModal.root.classList.contains('hidden')) {
      this.passModal.close();
      return true;
    }
    if (this.summonModal && !this.summonModal.root.classList.contains('hidden')) {
      if (!this.summonModal.isAnimating) {
        this.summonModal.close();
        return true;
      }
      return false;
    }
    return false;
  }

  private togglePauseMenu(): void {
    if (!this.match.inMatch || this.match.matchEnded) return;
    if (ScreenRouter.current?.id === 'pause_menu') {
      ScreenRouter.popAll();
    } else {
      ScreenRouter.push('pause_menu');
    }
    SynthAudio.play('click');
  }

  private renderPauseMenu(): void {
    const modeLabel = MODE_CATALOG.find((m) => m.id === this.match.gameMode)?.name ?? this.match.gameMode;
    this.pauseModal.innerHTML = `
      <div class="pause-board paper-panel paper-scroll-in">
        <div style="font-size:24px;font-weight:900;color:#fde047;">⏸ Match Paused</div>
        <div style="font-size:14px;color:#cbd5e1;">
          ${this.match.mapDef.name} • ${modeLabel} • ${this.match.difficultyId} (Wave ${Math.max(1, this.match.currentWave)})
        </div>
        <button class="seed-pod-btn" id="pause-resume" style="width:100%;">
          ▶ Resume Match ${Keybinds.badge('pause_menu')}
        </button>
        <button class="btn btn-gold" id="pause-restart" style="width:100%;">
          ${this.confirmRestart ? '⚠️ Confirm Restart Match?' : '🔄 Restart Match'}
        </button>
        <button class="btn btn-slate" id="pause-settings" style="width:100%;">⚙️ Settings</button>
        <button class="btn btn-rose" id="pause-quit" style="width:100%;">
          ${this.confirmQuit ? '⚠️ Confirm Quit to Garden Hub?' : '🏠 Quit to Garden Hub'}
        </button>
        <div style="font-size:14px;color:#94a3b8;">Tip: Press ${Keybinds.badge('help_overlay')} anytime for keybinds!</div>
      </div>
    `;

    this.pauseModal.querySelector('#pause-resume')!.addEventListener('click', () => {
      ScreenRouter.popAll();
      SynthAudio.play('click');
    });

    this.pauseModal.querySelector('#pause-restart')!.addEventListener('click', () => {
      if (!this.confirmRestart) {
        this.confirmRestart = true;
        this.renderPauseMenu();
        SynthAudio.play('click');
        return;
      }
      this.restartCurrentMatch();
    });

    this.pauseModal.querySelector('#pause-settings')!.addEventListener('click', () => {
      void this.openSettings();
    });

    this.pauseModal.querySelector('#pause-quit')!.addEventListener('click', () => {
      if (!this.confirmQuit) {
        this.confirmQuit = true;
        this.renderPauseMenu();
        SynthAudio.play('click');
        return;
      }
      this.exitToLobby();
    });
  }

  private restartCurrentMatch(): void {
    const cfg = this.lastLaunchCfg;
    ScreenRouter.popAll();
    if (!cfg) {
      this.startSelectedMatch();
      return;
    }
    this.launchMatch(cfg.mapId, cfg.difficulty, cfg.mode, cfg.puzzleId, cfg.storyChapterId, cfg.modifiers);
  }

  private bindGlobalKeys(): void {
    const handleBack = (_m: unknown, e?: KeyboardEvent) => {
      if (this.closeTopModal()) {
        e?.preventDefault();
        return true;
      }
      if (this.match.inMatch) {
        if (this.input.activeSlotIndex !== null || this.input.selectedTower !== null) {
          return false; // InputManager priority-10 handles cancel first
        }
        e?.preventDefault();
        this.togglePauseMenu();
        return true;
      }
      if (ScreenRouter.pop()) {
        e?.preventDefault();
        SynthAudio.play('click');
        return true;
      }
      return false;
    };

    InputActions.onDown('pause_menu', handleBack, 0);

    InputActions.onDown(
      'hub_fast_menu',
      (_m, e) => {
        if (this.match.inMatch || this.hasOpenModal()) return false;
        e?.preventDefault();
        this.toggleFastMenu();
        return true;
      },
      0
    );

    InputActions.onDown(
      'start_wave',
      (_m, e) => {
        if (this.match.inMatch || this.hasOpenModal()) return false;
        e?.preventDefault();
        this.startSelectedMatch();
        return true;
      },
      0
    );

    const bindHubShortcut = (
      action:
        | 'hub_units'
        | 'hub_summon'
        | 'hub_shop'
        | 'hub_quests'
        | 'hub_codex'
        | 'hub_settings'
        | 'hub_extras',
      fn: () => void
    ) => {
      InputActions.onDown(
        action,
        () => {
          if (this.match.inMatch || this.hasOpenModal()) return false;
          fn();
          return true;
        },
        0
      );
    };

    bindHubShortcut('hub_units', () => void this.openInventory());
    bindHubShortcut('hub_summon', () => void this.openSummon());
    bindHubShortcut('hub_shop', () => void this.openShopAndExtras('Shop'));
    bindHubShortcut('hub_quests', () => void this.openQuests());
    bindHubShortcut('hub_codex', () => void this.openCodex());
    bindHubShortcut('hub_settings', () => void this.openSettings());
    bindHubShortcut('hub_extras', () => void this.openShopAndExtras('Codes'));
  }

  private bindEvents(): void {
    EventBus.on('save:updated', () => {
      if (!this.match.inMatch) {
        this.match.rebuildHubGarden();
        this.renderLobby();
        this.fastMenu.render();
      }
    });

    EventBus.on('keybinds:changed', () => {
      if (!this.match.inMatch) {
        this.renderLobby();
        this.fastMenu.render();
      }
    });

    EventBus.on('ui:toggle_fast_menu', () => {
      this.toggleFastMenu();
    });

    EventBus.on('ui:try_unit', ({ unitId }) => {
      this.launchTryUnit(unitId);
    });

    EventBus.on('ui:open_unit_inventory', ({ unitId }) => {
      void this.openInventory(unitId);
    });

    EventBus.on('ui:open_lobby', () => {
      this.exitToLobby();
    });

    EventBus.on('ui:restart_match', () => {
      this.restartCurrentMatch();
    });

    EventBus.on('ui:start_match', ({ mapId, difficulty, mode, puzzleId, storyChapterId, modifiers }) => {
      this.launchMatch(
        mapId,
        difficulty,
        mode ?? 'standard',
        puzzleId,
        storyChapterId,
        modifiers ?? {}
      );
    });

    EventBus.on('hub:station_prompt', ({ stationId, label, keyHint, screenX, screenY, holdProgress }) => {
      this.activePromptStation = stationId as HubStationId | null;
      if (!stationId || this.match.inMatch || this.fastMenu.isOpen || this.hasOpenModal()) {
        this.stationPromptEl.classList.add('hidden');
        return;
      }
      this.stationPromptEl.classList.remove('hidden');
      this.stationPromptEl.style.left = `${Math.round(screenX)}px`;
      this.stationPromptEl.style.top = `${Math.round(screenY)}px`;
      const pct = Math.round(holdProgress * 100);
      this.stationPromptEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
          ${Keybinds.badge('hub_interact')}
          <div>
            <div style="font-size:15px;font-weight:900;color:#fde047;">${label}</div>
            <div style="font-size:14px;color:#cbd5e1;">${keyHint}</div>
          </div>
        </div>
        ${pct > 0 ? `<div class="gnome-track-bar" style="height:5px;margin-top:4px;"><div class="gnome-track-fill" style="width:${pct}%"></div></div>` : ''}
      `;
    });

    EventBus.on('toast:show', ({ title, subtitle, color }) => {
      this.pushToast(title, subtitle, color ?? '#38bdf8');
    });

    EventBus.on('achievement:unlocked', ({ title, rewardSeeds }) => {
      this.pushToast(`🏆 Achievement: ${title}`, `+${rewardSeeds} Seeds`, '#fbbf24');
      SynthAudio.play('crate_fanfare');
    });

    EventBus.on('vfx:screen_flash', ({ color, opacity, duration }) => {
      const clamped = QualityManager.clampFlashOpacity(opacity);
      this.flashOverlay.style.background = color;
      this.flashOverlay.style.opacity = `${clamped}`;
      setTimeout(() => {
        this.flashOverlay.style.opacity = '0';
      }, duration * 1000);
    });

    EventBus.on('match:wave_start', ({ wave, isBoss, enemyIcons }) => {
      const icons = enemyIcons.map((e) => `${e.name} ×${e.count}`).join(' • ');
      this.waveBanner.innerHTML = isBoss
        ? `<div style="font-size:22px;font-weight:800;color:#f43f5e;">⚠️ BOSS INCOMING</div><div style="font-size:15px;">${icons}</div>`
        : `<div style="font-size:22px;font-weight:800;color:#fde047;">WAVE ${wave}</div><div style="font-size:14px;">${icons}</div>`;
      this.waveBanner.classList.remove('hidden');
      setTimeout(() => this.waveBanner.classList.add('hidden'), 1800);

      if (this.tutorialStep === 3) {
        this.advanceTutorial();
      }
    });

    EventBus.on('match:boss_spawned', () => {
      if (!QualityManager.settings.bossCamera || QualityManager.settings.reducedMotion) return;
      this.letterTop.classList.add('active');
      this.letterBot.classList.add('active');
      setTimeout(() => {
        this.letterTop.classList.remove('active');
        this.letterBot.classList.remove('active');
      }, 3000);
    });

    EventBus.on('match:bloom_chest', ({ seeds, dewdrops, wave }) => {
      this.pushToast(`🌸 Endless Wave ${wave} Bloom Chest!`, `+${seeds} Seeds & +${dewdrops} Dewdrops`, '#c084fc');
    });

    EventBus.on('match:victory', ({ seedsEarned, wavesCleared }) => {
      this.showEndModal(true, wavesCleared, seedsEarned);
    });

    EventBus.on('match:defeat', ({ wavesCleared }) => {
      this.showEndModal(false, wavesCleared, 0);
    });

    EventBus.on('tower:placed', () => {
      if (this.tutorialStep === 0) this.advanceTutorial();
    });
    EventBus.on('tower:upgraded', () => {
      if (this.tutorialStep === 1) this.advanceTutorial();
    });
  }

  private renderLobby(): void {
    const d = SaveManager.data;
    const xpNeeded = d.playerLevel * 200;
    const boosts = SaveManager.getActiveBoosts();
    const unreadNews = d.whatsNewSeenVersion !== CURRENT_VERSION;
    const claimableQuests = d.dailyQuests.filter((q) => !q.claimed && q.progress >= q.target).length;

    if (!SaveManager.isDifficultyUnlocked(d.selectedMap, d.selectedDifficulty)) {
      d.selectedDifficulty = 'Easy';
    }

    const diffDef = DIFFICULTY_LADDER[d.selectedDifficulty] ?? DIFFICULTY_LADDER.Easy;
    const selectedMapDef = MAPS[d.selectedMap] ?? MAPS.sunny_backyard;
    const modeMeta = MODE_CATALOG.find((m) => m.id === this.selectedMode) ?? MODE_CATALOG[0];
    const teamEval = computeTeamPower(d.loadout, d.owned);

    this.lobbyEl.innerHTML = `
      <div class="hub-top-bar">
        <div class="hud-group" style="pointer-events:auto;">
          <button class="leaf-tab-btn" id="hub-fast-menu-btn">
            ☰ Menu ${Keybinds.badge('hub_fast_menu')}
          </button>
          <div class="lobby-brand paper-panel" style="padding:6px 12px;">
            <div style="font-size:24px;">🌻</div>
            <div>
              <div class="lobby-title" style="font-size:18px;">Garden Bastion TD <span style="font-size:14px;color:#86efac;">v${CURRENT_VERSION}</span></div>
              <div style="font-size:14px;color:#cbd5e1;">Lv.${d.playerLevel} Gardener (${d.playerXp}/${xpNeeded}) • Pass T${d.gardenPass.tier}</div>
            </div>
            ${boosts.doubleSeeds ? `<span class="stat-pill" style="border-color:#4ade80;color:#4ade80;">🌱 ×2</span>` : ''}
            ${boosts.doubleLuck ? `<span class="stat-pill" style="border-color:#fde047;color:#fde047;">🍀 ×2</span>` : ''}
          </div>
        </div>

        <div class="currency-strip" style="pointer-events:auto;">
          <div class="stat-pill">🌱 ${d.seeds} Seeds</div>
          <div class="stat-pill">💧 ${d.dewdrops} Dewdrops</div>
          <div class="stat-pill">🎫 ${d.eventTickets} Tickets</div>
          <button class="leaf-tab-btn" id="hub-quests-top-btn">
            📜 ${claimableQuests > 0 ? `<span class="badge-dot">${claimableQuests}</span>` : Keybinds.badge('hub_quests')}
          </button>
          <button class="leaf-tab-btn" id="lobby-news-btn">
            📰 News ${unreadNews ? '<span class="badge-new">NEW</span>' : ''}
          </button>
          <button class="leaf-tab-btn" id="lobby-settings-top">⚙️ ${Keybinds.badge('hub_settings')}</button>
        </div>
      </div>

      <div class="hub-controls-hint paper-panel">
        <span>Walk ${Keybinds.badge('cam_up')}${Keybinds.badge('cam_left')}${Keybinds.badge('cam_down')}${Keybinds.badge('cam_right')}</span>
        <span>Run ${Keybinds.badge('hub_run')}</span>
        <span>Jump ${Keybinds.badge('hub_jump')}</span>
        <span>Interact ${Keybinds.badge('hub_interact')}</span>
        <span>Fast Menu ${Keybinds.badge('hub_fast_menu')}</span>
        <span>Help ${Keybinds.badge('help_overlay')}</span>
      </div>

      <div class="hub-quick-launch paper-panel ${this.fastMenu.isOpen ? 'hidden' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="font-size:15px;font-weight:900;color:#fde047;">${modeMeta.icon} ${selectedMapDef.name}</div>
          <span style="font-size:14px;color:${teamEval.power >= diffDef.recommendedPower ? '#4ade80' : '#fbbf24'};">PWR ${teamEval.power.toLocaleString()}</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-slate btn-sm" id="hub-setup-btn" style="flex:1;">🗺 Mode & Setup</button>
          <button class="btn btn-green btn-sm" id="hub-units-btn" style="flex:1;">🌿 Units ${Keybinds.badge('hub_units')}</button>
        </div>
        <button class="seed-pod-btn" id="lobby-play-btn" style="width:100%;">
          ▶ Play ${
            this.selectedMode === 'puzzle'
              ? `Puzzle #${this.selectedPuzzleId}`
              : this.selectedMode === 'story'
                ? `Story Ch.${this.selectedStoryChapterId}`
                : `${modeMeta.name} (${d.selectedDifficulty})`
          } ${Keybinds.badge('start_wave')}
        </button>
      </div>
    `;

    this.lobbyEl.querySelector('#hub-fast-menu-btn')!.addEventListener('click', () => this.toggleFastMenu());
    this.lobbyEl.querySelector('#hub-setup-btn')!.addEventListener('click', () => ScreenRouter.push('mode_select'));
    this.lobbyEl.querySelector('#hub-units-btn')!.addEventListener('click', () => void this.openInventory());
    this.lobbyEl.querySelector('#hub-quests-top-btn')!.addEventListener('click', () => void this.openQuests());
    this.lobbyEl.querySelector('#lobby-news-btn')!.addEventListener('click', () => void this.openShopAndExtras('WhatsNew'));
    this.lobbyEl.querySelector('#lobby-settings-top')!.addEventListener('click', () => void this.openSettings());
    this.lobbyEl.querySelector('#lobby-play-btn')!.addEventListener('click', () => this.startSelectedMatch());
  }

  private launchTryUnit(unitId: string): void {
    this.closeTopModal();
    ScreenRouter.popAll();
    this.fastMenu.close();
    this.lobbyEl.classList.add('hidden');
    this.stationPromptEl.classList.add('hidden');
    this.endModal.classList.add('hidden');
    this.pauseModal.classList.add('hidden');
    this.match.startTryUnitTest(unitId);
    this.combatHud.show(true);
  }

  private startSelectedMatch(): void {
    const d = SaveManager.data;
    this.launchMatch(
      d.selectedMap,
      d.selectedDifficulty,
      this.selectedMode,
      this.selectedMode === 'puzzle' ? this.selectedPuzzleId : undefined,
      this.selectedMode === 'story' ? this.selectedStoryChapterId : undefined,
      this.selectedModifiers
    );
  }

  private launchMatch(
    mapId: MapId,
    difficulty: DifficultyId,
    mode: GameModeId,
    puzzleId?: number,
    storyChapterId?: number,
    modifiers: Record<string, number> = {}
  ): void {
    SynthAudio.play('click');
    ScreenRouter.popAll();
    this.fastMenu.close();
    this.lobbyEl.classList.add('hidden');
    this.stationPromptEl.classList.add('hidden');
    this.endModal.classList.add('hidden');
    this.pauseModal.classList.add('hidden');

    this.lastLaunchCfg = {
      mapId,
      difficulty,
      mode,
      puzzleId,
      storyChapterId,
      modifiers: { ...modifiers },
    };

    this.match.startMatch(mapId, difficulty, mode, puzzleId, {
      modifiers,
      storyChapterId,
    });
    this.combatHud.show(true);

    if (mode === 'puzzle' && puzzleId) {
      const puz = GARDEN_PUZZLES.find((p) => p.id === puzzleId);
      if (puz) this.pushToast(`🧩 ${puz.title}`, puz.hint, '#fde047');
    } else if (mode === 'story' && storyChapterId) {
      const ch = STORY_CHAPTERS.find((c) => c.id === storyChapterId);
      if (ch) this.pushToast(`📖 ${ch.title}`, ch.sproutQuote, '#86efac');
    }

    if (!SaveManager.data.tutorialCompleted && !SaveManager.data.tutorialSkipped && mode === 'standard') {
      this.tutorialStep = 0;
      this.renderTutorial();
    }
  }

  private exitToLobby(): void {
    SynthAudio.play('click');
    ScreenRouter.popAll();
    this.input.selectTower(null);
    this.input.selectSlot(null);
    this.combatHud.show(false);
    this.endModal.classList.add('hidden');
    this.pauseModal.classList.add('hidden');
    this.tutorialBox.classList.add('hidden');
    this.match.returnToLobby();
    ScreenRouter.replace('hub');
  }

  private renderTutorial(): void {
    if (SaveManager.data.tutorialCompleted || SaveManager.data.tutorialSkipped) {
      this.tutorialBox.classList.add('hidden');
      return;
    }
    const msgs = [
      'Hi! Click card [1] Sprout Striker below, then click the green lawn near the path to plant it!',
      `Awesome! Now click your Sprout Striker and press Upgrade ${Keybinds.badge('upgrade')} (or Shift+Click) to evolve its branches!`,
      `Great job! Try toggling Speed ${Keybinds.badge('speed_cycle')} or pressing Start Wave ${Keybinds.badge('start_wave')}!`,
      'Defend your Garden Bastion! Visit the Greenhouse in the Hub after the match for +100 Bonus Seeds!',
    ];
    if (this.tutorialStep >= msgs.length) {
      SaveManager.data.tutorialCompleted = true;
      SaveManager.addSeeds(100);
      this.tutorialBox.classList.add('hidden');
      this.pushToast('🌱 Tutorial Complete!', '+100 Bonus Seeds!', '#4ade80');
      return;
    }

    this.tutorialBox.classList.remove('hidden');
    this.tutorialBox.innerHTML = `
      <div class="sprout-mascot">🌱</div>
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:700;color:#86efac;">Sprout Guide</div>
        <div style="font-size:14px;margin:2px 0 8px;">${msgs[this.tutorialStep]}</div>
        <div style="display:flex;gap:8px;">
          ${this.tutorialStep >= 2 ? '<button class="btn btn-green btn-sm" id="tut-next">Got it!</button>' : ''}
          <button class="btn btn-slate btn-sm" id="tut-skip">Skip Tutorial</button>
        </div>
      </div>
    `;

    this.tutorialBox.querySelector('#tut-next')?.addEventListener('click', () => this.advanceTutorial());
    this.tutorialBox.querySelector('#tut-skip')!.addEventListener('click', () => {
      SaveManager.data.tutorialSkipped = true;
      SaveManager.save();
      this.tutorialBox.classList.add('hidden');
    });
  }

  private advanceTutorial(): void {
    this.tutorialStep++;
    this.renderTutorial();
  }

  private showEndModal(victory: boolean, wavesCleared: number, seedsEarned: number): void {
    ScreenRouter.popAll();
    const mvp = [...this.match.towers].sort((a, b) => b.totalDamageDealt - a.totalDamageDealt)[0];
    const hpRatio = this.match.maxBaseHp > 0 ? this.match.baseHp / this.match.maxBaseHp : 0;
    const stars = !victory ? 0 : hpRatio >= 0.999 ? 3 : hpRatio >= 0.5 ? 2 : 1;
    const starDisplay = victory ? `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}` : '🥀';
    const modBonusPct = Math.round(computeModifierEffects(this.match.activeModifiers).seedBonusTotal * 100);

    this.endModal.classList.remove('hidden');
    this.endModal.innerHTML = `
      <div class="modal-card paper-panel" style="width:500px;text-align:center;">
        <div class="modal-header" style="justify-content:center;">
          <div style="font-size:26px;font-weight:800;color:${victory ? '#4ade80' : '#f43f5e'};">
            ${victory ? '🏆 GARDEN DEFENDED!' : '🥀 GARDEN OVERRUN'}
          </div>
        </div>
        <div class="modal-body" style="align-items:center;">
          ${victory ? `<div style="font-size:32px;color:#fde047;letter-spacing:4px;">${starDisplay}</div>` : ''}
          <div style="font-size:18px;">Waves Cleared: <strong>${wavesCleared}</strong></div>
          <div style="font-size:14px;color:${victory ? '#86efac' : '#cbd5e1'};">
            ${victory ? '🌻 Your Gardener celebrates by the plaza fountain!' : '🪴 The Gardener regroups to plan the next defense.'}
          </div>
          ${
            victory
              ? `<div style="font-size:20px;color:#fbbf24;font-weight:800;">+${seedsEarned} Seeds Earned! ${modBonusPct > 0 ? `(+${modBonusPct}% Mods)` : ''}</div>`
              : ''
          }
          ${mvp ? `<div style="font-size:16px;color:#86efac;">⭐ MVP Unit: <strong>${mvp.def.name}</strong> (${mvp.totalDamageDealt.toLocaleString()} DMG)</div>` : ''}
          <div style="display:flex;gap:10px;width:100%;margin-top:8px;flex-wrap:wrap;">
            ${victory && !this.match.isEndless && this.match.gameMode === 'standard' ? '<button class="btn btn-purple" id="end-endless" style="flex:1;">Continue Endless</button>' : ''}
            <button class="btn btn-gold" id="end-replay" style="flex:1;">🔄 Play Again</button>
            <button class="seed-pod-btn" id="end-lobby" style="flex:1;">Claim & Hub</button>
          </div>
        </div>
      </div>
    `;

    this.endModal.querySelector('#end-endless')?.addEventListener('click', () => {
      this.endModal.classList.add('hidden');
      this.match.continueIntoEndless();
      SynthAudio.play('click');
    });

    this.endModal.querySelector('#end-replay')!.addEventListener('click', () => {
      this.restartCurrentMatch();
    });

    this.endModal.querySelector('#end-lobby')!.addEventListener('click', () => {
      this.exitToLobby();
      if (victory) EventBus.emit('hub:celebrate', undefined);
    });
  }

  private pushToast(title: string, subtitle?: string, color = '#38bdf8'): void {
    const el = document.createElement('div');
    el.className = 'toast-item';
    el.style.borderColor = color;
    el.innerHTML = `<div>${title}</div>${subtitle ? `<div style="font-size:14px;color:#cbd5e1;font-weight:600;">${subtitle}</div>` : ''}`;
    this.toastStack.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3200);
  }

  public update(dt: number): void {
    this.combatHud.updateFrame(dt);
    if (!this.match.inMatch) {
      const busy = this.hasOpenModal() || this.fastMenu.isOpen;
      this.match.hubWorld.setModalPaused(busy);
      if (!busy) {
        this.match.hubWorld.exitStationFocus();
      }
    }
  }
}
