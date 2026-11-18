import { SynthAudio } from './SynthAudio';
import { EventBus } from '../core/EventBus';
import { QualityManager } from '../core/QualityManager';
import { GlobalShaderUniforms } from '../rendering/ShaderLib';

/**
 * 100 BPM 4-Layer Adaptive Procedural Music (§10.1)
 * Layer 1: Garden pad (Always)
 * Layer 2: Plucks (Wave active)
 * Layer 3: Drums (Threat > 40%)
 * Layer 4: Danger (Boss or Base HP < 25%)
 */
class AdaptiveMusicImpl {
  private readonly bpm = 100;
  private readonly stepDuration = 60 / this.bpm / 2; // eighth note = 0.3 s
  private stepAccum = 0;
  private stepIndex = 0;
  private threatSmoothed = 0;
  public currentBeatPulse = 0;

  // I - V - vi - IV in C major (MIDI-ish Hz)
  private readonly chords = [
    [261.63, 329.63, 392.0], // C
    [196.0, 246.94, 293.66], // G
    [220.0, 261.63, 329.63], // Am
    [174.61, 220.0, 261.63], // F
  ];

  public update(
    dt: number,
    waveActive: boolean,
    rawThreat: number,
    isBossOrLowHp: boolean
  ): void {
    // Smooth threat over 2 s (§10.1)
    this.threatSmoothed += (rawThreat - this.threatSmoothed) * Math.min(1, dt * 0.5);
    this.currentBeatPulse = Math.max(0, this.currentBeatPulse - dt * 3.5);
    GlobalShaderUniforms.uBeatPulse.value = this.currentBeatPulse;

    this.stepAccum += dt;
    while (this.stepAccum >= this.stepDuration) {
      this.stepAccum -= this.stepDuration;
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
    const chordIdx = Math.floor(this.stepIndex / 8) % 4;
    const chord = this.chords[chordIdx];

    // Layer 1: Garden Pad (on start of each chord bar)
    if (this.stepIndex % 8 === 0) {
      for (const freq of chord) {
        this.note(ctx, duckGain, now, 'sine', freq, 2.2, 0.032);
      }
    }

    // Layer 2: Plucks (when wave is active)
    if (waveActive) {
      const noteFreq = chord[this.stepIndex % chord.length] * 2;
      this.note(ctx, duckGain, now, 'triangle', noteFreq, 0.18, 0.036);
    }

    // Layer 3: Drums (Threat > 40%)
    if (waveActive && this.threatSmoothed > 0.4) {
      if (this.stepIndex % 4 === 0) {
        this.note(ctx, duckGain, now, 'sine', 110, 0.12, 0.06, 45);
      }
      if (this.stepIndex % 2 === 1) {
        this.hat(ctx, duckGain, now, 0.04, 0.018);
      }
    }

    // Layer 4: Danger (Boss or Base HP < 25%)
    if (isBossOrLowHp) {
      if (this.stepIndex % 2 === 0) {
        this.note(ctx, duckGain, now, 'sawtooth', chord[0] * 0.5, 0.22, 0.035);
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
