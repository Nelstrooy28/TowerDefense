import { QualityManager } from '../core/QualityManager';
import { EventBus } from '../core/EventBus';

interface ActiveVoice {
  stopAt: number;
  gain: GainNode;
}

class SynthAudioImpl {
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public musicGain: GainNode | null = null;
  public sfxGain: GainNode | null = null;
  public uiGain: GainNode | null = null;
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

    EventBus.on('audio:sfx', ({ id, screenX, distance }) => this.play(id, screenX, distance));
    EventBus.on('audio:duck', ({ duration }) => this.duckMusic(duration));
  }

  public ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.uiGain = this.ctx.createGain();
      this.musicDuckGain = this.ctx.createGain();
      this.musicDuckGain.gain.value = 1.0;

      this.musicDuckGain.connect(this.musicGain);
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.uiGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.syncVolume();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public syncVolume(): void {
    if (!this.ctx || !this.masterGain) return;
    const s = QualityManager.settings;
    const t = this.ctx.currentTime;
    const vol = s.muted ? 0 : s.masterVolume;
    this.masterGain.gain.setTargetAtTime(vol, t, 0.02);
    this.musicGain?.gain.setTargetAtTime(s.volumeMusic ?? 0.85, t, 0.02);
    this.sfxGain?.gain.setTargetAtTime(s.volumeSfx ?? 0.9, t, 0.02);
    this.uiGain?.gain.setTargetAtTime(s.volumeUi ?? 0.8, t, 0.02);
  }

  public duckMusic(duration = 0.3): void {
    if (!this.ctx || !this.musicDuckGain) return;
    const now = this.ctx.currentTime;
    this.musicDuckGain.gain.cancelScheduledValues(now);
    this.musicDuckGain.gain.setValueAtTime(0.5, now);
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
    while (list.length > 0 && list[0].stopAt <= now) {
      list.shift();
    }
    if (list.length >= 12) {
      const oldest = list.shift();
      if (oldest) {
        oldest.gain.gain.setTargetAtTime(0.0001, now, 0.005);
      }
    }
    list.push({ stopAt: now + dur, gain: gainNode });
  }

  public playComboChord(comboCount: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || QualityManager.settings.muted) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    const n = Math.min(notes.length, Math.max(2, comboCount - 3));
    for (let i = 0; i < n; i++) {
      this.playTone(now + i * 0.045, 'triangle', notes[i], notes[i] * 1.02, 0.22, 0.14, 'combo', this.sfxGain);
    }
  }

  public play(id: string, screenX?: number, distance?: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.sfxGain || !this.uiGain || QualityManager.settings.muted) return;

    const now = ctx.currentTime;
    const pitchMult = 0.94 + Math.random() * 0.12;
    const distAtten = distance ? Math.max(0.28, 1 - distance / 55) : 1.0;
    const volMult = (0.9 + Math.random() * 0.2) * distAtten;
    const pan = screenX !== undefined ? Math.max(-0.85, Math.min(0.85, screenX)) : 0;

    const isUi =
      id === 'click' ||
      id === 'error' ||
      id === 'coin' ||
      id.startsWith('crate_') ||
      id === 'wheel_tick' ||
      id === 'upgrade' ||
      id === 'upgrade_max' ||
      id === 'sell';
    const bus = isUi ? this.uiGain : this.sfxGain;

    if (id === 'tomato') {
      this.playTone(now, 'sine', 320 * pitchMult, 110 * pitchMult, 0.11, 0.14 * volMult, 'tomato', bus, pan);
    } else if (id === 'cactus' || id === 'bamboo') {
      this.playTone(now, 'triangle', 1200 * pitchMult, 700 * pitchMult, 0.06, 0.1 * volMult, 'cactus', bus, pan);
    } else if (id === 'pineapple' || id === 'golem' || id === 'explosion') {
      this.playTone(now, 'sawtooth', 110 * pitchMult, 35 * pitchMult, 0.34, 0.24 * volMult, 'boom', bus, pan);
      this.playNoise(now, 0.22, 900, 0.18 * volMult, 'boom_n', bus, pan);
    } else if (id === 'laser') {
      this.playTone(now, 'sawtooth', 520 * pitchMult, 640 * pitchMult, 0.09, 0.08 * volMult, 'laser', bus, pan);
    } else if (id === 'ice') {
      this.playTone(now, 'sine', 1320 * pitchMult, 1760 * pitchMult, 0.18, 0.11 * volMult, 'ice', bus, pan);
    } else if (id === 'sonic') {
      this.playTone(now, 'sine', 180 * pitchMult, 55 * pitchMult, 0.28, 0.2 * volMult, 'sonic', bus, pan);
    } else if (id === 'pepper' || id === 'mushroom') {
      this.playNoise(now, 0.16, 1600, 0.11 * volMult, 'pepper', bus, pan);
    } else if (id === 'flytrap') {
      this.playTone(now, 'square', 240 * pitchMult, 90 * pitchMult, 0.12, 0.16 * volMult, 'chomp', bus, pan);
    } else if (id === 'place_root') {
      this.playNoise(now, 0.14, 520, 0.15, 'root_soil', bus, pan);
      this.playTone(now + 0.05, 'triangle', 220, 340, 0.12, 0.12, 'root_creak', bus, pan);
    } else if (id === 'lightning') {
      this.playNoise(now, 0.45, 780, 0.26, 'thunder', bus, pan);
      this.playTone(now, 'sawtooth', 880, 90, 0.25, 0.2, 'zap', bus, pan);
    } else if (id === 'stagger') {
      this.playArpeggio(now, [440, 587, 880], 0.04, 0.22, 'sawtooth', bus);
    } else if (id === 'crit') {
      this.playTone(now, 'triangle', 980 * pitchMult, 1560 * pitchMult, 0.12, 0.18 * volMult, 'crit', bus, pan);
    } else if (id === 'coin') {
      this.playTone(now, 'sine', 1046 * pitchMult, 1568 * pitchMult, 0.1, 0.12 * volMult, 'coin', bus, pan);
    } else if (id === 'click') {
      this.playTone(now, 'sine', 620 * pitchMult, 760 * pitchMult, 0.045, 0.09, 'ui', bus);
    } else if (id === 'error') {
      this.playTone(now, 'sawtooth', 190, 120, 0.14, 0.13, 'ui', bus);
    } else if (id === 'upgrade') {
      this.playArpeggio(now, [523, 659, 784, 1046], 0.06, 0.16, 'triangle', bus);
    } else if (id === 'upgrade_max') {
      this.playArpeggio(now, [523, 659, 784, 987, 1175, 1568], 0.065, 0.2, 'sawtooth', bus);
    } else if (id === 'sell') {
      this.playNoise(now, 0.15, 650, 0.12, 'sell_soil', bus);
      this.playArpeggio(now, [784, 659, 523], 0.05, 0.12, 'sine', bus);
    } else if (id === 'crate_thud') {
      this.playTone(now, 'sine', 140, 48, 0.18, 0.22, 'crate', bus);
    } else if (id === 'crate_rattle') {
      this.playTone(now, 'triangle', 420 * pitchMult, 520 * pitchMult, 0.05, 0.1, 'crate', bus);
    } else if (id === 'crate_ting') {
      this.playTone(now, 'sine', 1760, 2200, 0.24, 0.18, 'crate', bus);
    } else if (id === 'crate_fanfare') {
      this.playArpeggio(now, [523.25, 659.25, 783.99, 987.77, 1174.66], 0.075, 0.22, 'triangle', bus);
    } else if (id === 'timestop') {
      this.playTone(now, 'sawtooth', 600, 45, 0.55, 0.24, 'chrono', bus);
      this.playTone(now + 0.15, 'sine', 880, 880, 0.08, 0.14, 'chrono', bus);
    } else if (id === 'boss_roar') {
      this.playTone(now, 'sawtooth', 95, 36, 0.85, 0.28, 'boss', bus);
      this.playNoise(now, 0.7, 450, 0.2, 'boss', bus);
    } else if (id === 'synergy') {
      this.playArpeggio(now, [659, 987, 1318], 0.05, 0.14, 'sine', bus);
    } else if (id === 'wheel_tick') {
      this.playTone(now, 'triangle', 920 * pitchMult, 600, 0.03, 0.1, 'wheel', bus);
    } else if (id === 'base_hit') {
      this.playTone(now, 'sawtooth', 160, 70, 0.22, 0.2, 'basehit', bus);
    } else if (id === 'heartbeat') {
      this.playTone(now, 'sine', 65, 42, 0.12, 0.18, 'hb', bus);
      this.playTone(now + 0.18, 'sine', 58, 38, 0.12, 0.14, 'hb', bus);
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
    key: string,
    dest: AudioNode,
    pan = 0
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, startFreq), startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + dur);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    if (pan !== 0 && typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(dest);
    } else {
      osc.connect(gain);
      gain.connect(dest);
    }
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
    this.registerVoice(key, dur, gain);
  }

  private playNoise(
    startTime: number,
    dur: number,
    filterHz: number,
    vol: number,
    key: string,
    dest: AudioNode,
    pan = 0
  ): void {
    if (!this.ctx) return;
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
    if (pan !== 0 && typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(dest);
    } else {
      filter.connect(gain);
      gain.connect(dest);
    }
    src.start(startTime);
    this.registerVoice(key, dur, gain);
  }

  private playArpeggio(
    startTime: number,
    notes: number[],
    stepSec: number,
    vol: number,
    type: OscillatorType,
    dest: AudioNode
  ): void {
    for (let i = 0; i < notes.length; i++) {
      this.playTone(startTime + i * stepSec, type, notes[i], notes[i] * 1.01, 0.22, vol * 0.75, 'arp', dest);
    }
  }
}

export const SynthAudio = new SynthAudioImpl();
