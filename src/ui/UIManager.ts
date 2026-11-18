import { MatchController } from '../simulation/MatchController';
import { InputManager } from '../core/InputManager';
import { SaveManager } from '../core/SaveManager';
import { EventBus } from '../core/EventBus';
import { QualityManager } from '../core/QualityManager';
import { DIFFICULTIES, MAP_LIST, type DifficultyId, type MapId } from '../data/MapRegistry';
import { SummonModal } from './SummonModal';
import { InventoryModal } from './InventoryModal';
import { QuestPanel } from './QuestPanel';
import { SettingsModal } from './SettingsModal';
import { CombatHUD } from './CombatHUD';
import { SynthAudio } from '../audio/SynthAudio';

export class UIManager {
  private root: HTMLElement;
  private match: MatchController;
  private input: InputManager;

  private lobbyEl: HTMLDivElement;
  private summonModal: SummonModal;
  private inventoryModal: InventoryModal;
  private questPanel: QuestPanel;
  private settingsModal: SettingsModal;
  private combatHud: CombatHUD;

  private toastStack: HTMLDivElement;
  private flashOverlay: HTMLDivElement;
  private letterTop: HTMLDivElement;
  private letterBot: HTMLDivElement;
  private waveBanner: HTMLDivElement;
  private endModal: HTMLDivElement;
  private tutorialBox: HTMLDivElement;

  private tutorialStep = 0; // 0=place tomato, 1=upgrade, 2=speed, 3=wave, 4=done

  constructor(root: HTMLElement, match: MatchController, input: InputManager) {
    this.root = root;
    this.match = match;
    this.input = input;

    this.lobbyEl = document.createElement('div');
    this.lobbyEl.className = 'lobby-screen';
    this.root.appendChild(this.lobbyEl);

    this.summonModal = new SummonModal(this.root);
    this.inventoryModal = new InventoryModal(this.root);
    this.questPanel = new QuestPanel(this.root);
    this.settingsModal = new SettingsModal(this.root);
    this.combatHud = new CombatHUD(
      this.root,
      match,
      input,
      () => this.settingsModal.open(),
      () => this.exitToLobby()
    );

    // Overlays: Letterbox, Wave Banner, Toasts, Screen Flash, End Modal, Tutorial Sprout
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

  private bindEvents(): void {
    EventBus.on('save:updated', () => {
      if (!this.match.inMatch) this.renderLobby();
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
        ? `<div style="font-size:22px;font-weight:800;color:#f43f5e;">⚠️ BOSS INCOMING: BLIGHTED TREANT OVERLORD</div>`
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

    // Tutorial progression hooks (§15.7)
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

    this.lobbyEl.innerHTML = `
      <div class="lobby-topbar">
        <div class="lobby-brand gloss-panel">
          <div style="font-size:28px;">🌻</div>
          <div>
            <div class="lobby-title">Garden Bastion TD</div>
            <div style="font-size:14px;color:#86efac;">Lv.${d.playerLevel} Gardener (${d.playerXp}/${xpNeeded} XP)</div>
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
          <div style="font-size:19px;font-weight:800;">Select Garden Map</div>
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

          <div style="font-size:16px;font-weight:700;">Difficulty</div>
          <div class="diff-row">
            ${(['Easy', 'Normal', 'Hard', 'Insane'] as DifficultyId[])
              .map((diff) => {
                const def = DIFFICULTIES[diff];
                const active = d.selectedDifficulty === diff;
                return `<button class="diff-btn ${active ? 'active' : ''}" data-diff="${diff}" style="color:${def.badgeColor};">${diff}<br/>+${def.clearRewardSeeds}🌱</button>`;
              })
              .join('')}
          </div>

          <button class="btn btn-green" id="lobby-play-btn" style="font-size:19px;padding:13px;">
            ▶ Play Match
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
        <button class="btn" id="lobby-quests-btn">
          📜 Quests & Badges ${claimableQuests > 0 ? `<span class="badge-dot">${claimableQuests}</span>` : ''}
        </button>
      </div>
    `;

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

    this.lobbyEl.querySelector('#lobby-summon-btn')!.addEventListener('click', () => this.summonModal.open());
    this.lobbyEl.querySelector('#lobby-inv-btn')!.addEventListener('click', () => this.inventoryModal.open());
    this.lobbyEl.querySelector('#lobby-quests-btn')!.addEventListener('click', () => this.questPanel.open());
    this.lobbyEl.querySelector('#lobby-settings-btn')!.addEventListener('click', () => this.settingsModal.open());
    this.lobbyEl.querySelector('#lobby-play-btn')!.addEventListener('click', () => this.startSelectedMatch());
  }

  private startSelectedMatch(): void {
    SynthAudio.play('click');
    this.lobbyEl.classList.add('hidden');
    this.endModal.classList.add('hidden');
    this.match.startMatch(SaveManager.data.selectedMap, SaveManager.data.selectedDifficulty);
    this.combatHud.show(true);

    if (!SaveManager.data.tutorialCompleted && !SaveManager.data.tutorialSkipped) {
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
      'Hi! Click card [1] Tomato Tosser below, then click the green lawn near the path to place it!',
      'Awesome! Now click your Tomato Tosser and press Upgrade (or U) to power it up!',
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
          <div style="display:flex;gap:12px;width:100%;margin-top:8px;">
            ${victory && !this.match.isEndless ? '<button class="btn btn-purple" id="end-endless" style="flex:1;">Continue Endless</button>' : ''}
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
