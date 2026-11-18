import { WEATHER_LIST, WEATHERS, type WeatherDef, type WeatherId } from '../data/WeatherConfig';
import { EventBus } from '../core/EventBus';
import { VFXManager } from '../rendering/VFXManager';
import { GlobalShaderUniforms } from '../rendering/ShaderLib';
import { QualityManager } from '../core/QualityManager';
import { SynthAudio } from '../audio/SynthAudio';
import type { EnemyEntity } from './EnemyEntity';

export class WeatherSystem {
  public currentWeather: WeatherId | null = null;
  public upcomingWeather: WeatherId | null = null;
  private wavesRemaining = 0;
  private vfx: VFXManager;
  private lightningTimer = 6.0;
  private thunderDelay = -1;

  constructor(vfx: VFXManager) {
    this.vfx = vfx;
  }

  public reset(): void {
    this.currentWeather = null;
    this.upcomingWeather = null;
    this.wavesRemaining = 0;
    this.lightningTimer = 6.0;
    this.thunderDelay = -1;
    this.applyVisuals();
    EventBus.emit('weather:changed', { weather: null });
  }

  public get activeDef(): WeatherDef | null {
    return this.currentWeather ? WEATHERS[this.currentWeather] : null;
  }

  public onWaveStarted(wave: number, isBossWave: boolean, isFrostyMap = false): void {
    const prevWeather = this.currentWeather;
    if (this.wavesRemaining > 0) {
      this.wavesRemaining--;
      if (this.wavesRemaining === 0) {
        this.currentWeather = null;
        // §11 Rainbow appears after Rain Shower or Thunderstorm ends (+10% Seeds)
        if ((prevWeather === 'rain_shower' || prevWeather === 'thunderstorm') && !this.upcomingWeather) {
          this.currentWeather = 'rainbow';
          this.wavesRemaining = 1;
        }
        this.applyVisuals();
        EventBus.emit('weather:changed', { weather: this.currentWeather });
      }
    }

    if (this.upcomingWeather && !isBossWave) {
      this.currentWeather = this.upcomingWeather;
      this.upcomingWeather = null;
      this.wavesRemaining = 2;
      this.lightningTimer = 5.0;
      this.applyVisuals();
      EventBus.emit('weather:changed', { weather: this.currentWeather });
      const def = WEATHERS[this.currentWeather];
      EventBus.emit('toast:show', {
        title: `${def.icon} ${def.name} Active!`,
        subtitle: def.effectDesc,
        color: def.color,
      });
    } else if (isFrostyMap && !this.currentWeather && wave % 4 === 0) {
      this.currentWeather = 'snow';
      this.wavesRemaining = 1;
      this.applyVisuals();
      EventBus.emit('weather:changed', { weather: 'snow' });
    }

    if (wave > 0 && wave % 5 === 4 && !isBossWave) {
      if (Math.random() < 0.4) {
        this.upcomingWeather = WEATHER_LIST[Math.floor(Math.random() * WEATHER_LIST.length)];
        EventBus.emit('weather:announced', { weather: this.upcomingWeather, wavesUntil: 1 });
        const def = WEATHERS[this.upcomingWeather];
        EventBus.emit('toast:show', {
          title: `Weather Forecast: ${def.icon} ${def.name}`,
          subtitle: `Arriving next wave — ${def.effectDesc}`,
          color: def.color,
        });
      }
    }
  }

  public update(dt: number, enemies: EnemyEntity[]): void {
    if (this.thunderDelay > 0) {
      this.thunderDelay -= dt;
      if (this.thunderDelay <= 0) {
        SynthAudio.play('lightning');
      }
    }

    // §11 Thunderstorm: every 6 s lightning strikes a random enemy for 8% max HP
    if (this.currentWeather === 'thunderstorm') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 6.0;
        const alive = enemies.filter((e) => !e.isDead && !e.reachedGoal);
        if (alive.length > 0) {
          const target = alive[Math.floor(Math.random() * alive.length)];
          this.vfx.spawnChainLightning(
            target.position.x,
            18,
            target.position.z,
            target.position.x,
            0.5,
            target.position.z,
            0xe0e7ff
          );
          target.applyDamage(Math.round(target.maxHp * 0.08), {
            element: 'arcane',
            reaction: 'lightning',
          });
          EventBus.emit('vfx:screen_flash', {
            color: '#e0e7ff',
            opacity: QualityManager.clampFlashOpacity(0.45),
            duration: 0.14,
          });
          this.thunderDelay = 0.4; // thunder 0.4 s after bolt (§11)
        }
      }
    }
  }

  private applyVisuals(): void {
    this.vfx.setRainActive(
      this.currentWeather === 'rain_shower' || this.currentWeather === 'thunderstorm'
    );
    GlobalShaderUniforms.uWindStrength.value = this.currentWeather === 'wind_gust' ? 2.6 : 1.0;
  }
}
