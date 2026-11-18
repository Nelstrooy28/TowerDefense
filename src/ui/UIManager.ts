import { MatchController } from '../simulation/MatchController';
import { InputManager } from '../core/InputManager';
import { SaveManager } from '../core/SaveManager';
import { EventBus } from '../core/EventBus';
import { QualityManager } from '../core/QualityManager';
import { DIFFICULTIES, MAP_LIST, type DifficultyId, type MapId } from '../data/MapRegistry';
import {
  GARDEN_PUZZLES,
  getWeeklyChallengeForDate,
  type GameModeId,
} from '../data/GameModesConfig';
import { CombatHUD } from './CombatHUD';
import { SynthAudio } from '../audio/SynthAudio';
import type { SummonModal } from './SummonModal';
import type { InventoryModal } from './InventoryModal';
import type { QuestPanel } from './QuestPanel';
import type { SettingsModal } from './SettingsModal';
import type { CodexModal } from './CodexModal';
import type { GardenPassModal } from './GardenPassModal';

export class UIManager {
  private root: HTMLElement;
  private match: MatchController;
  private input: InputManager;

  private lobbyEl: HTMLDivElement;
  private combatHud: CombatHUD;

  // Fix F5 (§2): Lazy-loaded modals to reduce initial JS bundle size
  private summonModal: SummonModal | null = null;
  private inventoryModal: InventoryModal | null = null;
  private questPanel: QuestPanel | null = null;
  private settingsModal: SettingsModal | null = null;
  private codexModal: CodexModal | null = null;
  private passModal: GardenPassModal | null = null;

  private toastStack: HTMLDivElement;
  private flashOverlay: HTMLDivElement;
  private letterTop: HTMLDivElement;
  private letterBot: HTMLDivElement;
  private waveBanner: HTMLDivElement;
  private endModal: HTMLDivElement;
  private tutorialBox: HTMLDivElement;

  private selectedMode: GameModeId = 'standard';
  private selectedPuzzleId = 1;
  private tutorialStep = 0;

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
      () => void this.openSettings(),
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
    this.tutorialBox = document.createElement('div');
    this.tutorialBox.className = 'tutorial-box gloss-panel hidden';

    this.root.append(
      this.letterTop,
      this.letterBot,
      this.waveBanner,
      this.toastStack,
      this.flashOverlay,
      this.endModal,
      this.tutorialBox
    );

    this.renderLobby();
    this.bindEvents();
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
    const canSummon = d.seeds >= 100 || d.enchantedKeys > 0;
    const claimableQuests = d.dailyQuests.filter((q) => !q.claimed && q.progress >= q.target).length;
    const xpNeeded = d.playerLevel * 200;
    const weekly = getWeeklyChallengeForDate();

    let modeBodyHtml = '';
    if (this.selectedMode === 'standard' || this.selectedMode === 'boss_rush') {
      modeBodyHtml = `
        <div class="map-option-grid">
          ${MAP_LIST.map((m) => {
            const active = d.selectedMap === m.id;
            return `
              <button class="map-chip ${active ? 'active' : ''}" data-map="${m.id}">
                <div style="display:flex;justify-content:space-between;font-weight:800;">
                  <span>${m.name}</span>
                  <span style="color:#86efac;">${m.tierLabel}</span>
                </div>
                <div style="font-size:14px;color:#cbd5e1;margin-top:2px;">${m.description}</div>
              </button>
            `;
          }).join('')}
        </div>
        ${
          this.selectedMode === 'standard'
            ? `<div class="diff-row">
                ${(['Easy', 'Normal', 'Hard', 'Insane'] as DifficultyId[])
                  .map((diff) => {
                    const def = DIFFICULTIES[diff];
                    const active = d.selectedDifficulty === diff;
                    return `<button class="diff-btn ${active ? 'active' : ''}" data-diff="${diff}" style="color:${def.badgeColor};">${diff}<br/>+${def.clearRewardSeeds}🌱</button>`;
                  })
                  .join('')}
              </div>`
            : `<div style="font-size:14px;color:#fde047;">Boss Rush: Fight all 4 bosses back-to-back with $5,000 start!</div>`
        }
      `;
    } else if (this.selectedMode === 'weekly') {
      modeBodyHtml = `
        <div class="gloss-panel" style="padding:12px;">
          <div style="font-size:17px;font-weight:800;color:#fde047;">📅 ${weekly.title}</div>
          <div style="font-size:14px;color:#cbd5e1;margin-top:4px;">${weekly.description}</div>
          <div style="font-size:14px;color:#4ade80;margin-top:4px;">Reward: +400 Seeds & Badge</div>
        </div>
      `;
    } else {
      modeBodyHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:220px;overflow-y:auto;">
          ${GARDEN_PUZZLES.map((p) => {
            const stars = d.puzzleStars[p.id] ?? 0;
            const active = this.selectedPuzzleId === p.id;
            return `
              <button class="map-chip ${active ? 'active' : ''}" data-puz="${p.id}">
                <div style="font-weight:700;">#${p.id} ${p.title}</div>
                <div style="font-size:14px;color:#fde047;">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    this.lobbyEl.innerHTML = `
      <div class="lobby-topbar">
        <div class="lobby-brand gloss-panel">
          <div style="font-size:28px;">🌻</div>
          <div>
            <div class="lobby-title">Garden Bastion TD</div>
            <div style="font-size:14px;color:#86efac;">Lv.${d.playerLevel} Gardener (${d.playerXp}/${xpNeeded} XP) • Pass T${d.gardenPass.tier}</div>
          </div>
        </div>

        <div class="currency-strip">
          <div class="stat-pill">🌱 ${d.seeds} Seeds</div>
          <div class="stat-pill">💧 ${d.dewdrops} Dewdrops</div>
          <button class="btn btn-slate btn-sm" id="lobby-settings-btn">⚙️ Settings</button>
        </div>
      </div>

      <div class="lobby-center">
        <div class="lobby-map-card gloss-panel">
          <div class="mode-tabs">
            <button class="diff-btn ${this.selectedMode === 'standard' ? 'active' : ''}" data-mode="standard">Standard</button>
            <button class="diff-btn ${this.selectedMode === 'weekly' ? 'active' : ''}" data-mode="weekly">Weekly</button>
            <button class="diff-btn ${this.selectedMode === 'boss_rush' ? 'active' : ''}" data-mode="boss_rush">Boss Rush</button>
            <button class="diff-btn ${this.selectedMode === 'puzzle' ? 'active' : ''}" data-mode="puzzle">Puzzles</button>
          </div>
          ${modeBodyHtml}
          <button class="btn btn-green" id="lobby-play-btn" style="font-size:18px;padding:12px;">
            ▶ Play ${this.selectedMode === 'puzzle' ? `Puzzle #${this.selectedPuzzleId}` : 'Match'}
          </button>
        </div>
      </div>

      <div class="lobby-nav">
        <button class="btn btn-purple" id="lobby-summon-btn">
          🎁 Summon Crates ${canSummon ? '<span class="badge-dot">!</span>' : ''}
        </button>
        <button class="btn btn-gold" id="lobby-inv-btn">
          🌿 Units & Loadout (${d.loadout.filter(Boolean).length}/6)
        </button>
        <button class="btn btn-green" id="lobby-pass-btn">
          🌸 Garden Pass (T${d.gardenPass.tier})
        </button>
        <button class="btn" id="lobby-quests-btn">
          📜 Quests ${claimableQuests > 0 ? `<span class="badge-dot">${claimableQuests}</span>` : ''}
        </button>
        <button class="btn btn-slate" id="lobby-codex-btn">
          📖 Codex & Ranks
        </button>
      </div>
    `;

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

    this.lobbyEl.querySelectorAll('[data-map]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mapId = (btn as HTMLElement).dataset.map as MapId;
        SaveManager.data.selectedMap = mapId;
        SaveManager.save();
        this.match.loadDiorama(mapId);
        SynthAudio.play('click');
      });
    });

    this.lobbyEl.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        SaveManager.data.selectedDifficulty = (btn as HTMLElement).dataset.diff as DifficultyId;
        SaveManager.save();
        SynthAudio.play('click');
      });
    });

    this.lobbyEl.querySelector('#lobby-summon-btn')!.addEventListener('click', () => void this.openSummon());
    this.lobbyEl.querySelector('#lobby-inv-btn')!.addEventListener('click', () => void this.openInventory());
    this.lobbyEl.querySelector('#lobby-pass-btn')!.addEventListener('click', () => void this.openGardenPass());
    this.lobbyEl.querySelector('#lobby-quests-btn')!.addEventListener('click', () => void this.openQuests());
    this.lobbyEl.querySelector('#lobby-codex-btn')!.addEventListener('click', () => void this.openCodex());
    this.lobbyEl.querySelector('#lobby-settings-btn')!.addEventListener('click', () => void this.openSettings());
    this.lobbyEl.querySelector('#lobby-play-btn')!.addEventListener('click', () => this.startSelectedMatch());
  }

  private startSelectedMatch(): void {
    SynthAudio.play('click');
    this.lobbyEl.classList.add('hidden');
    this.endModal.classList.add('hidden');
    this.match.startMatch(
      SaveManager.data.selectedMap,
      SaveManager.data.selectedDifficulty,
      this.selectedMode,
      this.selectedMode === 'puzzle' ? this.selectedPuzzleId : undefined
    );
    this.combatHud.show(true);

    if (this.selectedMode === 'puzzle') {
      const puz = GARDEN_PUZZLES.find((p) => p.id === this.selectedPuzzleId);
      if (puz) this.pushToast(`🧩 ${puz.title}`, puz.hint, '#fde047');
    }

    if (!SaveManager.data.tutorialCompleted && !SaveManager.data.tutorialSkipped && this.selectedMode === 'standard') {
      this.tutorialStep = 0;
      this.renderTutorial();
    }
  }

  private exitToLobby(): void {
    SynthAudio.play('click');
    this.input.selectTower(null);
    this.input.selectSlot(null);
    this.combatHud.show(false);
    this.endModal.classList.add('hidden');
    this.tutorialBox.classList.add('hidden');
    this.match.returnToLobby();
    this.lobbyEl.classList.remove('hidden');
    this.renderLobby();
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
    const mvp = [...this.match.towers].sort((a, b) => b.totalDamageDealt - a.totalDamageDealt)[0];
    this.endModal.classList.remove('hidden');
    this.endModal.innerHTML = `
      <div class="modal-card gloss-panel" style="width:480px;text-align:center;">
        <div class="modal-header" style="justify-content:center;">
          <div style="font-size:26px;font-weight:800;color:${victory ? '#4ade80' : '#f43f5e'};">
            ${victory ? '🏆 GARDEN DEFENDED!' : '🥀 GARDEN OVERRUN'}
          </div>
        </div>
        <div class="modal-body" style="align-items:center;">
          <div style="font-size:18px;">Waves Cleared: <strong>${wavesCleared}</strong></div>
          ${victory ? `<div style="font-size:20px;color:#fbbf24;font-weight:800;">+${seedsEarned} Seeds Earned!</div>` : ''}
          ${mvp ? `<div style="font-size:16px;color:#86efac;">⭐ MVP Unit: <strong>${mvp.def.name}</strong> (${mvp.totalDamageDealt.toLocaleString()} DMG)</div>` : ''}
          <div style="display:flex;gap:12px;width:100%;margin-top:8px;">
            ${victory && !this.match.isEndless && this.match.gameMode === 'standard' ? '<button class="btn btn-purple" id="end-endless" style="flex:1;">Continue Endless</button>' : ''}
            <button class="btn btn-green" id="end-lobby" style="flex:1;">Claim & Return to Lobby</button>
          </div>
        </div>
      </div>
    `;

    this.endModal.querySelector('#end-endless')?.addEventListener('click', () => {
      this.endModal.classList.add('hidden');
      this.match.continueIntoEndless();
      SynthAudio.play('click');
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
