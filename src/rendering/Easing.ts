export type EasingFn = (t: number) => number;

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function linear(t: number): number {
  return clamp01(t);
}

export function easeOutCubic(t: number): number {
  const x = 1 - clamp01(t);
  return 1 - x * x * x;
}

export function easeInOutSine(t: number): number {
  const x = clamp01(t);
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

export function easeOutBack(t: number, s = 1.70158): number {
  const x = clamp01(t) - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
}

export function easeOutElastic(t: number): number {
  const x = clamp01(t);
  if (x === 0 || x === 1) return x;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}

export function easeOutBounce(t: number): number {
  let x = clamp01(t);
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) {
    return n1 * x * x;
  } else if (x < 2 / d1) {
    x -= 1.5 / d1;
    return n1 * x * x + 0.75;
  } else if (x < 2.5 / d1) {
    x -= 2.25 / d1;
    return n1 * x * x + 0.9375;
  } else {
    x -= 2.625 / d1;
    return n1 * x * x + 0.984375;
  }
}

/**
 * Damped harmonic spring: d^2x/dt^2 = -k(x - target) - c * dx/dt
 * Default constants from §8.1: k = 280, c = 18.
 */
export class DampedSpring {
  public value: number;
  public target: number;
  public velocity = 0;
  public k: number;
  public c: number;

  constructor(initial = 0, k = 280, c = 18) {
    this.value = initial;
    this.target = initial;
    this.k = k;
    this.c = c;
  }

  public impulse(dv: number): void {
    this.velocity += dv;
  }

  public setImmediate(v: number): void {
    this.value = v;
    this.target = v;
    this.velocity = 0;
  }

  public step(dt: number): number {
    if (dt <= 0) return this.value;
    // Substep if dt is large so spring stays unconditionally stable
    const substeps = dt > 0.016 ? 2 : 1;
    const h = dt / substeps;
    for (let i = 0; i < substeps; i++) {
      const accel = -this.k * (this.value - this.target) - this.c * this.velocity;
      this.velocity += accel * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}

export class Vec3Spring {
  public x: DampedSpring;
  public y: DampedSpring;
  public z: DampedSpring;

  constructor(ix = 1, iy = 1, iz = 1, k = 280, c = 18) {
    this.x = new DampedSpring(ix, k, c);
    this.y = new DampedSpring(iy, k, c);
    this.z = new DampedSpring(iz, k, c);
  }

  public setTarget(x: number, y: number, z: number): void {
    this.x.target = x;
    this.y.target = y;
    this.z.target = z;
  }

  public setImmediate(x: number, y: number, z: number): void {
    this.x.setImmediate(x);
    this.y.setImmediate(y);
    this.z.setImmediate(z);
  }

  public impulse(dx: number, dy: number, dz: number): void {
    this.x.impulse(dx);
    this.y.impulse(dy);
    this.z.impulse(dz);
  }

  public step(dt: number): void {
    this.x.step(dt);
    this.y.step(dt);
    this.z.step(dt);
  }
}
