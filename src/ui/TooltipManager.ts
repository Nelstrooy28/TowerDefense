import { Keybinds, type KeyAction } from '../core/Keybinds';

/**
 * Global 250ms Hover Tooltip & Screen Help Manager (Spec v5 Doc 03 §6).
 * Reads `data-tooltip` (short summary), `data-tooltip-shift` (Shift detail view),
 * and `data-tooltip-key` (optional KeyAction hint).
 */
class TooltipManagerImpl {
  private tipEl: HTMLDivElement | null = null;
  private helpModalEl: HTMLDivElement | null = null;
  private timer = 0;
  private activeTarget: HTMLElement | null = null;
  private lastX = 0;
  private lastY = 0;
  private shiftDown = false;
  private initialized = false;

  public init(): void {
    if (this.initialized || typeof document === 'undefined') return;
    this.initialized = true;

    this.tipEl = document.createElement('div');
    this.tipEl.className = 'garden-tooltip paper-panel hidden';
    document.body.appendChild(this.tipEl);

    this.helpModalEl = document.createElement('div');
    this.helpModalEl.className = 'modal-backdrop hidden';
    this.helpModalEl.style.zIndex = '90';
    document.body.appendChild(this.helpModalEl);

    document.addEventListener(
      'pointerover',
      (e) => {
        const el = (e.target as HTMLElement | null)?.closest('[data-tooltip]') as HTMLElement | null;
        if (el === this.activeTarget) return;
        this.hideTooltip();
        if (!el) return;
        this.activeTarget = el;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.timer = window.setTimeout(() => this.showTooltip(), 250);
      },
      true
    );

    document.addEventListener(
      'pointermove',
      (e) => {
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.shiftDown = e.shiftKey;
        if (this.tipEl && !this.tipEl.classList.contains('hidden')) {
          this.positionTooltip();
          if (this.activeTarget?.dataset.tooltipShift) this.renderTooltipContent();
        }
      },
      true
    );

    document.addEventListener(
      'pointerout',
      (e) => {
        if (!this.activeTarget) return;
        const related = e.relatedTarget as HTMLElement | null;
        if (!related || !this.activeTarget.contains(related)) {
          this.hideTooltip();
        }
      },
      true
    );

    window.addEventListener('keydown', (e) => {
      if (e.shiftKey !== this.shiftDown) {
        this.shiftDown = e.shiftKey;
        if (this.tipEl && !this.tipEl.classList.contains('hidden')) {
          this.renderTooltipContent();
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.shiftKey !== this.shiftDown) {
        this.shiftDown = e.shiftKey;
        if (this.tipEl && !this.tipEl.classList.contains('hidden')) {
          this.renderTooltipContent();
        }
      }
    });
  }

  private showTooltip(): void {
    if (!this.activeTarget || !this.tipEl) return;
    this.renderTooltipContent();
    this.tipEl.classList.remove('hidden');
    this.positionTooltip();
  }

  private renderTooltipContent(): void {
    if (!this.activeTarget || !this.tipEl) return;
    const text = this.activeTarget.dataset.tooltip ?? '';
    const shiftText = this.activeTarget.dataset.tooltipShift ?? '';
    const keyAct = this.activeTarget.dataset.tooltipKey as KeyAction | undefined;
    const keyHtml = keyAct ? Keybinds.badge(keyAct) : '';
    const title = this.activeTarget.dataset.tooltipTitle ?? '';

    this.tipEl.innerHTML = `
      ${title ? `<div style="font-size:15px;font-weight:800;color:#fde047;display:flex;justify-content:space-between;gap:8px;"><span>${title}</span>${keyHtml}</div>` : ''}
      <div style="font-size:14px;color:#f8fafc;">${text}${!title && keyHtml ? ` ${keyHtml}` : ''}</div>
      ${
        shiftText
          ? this.shiftDown
            ? `<div style="font-size:14px;color:#86efac;margin-top:4px;border-top:1px solid rgba(255,255,255,0.16);padding-top:4px;">${shiftText}</div>`
            : `<div style="font-size:14px;color:#94a3b8;margin-top:2px;">Hold Shift for stats</div>`
          : ''
      }
    `;
  }

  private positionTooltip(): void {
    if (!this.tipEl) return;
    const x = Math.min(window.innerWidth - 310, Math.max(12, this.lastX + 14));
    const y = Math.min(window.innerHeight - 130, Math.max(12, this.lastY + 18));
    this.tipEl.style.left = `${x}px`;
    this.tipEl.style.top = `${y}px`;
  }

  public hideTooltip(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = 0;
    }
    this.activeTarget = null;
    this.tipEl?.classList.add('hidden');
  }

  public showHelpCard(title: string, bullets: string[]): void {
    this.init();
    if (!this.helpModalEl) return;
    this.helpModalEl.innerHTML = `
      <div class="modal-card paper-panel" style="width:480px;">
        <div class="modal-header">
          <div style="font-size:20px;font-weight:900;color:#fde047;">❓ ${title}</div>
          <button class="btn btn-rose btn-sm" id="help-card-close">Close</button>
        </div>
        <div class="modal-body" style="gap:8px;font-size:14px;">
          ${bullets.map((b) => `<div>• ${b}</div>`).join('')}
        </div>
      </div>
    `;
    this.helpModalEl.classList.remove('hidden');
    this.helpModalEl.querySelector('#help-card-close')!.addEventListener('click', () => {
      this.helpModalEl?.classList.add('hidden');
    });
  }
}

export const TooltipManager = new TooltipManagerImpl();
