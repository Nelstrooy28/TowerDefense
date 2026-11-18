import { MatchController } from '../simulation/MatchController';
import { InputManager } from '../core/InputManager';
import { SaveManager } from '../core/SaveManager';
import { TimeScale, type GameSpeed } from '../core/TimeScale';
import { QualityManager } from '../core/QualityManager';
import { EventBus } from '../core/EventBus';
import { getUnitById } from '../data/UnitRegistry';
import { RARITIES } from '../data/RarityConfig';
import { TRAITS } from '../data/TraitConfig';
import { ProceduralTextures } from '../rendering/ProceduralTextures';
import { SynthAudio } from '../audio/SynthAudio';
import { WavePreview } from './WavePreview';
import { InspectorPanel } from './InspectorPanel';

export class CombatHUD {
  public root: HTMLDivElement;
  public wavePreview: WavePreview;
  public inspector: InspectorPanel;

  private match: MatchController;
  private input: InputManager;
  private displayedCash = 0;

  private cashEl!: HTMLElement;
  private hpEl!: HTMLElement;
  private waveEl!: HTMLElement;
  private skipBtn!: HTMLButtonElement;
  private autoSkipBtn!: HTMLButtonElement;
  private speedBtn!: HTMLButtonElement;
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
    onOpenSettings: () => void,
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
          <button class="btn btn-slate btn-sm" id="hud-speed-btn">Speed: 1x</button>
          <button class="btn btn-slate btn-sm" id="hud-autoskip-btn">Auto-Skip: OFF</button>
          <button class="btn btn-slate btn-sm" id="hud-dmg-btn">DPS Meter</button>
          <button class="btn btn-slate btn-sm" id="hud-mute-btn">🔊</button>
          <button class="btn btn-slate btn-sm" id="hud-settings-btn">⚙️</button>
          <button class="btn btn-rose btn-sm" id="hud-lobby-btn">Lobby</button>
        </div>
      </div>

      <div class="boss-bar-panel gloss-panel hidden" id="hud-boss-bar">
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;">
          <span id="boss-name-text">BLIGHTED TREANT OVERLORD</span>
          <span id="boss-hp-text">65,000 / 65,000</span>
        </div>
        <div class="boss-bar-track">
          <div class="boss-bar-hp" id="boss-hp-fill" style="width:100%"></div>
          <div class="boss-bar-shield" id="boss-shield-fill" style="width:0%"></div>
        </div>
      </div>

      <div class="damage-meter-panel gloss-panel hidden" id="hud-dmg-meter"></div>

      <div class="combat-bottom">
        <div class="ability-bar" id="hud-ability-bar"></div>
        <div class="hotbar-row gloss-panel" id="hud-hotbar-row"></div>
      </div>
    `;
    parent.appendChild(this.root);

    this.wavePreview = new WavePreview(this.root, match);
    this.inspector = new InspectorPanel(this.root, match, input);

    this.cashEl = this.root.querySelector('#hud-cash-text')!;
    this.hpEl = this.root.querySelector('#hud-hp-text')!;
    this.waveEl = this.root.querySelector('#hud-wave-text')!;
    this.skipBtn = this.root.querySelector('#hud-skip-btn') as HTMLButtonElement;
    this.autoSkipBtn = this.root.querySelector('#hud-autoskip-btn') as HTMLButtonElement;
    this.speedBtn = this.root.querySelector('#hud-speed-btn') as HTMLButtonElement;
    this.muteBtn = this.root.querySelector('#hud-mute-btn') as HTMLButtonElement;
    this.dmgToggleBtn = this.root.querySelector('#hud-dmg-btn') as HTMLButtonElement;
    this.hotbarRow = this.root.querySelector('#hud-hotbar-row') as HTMLDivElement;
    this.abilityBar = this.root.querySelector('#hud-ability-bar') as HTMLDivElement;
    this.bossBar = this.root.querySelector('#hud-boss-bar') as HTMLDivElement;
    this.dmgMeterPanel = this.root.querySelector('#hud-dmg-meter') as HTMLDivElement;

    this.skipBtn.addEventListener('click', () => {
      SynthAudio.play('click');
      this.match.skipWave();
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

    this.muteBtn.addEventListener('click', () => {
      QualityManager.applySettings({ muted: !QualityManager.settings.muted });
      SynthAudio.syncVolume();
      this.muteBtn.textContent = QualityManager.settings.muted ? '🔇' : '🔊';
    });

    this.root.querySelector('#hud-settings-btn')!.addEventListener('click', onOpenSettings);
    this.root.querySelector('#hud-lobby-btn')!.addEventListener('click', onExitToLobby);

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
      this.hpEl.textContent = `${hp} / ${maxHp}`;
      const heart = this.root.querySelector('#hud-heart')!;
      heart.textContent = hp < maxHp * 0.5 ? '💔' : '❤️';
      heart.classList.toggle('heart-fast', hp > 0 && hp < maxHp * 0.25);
      if (delta < 0) {
        this.root.querySelector('#hud-hp-pill')!.classList.add('cash-shake');
      }
    });

    EventBus.on('match:boss_spawned', ({ name, maxHp, maxShield }) => {
      this.activeBossMaxHp = maxHp;
      this.activeBossMaxShield = maxShield;
      this.root.querySelector('#boss-name-text')!.textContent = name.toUpperCase();
      this.bossBar.classList.remove('hidden');
    });

    EventBus.on('match:boss_defeated', () => {
      this.bossBar.classList.add('hidden');
    });

    EventBus.on('match:state_changed', () => this.refreshAll());
    EventBus.on('tower:selected', () => this.inspector.render());
    EventBus.on('placement:slot_selected', () => this.refreshHotbar());
  }

  public show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
    this.wavePreview.show(visible);
    if (visible) {
      this.displayedCash = this.match.cash;
      this.bossBar.classList.add('hidden');
      this.refreshAll();
    }
  }

  public refreshAll(): void {
    if (!this.match.inMatch) return;
    this.hpEl.textContent = `${this.match.baseHp} / ${this.match.maxBaseHp}`;
    this.waveEl.textContent = this.match.isEndless
      ? `Endless Wave ${this.match.currentWave}`
      : `Wave ${this.match.currentWave} / ${this.match.totalWaves}`;
    this.muteBtn.textContent = QualityManager.settings.muted ? '🔇' : '🔊';
    this.speedBtn.textContent = `Speed: ${TimeScale.speed}x`;
    this.refreshHotbar();
    this.wavePreview.update();
    this.inspector.render();
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
        const cantAfford = this.match.cash < unit.cost || placed >= unit.cap;

        return `
          <button class="hotbar-card ${isActive ? 'active' : ''} ${cantAfford ? 'unaffordable' : ''}" data-slot="${idx}" style="border-color:${hex};">
            <span class="hotbar-hotkey">${idx + 1}</span>
            <img src="${portrait}" alt="${unit.name}" style="width:58px;height:58px;border-radius:8px;border:2px solid ${hex};" />
            <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${cb} ${unit.name.split(' ')[0]}</div>
            <div style="font-size:14px;display:flex;justify-content:space-between;width:100%;">
              <span class="card-cost">$${unit.cost}</span>
              <span>${placed}/${unit.cap}</span>
            </div>
            <div style="font-size:14px;color:${owned ? TRAITS[owned.trait].color : '#94a3b8'};">${owned?.trait ?? ''}</div>
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
      // §8.7 3D mouse hover tilt (+-6 deg)
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

    // Odometer Cash Counter (§8.7)
    if (Math.abs(this.displayedCash - this.match.cash) > 0.5) {
      this.displayedCash += (this.match.cash - this.displayedCash) * Math.min(1, dt * 16);
      this.cashEl.textContent = `${Math.round(this.displayedCash).toLocaleString()}`;
    } else if (this.displayedCash !== this.match.cash) {
      this.displayedCash = this.match.cash;
      this.cashEl.textContent = `${this.match.cash.toLocaleString()}`;
    }

    // Skip Wave Prompt
    if (!this.match.waveActive) {
      this.skipBtn.classList.remove('hidden');
      this.skipBtn.textContent = `Start Wave ${this.match.currentWave + 1} (${Math.ceil(this.match.waveCountdown)}s)`;
    } else if (this.match.skipBonusAvailable) {
      this.skipBtn.classList.remove('hidden');
      this.skipBtn.textContent = `Skip Wave? [+ $${this.match.getEarlySkipBonus()}]`;
    } else {
      this.skipBtn.classList.add('hidden');
    }

    // Boss HP Bar
    const boss = this.match.enemies.find((e) => !e.isDead && e.def.isBoss);
    if (boss) {
      this.bossBar.classList.remove('hidden');
      const hpPct = Math.max(0, (boss.hp / Math.max(1, this.activeBossMaxHp)) * 100);
      const shPct = this.activeBossMaxShield > 0 ? Math.max(0, (boss.armor / this.activeBossMaxShield) * 100) : 0;
      (this.root.querySelector('#boss-hp-fill') as HTMLElement).style.width = `${hpPct}%`;
      (this.root.querySelector('#boss-shield-fill') as HTMLElement).style.width = `${shPct}%`;
      this.root.querySelector('#boss-hp-text')!.textContent = `${Math.round(boss.hp).toLocaleString()} / ${this.activeBossMaxHp.toLocaleString()}`;
    }

    // Ability Bar (Lv.4+ units)
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

    // Damage Meter (§9.7)
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
