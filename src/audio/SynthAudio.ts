import { QualityManager } from '../core/QualityManager';
import { EventBus } from '../core/EventBus';

interface ActiveVoice {
  stopAt: number;
  gain: GainNode;
}

class SynthAudioImpl {
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public musicDuckGain: GainNode | null = null;
  private voicesByKey = new Map<string, ActiveVoice[]>();
  private heartbeatTimer = 0;

  constructor() {
    const unlock = () => {
      this.ensureContext();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    EventBus.on('audio:sfx', ({ id }) => this.play(id));
    EventBus.on('audio:duck', ({ duration }) => this.duckMusic(duration));
  }

  public ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.musicDuckGain = this.ctx.createGain();
      this.musicDuckGain.gain.value = 1.0;
      this.musicDuckGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.syncVolume();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public syncVolume(): void {
    if (!this.masterGain || !this.ctx) return;
    const vol = QualityManager.settings.muted ? 0 : QualityManager.settings.masterVolume;
    this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.02);
  }

  public duckMusic(duration = 0.3): void {
    if (!this.ctx || !this.musicDuckGain) return;
    const now = this.ctx.currentTime;
    this.musicDuckGain.gain.cancelScheduledValues(now);
    this.musicDuckGain.gain.setValueAtTime(0.5, now); // -6 dB
    this.musicDuckGain.gain.exponentialRampToValueAtTime(1.0, now + duration);
  }

  private registerVoice(key: string, dur: number, gainNode: GainNode): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    let list = this.voicesByKey.get(key);
    if (!list) {
      list = [];
      this.voicesByKey.set(key, list);
    }
    // Prune expired
    while (list.length > 0 && list[0].stopAt <= now) {
      list.shift();
    }
    // §10.1 Max 12 voices of the same SFX; oldest voice stolen
    if (list.length >= 12) {
      const oldest = list.shift();
      if (oldest) {
        oldest.gain.gain.setTargetAtTime(0.0001, now, 0.005);
      }
    }
    list.push({ stopAt: now + dur, gain: gainNode });
  }

  public play(id: string): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || QualityManager.settings.muted) return;

    const now = ctx.currentTime;
    // §10.1 SFX variety: random pitch +-6%, volume +-10%
    const pitchMult = 0.94 + Math.random() * 0.12;
    const volMult = 0.9 + Math.random() * 0.2;

    if (id === 'tomato') {
      this.playTone(now, 'sine', 320 * pitchMult, 110 * pitchMult, 0.11, 0.14 * volMult, 'tomato');
    } else if (id === 'cactus') {
      this.playTone(now, 'triangle', 1200 * pitchMult, 700 * pitchMult, 0.06, 0.1 * volMult, 'cactus');
    } else if (id === 'pineapple' || id === 'golem' || id === 'explosion') {
      this.playTone(now, 'sawtooth', 110 * pitchMult, 35 * pitchMult, 0.34, 0.24 * volMult, 'boom');
      this.playNoise(now, 0.22, 900, 0.18 * volMult, 'boom_n');
    } else if (id === 'laser') {
      this.playTone(now, 'sawtooth', 520 * pitchMult, 640 * pitchMult, 0.09, 0.08 * volMult, 'laser');
    } else if (id === 'ice') {
      this.playTone(now, 'sine', 1320 * pitchMult, 1760 * pitchMult, 0.18, 0.11 * volMult, 'ice');
    } else if (id === 'sonic') {
      this.playTone(now, 'sine', 180 * pitchMult, 55 * pitchMult, 0.28, 0.2 * volMult, 'sonic');
    } else if (id === 'pepper') {
      this.playNoise(now, 0.16, 1600, 0.11 * volMult, 'pepper');
    } else if (id === 'flytrap') {
      this.playTone(now, 'square', 240 * pitchMult, 90 * pitchMult, 0.12, 0.16 * volMult, 'chomp');
    } else if (id === 'crit') {
      this.playTone(now, 'triangle', 980 * pitchMult, 1560 * pitchMult, 0.12, 0.18 * volMult, 'crit');
    } else if (id === 'coin') {
      this.playTone(now, 'sine', 1046 * pitchMult, 1568 * pitchMult, 0.1, 0.12 * volMult, 'coin');
    } else if (id === 'click') {
      this.playTone(now, 'sine', 620 * pitchMult, 760 * pitchMult, 0.045, 0.09, 'ui');
    } else if (id === 'error') {
      this.playTone(now, 'sawtooth', 190, 120, 0.14, 0.13, 'ui');
    } else if (id === 'upgrade') {
      this.playArpeggio(now, [523, 659, 784, 1046], 0.06, 0.16, 'triangle');
    } else if (id === 'upgrade_max') {
      this.playArpeggio(now, [523, 659, 784, 987, 1175, 1568], 0.065, 0.2, 'sawtooth');
    } else if (id === 'sell') {
      this.playArpeggio(now, [784, 659, 523], 0.05, 0.12, 'sine');
    } else if (id === 'crate_thud') {
      this.playTone(now, 'sine', 140, 48, 0.18, 0.22, 'crate');
    } else if (id === 'crate_rattle') {
      this.playTone(now, 'triangle', 420 * pitchMult, 520 * pitchMult, 0.05, 0.1, 'crate');
    } else if (id === 'crate_ting') {
      this.playTone(now, 'sine', 1760, 2200, 0.24, 0.18, 'crate');
    } else if (id === 'crate_fanfare') {
      this.playArpeggio(now, [523.25, 659.25, 783.99, 987.77, 1174.66], 0.075, 0.22, 'triangle');
    } else if (id === 'timestop') {
      this.playTone(now, 'sawtooth', 600, 45, 0.55, 0.24, 'chrono');
      this.playTone(now + 0.15, 'sine', 880, 880, 0.08, 0.14, 'chrono');
    } else if (id === 'boss_roar') {
      this.playTone(now, 'sawtooth', 95, 36, 0.85, 0.28, 'boss');
      this.playNoise(now, 0.7, 450, 0.2, 'boss');
    } else if (id === 'synergy') {
      this.playArpeggio(now, [659, 987, 1318], 0.05, 0.14, 'sine');
    } else if (id === 'wheel_tick') {
      this.playTone(now, 'triangle', 920 * pitchMult, 600, 0.03, 0.1, 'wheel');
    } else if (id === 'base_hit') {
      this.playTone(now, 'sawtooth', 160, 70, 0.22, 0.2, 'basehit');
    } else if (id === 'heartbeat') {
      this.playTone(now, 'sine', 65, 42, 0.12, 0.18, 'hb');
      this.playTone(now + 0.18, 'sine', 58, 38, 0.12, 0.14, 'hb');
    }
  }

  public updateLowHpHeartbeat(dt: number, isLowHp: boolean): void {
    if (!isLowHp) {
      this.heartbeatTimer = 0;
      return;
    }
    this.heartbeatTimer -= dt;
    if (this.heartbeatTimer <= 0) {
      this.heartbeatTimer = 0.85;
      this.play('heartbeat');
    }
  }

  private playTone(
    startTime: number,
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    dur: number,
    vol: number,
    key: string
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, startFreq), startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + dur);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
    this.registerVoice(key, dur, gain);
  }

  private playNoise(startTime: number, dur: number, filterHz: number, vol: number, key: string): void {
    if (!this.ctx || !this.masterGain) return;
    const sampleCount = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(startTime);
    this.registerVoice(key, dur, gain);
  }

  private playArpeggio(
    startTime: number,
    notes: number[],
    stepSec: number,
    vol: number,
    type: OscillatorType
  ): void {
    for (let i = 0; i < notes.length; i++) {
      this.playTone(startTime + i * stepSec, type, notes[i], notes[i] * 1.01, 0.22, vol * 0.75, 'arp');
    }
  }
}

export const SynthAudio = new SynthAudioImpl();
