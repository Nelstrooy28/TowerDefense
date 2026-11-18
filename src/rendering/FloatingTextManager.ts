import * as THREE from 'three';
import { easeOutBack, easeOutCubic } from './Easing';

export type PopupKind = 'normal' | 'burn' | 'freeze' | 'cash' | 'crit' | 'synergy';

interface PopupItem {
  el: HTMLSpanElement;
  active: boolean;
  kind: PopupKind;
  enemyId: string;
  amount: number;
  labelPrefix: string;
  worldPos: THREE.Vector3;
  age: number;
  lifetime: number;
  rotDeg: number;
}

const COLORS: Record<PopupKind, string> = {
  normal: '#ffffff',
  burn: '#fb923c',
  freeze: '#38bdf8',
  cash: '#fbbf24',
  crit: '#fde047',
  synergy: '#e879f9',
};

export class FloatingTextManager {
  private container: HTMLElement;
  private pool: PopupItem[] = [];
  private readonly maxPopups = 60;
  private readonly _proj = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.container = container;
    for (let i = 0; i < this.maxPopups; i++) {
      const el = document.createElement('span');
      el.className = 'world-popup';
      el.style.display = 'none';
      this.container.appendChild(el);
      this.pool.push({
        el,
        active: false,
        kind: 'normal',
        enemyId: '',
        amount: 0,
        labelPrefix: '',
        worldPos: new THREE.Vector3(),
        age: 0,
        lifetime: 0.7,
        rotDeg: 0,
      });
    }
  }

  public spawnDamage(
    x: number,
    y: number,
    z: number,
    amount: number,
    kind: PopupKind,
    enemyId = '',
    customText?: string
  ): void {
    // §8.3.4 Merge hits on the same enemy within 0.15 s
    if (enemyId && !customText && (kind === 'normal' || kind === 'burn' || kind === 'freeze')) {
      for (const item of this.pool) {
        if (item.active && item.enemyId === enemyId && item.kind === kind && item.age < 0.15) {
          item.amount += Math.round(amount);
          item.age = 0;
          item.el.textContent = `${item.amount}`;
          return;
        }
      }
    }

    const slot = this.acquireSlot();
    slot.active = true;
    slot.kind = kind;
    slot.enemyId = enemyId;
    slot.amount = Math.round(amount);
    slot.labelPrefix = customText ?? '';
    slot.worldPos.set(
      x + (Math.random() * 0.6 - 0.3),
      y + 0.8 + Math.random() * 0.25,
      z + (Math.random() * 0.6 - 0.3)
    );
    slot.age = 0;
    slot.lifetime = kind === 'synergy' ? 0.95 : 0.7;
    slot.rotDeg = kind === 'crit' ? Math.random() * 16 - 8 : 0;

    if (customText) {
      slot.el.textContent = customText;
    } else if (kind === 'cash') {
      slot.el.textContent = `+$${slot.amount}`;
    } else if (kind === 'crit') {
      slot.el.textContent = `${slot.amount}!`;
    } else {
      slot.el.textContent = `${slot.amount}`;
    }

    slot.el.style.color = COLORS[kind];
    slot.el.className = `world-popup popup-${kind}`;
    slot.el.style.display = 'block';
  }

  private acquireSlot(): PopupItem {
    for (const item of this.pool) {
      if (!item.active) return item;
    }
    // Cap 60 live popups: drop oldest normal ones first, never drop crits or cash (§8.3.4)
    let oldestNormal: PopupItem | null = null;
    let oldestAny: PopupItem = this.pool[0];
    for (const item of this.pool) {
      if (item.age > oldestAny.age) oldestAny = item;
      if (item.kind !== 'crit' && item.kind !== 'cash') {
        if (!oldestNormal || item.age > oldestNormal.age) {
          oldestNormal = item;
        }
      }
    }
    return oldestNormal ?? oldestAny;
  }

  public update(dt: number, camera: THREE.Camera): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const item of this.pool) {
      if (!item.active) continue;
      item.age += dt;
      if (item.age >= item.lifetime) {
        item.active = false;
        item.el.style.display = 'none';
        continue;
      }

      const t = item.age / item.lifetime;
      const rise = easeOutCubic(t) * 1.2;
      this._proj.set(item.worldPos.x, item.worldPos.y + rise, item.worldPos.z).project(camera);

      if (this._proj.z > 1) {
        item.el.style.opacity = '0';
        continue;
      }

      const sx = (this._proj.x * 0.5 + 0.5) * w;
      const sy = (-this._proj.y * 0.5 + 0.5) * h;
      const opacity = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;

      let scale = 1;
      if (item.kind === 'crit' || item.kind === 'synergy') {
        scale = t < 0.28 ? 0.4 + easeOutBack(t / 0.28) * 1.0 : 1.4 - (t - 0.28) * 0.55;
      } else {
        scale = 0.85 + easeOutCubic(Math.min(1, t * 3)) * 0.2;
      }

      item.el.style.opacity = `${opacity}`;
      item.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${item.rotDeg.toFixed(1)}deg) scale(${scale.toFixed(2)})`;
    }
  }

  public clear(): void {
    for (const item of this.pool) {
      item.active = false;
      item.el.style.display = 'none';
    }
  }
}
