import type { QualityTier } from './QualityManager';
import type { MapId, DifficultyId } from '../data/MapRegistry';
import type { WeatherId } from '../data/WeatherConfig';
import type { RarityId } from '../data/RarityConfig';
import type { TraitId } from '../data/TraitConfig';

export interface GameEvents {
  'music:beat': { beatIndex: number; threat: number };
  'audio:sfx': { id: string; intensity?: number };
  'audio:duck': { duration: number };

  'camera:trauma': { amount: number };
  'camera:fov_kick': { degrees: number; duration: number };
  'camera:zoom_punch': { factor: number; duration: number };
  'camera:focus_nudge': { x: number; z: number };
  'camera:boss_pan': { x: number; y: number; z: number; duration: number };

  'vfx:screen_flash': { color: string; opacity: number; duration: number };
  'vfx:chromatic_pulse': { strength: number; duration: number };
  'vfx:radial_blur': { strength: number; duration: number };
  'vfx:base_hit_vignette': { lowHp: boolean };
  'vfx:explosion_env': { x: number; z: number; radius: number };

  'match:state_changed': void;
  'match:cash_changed': { cash: number; delta: number };
  'match:insufficient_cash': void;
  'match:base_hp_changed': { hp: number; maxHp: number; delta: number };
  'match:wave_start': { wave: number; totalWaves: number; isBoss: boolean; enemyIcons: Array<{ id: string; count: number; name: string }> };
  'match:wave_cleared': { wave: number; bonus: number };
  'match:boss_spawned': { name: string; maxHp: number; maxShield: number };
  'match:boss_phase': { phase: number };
  'match:boss_defeated': void;
  'match:victory': { mapId: MapId; difficulty: DifficultyId; seedsEarned: number; wavesCleared: number };
  'match:defeat': { wavesCleared: number };
  'match:bloom_chest': { seeds: number; dewdrops: number; wave: number };

  'tower:selected': { towerId: string | null };
  'tower:placed': { unitId: string; x: number; z: number };
  'tower:upgraded': { towerId: string; level: number };
  'tower:sold': { towerId: string };
  'placement:slot_selected': { slotIndex: number | null };

  'weather:announced': { weather: WeatherId; wavesUntil: number };
  'weather:changed': { weather: WeatherId | null };

  'quest:progress': { type: 'kill_ant' | 'steam_burst' | 'win_hard' | 'summon' | 'upgrade_max'; amount: number };
  'achievement:unlocked': { id: string; title: string; rewardSeeds: number };

  'quality:changed': { tier: QualityTier; autoDropped: boolean };
  'save:updated': void;
  'toast:show': { title: string; subtitle?: string; color?: string };
  'crate:pulled': { unitId: string; rarity: RarityId; trait: TraitId; isNew: boolean };
  'ui:open_lobby': void;
  'ui:start_match': { mapId: MapId; difficulty: DifficultyId };
}

type Listener<T> = (payload: T) => void;

class TypedEventBus {
  private listeners = new Map<keyof GameEvents, Set<Listener<unknown>>>();

  on<K extends keyof GameEvents>(event: K, fn: Listener<GameEvents[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as Listener<unknown>);
    return () => {
      set?.delete(fn as Listener<unknown>);
    };
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      (fn as Listener<GameEvents[K]>)(payload);
    }
  }
}

export const EventBus = new TypedEventBus();
