/**
 * Unified Procedural SVG Icon Kit (Spec v5 Doc 03 §2)
 * Thick 2.5px rounded dark outline, 2-tone flat colors + white highlight shine.
 * Zero external image dependencies (AGENTS Rule 1).
 */

export type GardenIconId =
  | 'seeds'
  | 'dewdrops'
  | 'tickets'
  | 'cash'
  | 'heart'
  | 'wave'
  | 'damage'
  | 'range'
  | 'speed'
  | 'fire'
  | 'ice'
  | 'poison'
  | 'lightning'
  | 'water'
  | 'nature'
  | 'upgrade'
  | 'sell'
  | 'target'
  | 'manager'
  | 'play'
  | 'pause'
  | 'settings'
  | 'lock'
  | 'star'
  | 'crown'
  | 'help';

const ICON_MAP: Record<GardenIconId, { bg: string; fg: string; path: string }> = {
  seeds: {
    bg: '#4ade80',
    fg: '#15803d',
    path: '<path d="M12 20c5-1 8-6 8-12-6 0-11 3-12 8-1 3 1 4 4 4z" fill="currentColor" stroke="#0f172a" stroke-width="2.5" stroke-linejoin="round"/><path d="M7 18c2-3 5-6 9-8" stroke="#bbf7d0" stroke-width="2" stroke-linecap="round"/>',
  },
  dewdrops: {
    bg: '#38bdf8',
    fg: '#0284c7',
    path: '<path d="M12 3c-4 6-6 9-6 12a6 6 0 0012 0c0-3-2-6-6-12z" fill="currentColor" stroke="#0f172a" stroke-width="2.5"/><circle cx="10" cy="14" r="1.4" fill="#e0f2fe"/>',
  },
  tickets: {
    bg: '#fbbf24',
    fg: '#d97706',
    path: '<rect x="3" y="6" width="18" height="12" rx="3" fill="currentColor" stroke="#0f172a" stroke-width="2.5"/><circle cx="12" cy="12" r="2.2" fill="#fef3c7"/>',
  },
  cash: {
    bg: '#fbbf24',
    fg: '#b45309',
    path: '<circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="#0f172a" stroke-width="2.5"/><path d="M12 7v10M9.5 10c0-1 1.2-1.5 2.5-1.5s2.5.5 2.5 1.5-1.2 1.5-2.5 1.5-2.5.5-2.5 1.5 1.2 1.5 2.5 1.5 2.5-.5 2.5-1.5" stroke="#fef3c7" stroke-width="2" stroke-linecap="round"/>',
  },
  heart: {
    bg: '#ef4444',
    fg: '#b91c1c',
    path: '<path d="M12 20s-7.5-4.8-7.5-10a4.3 4.3 0 017.5-2.7A4.3 4.3 0 0119.5 10c0 5.2-7.5 10-7.5 10z" fill="currentColor" stroke="#0f172a" stroke-width="2.5"/><circle cx="8.5" cy="9" r="1.2" fill="#fecaca"/>',
  },
  wave: {
    bg: '#fde047',
    fg: '#ca8a04',
    path: '<path d="M4 15c2.5-5 5.5 5 8 0s5.5 5 8 0" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>',
  },
  damage: {
    bg: '#fb923c',
    fg: '#c2410c',
    path: '<path d="M14 3L6 13h5l-1 8 8-10h-5l1-8z" fill="currentColor" stroke="#0f172a" stroke-width="2.3" stroke-linejoin="round"/>',
  },
  range: {
    bg: '#38bdf8',
    fg: '#0369a1',
    path: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="12" cy="12" r="3" fill="#bae6fd" stroke="#0f172a" stroke-width="2"/>',
  },
  speed: {
    bg: '#4ade80',
    fg: '#15803d',
    path: '<path d="M4 7l7 5-7 5V7zm9 0l7 5-7 5V7z" fill="currentColor" stroke="#0f172a" stroke-width="2.2" stroke-linejoin="round"/>',
  },
  fire: {
    bg: '#fb923c',
    fg: '#ea580c',
    path: '<path d="M12 3c3 4 5 6.5 5 10a5 5 0 01-10 0c0-2.5 1.5-5 3-7 0 2 1 3 2 3s0-3 0-6z" fill="currentColor" stroke="#0f172a" stroke-width="2.3"/>',
  },
  ice: {
    bg: '#7dd3fc',
    fg: '#0284c7',
    path: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  },
  poison: {
    bg: '#84cc16',
    fg: '#4d7c0f',
    path: '<circle cx="11" cy="14" r="5" fill="currentColor" stroke="#0f172a" stroke-width="2.3"/><circle cx="16" cy="8" r="2.5" fill="#a855f7" stroke="#0f172a" stroke-width="2"/>',
  },
  lightning: {
    bg: '#a78bfa',
    fg: '#6d28d9',
    path: '<path d="M13 3L5 14h6l-1 7 9-11h-6l0-7z" fill="currentColor" stroke="#0f172a" stroke-width="2.3"/>',
  },
  water: {
    bg: '#38bdf8',
    fg: '#0284c7',
    path: '<path d="M12 4c-3.5 5-5 7.5-5 10a5 5 0 0010 0c0-2.5-1.5-5-5-10z" fill="currentColor" stroke="#0f172a" stroke-width="2.3"/>',
  },
  nature: {
    bg: '#4ade80',
    fg: '#16a34a',
    path: '<path d="M6 18c0-7 5-12 12-12 0 7-5 12-12 12z" fill="currentColor" stroke="#0f172a" stroke-width="2.4"/>',
  },
  upgrade: {
    bg: '#4ade80',
    fg: '#15803d',
    path: '<path d="M12 4l7 7h-4v8H9v-8H5l7-7z" fill="currentColor" stroke="#0f172a" stroke-width="2.4" stroke-linejoin="round"/>',
  },
  sell: {
    bg: '#fb7185',
    fg: '#be123c',
    path: '<rect x="5" y="7" width="14" height="12" rx="3" fill="currentColor" stroke="#0f172a" stroke-width="2.4"/><path d="M9 12h6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
  },
  target: {
    bg: '#fde047',
    fg: '#ca8a04',
    path: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round"/>',
  },
  manager: {
    bg: '#84cc16',
    fg: '#3f6212',
    path: '<rect x="4" y="5" width="16" height="14" rx="3" fill="currentColor" stroke="#0f172a" stroke-width="2.4"/><path d="M8 10h8M8 14h5" stroke="#fef9c3" stroke-width="2.2" stroke-linecap="round"/>',
  },
  play: {
    bg: '#4ade80',
    fg: '#15803d',
    path: '<path d="M7 5l12 7-12 7V5z" fill="currentColor" stroke="#0f172a" stroke-width="2.4" stroke-linejoin="round"/>',
  },
  pause: {
    bg: '#94a3b8',
    fg: '#475569',
    path: '<rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" stroke="#0f172a" stroke-width="2.2"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" stroke="#0f172a" stroke-width="2.2"/>',
  },
  settings: {
    bg: '#cbd5e1',
    fg: '#64748b',
    path: '<circle cx="12" cy="12" r="5" fill="currentColor" stroke="#0f172a" stroke-width="2.4"/><circle cx="12" cy="12" r="2" fill="#0f172a"/>',
  },
  lock: {
    bg: '#fbbf24',
    fg: '#b45309',
    path: '<rect x="6" y="10" width="12" height="9" rx="2" fill="currentColor" stroke="#0f172a" stroke-width="2.4"/><path d="M8 10V8a4 4 0 018 0v2" fill="none" stroke="#0f172a" stroke-width="2.4"/>',
  },
  star: {
    bg: '#fde047',
    fg: '#eab308',
    path: '<path d="M12 3l2.6 5.4 6 .8-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.3-4.2 6-.8L12 3z" fill="currentColor" stroke="#0f172a" stroke-width="2.2" stroke-linejoin="round"/>',
  },
  crown: {
    bg: '#fbbf24',
    fg: '#b45309',
    path: '<path d="M4 17l2-9 6 4 6-4 2 9H4z" fill="currentColor" stroke="#0f172a" stroke-width="2.4" stroke-linejoin="round"/>',
  },
  help: {
    bg: '#38bdf8',
    fg: '#0369a1',
    path: '<circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="#0f172a" stroke-width="2.4"/><path d="M10 9.5a2.2 2.2 0 113.5 1.8c-.9.6-1.5 1.1-1.5 2.2" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16.5" r="1.2" fill="#ffffff"/>',
  },
};

export function renderGardenIcon(id: GardenIconId, size = 18): string {
  const def = ICON_MAP[id];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="vertical-align:-3px;color:${def.bg};flex-shrink:0;" aria-hidden="true">${def.path}</svg>`;
}
