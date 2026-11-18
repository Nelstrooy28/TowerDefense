import { SynthAudio } from './SynthAudio';
import { EventBus } from '../core/EventBus';
import { QualityManager } from '../core/QualityManager';
import { GlobalShaderUniforms } from '../rendering/ShaderLib';
import type { MapId } from '../data/MapRegistry';

const MAP_CHORDS: Record<MapId, number[][]> = {
  // C major: I - V - vi - IV
  sunny_backyard: [
    [261.63, 329.63, 392.0],
    [196.0, 246.94, 293.66],
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 261.63],
  ],
  // D Dorian
  enchanted_jungle: [
    [293.66, 349.23, 440.0],
    [329.63, 392.0, 493.88],
    [261.63, 329.63, 392.0],
    [293.66, 392.0, 440.0],
  ],
  // E Phrygian
  volcano_greenhouse: [
    [329.63, 392.0, 493.88],
    [349.23, 440.0, 523.25],
    [293.66, 349.23, 440.0],
    [329.63, 349.23, 493.88],
  ],
  // A minor (Frosty bell layer)
  frosty_allotment: [
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 261.63],
    [261.63, 329.63, 392.0],
    [196.0, 246.94, 293.66],
  ],
};

class AdaptiveMusicImpl {
  private stepAccum = 0;
  private stepIndex = 0;
  private threatSmoothed = 0;
  public currentBeatPulse = 0;
  public mapId: MapId = 'sunny_backyard';
  public bossPhase3 = false;

  public update(
    dt: number,
    waveActive: boolean,
    rawThreat: number,
    isBossOrLowHp: boolean
  ): void {
    const bpm = this.bossPhase3 ? 112 : 100; // §17 Phase 3 raises tempo 100 -> 112 BPM
    const stepDuration = 60 / bpm / 2;

    this.threatSmoothed += (rawThreat - this.threatSmoothed) * Math.min(1, dt * 0.5);
    this.currentBeatPulse = Math.max(0, this.currentBeatPulse - dt * 3.5);
    GlobalShaderUniforms.uBeatPulse.value = this.currentBeatPulse;

    this.stepAccum += dt;
    while (this.stepAccum >= stepDuration) {
      this.stepAccum -= stepDuration;
      this.triggerStep(waveActive, isBossOrLowHp);
      this.stepIndex = (this.stepIndex + 1) % 32;
    }
  }

  private triggerStep(waveActive: boolean, isBossOrLowHp: boolean): void {
    const isQuarterBeat = this.stepIndex % 2 === 0;
    if (isQuarterBeat) {
      this.currentBeatPulse = 1.0;
      EventBus.emit('music:beat', {
        beatIndex: this.stepIndex / 2,
        threat: this.threatSmoothed,
      });
    }

    const ctx = SynthAudio.ctx;
    const duckGain = SynthAudio.musicDuckGain;
    if (!ctx || !duckGain || ctx.state !== 'running' || QualityManager.settings.muted) {
      return;
    }

    const now = ctx.currentTime;
    const chords = MAP_CHORDS[this.mapId] ?? MAP_CHORDS.sunny_backyard;
    const chordIdx = Math.floor(this.stepIndex / 8) % 4;
    const chord = chords[chordIdx];

    // Layer 1: Garden Pad
    if (this.stepIndex % 8 === 0) {
      for (const freq of chord) {
        this.note(ctx, duckGain, now, 'sine', freq, 2.2, 0.032);
      }
      if (this.mapId === 'frosty_allotment') {
        this.note(ctx, duckGain, now, 'sine', chord[2] * 4, 0.85, 0.02); // Winter bell layer
      }
    }

    // Layer 2: Plucks
    if (waveActive) {
      const noteFreq = chord[this.stepIndex % chord.length] * 2;
      this.note(ctx, duckGain, now, 'triangle', noteFreq, 0.18, 0.036);
    }

    // Layer 3: Drums
    if (waveActive && this.threatSmoothed > 0.4) {
      if (this.stepIndex % 4 === 0) {
        this.note(ctx, duckGain, now, 'sine', 110, 0.12, 0.06, 45);
      }
      if (this.stepIndex % 2 === 1) {
        this.hat(ctx, duckGain, now, 0.04, 0.018);
      }
    }

    // Layer 4: Danger + Boss lead
    if (isBossOrLowHp) {
      if (this.stepIndex % 2 === 0) {
        this.note(ctx, duckGain, now, 'sawtooth', chord[0] * 0.5, 0.22, 0.035);
      }
      if (this.bossPhase3 && this.stepIndex % 4 === 2) {
        this.note(ctx, duckGain, now, 'square', chord[1] * 1.5, 0.16, 0.024);
      }
      this.hat(ctx, duckGain, now, 0.03, 0.022);
    }
  }

  private note(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    type: OscillatorType,
    freq: number,
    dur: number,
    vol: number,
    dropToFreq?: number
  ): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (dropToFreq) {
      osc.frequency.exponentialRampToValueAtTime(dropToFreq, t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private hat(ctx: AudioContext, dest: AudioNode, t: number, dur: number, vol: number): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(6400, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }
}

export const AdaptiveMusic = new AdaptiveMusicImpl();
