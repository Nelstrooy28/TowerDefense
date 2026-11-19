import { Keybinds, KEY_ACTION_META, type KeyAction, type KeyMods } from './Keybinds';
import { QualityManager } from './QualityManager';
import { EventBus } from './EventBus';

interface ActionListener {
  priority: number;
  fn: (mods: KeyMods, ev?: KeyboardEvent) => boolean | void;
}

class InputActionsImpl {
  private pressedCodes = new Map<string, KeyMods>();
  private heldMs = new Map<KeyAction, number>();
  private holdFired = new Set<KeyAction>();
  private downListeners = new Map<KeyAction, ActionListener[]>();
  private upListeners = new Map<KeyAction, ActionListener[]>();
  private captureCb: ((combo: string) => void) | null = null;
  private helpOverlayEl: HTMLDivElement | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private prevGpButtons: boolean[] = [];
  private activeHoldAction: KeyAction | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.bindBrowserEvents();
    }
  }

  private bindBrowserEvents(): void {
    window.addEventListener(
      'pointermove',
      (e) => {
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        if (e.pointerType === 'touch') {
          Keybinds.setInputMode('touch');
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchstart',
      () => {
        Keybinds.setInputMode('touch');
      },
      { passive: true }
    );

    window.addEventListener(
      'keydown',
      (e) => {
        Keybinds.setInputMode('keyboard');

        if (this.captureCb) {
          e.preventDefault();
          e.stopPropagation();
          if (e.code === 'Escape') {
            this.cancelCapture();
            return;
          }
          if (
            e.code.startsWith('Shift') ||
            e.code.startsWith('Control') ||
            e.code.startsWith('Alt') ||
            e.code.startsWith('Meta')
          ) {
            return;
          }
          const prefix: string[] = [];
          if (e.ctrlKey) prefix.push('Ctrl');
          if (e.shiftKey) prefix.push('Shift');
          if (e.altKey) prefix.push('Alt');
          const combo = [...prefix, e.code].join('+');
          const cb = this.captureCb;
          this.captureCb = null;
          cb(combo);
          return;
        }

        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        const typingInField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        if (typingInField && e.code !== 'Escape') return;

        const isFirstDown = !this.pressedCodes.has(e.code);
        const mods: KeyMods = {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
        };
        this.pressedCodes.set(e.code, mods);

        if (isFirstDown) {
          this.dispatchKeyDown(e.code, mods, e);
        }
      },
      true
    );

    window.addEventListener(
      'keyup',
      (e) => {
        const mods: KeyMods = {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
        };
        this.pressedCodes.delete(e.code);
        this.dispatchKeyUp(e.code, mods, e);
      },
      true
    );

    window.addEventListener('blur', () => {
      this.pressedCodes.clear();
      this.heldMs.clear();
      this.holdFired.clear();
      this.setHelpOverlayVisible(false);
      this.clearHoldRing();
    });
  }

  private dispatchKeyDown(code: string, mods: KeyMods, ev?: KeyboardEvent): void {
    // Check help overlay toggle (F1)
    if (Keybinds.matches('help_overlay', code, mods)) {
      ev?.preventDefault();
      this.setHelpOverlayVisible(true);
    }

    // Collect matching actions and sort listeners across them by priority desc
    const matched: Array<{ action: KeyAction; entry: ActionListener }> = [];
    for (const meta of KEY_ACTION_META) {
      if (Keybinds.matches(meta.action, code, mods)) {
        if (!this.heldMs.has(meta.action)) {
          this.heldMs.set(meta.action, 0);
        }
        const list = this.downListeners.get(meta.action);
        if (list) {
          for (const entry of list) {
            matched.push({ action: meta.action, entry });
          }
        }
      }
    }
    matched.sort((a, b) => b.entry.priority - a.entry.priority);

    for (const m of matched) {
      if (m.entry.fn(mods, ev) === true) {
        ev?.stopPropagation();
        break;
      }
    }
  }

  private dispatchKeyUp(code: string, mods: KeyMods, ev?: KeyboardEvent): void {
    if (Keybinds.matches('help_overlay', code, mods) || !this.isDown('help_overlay')) {
      this.setHelpOverlayVisible(false);
    }

    for (const meta of KEY_ACTION_META) {
      if (Keybinds.matches(meta.action, code, mods)) {
        if (!this.isDown(meta.action)) {
          this.heldMs.delete(meta.action);
          this.holdFired.delete(meta.action);
          if (this.activeHoldAction === meta.action) {
            this.clearHoldRing();
          }
          const list = this.upListeners.get(meta.action);
          if (list) {
            const sorted = [...list].sort((a, b) => b.priority - a.priority);
            for (const entry of sorted) {
              if (entry.fn(mods, ev) === true) break;
            }
          }
        }
      }
    }
  }

  public isDown(action: KeyAction): boolean {
    for (const [code, mods] of this.pressedCodes.entries()) {
      if (Keybinds.matches(action, code, mods)) return true;
    }
    return false;
  }

  public getHoldMs(action: KeyAction): number {
    return this.heldMs.get(action) ?? 0;
  }

  public consumeHoldFire(action: KeyAction): void {
    this.holdFired.add(action);
    this.clearHoldRing();
  }

  public wasHoldFired(action: KeyAction): boolean {
    return this.holdFired.has(action);
  }

  public onDown(
    action: KeyAction,
    fn: (mods: KeyMods, ev?: KeyboardEvent) => boolean | void,
    priority = 0
  ): () => void {
    let list = this.downListeners.get(action);
    if (!list) {
      list = [];
      this.downListeners.set(action, list);
    }
    const entry: ActionListener = { priority, fn };
    list.push(entry);
    return () => {
      const idx = list!.indexOf(entry);
      if (idx >= 0) list!.splice(idx, 1);
    };
  }

  public onUp(
    action: KeyAction,
    fn: (mods: KeyMods, ev?: KeyboardEvent) => boolean | void,
    priority = 0
  ): () => void {
    let list = this.upListeners.get(action);
    if (!list) {
      list = [];
      this.upListeners.set(action, list);
    }
    const entry: ActionListener = { priority, fn };
    list.push(entry);
    return () => {
      const idx = list!.indexOf(entry);
      if (idx >= 0) list!.splice(idx, 1);
    };
  }

  public startCapture(cb: (combo: string) => void): void {
    this.captureCb = cb;
  }

  public cancelCapture(): void {
    this.captureCb = null;
  }

  public update(dt: number): void {
    const dtMs = dt * 1000;
    for (const action of Array.from(this.heldMs.keys())) {
      if (this.isDown(action)) {
        const next = (this.heldMs.get(action) ?? 0) + dtMs;
        this.heldMs.set(action, next);

        if (action === 'upgrade' && !this.holdFired.has('upgrade')) {
          this.activeHoldAction = 'upgrade';
          EventBus.emit('ui:hold_progress', {
            active: true,
            progress: Math.min(1, next / 250),
            label: 'Upgrade',
            x: this.lastPointerX,
            y: this.lastPointerY,
          });
        } else if (
          action === 'sell' &&
          QualityManager.settings.holdToSell &&
          !this.holdFired.has('sell')
        ) {
          this.activeHoldAction = 'sell';
          EventBus.emit('ui:hold_progress', {
            active: true,
            progress: Math.min(1, next / 400),
            label: 'Hold Sell',
            x: this.lastPointerX,
            y: this.lastPointerY,
          });
        } else if (
          action === 'hub_interact' &&
          QualityManager.settings.holdToInteract &&
          !this.holdFired.has('hub_interact')
        ) {
          this.activeHoldAction = 'hub_interact';
          EventBus.emit('ui:hold_progress', {
            active: true,
            progress: Math.min(1, next / 350),
            label: 'Interact',
            x: this.lastPointerX,
            y: this.lastPointerY,
          });
        }
      } else {
        this.heldMs.delete(action);
        this.holdFired.delete(action);
      }
    }

    this.pollGamepad();
  }

  private clearHoldRing(): void {
    this.activeHoldAction = null;
    EventBus.emit('ui:hold_progress', {
      active: false,
      progress: 0,
      label: '',
      x: this.lastPointerX,
      y: this.lastPointerY,
    });
  }

  private pollGamepad(): void {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    const pads = navigator.getGamepads();
    const pad = pads?.[0];
    if (!pad) return;

    const btnAction: Partial<Record<number, KeyAction>> = {
      0: 'hub_jump', // A
      1: 'cancel', // B
      2: 'upgrade', // X
      3: 'sell', // Y
      4: 'select_next_tower', // LB
      5: 'target_cycle', // RB
      6: 'ability_1', // LT
      7: 'ability_2', // RT
      9: 'pause_menu', // Start
    };

    for (let i = 0; i < pad.buttons.length; i++) {
      const pressed = pad.buttons[i]?.pressed ?? false;
      const was = this.prevGpButtons[i] ?? false;
      const action = btnAction[i];
      if (action) {
        if (pressed && !was) {
          const list = this.downListeners.get(action);
          if (list) {
            const sorted = [...list].sort((a, b) => b.priority - a.priority);
            for (const e of sorted) {
              if (e.fn({}) === true) break;
            }
          }
        } else if (!pressed && was) {
          const list = this.upListeners.get(action);
          if (list) {
            const sorted = [...list].sort((a, b) => b.priority - a.priority);
            for (const e of sorted) {
              if (e.fn({}) === true) break;
            }
          }
        }
      }
      this.prevGpButtons[i] = pressed;
    }
  }

  private setHelpOverlayVisible(visible: boolean): void {
    if (typeof document === 'undefined') return;
    if (!this.helpOverlayEl) {
      this.helpOverlayEl = document.createElement('div');
      this.helpOverlayEl.id = 'key-help-overlay';
      this.helpOverlayEl.className = 'key-help-overlay hidden';
      document.body.appendChild(this.helpOverlayEl);
    }
    this.helpOverlayEl.classList.toggle('hidden', !visible);
    if (!visible) return;

    const categories: KeyActionMetaCat[] = ['Match', 'Camera', 'Unit Manager', 'Lobby Hub', 'Survival', 'System'];
    this.helpOverlayEl.innerHTML = `
      <div class="key-help-card paper-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div style="font-size:20px;font-weight:900;color:#fde047;">
            ⌨ Controls Reference — ${Keybinds.getPreset().toUpperCase()} Preset (Release F1 to close)
          </div>
        </div>
        <div class="key-help-grid">
          ${categories
            .map((cat) => {
              const items = KEY_ACTION_META.filter((m) => m.category === cat && Keybinds.getHint(m.action));
              return `
                <div class="gloss-panel" style="padding:10px;">
                  <div style="font-size:15px;font-weight:800;color:#86efac;margin-bottom:6px;">${cat}</div>
                  ${items
                    .map(
                      (m) => `
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:14px;padding:2px 0;">
                      <span style="color:#cbd5e1;">${m.label}</span>
                      ${Keybinds.badge(m.action)}
                    </div>`
                    )
                    .join('')}
                </div>`;
            })
            .join('')}
        </div>
      </div>
    `;
  }
}

type KeyActionMetaCat = (typeof KEY_ACTION_META)[number]['category'];

export const InputActions = new InputActionsImpl();
