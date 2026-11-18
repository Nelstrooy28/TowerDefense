import { MatchController } from '../simulation/MatchController';
import { InputManager } from '../core/InputManager';
import { SaveManager } from '../core/SaveManager';
import { TimeScale, type GameSpeed } from '../core/TimeScale';
import { QualityManager } from '../core/QualityManager';
import { EventBus } from '../core/EventBus';
import { getUnitById } from '../data/UnitRegistry';
import { RARITIES } from '../data/RarityConfig';
import { TRAITS } from '../data/TraitConfig';
import { MODIFIER_FAMILIES, VARIANTS } from '../data/BalanceConfig';
import { ProceduralTextures } from '../rendering/ProceduralTextures';
import { SynthAudio } from '../audio/SynthAudio';
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

  private activeBossMaxHp = 1;
  private activeBossMaxShield = 0;

  constructor(
    parent: HTMLElement,
    match: MatchController,
    input: InputManager,
    onOpenPause: () => void,
    onExitToLobby: () => void
  ) {
    this.match = match;
    this.input = input;

    this.root = document.createElement('div');
    this.root.className = 'hidden';
    this.root.innerHTML = `
      <div class="combat-top">
        <div class="hud-group">
          <div class="stat-pill" id="hud-hp-pill">
            <span class="heart-pulse" id="hud-heart">❤️</span>
            <span id="hud-hp-text">150 / 150</span>
          </div>
          <div class="stat-pill" id="hud-cash-pill">💵 $<span id="hud-cash-text">600</span></div>
          <div class="stat-pill" id="hud-wave-text">Wave 0 / 20</div>
          <button class="btn btn-gold btn-sm hidden" id="hud-skip-btn">Skip Wave</button>
        </div>
        <div class="hud-group">
          <button class="btn btn-green btn-sm" id="hud-manager-btn" title="Shortcut: M">🌿 Manager</button>
          <button class="btn btn-slate btn-sm" id="hud-pause-btn" title="Shortcut: P">⏸ Pause</button>
          <button class="btn btn-slate btn-sm" id="hud-speed-btn">Speed: 1x</button>
          <button class="btn btn-slate btn-sm" id="hud-autoskip-btn">Auto-Skip: OFF</button>
          <button class="btn btn-slate btn-sm" id="hud-dmg-btn">DPS</button>
          <button class="btn btn-slate btn-sm" id="hud-photo-btn" title="Save Screenshot">📷</button>
          <button class="btn btn-slate btn-sm" id="hud-mute-btn">🔊</button>
          <button class="btn btn-slate btn-sm" id="hud-settings-btn" title="Pause / Menu (Esc)">☰ Menu</button>
          <button class="btn btn-rose btn-sm" id="hud-lobby-btn">Hub</button>
        </div>
      </div>

      <div class="wave-timeline-strip gloss-panel" id="hud-wave-timeline"></div>
      <div class="hud-modifiers-bar hidden" id="hud-modifiers-bar"></div>
      <div class="hud-mode-tip gloss-panel hidden" id="hud-mode-banner"></div>
      <div class="hud-sandbox-bar gloss-panel hidden" id="hud-sandbox-bar"></div>
      <div class="hud-rival-bar gloss-panel hidden" id="hud-rival-bar"></div>

      <div class="boss-bar-panel gloss-panel hidden" id="hud-boss-bar">
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;">
          <span id="boss-name-text">BLIGHTED TREANT OVERLORD</span>
          <span id="boss-hp-text">24,000 / 24,000</span>
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

      <div class="combat-bottom">
        <div class="ability-bar" id="hud-ability-bar"></div>
        <div class="hotbar-row gloss-panel" id="hud-hotbar-row"></div>
      </div>
    `;
    parent.appendChild(this.root);

    this.wavePreview = new WavePreview(this.root, match);
    this.inspector = new InspectorPanel(this.root, match, input);
    this.gardenManager = new GardenManagerPanel(this.root, match, input);

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

    this.root.querySelector('#hud-manager-btn')!.addEventListener('click', () => {
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
      this.speedBtn.textContent = `Speed: ${next}x`;
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

    this.root.querySelector('#hud-settings-btn')!.addEventListener('click', onOpenPause);
    this.root.querySelector('#hud-lobby-btn')!.addEventListener('click', onExitToLobby);

    EventBus.on('match:paused_changed', ({ paused }) => {
      this.pauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
      this.pauseBtn.classList.toggle('btn-gold', paused);
      this.pauseBtn.classList.toggle('btn-slate', !paused);
    });

    EventBus.on('match:killfeed', ({ text, color }) => this.pushKillFeed(text, color));
    EventBus.on('match:mode_tip', ({ text }) => {
      this.modeBannerEl.textContent = `💡 ${text}`;
      this.modeBannerEl.classList.remove('hidden');
      setTimeout(() => this.modeBannerEl.classList.add('hidden'), 6500);
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
    } else {
      this.displayedCash = this.match.cash;
      this.bossBar.classList.add('hidden');
      this.killFeedEl.innerHTML = '';
      this.refreshAll();
    }
  }

  public refreshAll(): void {
    if (!this.match.inMatch) return;
    if (this.match.gameMode !== 'survival') {
      this.hpEl.textContent = `${this.match.baseHp} / ${this.match.maxBaseHp}`;
    }
    this.waveEl.textContent = this.match.isEndless
      ? `Endless Wave ${this.match.currentWave}`
      : `Wave ${this.match.currentWave} / ${this.match.totalWaves}`;
    this.muteBtn.textContent = QualityManager.settings.muted ? '🔇' : '🔊';
    this.speedBtn.textContent = `Speed: ${TimeScale.speed}x`;
    this.pauseBtn.textContent = TimeScale.paused ? '▶ Resume' : '⏸ Pause';
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
        return `<span class="mod-chip" title="${fam.name} Lv.${lvl}: ${fam.effectDescriptions[lvl - 1]}">${fam.icon} ${fam.name} ${lvl}</span>`;
      })
      .join('');
  }

  private refreshModePanels(): void {
    if (this.match.gameMode === 'sandbox') {
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
      const isSnail = w % 10 === 0 && !isBoss;
      const icon = isBoss ? '💀' : isSnail ? '🐌' : w >= 12 ? '⚡' : '🐜';
      items.push(`<span style="color:${isBoss ? '#f43f5e' : '#e2e8f0'};">W${w} ${icon}</span>`);
    }
    this.timelineEl.innerHTML =
      items.length > 0 ? `<span>Upcoming:</span> ${items.join(' • ')}` : `<span>Final Wave!</span>`;
  }

  public refreshHotbar(): void {
    const loadout = SaveManager.data.loadout;
    this.hotbarRow.innerHTML = loadout
      .map((uId, idx) => {
        if (!uId) {
          return `<div class="hotbar-card" style="opacity:0.35;cursor:default;"><span class="hotbar-hotkey">${idx + 1}</span><div style="margin:auto;">Empty</div></div>`;
        }
        const unit = getUnitById(uId);
        const owned = SaveManager.data.owned[uId];
        const placed = this.match.getUnitPlacedCount(uId);
        const hex = RARITIES[unit.rarity].hex;
        const cb = QualityManager.settings.colorblindMode ? RARITIES[unit.rarity].symbolChar : '';
        const portrait = ProceduralTextures.getUnitPortraitUrl(uId);
        const isActive = this.input.activeSlotIndex === idx;
        const effectiveCost = Math.round((unit.cost * this.match.modifierEffects.towerCostMult) / 5) * 5;
        const cantAfford = (!this.match.sandboxInfiniteCash && this.match.cash < effectiveCost) || placed >= unit.cap;
        const varId = owned?.variant ?? 'none';
        const varTag = varId !== 'none' ? `<span style="color:${VARIANTS[varId].color};">★${VARIANTS[varId].label}</span>` : '';

        return `
          <button class="hotbar-card ${isActive ? 'active' : ''} ${cantAfford ? 'unaffordable' : 'affordable-glow'}" data-slot="${idx}" style="border-color:${hex};">
            <span class="hotbar-hotkey">${idx + 1}</span>
            <img src="${portrait}" alt="${unit.name}" style="width:56px;height:56px;border-radius:8px;border:2px solid ${hex};" />
            <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${cb} ${unit.name.split(' ')[0]}</div>
            <div style="font-size:14px;display:flex;justify-content:space-between;width:100%;">
              <span class="card-cost">$${effectiveCost}</span>
              <span>${placed}/${unit.cap}</span>
            </div>
            <div style="font-size:14px;color:${owned ? TRAITS[owned.trait].color : '#94a3b8'};">${owned?.trait ?? ''} ${varTag}</div>
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

    if (Math.abs(this.displayedCash - this.match.cash) > 0.5) {
      this.displayedCash += (this.match.cash - this.displayedCash) * Math.min(1, dt * 16);
      this.cashEl.textContent = `${Math.round(this.displayedCash).toLocaleString()}`;
    } else if (this.displayedCash !== this.match.cash) {
      this.displayedCash = this.match.cash;
      this.cashEl.textContent = `${this.match.cash.toLocaleString()}`;
    }

    if (!this.match.waveActive) {
      this.skipBtn.classList.remove('hidden');
      this.skipBtn.textContent = `Start Wave ${this.match.currentWave + 1} (${Math.ceil(this.match.waveCountdown)}s)`;
    } else if (this.match.skipBonusAvailable) {
      this.skipBtn.classList.remove('hidden');
      this.skipBtn.textContent = `Skip Wave? [+ $${this.match.getEarlySkipBonus()}]`;
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
    const keys = ['Q', 'E', 'R'];
    this.abilityBar.innerHTML = abilityTowers
      .slice(0, 3)
      .map((t, i) => {
        const ab = t.def.ability!;
        const ready = t.isAbilityReady();
        const cdStr = ready ? 'READY' : `${t.abilityCooldownRemaining.toFixed(1)}s`;
        return `
          <button class="ability-btn ${ready ? 'ready' : ''}" data-ab-idx="${i}">
            [${keys[i]}] ${ab.name} (${cdStr})
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
