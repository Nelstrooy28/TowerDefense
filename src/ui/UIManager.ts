import { MatchController } from '../simulation/MatchController';
import { InputManager } from '../core/InputManager';
import { SaveManager } from '../core/SaveManager';
import { EventBus } from '../core/EventBus';
import { QualityManager } from '../core/QualityManager';
import { TimeScale } from '../core/TimeScale';
import { DIFFICULTIES, MAP_LIST, MAPS, type DifficultyId, type MapId } from '../data/MapRegistry';
import {
  CURRENT_VERSION,
  DIFFICULTY_LADDER,
  DIFFICULTY_ORDER,
  MODIFIER_FAMILIES,
  VARIANTS,
  computeModifierEffects,
  getHourlyChallengeModifiers,
} from '../data/BalanceConfig';
import {
  GARDEN_PUZZLES,
  MODE_CATALOG,
  STORY_CHAPTERS,
  getWeeklyChallengeForDate,
  type GameModeId,
} from '../data/GameModesConfig';
import { getUnitById } from '../data/UnitRegistry';
import { computeTeamPower } from '../data/UnitQuery';
import { ProceduralTextures } from '../rendering/ProceduralTextures';
import { ScreenRouter } from './ScreenRouter';
import { CombatHUD } from './CombatHUD';
import { SynthAudio } from '../audio/SynthAudio';
import type { SummonModal } from './SummonModal';
import type { InventoryModal } from './InventoryModal';
import type { QuestPanel } from './QuestPanel';
import type { SettingsModal } from './SettingsModal';
import type { CodexModal } from './CodexModal';
import type { GardenPassModal } from './GardenPassModal';
import type { ShopAndExtrasModal, ShopExtrasTab } from './ShopAndExtrasModal';

type HubWizardStep = 'mode' | 'map' | 'difficulty' | 'team';

const GNOME_MILESTONES: Array<{ xp: number; unitId: string; label: string }> = [
  { xp: 100, unitId: 'bramble_snare', label: 'Bramble Snare' },
  { xp: 300, unitId: 'walnut_wall', label: 'Walnut Wall' },
  { xp: 600, unitId: 'sunflower_producer', label: 'Sunny Sprout' },
];

export class UIManager {
  private root: HTMLElement;
  private match: MatchController;
  private input: InputManager;

  private lobbyEl: HTMLDivElement;
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
    this.lobbyEl.className = 'lobby-screen';
    this.root.appendChild(this.lobbyEl);

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

    this.registerScreens();
    ScreenRouter.replace('hub');
    this.bindEvents();
    this.bindGlobalKeys();
  }

  private registerScreens(): void {
    const enterStep = (step: HubWizardStep) => {
      this.hubStep = step;
      this.lobbyEl.classList.remove('hidden');
      this.renderLobby();
    };

    ScreenRouter.register({
      id: 'hub',
      enter: () => enterStep('mode'),
      exit: () => {},
    });
    ScreenRouter.register({
      id: 'mode_select',
      enter: () => enterStep('mode'),
      exit: () => {},
    });
    ScreenRouter.register({
      id: 'map_select',
      enter: () => enterStep('map'),
      exit: () => {},
    });
    ScreenRouter.register({
      id: 'difficulty_mods',
      enter: () => enterStep('difficulty'),
      exit: () => {},
    });
    ScreenRouter.register({
      id: 'team_pick',
      enter: () => enterStep('team'),
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

  private navigateWizard(step: HubWizardStep): void {
    const screenMap: Record<HubWizardStep, string> = {
      mode: 'hub',
      map: 'map_select',
      difficulty: 'difficulty_mods',
      team: 'team_pick',
    };
    const id = screenMap[step];
    if (step === 'mode') {
      ScreenRouter.replace('hub');
    } else {
      ScreenRouter.push(id);
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
      <div class="pause-board paper-panel">
        <div style="font-size:24px;font-weight:900;color:#fde047;">⏸ Match Paused</div>
        <div style="font-size:14px;color:#cbd5e1;">
          ${this.match.mapDef.name} • ${modeLabel} • ${this.match.difficultyId} (Wave ${Math.max(1, this.match.currentWave)})
        </div>
        <button class="seed-pod-btn" id="pause-resume" style="width:100%;">▶ Resume Match [Esc]</button>
        <button class="btn btn-gold" id="pause-restart" style="width:100%;">
          ${this.confirmRestart ? '⚠️ Confirm Restart Match?' : '🔄 Restart Match'}
        </button>
        <button class="btn btn-slate" id="pause-settings" style="width:100%;">⚙️ Settings</button>
        <button class="btn btn-rose" id="pause-quit" style="width:100%;">
          ${this.confirmQuit ? '⚠️ Confirm Quit to Garden Hub?' : '🏠 Quit to Garden Hub'}
        </button>
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
    // Capture phase checks active selection BEFORE InputManager clears it on Escape
    document.addEventListener(
      'keydown',
      (e) => {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        if (e.code === 'Escape') {
          if (this.closeTopModal()) {
            e.stopPropagation();
            return;
          }
          if (this.summonModal && !this.summonModal.root.classList.contains('hidden')) {
            return;
          }
          if (this.match.inMatch) {
            if (this.input.activeSlotIndex !== null || this.input.selectedTower !== null) {
              return; // Let InputManager clear selection first
            }
            e.preventDefault();
            this.togglePauseMenu();
            return;
          }
          if (ScreenRouter.pop()) {
            e.preventDefault();
            SynthAudio.play('click');
          }
          return;
        }

        if (this.match.inMatch || this.hasOpenModal()) return;

        if (e.code === 'Enter') {
          e.preventDefault();
          this.startSelectedMatch();
        } else if (e.code === 'KeyU') {
          void this.openInventory();
        } else if (e.code === 'KeyS') {
          void this.openSummon();
        } else if (e.code === 'KeyH') {
          void this.openShopAndExtras('Shop');
        } else if (e.code === 'KeyQ') {
          void this.openQuests();
        } else if (e.code === 'KeyB') {
          void this.openCodex();
        } else if (e.code === 'KeyO') {
          void this.openSettings();
        } else if (e.code === 'KeyX') {
          void this.openShopAndExtras('Codes');
        }
      },
      true
    );
  }

  private bindEvents(): void {
    EventBus.on('save:updated', () => {
      if (!this.match.inMatch) {
        this.match.rebuildHubGarden();
        this.renderLobby();
      }
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
    const canSummon = d.seeds >= 100 || d.enchantedKeys > 0 || d.eventTickets > 0;
    const claimableQuests = d.dailyQuests.filter((q) => !q.claimed && q.progress >= q.target).length;
    const xpNeeded = d.playerLevel * 200;
    const boosts = SaveManager.getActiveBoosts();
    const unreadNews = d.whatsNewSeenVersion !== CURRENT_VERSION;

    // Ensure selectedDifficulty is unlocked on the selected map
    if (!SaveManager.isDifficultyUnlocked(d.selectedMap, d.selectedDifficulty)) {
      d.selectedDifficulty = 'Easy';
    }

    const activeModMap =
      this.selectedMode === 'hourly' ? getHourlyChallengeModifiers().modifiers : this.selectedModifiers;
    const modEffects = computeModifierEffects(activeModMap);
    const modBonusPct = Math.round(modEffects.seedBonusTotal * 100);
    const teamEval = computeTeamPower(d.loadout, d.owned);
    const diffDef = DIFFICULTY_LADDER[d.selectedDifficulty] ?? DIFFICULTY_LADDER.Easy;
    const selectedMapDef = MAPS[d.selectedMap] ?? MAPS.sunny_backyard;

    const wizardContentHtml = this.renderWizardStepBody(
      d.selectedMap,
      d.selectedDifficulty,
      activeModMap,
      modBonusPct,
      teamEval,
      diffDef.recommendedPower
    );

    const nextMilestone = GNOME_MILESTONES.find((m) => !d.questGnomeClaimed.includes(m.xp));
    const gnomeTargetXp = nextMilestone ? nextMilestone.xp : 600;
    const gnomePct = Math.min(100, Math.round((d.questGnomeXp / gnomeTargetXp) * 100));
    const canClaimGnome = Boolean(nextMilestone && d.questGnomeXp >= nextMilestone.xp);

    const podiumEntries = d.endlessPodium[d.selectedMap] ?? [];
    const podiumText =
      podiumEntries.length > 0
        ? podiumEntries.map((e, i) => `#${i + 1} W${e.wave}`).join(' • ')
        : 'No Endless records yet — clear Endless waves to claim the podium!';

    const modeMeta = MODE_CATALOG.find((m) => m.id === this.selectedMode) ?? MODE_CATALOG[0];

    this.lobbyEl.innerHTML = `
      <div class="lobby-topbar">
        <div class="lobby-brand paper-panel">
          <div style="font-size:30px;">🌻</div>
          <div>
            <div class="lobby-title">Garden Bastion TD <span style="font-size:14px;color:#86efac;">v${CURRENT_VERSION}</span></div>
            <div style="font-size:14px;color:#cbd5e1;">Lv.${d.playerLevel} Gardener (${d.playerXp}/${xpNeeded} XP) • Pass T${d.gardenPass.tier}</div>
          </div>
          ${boosts.doubleSeeds ? `<span class="stat-pill" style="border-color:#4ade80;color:#4ade80;">🌱 ×2 Weekend Seeds</span>` : ''}
          ${boosts.doubleLuck ? `<span class="stat-pill" style="border-color:#fde047;color:#fde047;">🍀 ×2 Luck Hour</span>` : ''}
        </div>

        <div class="currency-strip">
          <div class="stat-pill">🌱 ${d.seeds} Seeds</div>
          <div class="stat-pill">💧 ${d.dewdrops} Dewdrops</div>
          <div class="stat-pill">🎫 ${d.eventTickets} Tickets</div>
          <button class="leaf-tab-btn" id="lobby-news-btn">
            📰 What's New ${unreadNews ? '<span class="badge-new">NEW</span>' : ''}
          </button>
          <button class="leaf-tab-btn" id="lobby-settings-top">⚙️ [O]</button>
        </div>
      </div>

      <div class="hub-layout">
        <div class="hub-signs-col">
          <button class="wood-sign-btn ${this.hubStep ? 'active' : ''}" id="sign-play" data-hub-focus="play">
            <span>▶ Play & Setup</span><span style="font-size:14px;opacity:0.85;">[Enter]</span>
          </button>
          <button class="wood-sign-btn" id="lobby-inv-btn" data-hub-focus="hub">
            <span>🌿 Units & Presets (${d.loadout.filter(Boolean).length}/6)</span><span style="font-size:14px;opacity:0.85;">[U]</span>
          </button>
          <button class="wood-sign-btn" id="lobby-summon-btn" data-hub-focus="summon">
            <span>🎁 Summon Crates ${canSummon ? '<span class="badge-dot">!</span>' : ''}</span><span style="font-size:14px;opacity:0.85;">[S]</span>
          </button>
          <button class="wood-sign-btn" id="lobby-shop-btn" data-hub-focus="shop">
            <span>🛒 Weekly Seed Shop</span><span style="font-size:14px;opacity:0.85;">[H]</span>
          </button>
          <button class="wood-sign-btn" id="lobby-quests-btn" data-hub-focus="hub">
            <span>📜 Quests ${claimableQuests > 0 ? `<span class="badge-dot">${claimableQuests}</span>` : ''}</span><span style="font-size:14px;opacity:0.85;">[Q]</span>
          </button>
          <button class="wood-sign-btn" id="lobby-pass-btn" data-hub-focus="hub">
            <span>🌸 Garden Pass (T${d.gardenPass.tier})</span><span style="font-size:14px;opacity:0.85;">Pass</span>
          </button>
          <button class="wood-sign-btn" id="lobby-codex-btn" data-hub-focus="hub">
            <span>📖 Bestiary & Ranks</span><span style="font-size:14px;opacity:0.85;">[B]</span>
          </button>
          <button class="wood-sign-btn" id="lobby-codes-btn" data-hub-focus="shop">
            <span>🎁 Codes & Extras</span><span style="font-size:14px;opacity:0.85;">[X]</span>
          </button>
          <button class="wood-sign-btn" id="lobby-settings-btn" data-hub-focus="hub">
            <span>⚙️ Settings</span><span style="font-size:14px;opacity:0.85;">[O]</span>
          </button>

          <div class="hub-gnome-card">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:800;color:#fde047;">
              <span>🧙 Old Mossbeard</span>
              <span>${d.questGnomeXp}/${gnomeTargetXp} XP</span>
            </div>
            <div class="gnome-track-bar"><div class="gnome-track-fill" style="width:${gnomePct}%"></div></div>
            ${
              nextMilestone
                ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:14px;">
                    <span style="color:#cbd5e1;">Next: ${nextMilestone.label}</span>
                    ${
                      canClaimGnome
                        ? `<button class="btn btn-gold btn-sm" id="claim-gnome-btn">Claim!</button>`
                        : `<span style="color:#94a3b8;">Win waves</span>`
                    }
                  </div>`
                : `<div style="font-size:14px;color:#4ade80;font-weight:700;">All Gnome rewards claimed!</div>`
            }
          </div>
        </div>

        <div></div>

        <div class="hub-stage-panel paper-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div style="font-size:18px;font-weight:900;color:#fde047;">${modeMeta.icon} ${modeMeta.name} — ${selectedMapDef.name}</div>
            ${
              this.hubStep !== 'mode'
                ? `<button class="leaf-tab-btn" id="wizard-back-btn">← Back [Esc]</button>`
                : ''
            }
          </div>

          <div class="hub-wizard-steps">
            <button class="leaf-tab-btn ${this.hubStep === 'mode' ? 'active' : ''}" data-step="mode">1. Mode</button>
            <button class="leaf-tab-btn ${this.hubStep === 'map' ? 'active' : ''}" data-step="map">2. Map</button>
            <button class="leaf-tab-btn ${this.hubStep === 'difficulty' ? 'active' : ''}" data-step="difficulty">3. Diff & Mods</button>
            <button class="leaf-tab-btn ${this.hubStep === 'team' ? 'active' : ''}" data-step="team">4. Team</button>
          </div>

          <div style="flex:1;min-height:0;overflow-y:auto;padding-right:4px;">
            ${wizardContentHtml}
          </div>

          <div style="border-top:1px solid rgba(255,255,255,0.14);padding-top:10px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;color:#cbd5e1;">
              <span>Team Power: <strong style="color:${teamEval.power >= diffDef.recommendedPower ? '#4ade80' : '#fbbf24'};">${teamEval.power.toLocaleString()}</strong> / Rec ${diffDef.recommendedPower.toLocaleString()}</span>
              <span>${modBonusPct > 0 ? `<strong style="color:#fde047;">+${modBonusPct}% Mod Seeds</strong>` : d.selectedDifficulty}</span>
            </div>
            <button class="seed-pod-btn" id="lobby-play-btn" style="width:100%;">
              ▶ Play ${
                this.selectedMode === 'puzzle'
                  ? `Puzzle #${this.selectedPuzzleId}`
                  : this.selectedMode === 'story'
                    ? `Story Ch.${this.selectedStoryChapterId}`
                    : `${modeMeta.name} (${d.selectedDifficulty})`
              }
            </button>
          </div>
        </div>
      </div>

      <div class="podium-strip">
        <div><strong style="color:#fde047;">🏆 ${selectedMapDef.name} Endless Podium:</strong> ${podiumText}</div>
        <div style="color:#94a3b8;">Enter Play • U Units • S Summon • H Shop • Esc Back</div>
      </div>
    `;

    // Bind navigation signs + hub hover camera framing
    this.lobbyEl.querySelectorAll('[data-hub-focus]').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        const target = (el as HTMLElement).dataset.hubFocus as 'hub' | 'summon' | 'shop' | 'play';
        EventBus.emit('ui:hub_focus', { target });
        if (target === 'summon') this.match.engine.cameraRig.focusPoint(-4, 0, 22);
        else if (target === 'shop') this.match.engine.cameraRig.focusPoint(4, 1, 22);
        else this.match.engine.cameraRig.focusPoint(0, 2, 24);
      });
    });

    this.lobbyEl.querySelector('#sign-play')!.addEventListener('click', () => {
      this.navigateWizard('mode');
    });

    this.lobbyEl.querySelectorAll('[data-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = (btn as HTMLElement).dataset.step as HubWizardStep;
        this.navigateWizard(step);
      });
    });

    this.lobbyEl.querySelector('#wizard-back-btn')?.addEventListener('click', () => {
      ScreenRouter.pop();
      SynthAudio.play('click');
    });

    // Mode, puzzle, story, map, difficulty, modifier, preset bindings
    this.lobbyEl.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedMode = (btn as HTMLElement).dataset.mode as GameModeId;
        SynthAudio.play('click');
        this.renderLobby();
      });
    });

    this.lobbyEl.querySelectorAll('[data-puz]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedPuzzleId = Number((btn as HTMLElement).dataset.puz);
        SynthAudio.play('click');
        this.renderLobby();
      });
    });

    this.lobbyEl.querySelectorAll('[data-story]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedStoryChapterId = Number((btn as HTMLElement).dataset.story);
        SynthAudio.play('click');
        this.renderLobby();
      });
    });

    this.lobbyEl.querySelectorAll('[data-map]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mapId = (btn as HTMLElement).dataset.map as MapId;
        SaveManager.data.selectedMap = mapId;
        if (!SaveManager.isDifficultyUnlocked(mapId, SaveManager.data.selectedDifficulty)) {
          SaveManager.data.selectedDifficulty = 'Easy';
        }
        SaveManager.save();
        this.match.loadDiorama(mapId);
        SynthAudio.play('click');
      });
    });

    this.lobbyEl.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const diff = (btn as HTMLElement).dataset.diff as DifficultyId;
        if (!SaveManager.isDifficultyUnlocked(SaveManager.data.selectedMap, diff)) return;
        SaveManager.data.selectedDifficulty = diff;
        SaveManager.save();
        SynthAudio.play('click');
      });
    });

    this.lobbyEl.querySelectorAll('[data-mod-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.modId!;
        const tier = Number((btn as HTMLElement).dataset.modTier ?? 0);
        if (tier <= 0) delete this.selectedModifiers[id];
        else this.selectedModifiers[id] = tier;
        SynthAudio.play('click');
        this.renderLobby();
      });
    });

    this.lobbyEl.querySelectorAll('[data-preset-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number((btn as HTMLElement).dataset.presetIdx);
        SaveManager.switchTeamPreset(idx);
        SynthAudio.play('click');
      });
    });

    this.lobbyEl.querySelector('#claim-gnome-btn')?.addEventListener('click', () => {
      if (!nextMilestone) return;
      if (SaveManager.claimQuestGnomeMilestone(nextMilestone.xp, nextMilestone.unitId)) {
        this.pushToast('🧙 Old Mossbeard Reward!', `Unlocked ${nextMilestone.label}!`, '#fde047');
        SynthAudio.play('crate_fanfare');
      }
    });

    this.lobbyEl.querySelector('#wizard-open-inv')?.addEventListener('click', () => void this.openInventory());
    this.lobbyEl.querySelector('#lobby-summon-btn')!.addEventListener('click', () => void this.openSummon());
    this.lobbyEl.querySelector('#lobby-inv-btn')!.addEventListener('click', () => void this.openInventory());
    this.lobbyEl.querySelector('#lobby-shop-btn')!.addEventListener('click', () => void this.openShopAndExtras('Shop'));
    this.lobbyEl.querySelector('#lobby-pass-btn')!.addEventListener('click', () => void this.openGardenPass());
    this.lobbyEl.querySelector('#lobby-quests-btn')!.addEventListener('click', () => void this.openQuests());
    this.lobbyEl.querySelector('#lobby-codex-btn')!.addEventListener('click', () => void this.openCodex());
    this.lobbyEl.querySelector('#lobby-codes-btn')!.addEventListener('click', () => void this.openShopAndExtras('Codes'));
    this.lobbyEl.querySelector('#lobby-settings-btn')!.addEventListener('click', () => void this.openSettings());
    this.lobbyEl.querySelector('#lobby-settings-top')!.addEventListener('click', () => void this.openSettings());
    this.lobbyEl.querySelector('#lobby-news-btn')!.addEventListener('click', () => void this.openShopAndExtras('WhatsNew'));
    this.lobbyEl.querySelector('#lobby-play-btn')!.addEventListener('click', () => this.startSelectedMatch());
  }

  private renderWizardStepBody(
    selectedMap: MapId,
    selectedDifficulty: DifficultyId,
    activeModMap: Record<string, number>,
    modBonusPct: number,
    teamEval: { power: number; warnings: string[] },
    recommendedPower: number
  ): string {
    const d = SaveManager.data;
    if (this.hubStep === 'mode') {
      const weekly = getWeeklyChallengeForDate();
      const hourly = getHourlyChallengeModifiers();
      let subHtml = '';
      if (this.selectedMode === 'weekly') {
        subHtml = `
          <div class="gloss-panel" style="padding:10px;margin-top:8px;">
            <div style="font-size:16px;font-weight:800;color:#fde047;">📅 ${weekly.title}</div>
            <div style="font-size:14px;color:#cbd5e1;">${weekly.description} (${MAPS[weekly.mapId].name})</div>
          </div>`;
      } else if (this.selectedMode === 'hourly') {
        const modNames = Object.entries(hourly.modifiers)
          .map(([id, t]) => `${MODIFIER_FAMILIES.find((m) => m.id === id)?.name ?? id} T${t}`)
          .join(' • ');
        subHtml = `
          <div class="gloss-panel" style="padding:10px;margin-top:8px;">
            <div style="font-size:16px;font-weight:800;color:#38bdf8;">⏰ Hourly Modifiers (${hourly.hourKey})</div>
            <div style="font-size:14px;color:#cbd5e1;">${modNames} (+${hourly.seedBonusPct}% Seeds Bonus)</div>
          </div>`;
      } else if (this.selectedMode === 'puzzle') {
        subHtml = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
            ${GARDEN_PUZZLES.map((p) => {
              const stars = d.puzzleStars[p.id] ?? 0;
              return `
                <button class="map-chip ${this.selectedPuzzleId === p.id ? 'active' : ''}" data-puz="${p.id}">
                  <div style="font-weight:800;">#${p.id} ${p.title}</div>
                  <div style="font-size:14px;color:#fde047;">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
                </button>`;
            }).join('')}
          </div>`;
      } else if (this.selectedMode === 'story') {
        subHtml = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
            ${STORY_CHAPTERS.map((ch) => {
              const cleared = d.storyCleared.includes(ch.id);
              return `
                <button class="map-chip ${this.selectedStoryChapterId === ch.id ? 'active' : ''}" data-story="${ch.id}">
                  <div style="font-weight:800;">${ch.title} ${cleared ? '✓' : ''}</div>
                  <div style="font-size:14px;color:#86efac;">${ch.lesson}</div>
                </button>`;
            }).join('')}
          </div>`;
      }

      return `
        <div class="mode-card-grid">
          ${MODE_CATALOG.map((m) => {
            const active = this.selectedMode === m.id;
            return `
              <button class="mode-card ${active ? 'active' : ''}" data-mode="${m.id}">
                <div style="display:flex;justify-content:space-between;font-weight:800;">
                  <span>${m.icon} ${m.name}</span>
                  <span style="color:#86efac;">${m.rewardText}</span>
                </div>
                <div style="font-size:14px;color:#cbd5e1;margin-top:3px;">${m.tagline}</div>
              </button>`;
          }).join('')}
        </div>
        ${subHtml}
      `;
    }

    if (this.hubStep === 'map') {
      return `
        <div class="map-option-grid">
          ${MAP_LIST.map((m) => {
            const active = selectedMap === m.id;
            return `
              <button class="map-chip ${active ? 'active' : ''}" data-map="${m.id}">
                <div style="display:flex;justify-content:space-between;font-weight:800;">
                  <span>${m.name}</span>
                  <span style="color:#86efac;">${m.tierLabel} • ${m.paths.length} Lane${m.paths.length > 1 ? 's' : ''}</span>
                </div>
                <div style="font-size:14px;color:#cbd5e1;margin-top:2px;">${m.description}</div>
              </button>`;
          }).join('')}
        </div>
      `;
    }

    if (this.hubStep === 'difficulty') {
      const isHourly = this.selectedMode === 'hourly';
      return `
        <div style="font-size:15px;font-weight:800;color:#86efac;margin-bottom:6px;">Garden Soil Tier Difficulty</div>
        <div class="diff-pot-row" style="margin-bottom:12px;">
          ${DIFFICULTY_ORDER.map((diff) => {
            const def = DIFFICULTIES[diff];
            const ladder = DIFFICULTY_LADDER[diff];
            const unlocked = SaveManager.isDifficultyUnlocked(selectedMap, diff);
            const active = selectedDifficulty === diff;
            return `
              <button class="diff-pot-btn ${active ? 'active' : ''}" data-diff="${diff}" ${unlocked ? '' : 'disabled'}
                style="color:${unlocked ? def.badgeColor : '#94a3b8'};"
                title="${unlocked ? `${ladder.waves} Waves • ${ladder.unlockRule}` : `Locked: ${ladder.unlockRule}`}">
                <div>${unlocked ? '' : '🔒 '}${diff}</div>
                <div style="font-size:14px;color:#fde047;">+${def.clearRewardSeeds}🌱</div>
              </button>`;
          }).join('')}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:15px;font-weight:800;color:#fde047;">⚔ Modifier Board (${modBonusPct > 0 ? `+${modBonusPct}% Seeds` : 'Optional Risk'})</span>
          ${isHourly ? `<span style="font-size:14px;color:#38bdf8;">Locked to Hourly Seed</span>` : ''}
        </div>
        <div class="modifier-grid">
          ${MODIFIER_FAMILIES.map((fam) => {
            const cur = activeModMap[fam.id] ?? 0;
            const desc = cur > 0 ? fam.effectDescriptions[cur - 1] : 'Off (Standard rules)';
            return `
              <div class="modifier-cell">
                <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;">
                  <span>${fam.icon} ${fam.name}</span>
                  <span style="color:#fde047;">${cur > 0 ? `+${Math.round(fam.seedBonuses[cur - 1] * 100)}%` : '0%'}</span>
                </div>
                <div style="font-size:14px;color:#cbd5e1;">${desc}</div>
                <div style="display:flex;gap:4px;">
                  ${[0, 1, 2, 3, 4]
                    .map(
                      (t) => `
                    <button class="btn btn-sm ${cur === t ? 'btn-gold' : 'btn-slate'}"
                      style="flex:1;padding:2px 4px;min-height:30px;"
                      data-mod-id="${fam.id}" data-mod-tier="${t}" ${isHourly ? 'disabled' : ''}>
                      ${t === 0 ? '0' : `T${t}`}
                    </button>`
                    )
                    .join('')}
                </div>
              </div>`;
          }).join('')}
        </div>
      `;
    }

    // Step 4: Team Preset & Composition Warnings
    return `
      <div style="font-size:15px;font-weight:800;color:#86efac;margin-bottom:6px;">Team Presets</div>
      <div class="leaf-tab-row" style="margin-bottom:10px;">
        ${d.teamPresets
          .map(
            (p, idx) => `
          <button class="leaf-tab-btn ${d.activePreset === idx ? 'active' : ''}" data-preset-idx="${idx}">
            ${p.name}
          </button>`
          )
          .join('')}
        <button class="btn btn-slate btn-sm" id="wizard-open-inv">✏️ Edit Units</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px;">
        ${d.loadout
          .map((uid, idx) => {
            if (!uid) {
              return `<div class="gloss-panel" style="padding:10px;text-align:center;color:#94a3b8;font-size:14px;">Slot ${idx + 1} Empty</div>`;
            }
            const u = getUnitById(uid);
            const own = d.owned[uid];
            const varDef = VARIANTS[own?.variant ?? 'none'];
            return `
              <div class="gloss-panel" style="padding:8px;display:flex;align-items:center;gap:8px;">
                <img src="${ProceduralTextures.getUnitPortraitUrl(uid)}" alt="${u.name}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;"/>
                <div style="min-width:0;">
                  <div style="font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.name}</div>
                  <div style="font-size:14px;color:${varDef.color};">${varDef.id !== 'none' ? varDef.label : u.rarity} • $${u.levels[0].upgradeCost}</div>
                </div>
              </div>`;
          })
          .join('')}
      </div>

      <div class="gloss-panel" style="padding:10px;">
        <div style="font-size:14px;font-weight:800;color:${teamEval.power >= recommendedPower ? '#4ade80' : '#fbbf24'};">
          Power Check: ${teamEval.power.toLocaleString()} vs ${recommendedPower.toLocaleString()} Recommended
        </div>
        ${
          teamEval.warnings.length > 0
            ? `<div style="font-size:14px;color:#fda4af;margin-top:4px;">⚠️ ${teamEval.warnings.join(' • ')}</div>`
            : `<div style="font-size:14px;color:#86efac;margin-top:4px;">✓ Balanced coverage for Anti-Air, Splash & Economy!</div>`
        }
      </div>
    `;
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
    this.lobbyEl.classList.add('hidden');
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
      'Hi! Click card [1] Tomato Tosser below, then click the green lawn near the path to plant its roots!',
      'Awesome! Now click your Tomato Tosser and press Upgrade (or U) to evolve its roots!',
      'Great job! Try toggling the Speed button (1x/2x/3x) or pressing Start Wave!',
      'Defend your Garden Bastion! After the match, open a Seed Summon Crate in the Lobby for +100 Seeds!',
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
  }
}
