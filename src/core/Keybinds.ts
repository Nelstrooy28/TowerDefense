import { QualityManager } from './QualityManager';
import { EventBus } from './EventBus';

export type KeyPresetId = 'gtd' | 'classic' | 'left_hand';

export type KeyAction =
  | 'hotbar_1'
  | 'hotbar_2'
  | 'hotbar_3'
  | 'hotbar_4'
  | 'hotbar_5'
  | 'hotbar_6'
  | 'rotate'
  | 'cancel'
  | 'upgrade'
  | 'upgrade_max'
  | 'sell'
  | 'target_cycle'
  | 'ability_1'
  | 'ability_2'
  | 'ability_3'
  | 'manager'
  | 'start_wave'
  | 'speed_cycle'
  | 'pause'
  | 'pause_menu'
  | 'show_ranges'
  | 'cam_up'
  | 'cam_down'
  | 'cam_left'
  | 'cam_right'
  | 'cam_rot_left'
  | 'cam_rot_right'
  | 'cam_zoom_in'
  | 'cam_zoom_out'
  | 'cam_reset'
  | 'photo_mode'
  | 'debug_overlay'
  | 'help_overlay'
  | 'undo_place'
  | 'select_next_tower'
  | 'hub_jump'
  | 'hub_run'
  | 'hub_interact'
  | 'hub_fast_menu'
  | 'hub_units'
  | 'hub_summon'
  | 'hub_quests'
  | 'hub_shop'
  | 'hub_codex'
  | 'hub_settings'
  | 'hub_extras'
  | 'survival_dash'
  | 'survival_splash'
  | 'summon_skip'
  | 'row_up'
  | 'row_down'
  | 'prio_up'
  | 'prio_down';

export interface KeyActionMeta {
  action: KeyAction;
  label: string;
  category: 'Match' | 'Camera' | 'Unit Manager' | 'Lobby Hub' | 'Survival' | 'System';
  ignoreShift?: boolean;
  rebindable?: boolean;
}

export const KEY_ACTION_META: KeyActionMeta[] = [
  { action: 'hotbar_1', label: 'Hotbar Slot 1', category: 'Match', ignoreShift: true },
  { action: 'hotbar_2', label: 'Hotbar Slot 2', category: 'Match', ignoreShift: true },
  { action: 'hotbar_3', label: 'Hotbar Slot 3', category: 'Match', ignoreShift: true },
  { action: 'hotbar_4', label: 'Hotbar Slot 4', category: 'Match', ignoreShift: true },
  { action: 'hotbar_5', label: 'Hotbar Slot 5', category: 'Match', ignoreShift: true },
  { action: 'hotbar_6', label: 'Hotbar Slot 6', category: 'Match', ignoreShift: true },
  { action: 'rotate', label: 'Rotate Ghost', category: 'Match' },
  { action: 'cancel', label: 'Cancel / Deselect', category: 'Match', ignoreShift: true },
  { action: 'upgrade', label: 'Upgrade Selected', category: 'Match' },
  { action: 'upgrade_max', label: 'Upgrade Max Affordable', category: 'Match' },
  { action: 'sell', label: 'Sell Selected', category: 'Match' },
  { action: 'target_cycle', label: 'Cycle Targeting', category: 'Match' },
  { action: 'ability_1', label: 'Ability 1', category: 'Match' },
  { action: 'ability_2', label: 'Ability 2', category: 'Match' },
  { action: 'ability_3', label: 'Ability 3', category: 'Match' },
  { action: 'manager', label: 'Open Unit Manager', category: 'Unit Manager' },
  { action: 'start_wave', label: 'Start / Skip Wave', category: 'Match', ignoreShift: true },
  { action: 'speed_cycle', label: 'Cycle Game Speed', category: 'Match' },
  { action: 'pause', label: 'Quick Pause', category: 'Match' },
  { action: 'pause_menu', label: 'Pause Menu / Back', category: 'System', ignoreShift: true },
  { action: 'show_ranges', label: 'Show All Ranges (Hold)', category: 'Match', ignoreShift: true },
  { action: 'undo_place', label: 'Undo Last Placement', category: 'Match' },
  { action: 'select_next_tower', label: 'Select Next Tower', category: 'Match' },
  { action: 'cam_up', label: 'Pan / Walk Forward', category: 'Camera', ignoreShift: true },
  { action: 'cam_down', label: 'Pan / Walk Back', category: 'Camera', ignoreShift: true },
  { action: 'cam_left', label: 'Pan / Walk Left', category: 'Camera', ignoreShift: true },
  { action: 'cam_right', label: 'Pan / Walk Right', category: 'Camera', ignoreShift: true },
  { action: 'cam_rot_left', label: 'Rotate Camera Left', category: 'Camera', ignoreShift: true },
  { action: 'cam_rot_right', label: 'Rotate Camera Right', category: 'Camera', ignoreShift: true },
  { action: 'cam_zoom_in', label: 'Zoom In', category: 'Camera', ignoreShift: true },
  { action: 'cam_zoom_out', label: 'Zoom Out', category: 'Camera', ignoreShift: true },
  { action: 'cam_reset', label: 'Reset Camera', category: 'Camera', ignoreShift: true },
  { action: 'row_up', label: 'Manager Row Up', category: 'Unit Manager' },
  { action: 'row_down', label: 'Manager Row Down', category: 'Unit Manager' },
  { action: 'prio_up', label: 'Move Priority Up', category: 'Unit Manager' },
  { action: 'prio_down', label: 'Move Priority Down', category: 'Unit Manager' },
  { action: 'hub_jump', label: 'Hub Jump', category: 'Lobby Hub', ignoreShift: true },
  { action: 'hub_run', label: 'Hub Sprint (Hold)', category: 'Lobby Hub', ignoreShift: true },
  { action: 'hub_interact', label: 'Interact with Station', category: 'Lobby Hub' },
  { action: 'hub_fast_menu', label: 'Toggle Fast Menu', category: 'Lobby Hub' },
  { action: 'hub_units', label: 'Open Units', category: 'Lobby Hub' },
  { action: 'hub_summon', label: 'Open Summon', category: 'Lobby Hub' },
  { action: 'hub_quests', label: 'Open Quests', category: 'Lobby Hub' },
  { action: 'hub_shop', label: 'Open Shop', category: 'Lobby Hub' },
  { action: 'hub_codex', label: 'Open Bestiary', category: 'Lobby Hub' },
  { action: 'hub_settings', label: 'Open Settings', category: 'Lobby Hub' },
  { action: 'hub_extras', label: 'Open Codes & Extras', category: 'Lobby Hub' },
  { action: 'survival_dash', label: 'Survival Dash', category: 'Survival', ignoreShift: true },
  { action: 'survival_splash', label: 'Survival Water Splash', category: 'Survival' },
  { action: 'summon_skip', label: 'Skip Summon Anim', category: 'System', rebindable: false },
  { action: 'photo_mode', label: 'Photo Mode', category: 'System' },
  { action: 'debug_overlay', label: 'Debug Overlay', category: 'System' },
  { action: 'help_overlay', label: 'Show Key Overlay (Hold)', category: 'System' },
];

const META_MAP = new Map<KeyAction, KeyActionMeta>(KEY_ACTION_META.map((m) => [m.action, m]));

export type BindingTuple = [string, string];

const GTD_DEFAULTS: Record<KeyAction, BindingTuple> = {
  hotbar_1: ['Digit1', ''],
  hotbar_2: ['Digit2', ''],
  hotbar_3: ['Digit3', ''],
  hotbar_4: ['Digit4', ''],
  hotbar_5: ['Digit5', ''],
  hotbar_6: ['Digit6', ''],
  rotate: ['KeyR', ''],
  cancel: ['KeyQ', 'Escape'],
  upgrade: ['KeyE', ''],
  upgrade_max: ['Shift+KeyE', ''],
  sell: ['KeyX', 'Backspace'],
  target_cycle: ['KeyT', ''],
  ability_1: ['KeyZ', ''],
  ability_2: ['KeyC', ''],
  ability_3: ['KeyV', ''],
  manager: ['Tab', ''],
  start_wave: ['Enter', 'Space'],
  speed_cycle: ['KeyF', ''],
  pause: ['KeyP', ''],
  pause_menu: ['Escape', ''],
  show_ranges: ['AltLeft', 'AltRight'],
  undo_place: ['Ctrl+KeyZ', 'Meta+KeyZ'],
  select_next_tower: ['BracketRight', ''],
  cam_up: ['KeyW', 'ArrowUp'],
  cam_down: ['KeyS', 'ArrowDown'],
  cam_left: ['KeyA', 'ArrowLeft'],
  cam_right: ['KeyD', 'ArrowRight'],
  cam_rot_left: ['Comma', ''],
  cam_rot_right: ['Period', ''],
  cam_zoom_in: ['KeyI', 'Equal'],
  cam_zoom_out: ['KeyO', 'Minus'],
  cam_reset: ['Home', ''],
  row_up: ['ArrowUp', ''],
  row_down: ['ArrowDown', ''],
  prio_up: ['Ctrl+ArrowUp', ''],
  prio_down: ['Ctrl+ArrowDown', ''],
  hub_jump: ['Space', ''],
  hub_run: ['ShiftLeft', 'ShiftRight'],
  hub_interact: ['KeyE', ''],
  hub_fast_menu: ['KeyM', ''],
  hub_units: ['KeyU', ''],
  hub_summon: ['KeyG', ''],
  hub_quests: ['KeyJ', ''],
  hub_shop: ['KeyH', ''],
  hub_codex: ['KeyB', ''],
  hub_settings: ['KeyO', ''],
  hub_extras: ['KeyX', ''],
  survival_dash: ['ShiftLeft', 'ShiftRight'],
  survival_splash: ['KeyQ', ''],
  summon_skip: ['Space', ''],
  photo_mode: ['F2', ''],
  debug_overlay: ['F3', ''],
  help_overlay: ['F1', ''],
};

const CLASSIC_DEFAULTS: Record<KeyAction, BindingTuple> = {
  ...GTD_DEFAULTS,
  cancel: ['Escape', ''],
  upgrade: ['KeyU', 'KeyF'],
  upgrade_max: ['Shift+KeyU', ''],
  ability_1: ['KeyQ', ''],
  ability_2: ['KeyE', ''],
  ability_3: ['KeyR', ''],
  manager: ['KeyM', ''],
  select_next_tower: ['Tab', ''],
  start_wave: ['Space', 'Enter'],
  speed_cycle: ['KeyV', ''],
  hub_summon: ['KeyS', ''],
  hub_quests: ['KeyQ', ''],
  survival_splash: ['KeyE', ''],
  survival_dash: ['Space', ''],
};

const LEFT_HAND_DEFAULTS: Record<KeyAction, BindingTuple> = {
  ...GTD_DEFAULTS,
  rotate: ['KeyR', ''],
  cancel: ['Escape', ''],
  upgrade: ['KeyE', ''],
  upgrade_max: ['Shift+KeyE', ''],
  sell: ['KeyX', ''],
  target_cycle: ['KeyT', ''],
  ability_1: ['KeyZ', ''],
  ability_2: ['KeyC', ''],
  ability_3: ['KeyV', ''],
  speed_cycle: ['KeyF', ''],
  manager: ['Tab', ''],
  start_wave: ['Space', 'Enter'],
  cam_up: ['ArrowUp', 'KeyW'],
  cam_down: ['ArrowDown', 'KeyS'],
  cam_left: ['ArrowLeft', 'KeyA'],
  cam_right: ['ArrowRight', 'KeyD'],
};

export const PRESET_TABLES: Record<KeyPresetId, Record<KeyAction, BindingTuple>> = {
  gtd: GTD_DEFAULTS,
  classic: CLASSIC_DEFAULTS,
  left_hand: LEFT_HAND_DEFAULTS,
};

export interface KeyMods {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

class KeybindsManager {
  public inputMode: 'keyboard' | 'touch' = 'keyboard';

  public getPreset(): KeyPresetId {
    return QualityManager.settings.keybinds?.preset ?? 'gtd';
  }

  public isPromptSeen(): boolean {
    return Boolean(QualityManager.settings.keybinds?.promptSeen);
  }

  public markPromptSeen(): void {
    const cur = QualityManager.settings.keybinds ?? { preset: 'gtd', custom: {} };
    QualityManager.applySettings({ keybinds: { ...cur, promptSeen: true } }, false);
  }

  public setPreset(preset: KeyPresetId, keepCustom = false): void {
    const prev = QualityManager.settings.keybinds;
    QualityManager.applySettings(
      {
        keybinds: {
          preset,
          custom: keepCustom ? { ...(prev?.custom ?? {}) } : {},
          promptSeen: true,
        },
      },
      false
    );
    EventBus.emit('keybinds:changed', undefined);
  }

  public resetToPreset(): void {
    this.setPreset(this.getPreset(), false);
  }

  public getSlots(action: KeyAction): BindingTuple {
    const cfg = QualityManager.settings.keybinds;
    const custom = cfg?.custom?.[action];
    if (custom) return [custom[0] ?? '', custom[1] ?? ''];
    const base = PRESET_TABLES[cfg?.preset ?? 'gtd'] ?? GTD_DEFAULTS;
    const tup = base[action] ?? ['', ''];
    return [tup[0], tup[1]];
  }

  public setSlot(action: KeyAction, slotIndex: 0 | 1, binding: string): void {
    const cfg = QualityManager.settings.keybinds ?? { preset: 'gtd', custom: {} };
    const nextCustom = { ...(cfg.custom ?? {}) };
    const cur = this.getSlots(action);
    cur[slotIndex] = binding;
    nextCustom[action] = cur;
    QualityManager.applySettings(
      { keybinds: { ...cfg, custom: nextCustom, promptSeen: true } },
      false
    );
    EventBus.emit('keybinds:changed', undefined);
  }

  public findConflicts(
    binding: string,
    excludeAction: KeyAction
  ): Array<{ action: KeyAction; slotIndex: 0 | 1; label: string }> {
    if (!binding) return [];
    const targetMeta = META_MAP.get(excludeAction);
    const out: Array<{ action: KeyAction; slotIndex: 0 | 1; label: string }> = [];
    for (const meta of KEY_ACTION_META) {
      if (meta.action === excludeAction) continue;
      // Hub/Match/Manager scopes can intentionally reuse keys across distinct screens
      if (targetMeta && meta.category !== targetMeta.category) {
        const crossCompatible =
          (targetMeta.category === 'Lobby Hub' && meta.category === 'Match') ||
          (targetMeta.category === 'Match' && meta.category === 'Lobby Hub') ||
          (targetMeta.category === 'Unit Manager' && meta.category === 'Lobby Hub') ||
          (targetMeta.category === 'Lobby Hub' && meta.category === 'Unit Manager') ||
          (targetMeta.category === 'Survival' && meta.category === 'Match' && meta.action !== 'cancel');
        if (crossCompatible) continue;
      }
      const slots = this.getSlots(meta.action);
      if (slots[0] === binding) out.push({ action: meta.action, slotIndex: 0, label: meta.label });
      else if (slots[1] === binding) out.push({ action: meta.action, slotIndex: 1, label: meta.label });
    }
    return out;
  }

  public swapBinding(
    actionA: KeyAction,
    slotA: 0 | 1,
    actionB: KeyAction,
    slotB: 0 | 1,
    newBinding: string
  ): void {
    const oldA = this.getSlots(actionA)[slotA];
    this.setSlot(actionA, slotA, newBinding);
    this.setSlot(actionB, slotB, oldA);
  }

  public matches(action: KeyAction, code: string, mods: KeyMods = {}): boolean {
    const slots = this.getSlots(action);
    const meta = META_MAP.get(action);
    for (const s of slots) {
      if (!s) continue;
      if (this.matchSingle(s, code, mods, Boolean(meta?.ignoreShift))) return true;
    }
    return false;
  }

  private matchSingle(binding: string, code: string, mods: KeyMods, ignoreShift: boolean): boolean {
    const parts = binding.split('+');
    const keyPart = parts[parts.length - 1];
    if (keyPart !== code) return false;

    const reqShift = parts.includes('Shift');
    const reqCtrl = parts.includes('Ctrl');
    const reqAlt = parts.includes('Alt');
    const reqMeta = parts.includes('Meta');

    if (reqCtrl !== Boolean(mods.ctrlKey)) return false;
    if (reqAlt !== Boolean(mods.altKey) && !code.startsWith('Alt')) return false;
    if (reqMeta !== Boolean(mods.metaKey)) return false;
    if (reqShift && !mods.shiftKey) return false;
    if (!reqShift && !ignoreShift && mods.shiftKey && !code.startsWith('Shift')) return false;
    return true;
  }

  public formatBinding(binding: string): string {
    if (!binding) return '—';
    return binding
      .split('+')
      .map((part) => {
        if (part.startsWith('Key')) return part.slice(3);
        if (part.startsWith('Digit')) return part.slice(5);
        if (part === 'Space') return 'Space';
        if (part === 'Enter') return 'Enter';
        if (part === 'Escape') return 'Esc';
        if (part === 'Backspace') return 'Bksp';
        if (part === 'Tab') return 'Tab';
        if (part === 'ArrowUp') return '↑';
        if (part === 'ArrowDown') return '↓';
        if (part === 'ArrowLeft') return '←';
        if (part === 'ArrowRight') return '→';
        if (part === 'Comma') return ',';
        if (part === 'Period') return '.';
        if (part === 'Equal') return '+';
        if (part === 'Minus') return '-';
        if (part === 'BracketRight') return ']';
        if (part === 'AltLeft' || part === 'AltRight') return 'Alt';
        if (part === 'ShiftLeft' || part === 'ShiftRight') return 'Shift';
        return part;
      })
      .join('+');
  }

  public getHint(action: KeyAction): string {
    const slots = this.getSlots(action);
    const chosen = slots[0] || slots[1];
    return chosen ? this.formatBinding(chosen) : '';
  }

  public badge(action: KeyAction): string {
    const h = this.getHint(action);
    if (!h) return '';
    return `<kbd class="key-cap">${h}</kbd>`;
  }

  public setInputMode(mode: 'keyboard' | 'touch'): void {
    if (this.inputMode === mode) return;
    this.inputMode = mode;
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('input-touch', mode === 'touch');
    }
    EventBus.emit('input:mode_changed', { mode });
  }
}

export const Keybinds = new KeybindsManager();
