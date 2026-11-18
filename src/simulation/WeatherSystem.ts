import { WEATHER_LIST, WEATHERS, type WeatherDef, type WeatherId } from '../data/WeatherConfig';
import { EventBus } from '../core/EventBus';
import { VFXManager } from '../rendering/VFXManager';
import { GlobalShaderUniforms } from '../rendering/ShaderLib';

export class WeatherSystem {
  public currentWeather: WeatherId | null = null;
  public upcomingWeather: WeatherId | null = null;
  private wavesRemaining = 0;
  private vfx: VFXManager;

  constructor(vfx: VFXManager) {
    this.vfx = vfx;
  }

  public reset(): void {
    this.currentWeather = null;
    this.upcomingWeather = null;
    this.wavesRemaining = 0;
    this.applyVisuals();
    EventBus.emit('weather:changed', { weather: null });
  }

  public get activeDef(): WeatherDef | null {
    return this.currentWeather ? WEATHERS[this.currentWeather] : null;
  }

  public onWaveStarted(wave: number, isBossWave: boolean): void {
    if (this.wavesRemaining > 0) {
      this.wavesRemaining--;
      if (this.wavesRemaining === 0) {
        this.currentWeather = null;
        this.applyVisuals();
        EventBus.emit('weather:changed', { weather: null });
      }
    }

    // Activate announced weather on the next wave
    if (this.upcomingWeather && !isBossWave) {
      this.currentWeather = this.upcomingWeather;
      this.upcomingWeather = null;
      this.wavesRemaining = 2;
      this.applyVisuals();
      EventBus.emit('weather:changed', { weather: this.currentWeather });
      const def = WEATHERS[this.currentWeather];
      EventBus.emit('toast:show', {
        title: `${def.icon} ${def.name} Active!`,
        subtitle: def.effectDesc,
        color: def.color,
      });
    }

    // §15.2 Every 5 waves (not on boss waves), roll 40% for next wave (banner warns 1 wave ahead)
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

  private applyVisuals(): void {
    this.vfx.setRainActive(this.currentWeather === 'rain_shower');
    GlobalShaderUniforms.uWindStrength.value = this.currentWeather === 'wind_gust' ? 2.6 : 1.0;
  }
}
