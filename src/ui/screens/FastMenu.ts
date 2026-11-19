import { SaveManager } from '../../core/SaveManager';
import { Keybinds } from '../../core/Keybinds';
import { EventBus } from '../../core/EventBus';
import {
  CURRENT_VERSION,
  DIFFICULTY_LADDER,
  DIFFICULTY_ORDER,
  MODIFIER_FAMILIES,
  VARIANTS,
  computeModifierEffects,
  getHourlyChallengeModifiers,
} from '../../data/BalanceConfig';
import {
  GARDEN_PUZZLES,
  MODE_CATALOG,
  STORY_CHAPTERS,
  getWeeklyChallengeForDate,
  type GameModeId,
} from '../../data/GameModesConfig';
import { DIFFICULTIES, MAP_LIST, MAPS, type DifficultyId, type MapId } from '../../data/MapRegistry';
import { getUnitById } from '../../data/UnitRegistry';
import { computeTeamPower } from '../../data/UnitQuery';
import { ProceduralTextures } from '../../rendering/ProceduralTextures';
import { ScreenRouter } from '../ScreenRouter';
import { SynthAudio } from '../../audio/SynthAudio';
import type { MatchController } from '../../simulation/MatchController';
import type { HubStationId } from '../../hub/Station';

export type HubWizardStep = 'mode' | 'map' | 'difficulty' | 'team';

const GNOME_MILESTONES: Array<{ xp: number; unitId: string; label: string }> = [
  { xp: 100, unitId: 'bramble_snare', label: 'Bramble Snare' },
  { xp: 300, unitId: 'walnut_wall', label: 'Ironwood Stump' },
  { xp: 600, unitId: 'sunflower_producer', label: 'Sunny Sprout' },
];

export interface FastMenuCallbacks {
  getWizardState: () => {
    mode: GameModeId;
    puzzleId: number;
    storyChapterId: number;
    modifiers: Record<string, number>;
    step: HubWizardStep;
  };
  setWizardState: (
    patch: Partial<{
      mode: GameModeId;
      puzzleId: number;
      storyChapterId: number;
      modifiers: Record<string, number>;
      step: HubWizardStep;
    }>
  ) => void;
  onNavigateStep: (step: HubWizardStep) => void;
  onLaunch: () => void;
  onOpenInventory: () => void;
  onOpenSummon: () => void;
  onOpenShop: (tab: 'Shop' | 'Codes' | 'WhatsNew') => void;
  onOpenQuests: () => void;
  onOpenPass: () => void;
  onOpenCodex: () => void;
  onOpenSettings: () => void;
  onPushToast: (title: string, subtitle?: string, color?: string) => void;
  onCloseFastMenu: () => void;
}

export class FastMenu {
  public readonly root: HTMLDivElement;
  public isOpen = false;

  private readonly match: MatchController;
  private readonly callbacks: FastMenuCallbacks;

  constructor(parent: HTMLElement, match: MatchController, callbacks: FastMenuCallbacks) {
    this.match = match;
    this.callbacks = callbacks;

    this.root = document.createElement('div');
    this.root.className = 'fast-menu-overlay hidden';
    parent.appendChild(this.root);
  }

  public open(step?: HubWizardStep): void {
    if (step) {
      this.callbacks.setWizardState({ step });
    }
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.render();
  }

  public close(): void {
    this.isOpen = false;
    this.root.classList.add('hidden');
  }

  public render(): void {
    if (!this.isOpen) return;

    const d = SaveManager.data;
    const state = this.callbacks.getWizardState();
    const canSummon = d.seeds >= 100 || d.enchantedKeys > 0 || d.eventTickets > 0;
    const claimableQuests = d.dailyQuests.filter((q) => !q.claimed && q.progress >= q.target).length;
    const xpNeeded = d.playerLevel * 200;
    const boosts = SaveManager.getActiveBoosts();
    const unreadNews = d.whatsNewSeenVersion !== CURRENT_VERSION;

    if (!SaveManager.isDifficultyUnlocked(d.selectedMap, d.selectedDifficulty)) {
      d.selectedDifficulty = 'Easy';
    }

    const activeModMap =
      state.mode === 'hourly' ? getHourlyChallengeModifiers().modifiers : state.modifiers;
    const modEffects = computeModifierEffects(activeModMap);
    const modBonusPct = Math.round(modEffects.seedBonusTotal * 100);
    const teamEval = computeTeamPower(d.loadout, d.owned);
    const diffDef = DIFFICULTY_LADDER[d.selectedDifficulty] ?? DIFFICULTY_LADDER.Easy;
    const selectedMapDef = MAPS[d.selectedMap] ?? MAPS.sunny_backyard;
    const modeMeta = MODE_CATALOG.find((m) => m.id === state.mode) ?? MODE_CATALOG[0];

    const wizardContentHtml = this.renderWizardStepBody(
      state,
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

    this.root.innerHTML = `
      <div class="fast-menu-drawer">
        <div class="lobby-topbar">
          <div class="lobby-brand paper-panel">
            <div style="font-size:28px;">🌻</div>
            <div>
              <div class="lobby-title">Garden Fast Menu <span style="font-size:14px;color:#86efac;">v${CURRENT_VERSION}</span></div>
              <div style="font-size:14px;color:#cbd5e1;">Lv.${d.playerLevel} Gardener (${d.playerXp}/${xpNeeded} XP) • Pass T${d.gardenPass.tier}</div>
            </div>
            ${boosts.doubleSeeds ? `<span class="stat-pill" style="border-color:#4ade80;color:#4ade80;">🌱 ×2 Weekend</span>` : ''}
            ${boosts.doubleLuck ? `<span class="stat-pill" style="border-color:#fde047;color:#fde047;">🍀 ×2 Luck</span>` : ''}
          </div>

          <div class="currency-strip">
            <div class="stat-pill">🌱 ${d.seeds} Seeds</div>
            <div class="stat-pill">💧 ${d.dewdrops} Dewdrops</div>
            <div class="stat-pill">🎫 ${d.eventTickets} Tickets</div>
            <button class="leaf-tab-btn" id="fm-news-btn">
              📰 News ${unreadNews ? '<span class="badge-new">NEW</span>' : ''}
            </button>
            <button class="btn btn-rose btn-sm" id="fm-close-btn">✕ Close ${Keybinds.badge('hub_fast_menu')}</button>
          </div>
        </div>

        <div class="hub-layout" style="flex:1;min-height:0;">
          <div class="hub-signs-col">
            <button class="wood-sign-btn active" id="sign-play" data-teleport="play_pads">
              <span>▶ Play & Setup</span>${Keybinds.badge('start_wave')}
            </button>
            <button class="wood-sign-btn" id="lobby-inv-btn" data-teleport="shed">
              <span>🌿 Units & Presets (${d.loadout.filter(Boolean).length}/6)</span>${Keybinds.badge('hub_units')}
            </button>
            <button class="wood-sign-btn" id="lobby-summon-btn" data-teleport="greenhouse">
              <span>🎁 Summon Crates ${canSummon ? '<span class="badge-dot">!</span>' : ''}</span>${Keybinds.badge('hub_summon')}
            </button>
            <button class="wood-sign-btn" id="lobby-shop-btn" data-teleport="seed_shop">
              <span>🛒 Weekly Seed Shop</span>${Keybinds.badge('hub_shop')}
            </button>
            <button class="wood-sign-btn" id="lobby-quests-btn" data-teleport="mossbeard">
              <span>📜 Quests ${claimableQuests > 0 ? `<span class="badge-dot">${claimableQuests}</span>` : ''}</span>${Keybinds.badge('hub_quests')}
            </button>
            <button class="wood-sign-btn" id="lobby-pass-btn" data-teleport="fountain">
              <span>🌸 Garden Pass (T${d.gardenPass.tier})</span><span style="font-size:14px;opacity:0.85;">Pass</span>
            </button>
            <button class="wood-sign-btn" id="lobby-codex-btn" data-teleport="trophy_podium">
              <span>📖 Bestiary & Ranks</span>${Keybinds.badge('hub_codex')}
            </button>
            <button class="wood-sign-btn" id="lobby-codes-btn" data-teleport="notice_board">
              <span>🎁 Codes & Extras</span>${Keybinds.badge('hub_extras')}
            </button>
            <button class="wood-sign-btn" id="lobby-settings-btn" data-teleport="fountain">
              <span>⚙️ Settings</span>${Keybinds.badge('hub_settings')}
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
                state.step !== 'mode'
                  ? `<button class="leaf-tab-btn" id="wizard-back-btn">← Back ${Keybinds.badge('cancel')}</button>`
                  : ''
              }
            </div>

            <div class="hub-wizard-steps">
              <button class="leaf-tab-btn ${state.step === 'mode' ? 'active' : ''}" data-step="mode">1. Mode</button>
              <button class="leaf-tab-btn ${state.step === 'map' ? 'active' : ''}" data-step="map">2. Map</button>
              <button class="leaf-tab-btn ${state.step === 'difficulty' ? 'active' : ''}" data-step="difficulty">3. Diff & Mods</button>
              <button class="leaf-tab-btn ${state.step === 'team' ? 'active' : ''}" data-step="team">4. Team</button>
            </div>

            <div style="flex:1;min-height:0;overflow-y:auto;padding-right:4px;">
              ${wizardContentHtml}
            </div>

            <div style="border-top:1px solid rgba(255,255,255,0.14);padding-top:10px;display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;color:#cbd5e1;">
                <span>Team Power: <strong style="color:${teamEval.power >= diffDef.recommendedPower ? '#4ade80' : '#fbbf24'};">${teamEval.power.toLocaleString()}</strong> / Rec ${diffDef.recommendedPower.toLocaleString()}</span>
                <span>${modBonusPct > 0 ? `<strong style="color:#fde047;">+${modBonusPct}% Mod Seeds</strong>` : d.selectedDifficulty}</span>
              </div>
              <button class="seed-pod-btn" id="fast-play-btn" style="width:100%;">
                ▶ Play ${
                  state.mode === 'puzzle'
                    ? `Puzzle #${state.puzzleId}`
                    : state.mode === 'story'
                      ? `Story Ch.${state.storyChapterId}`
                      : `${modeMeta.name} (${d.selectedDifficulty})`
                } ${Keybinds.badge('start_wave')}
              </button>
            </div>
          </div>
        </div>

        <div class="podium-strip">
          <div><strong style="color:#fde047;">🏆 ${selectedMapDef.name} Endless Podium:</strong> ${podiumText}</div>
          <div style="color:#94a3b8;">Click any wooden sign to teleport Avatar & open • Esc Back</div>
        </div>
      </div>
    `;

    this.bindInteractions(state, nextMilestone);
  }

  private renderWizardStepBody(
    state: ReturnType<FastMenuCallbacks['getWizardState']>,
    selectedMap: MapId,
    selectedDifficulty: DifficultyId,
    activeModMap: Record<string, number>,
    modBonusPct: number,
    teamEval: { power: number; warnings: string[] },
    recommendedPower: number
  ): string {
    const d = SaveManager.data;
    if (state.step === 'mode') {
      const weekly = getWeeklyChallengeForDate();
      const hourly = getHourlyChallengeModifiers();
      let subHtml = '';
      if (state.mode === 'weekly') {
        subHtml = `
          <div class="gloss-panel" style="padding:10px;margin-top:8px;">
            <div style="font-size:16px;font-weight:800;color:#fde047;">📅 ${weekly.title}</div>
            <div style="font-size:14px;color:#cbd5e1;">${weekly.description} (${MAPS[weekly.mapId].name})</div>
          </div>`;
      } else if (state.mode === 'hourly') {
        const modNames = Object.entries(hourly.modifiers)
          .map(([id, t]) => `${MODIFIER_FAMILIES.find((m) => m.id === id)?.name ?? id} T${t}`)
          .join(' • ');
        subHtml = `
          <div class="gloss-panel" style="padding:10px;margin-top:8px;">
            <div style="font-size:16px;font-weight:800;color:#38bdf8;">⏰ Hourly Modifiers (${hourly.hourKey})</div>
            <div style="font-size:14px;color:#cbd5e1;">${modNames} (+${hourly.seedBonusPct}% Seeds Bonus)</div>
          </div>`;
      } else if (state.mode === 'puzzle') {
        subHtml = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
            ${GARDEN_PUZZLES.map((p) => {
              const stars = d.puzzleStars[p.id] ?? 0;
              return `
                <button class="map-chip ${state.puzzleId === p.id ? 'active' : ''}" data-puz="${p.id}">
                  <div style="font-weight:800;">#${p.id} ${p.title}</div>
                  <div style="font-size:14px;color:#fde047;">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
                </button>`;
            }).join('')}
          </div>`;
      } else if (state.mode === 'story') {
        subHtml = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
            ${STORY_CHAPTERS.map((ch) => {
              const cleared = d.storyCleared.includes(ch.id);
              return `
                <button class="map-chip ${state.storyChapterId === ch.id ? 'active' : ''}" data-story="${ch.id}">
                  <div style="font-weight:800;">${ch.title} ${cleared ? '✓' : ''}</div>
                  <div style="font-size:14px;color:#86efac;">${ch.lesson}</div>
                </button>`;
            }).join('')}
          </div>`;
      }

      return `
        <div class="mode-card-grid">
          ${MODE_CATALOG.map((m) => {
            const active = state.mode === m.id;
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

    if (state.step === 'map') {
      return `
        <div class="map-option-grid">
          ${MAP_LIST.map((m) => {
            const active = selectedMap === m.id;
            const endlessBest = d.endlessPodium[m.id]?.[0]?.wave ?? 0;
            return `
              <button class="map-chip ${active ? 'active' : ''}" data-map="${m.id}">
                <div style="display:flex;justify-content:space-between;font-weight:800;">
                  <span>${m.name}</span>
                  <span style="color:#86efac;">${m.tierLabel} • ${m.paths.length} Lane${m.paths.length > 1 ? 's' : ''}</span>
                </div>
                <div style="font-size:14px;color:#cbd5e1;margin-top:2px;">${m.description}</div>
                <div style="font-size:14px;color:#fde047;margin-top:4px;">🌤 Dynamic Weather • 👑 Boss Wave • Best Endless: W${endlessBest}</div>
              </button>`;
          }).join('')}
        </div>
      `;
    }

    if (state.step === 'difficulty') {
      const isHourly = state.mode === 'hourly';
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

  private bindInteractions(
    state: ReturnType<FastMenuCallbacks['getWizardState']>,
    nextMilestone: { xp: number; unitId: string; label: string } | undefined
  ): void {
    const teleportStation = (station: HubStationId, focus = true) => {
      this.match.hubWorld.teleportToStation(station, this.match.engine.cameraRig, focus);
    };

    this.root.querySelector('#fm-close-btn')?.addEventListener('click', () => {
      this.callbacks.onCloseFastMenu();
      SynthAudio.play('click');
    });

    this.root.querySelector('#fm-news-btn')?.addEventListener('click', () => {
      teleportStation('notice_board', true);
      this.callbacks.onCloseFastMenu();
      this.callbacks.onOpenShop('WhatsNew');
    });

    this.root.querySelector('#sign-play')?.addEventListener('click', () => {
      teleportStation('play_pads', false);
      this.callbacks.onNavigateStep('mode');
    });
    this.root.querySelector('#lobby-inv-btn')?.addEventListener('click', () => {
      teleportStation('shed', true);
      this.callbacks.onCloseFastMenu();
      this.callbacks.onOpenInventory();
    });
    this.root.querySelector('#lobby-summon-btn')?.addEventListener('click', () => {
      teleportStation('greenhouse', true);
      this.callbacks.onCloseFastMenu();
      this.callbacks.onOpenSummon();
    });
    this.root.querySelector('#lobby-shop-btn')?.addEventListener('click', () => {
      teleportStation('seed_shop', true);
      this.callbacks.onCloseFastMenu();
      this.callbacks.onOpenShop('Shop');
    });
    this.root.querySelector('#lobby-quests-btn')?.addEventListener('click', () => {
      teleportStation('mossbeard', true);
      this.callbacks.onCloseFastMenu();
      this.callbacks.onOpenQuests();
    });
    this.root.querySelector('#lobby-pass-btn')?.addEventListener('click', () => {
      teleportStation('fountain', true);
      this.callbacks.onCloseFastMenu();
      this.callbacks.onOpenPass();
    });
    this.root.querySelector('#lobby-codex-btn')?.addEventListener('click', () => {
      teleportStation('trophy_podium', true);
      this.callbacks.onCloseFastMenu();
      this.callbacks.onOpenCodex();
    });
    this.root.querySelector('#lobby-codes-btn')?.addEventListener('click', () => {
      teleportStation('notice_board', true);
      this.callbacks.onCloseFastMenu();
      this.callbacks.onOpenShop('Codes');
    });
    this.root.querySelector('#lobby-settings-btn')?.addEventListener('click', () => {
      teleportStation('fountain', true);
      this.callbacks.onCloseFastMenu();
      this.callbacks.onOpenSettings();
    });

    this.root.querySelectorAll('[data-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = (btn as HTMLElement).dataset.step as HubWizardStep;
        this.callbacks.onNavigateStep(step);
      });
    });

    this.root.querySelector('#wizard-back-btn')?.addEventListener('click', () => {
      ScreenRouter.pop();
      SynthAudio.play('click');
    });

    this.root.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.setWizardState({ mode: (btn as HTMLElement).dataset.mode as GameModeId });
        SynthAudio.play('click');
        this.render();
      });
    });

    this.root.querySelectorAll('[data-puz]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.setWizardState({ puzzleId: Number((btn as HTMLElement).dataset.puz) });
        SynthAudio.play('click');
        this.render();
      });
    });

    this.root.querySelectorAll('[data-story]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.setWizardState({ storyChapterId: Number((btn as HTMLElement).dataset.story) });
        SynthAudio.play('click');
        this.render();
      });
    });

    this.root.querySelectorAll('[data-map]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mapId = (btn as HTMLElement).dataset.map as MapId;
        SaveManager.data.selectedMap = mapId;
        if (!SaveManager.isDifficultyUnlocked(mapId, SaveManager.data.selectedDifficulty)) {
          SaveManager.data.selectedDifficulty = 'Easy';
        }
        SaveManager.save();
        this.match.loadDiorama(mapId);
        SynthAudio.play('click');
        this.render();
      });
    });

    this.root.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const diff = (btn as HTMLElement).dataset.diff as DifficultyId;
        if (!SaveManager.isDifficultyUnlocked(SaveManager.data.selectedMap, diff)) return;
        SaveManager.data.selectedDifficulty = diff;
        SaveManager.save();
        SynthAudio.play('click');
        this.render();
      });
    });

    this.root.querySelectorAll('[data-mod-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.modId!;
        const tier = Number((btn as HTMLElement).dataset.modTier ?? 0);
        const mods = { ...state.modifiers };
        if (tier <= 0) delete mods[id];
        else mods[id] = tier;
        this.callbacks.setWizardState({ modifiers: mods });
        SynthAudio.play('click');
        this.render();
      });
    });

    this.root.querySelectorAll('[data-preset-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number((btn as HTMLElement).dataset.presetIdx);
        SaveManager.switchTeamPreset(idx);
        SynthAudio.play('click');
      });
    });

    this.root.querySelector('#claim-gnome-btn')?.addEventListener('click', () => {
      if (!nextMilestone) return;
      if (SaveManager.claimQuestGnomeMilestone(nextMilestone.xp, nextMilestone.unitId)) {
        this.callbacks.onPushToast('🧙 Old Mossbeard Reward!', `Unlocked ${nextMilestone.label}!`, '#fde047');
        EventBus.emit('hub:celebrate', undefined);
        SynthAudio.play('crate_fanfare');
      }
    });

    this.root.querySelector('#wizard-open-inv')?.addEventListener('click', () => {
      this.callbacks.onCloseFastMenu();
      this.callbacks.onOpenInventory();
    });

    this.root.querySelector('#fast-play-btn')?.addEventListener('click', () => {
      this.callbacks.onLaunch();
    });
  }
}
