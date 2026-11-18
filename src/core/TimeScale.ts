import { QualityManager } from './QualityManager';

export type HitStopKind =
  | 'crit'
  | 'flytrap_devour'
  | 'golem_smash'
  | 'shield_shatter'
  | 'boss_phase'
  | 'boss_kill';

const HIT_STOP_DURATION: Record<HitStopKind, number> = {
  crit: 0.04,
  flytrap_devour: 0.07,
  golem_smash: 0.09,
  shield_shatter: 0.06,
  boss_phase: 0.15,
  boss_kill: 0.25,
};

export type GameSpeed = 1 | 2 | 3;

class TimeScaleController {
  public speed: GameSpeed = 1;
  public paused = false;

  private hitStopRemaining = 0;
  private lastCritHitStopAt = -10;
  private elapsedReal = 0;

  private slowMoScale = 1.0;
  private slowMoRemaining = 0;
  private slowMoDuration = 0;

  private chronoTimeStopRemaining = 0;

  public resetMatch(): void {
    this.hitStopRemaining = 0;
    this.slowMoScale = 1.0;
    this.slowMoRemaining = 0;
    this.slowMoDuration = 0;
    this.chronoTimeStopRemaining = 0;
    this.paused = false;
  }

  public setSpeed(speed: GameSpeed): void {
    this.speed = speed;
  }

  public triggerHitStop(kind: HitStopKind): void {
    const isBossEvent = kind === 'boss_phase' || kind === 'boss_kill';
    if (this.speed === 3 && !isBossEvent) return;
    if (kind === 'crit') {
      if (this.elapsedReal - this.lastCritHitStopAt < 0.25) return;
      this.lastCritHitStopAt = this.elapsedReal;
    }
    const dur = HIT_STOP_DURATION[kind];
    this.hitStopRemaining = Math.min(0.25, Math.max(this.hitStopRemaining, dur));
  }

  public triggerSlowMo(scale: number, duration: number, isBossEvent = false): void {
    if (QualityManager.settings.reducedMotion && !isBossEvent) return;
    if (this.speed === 3 && !isBossEvent) return;
    this.slowMoScale = scale;
    this.slowMoRemaining = Math.max(this.slowMoRemaining, duration);
    this.slowMoDuration = Math.max(this.slowMoDuration, duration);
  }

  public triggerChronoTimeStop(duration: number): void {
    this.chronoTimeStopRemaining = Math.max(this.chronoTimeStopRemaining, duration);
  }

  public isChronoTimeStopped(): boolean {
    return this.chronoTimeStopRemaining > 0;
  }

  public isInHitStop(): boolean {
    return this.hitStopRemaining > 0;
  }

  public step(rawDt: number): { uiDt: number; simDt: number; enemyDt: number; shaderDt: number } {
    const clampedDt = Math.min(Math.max(rawDt, 0), 0.05);
    this.elapsedReal += clampedDt;

    if (this.paused) {
      return { uiDt: clampedDt, simDt: 0, enemyDt: 0, shaderDt: clampedDt * 0.25 };
    }

    if (this.hitStopRemaining > 0) {
      this.hitStopRemaining = Math.max(0, this.hitStopRemaining - clampedDt);
      return { uiDt: clampedDt, simDt: 0, enemyDt: 0, shaderDt: 0 };
    }

    let slowFactor = 1.0;
    if (this.slowMoRemaining > 0) {
      this.slowMoRemaining = Math.max(0, this.slowMoRemaining - clampedDt);
      const t = this.slowMoDuration > 0 ? 1 - this.slowMoRemaining / this.slowMoDuration : 1;
      slowFactor = this.slowMoScale + (1.0 - this.slowMoScale) * (t * t);
    }

    const simDt = clampedDt * this.speed * slowFactor;

    if (this.chronoTimeStopRemaining > 0) {
      this.chronoTimeStopRemaining = Math.max(0, this.chronoTimeStopRemaining - simDt);
    }

    const enemyDt = this.chronoTimeStopRemaining > 0 ? 0 : simDt;
    return {
      uiDt: clampedDt,
      simDt,
      enemyDt,
      shaderDt: simDt,
    };
  }
}

export const TimeScale = new TimeScaleController();
