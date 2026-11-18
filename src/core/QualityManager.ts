import { EventBus } from './EventBus';

export type QualityTier = 'Low' | 'Medium' | 'High' | 'Ultra';

export interface QualityPreset {
  tier: QualityTier;
  particleCap: number;
  particleRecipeMult: number;
  shadowMapSize: number; // 0 = off (contact discs)
  bloomMode: 'off' | 'half' | 'full';
  grassBlades: number;
  decals: number;
  postFx: boolean;
  pixelRatio: number; // 0 = devicePixelRatio
}

export const QUALITY_PRESETS: Record<QualityTier, QualityPreset> = {
  Low: {
    tier: 'Low',
    particleCap: 600,
    particleRecipeMult: 0.25,
    shadowMapSize: 0,
    bloomMode: 'off',
    grassBlades: 0,
    decals: 40,
    postFx: false,
    pixelRatio: 1.0,
  },
  Medium: {
    tier: 'Medium',
    particleCap: 1500,
    particleRecipeMult: 0.6,
    shadowMapSize: 1024,
    bloomMode: 'half',
    grassBlades: 8000,
    decals: 120,
    postFx: true,
    pixelRatio: 1.25,
  },
  High: {
    tier: 'High',
    particleCap: 2500,
    particleRecipeMult: 1.0,
    shadowMapSize: 2048,
    bloomMode: 'full',
    grassBlades: 20000,
    decals: 200,
    postFx: true,
    pixelRatio: 1.5,
  },
  Ultra: {
    tier: 'Ultra',
    particleCap: 4000,
    particleRecipeMult: 1.5,
    shadowMapSize: 4096,
    bloomMode: 'full',
    grassBlades: 40000,
    decals: 300,
    postFx: true,
    pixelRatio: 0,
  },
};

const TIER_ORDER: QualityTier[] = ['Low', 'Medium', 'High', 'Ultra'];

export interface QualitySettings {
  tier: QualityTier;
  reducedMotion: boolean;
  screenShake: number; // 0..1
  colorblindMode: boolean;
  flashReduction: boolean;
  bossCamera: boolean;
  damageMeter: boolean;
  masterVolume: number; // 0..1
  muted: boolean;
}

class QualityManagerImpl {
  public settings: QualitySettings = {
    tier: 'High',
    reducedMotion: false,
    screenShake: 1.0,
    colorblindMode: false,
    flashReduction: false,
    bossCamera: true,
    damageMeter: false,
    masterVolume: 0.7,
    muted: false,
  };

  private slowFramesAccum = 0;
  private frameSampleCount = 0;
  private frameTimeSum = 0;
  private autoScaledOnce = false;

  public get preset(): QualityPreset {
    return QUALITY_PRESETS[this.settings.tier];
  }

  public applySettings(partial: Partial<QualitySettings>, notify = true): void {
    const prevTier = this.settings.tier;
    Object.assign(this.settings, partial);
    if (notify && prevTier !== this.settings.tier) {
      EventBus.emit('quality:changed', { tier: this.settings.tier, autoDropped: false });
    }
  }

  public setTier(tier: QualityTier, autoDropped = false): void {
    if (this.settings.tier === tier) return;
    this.settings.tier = tier;
    this.slowFramesAccum = 0;
    this.frameSampleCount = 0;
    this.frameTimeSum = 0;
    EventBus.emit('quality:changed', { tier, autoDropped });
    if (autoDropped) {
      EventBus.emit('toast:show', {
        title: `Quality adjusted to ${tier}`,
        subtitle: 'Auto-scaler kept frame rate smooth (>20 ms for 3 s)',
        color: '#38bdf8',
      });
    }
  }

  public recordFrameTime(ms: number, dtSeconds: number): void {
    if (this.settings.tier === 'Low' || this.autoScaledOnce) return;
    this.frameSampleCount++;
    this.frameTimeSum += ms;

    const avg = this.frameTimeSum / Math.max(1, this.frameSampleCount);
    if (avg > 20 && this.frameSampleCount > 20) {
      this.slowFramesAccum += dtSeconds;
      if (this.slowFramesAccum >= 3.0) {
        const idx = TIER_ORDER.indexOf(this.settings.tier);
        if (idx > 0) {
          this.autoScaledOnce = true;
          this.setTier(TIER_ORDER[idx - 1], true);
        }
      }
    } else if (avg < 17) {
      this.slowFramesAccum = Math.max(0, this.slowFramesAccum - dtSeconds * 2);
      if (this.frameSampleCount > 180) {
        this.frameSampleCount = 60;
        this.frameTimeSum = avg * 60;
      }
    }
  }

  public scaleParticleCount(highCount: number): number {
    return Math.max(1, Math.round(highCount * this.preset.particleRecipeMult));
  }

  public clampFlashOpacity(opacity: number): number {
    return this.settings.flashReduction ? Math.min(opacity, 0.4) : opacity;
  }
}

export const QualityManager = new QualityManagerImpl();
