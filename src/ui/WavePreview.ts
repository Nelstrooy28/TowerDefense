import { MatchController } from '../simulation/MatchController';
import { getEliteSpawnChance } from '../data/ModifierConfig';
import { WEATHERS } from '../data/WeatherConfig';
import type { EnemyTypeId } from '../data/EnemyRegistry';

const ENEMY_ICONS: Record<EnemyTypeId, string> = {
  garden_ant: '🐜',
  aphid_cluster: '🟢',
  aphid_mini: '◦',
  sprinter_mantis: '🦗',
  iron_beetle: '🪲',
  caterpillar_cocoon: '🐛',
  moth_flyer: '🦋',
  burrowing_mole: '🦡',
  termite_gnawer: '🪵',
  spore_wasp: '🐝',
  locust_swarm: '🦗',
  gargantuan_snail: '🐌',
  speedy_slug: '🐛',
  treant_overlord: '🌳',
  vinewyrm_hydra: '🐍',
  magma_beetle_queen: '🌋',
  frost_moth_empress: '❄️',
  pocket_mouse: '🐭',
  glow_moth: '🧚',
  ember_fly: '🔥',
};

const THREAT_COLORS: Record<string, string> = {
  Low: '#4ade80',
  Medium: '#fbbf24',
  High: '#f97316',
  Boss: '#f43f5e',
};

export class WavePreview {
  public root: HTMLDivElement;
  private match: MatchController;

  constructor(parent: HTMLElement, match: MatchController) {
    this.match = match;
    this.root = document.createElement('div');
    this.root.className = 'wave-preview-panel gloss-panel hidden';
    parent.appendChild(this.root);
  }

  public show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  public update(): void {
    if (!this.match.inMatch || this.match.matchEnded) return;
    const nextWave = this.match.currentWave + 1;
    if (!this.match.isEndless && nextWave > this.match.totalWaves) {
      this.root.innerHTML = `<div style="font-size:15px;font-weight:800;color:#4ade80;">Final Wave Active!</div>`;
      return;
    }

    const info = this.match.getWavePreview(nextWave);
    const elitePct = Math.round(getEliteSpawnChance(nextWave) * 100);
    const activeW = this.match.weather.activeDef;
    const upcomingW = this.match.weather.upcomingWeather ? WEATHERS[this.match.weather.upcomingWeather] : null;

    const iconsHtml = info.entries
      .map((e) => `<span style="white-space:nowrap;">${ENEMY_ICONS[e.type]} ×${e.count}</span>`)
      .join(' ');

    this.root.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <span style="font-size:15px;font-weight:800;">Next: Wave ${nextWave}</span>
        <span style="font-size:14px;font-weight:800;color:${THREAT_COLORS[info.threatLabel]};">Threat: ${info.threatLabel}</span>
      </div>
      <div style="font-size:15px;margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;">${iconsHtml}</div>
      <div style="font-size:14px;color:#cbd5e1;margin-top:4px;">
        ${elitePct > 0 ? `⚡ Elites ${elitePct}%` : ''}
        ${activeW ? ` • ${activeW.icon} ${activeW.name}` : upcomingW ? ` • Next: ${upcomingW.icon} ${upcomingW.name}` : ''}
      </div>
    `;
  }
}
