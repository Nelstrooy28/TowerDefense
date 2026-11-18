export type WeatherId =
  | 'sunny_spell'
  | 'rain_shower'
  | 'wind_gust'
  | 'pollen_bloom'
  | 'night_fog';

export interface WeatherDef {
  id: WeatherId;
  name: string;
  icon: string;
  color: string;
  effectDesc: string;
  visualDesc: string;
  fireMult: number;
  iceMult: number;
  farmMult: number;
  rangeMult: number;
  critBonus: number;
  flyingSpeedMult: number;
  allEnemiesWet: boolean;
  arcaneBonusChains: number;
  projectileDrift: number;
}

export const WEATHER_LIST: WeatherId[] = [
  'sunny_spell',
  'rain_shower',
  'wind_gust',
  'pollen_bloom',
  'night_fog',
];

export const WEATHERS: Record<WeatherId, WeatherDef> = {
  sunny_spell: {
    id: 'sunny_spell',
    name: 'Sunny Spell',
    icon: '☀️',
    color: '#fde047',
    effectDesc: 'Fire DoT +20%, Ice −10%',
    visualDesc: 'Brighter sun, lens flare, heat shimmer',
    fireMult: 1.2,
    iceMult: 0.9,
    farmMult: 1.0,
    rangeMult: 1.0,
    critBonus: 0,
    flyingSpeedMult: 1.0,
    allEnemiesWet: false,
    arcaneBonusChains: 0,
    projectileDrift: 0,
  },
  rain_shower: {
    id: 'rain_shower',
    name: 'Rain Shower',
    icon: '🌧️',
    color: '#38bdf8',
    effectDesc: 'All enemies Wet; Arcane chains +1; Fire −20%',
    visualDesc: 'Rain streaks, puddle decals, pond ripples',
    fireMult: 0.8,
    iceMult: 1.0,
    farmMult: 1.0,
    rangeMult: 1.0,
    critBonus: 0,
    flyingSpeedMult: 1.0,
    allEnemiesWet: true,
    arcaneBonusChains: 1,
    projectileDrift: 0,
  },
  wind_gust: {
    id: 'wind_gust',
    name: 'Wind Gust',
    icon: '💨',
    color: '#a7f3d0',
    effectDesc: 'Projectile arcs drift; flying enemies −15% speed',
    visualDesc: 'Leaves and petals blow across screen, grass bends hard',
    fireMult: 1.0,
    iceMult: 1.0,
    farmMult: 1.0,
    rangeMult: 1.0,
    critBonus: 0,
    flyingSpeedMult: 0.85,
    allEnemiesWet: false,
    arcaneBonusChains: 0,
    projectileDrift: 0.85,
    },
  pollen_bloom: {
    id: 'pollen_bloom',
    name: 'Pollen Bloom',
    icon: '🌼',
    color: '#facc15',
    effectDesc: 'Money Tree +25% cash',
    visualDesc: 'Golden pollen clouds, flowers open on map',
    fireMult: 1.0,
    iceMult: 1.0,
    farmMult: 1.25,
    rangeMult: 1.0,
    critBonus: 0,
    flyingSpeedMult: 1.0,
    allEnemiesWet: false,
    arcaneBonusChains: 0,
    projectileDrift: 0,
  },
  night_fog: {
    id: 'night_fog',
    name: 'Night Fog',
    icon: '🌙',
    color: '#818cf8',
    effectDesc: 'Range −10%, crits +5%',
    visualDesc: 'Blue fog, fireflies, units emissive glows stand out',
    fireMult: 1.0,
    iceMult: 1.0,
    farmMult: 1.0,
    rangeMult: 0.9,
    critBonus: 0.05,
    flyingSpeedMult: 1.0,
    allEnemiesWet: false,
    arcaneBonusChains: 0,
    projectileDrift: 0,
  },
};
