import { TimeScale } from '../core/TimeScale';
import { EventBus } from '../core/EventBus';
import { VFXManager } from '../rendering/VFXManager';
import { DecalManager } from '../rendering/DecalManager';
import { GrassField } from '../rendering/GrassField';
import { FloatingTextManager } from '../rendering/FloatingTextManager';
import { SynthAudio } from '../audio/SynthAudio';
import type { TowerEntity } from './TowerEntity';
import type { EnemyEntity } from './EnemyEntity';

export class AbilitySystem {
  private vfx: VFXManager;
  private decals: DecalManager;
  private grass: GrassField;
  private popups: FloatingTextManager;

  public onDamageCredit?: (tower: TowerEntity, hpStripped: number, enemy: EnemyEntity) => void;

  constructor(
    vfx: VFXManager,
    decals: DecalManager,
    grass: GrassField,
    popups: FloatingTextManager
  ) {
    this.vfx = vfx;
    this.decals = decals;
    this.grass = grass;
    this.popups = popups;
  }

  public activate(tower: TowerEntity, towers: TowerEntity[], enemies: EnemyEntity[]): boolean {
    if (!tower.def.ability || !tower.isAbilityReady()) return false;
    const abilityId = tower.def.ability.id;
    tower.abilityCooldownRemaining = tower.getAbilityMaxCooldown();
    tower.anim.triggerAttack(tower.def.id);

    const tx = tower.position.x;
    const tz = tower.position.z;
    const rng = tower.getEffectiveRange();

    if (abilityId === 'bass_drop') {
      this.vfx.spawnShockwave(tx, 0.08, tz, rng * 1.15, 0xe879f9, 0.65);
      this.grass.addReaction(tx, tz, rng, 'flatten', 2.2);
      EventBus.emit('camera:trauma', { amount: 0.35 });
      EventBus.emit('camera:fov_kick', { degrees: 5, duration: 0.35 });
      EventBus.emit('audio:duck', { duration: 0.3 });
      SynthAudio.play('sonic');

      let hitCount = 0;
      for (const e of enemies) {
        if (e.isDead || e.reachedGoal) continue;
        if (Math.hypot(e.position.x - tx, e.position.z - tz) <= rng) {
          e.freezeTimer = Math.max(e.freezeTimer, 1.5);
          e.applyKnockback(1.6, 1);
          const res = e.applyDamage(tower.getEffectiveDamage() * 2, { sourceTowerId: tower.id });
          this.onDamageCredit?.(tower, res.hpDamage, e);
          hitCount++;
        }
      }
      this.popups.spawnDamage(tx, tower.position.y + 1.4, tz, 0, 'synergy', '', 'BASS DROP!');
      EventBus.emit('match:killfeed', { text: `Sonic Bloom Bass Dropped ${hitCount} pests`, color: '#e879f9' });
      return true;
    }

    if (abilityId === 'overdrive_mist') {
      this.vfx.spawnShockwave(tx, 0.08, tz, rng, 0x38bdf8, 0.65);
      this.vfx.spawnRecipe('frost_shatter', tx, 0.8, tz);
      SynthAudio.play('ice');
      for (const ally of towers) {
        if (Math.hypot(ally.position.x - tx, ally.position.z - tz) <= rng) {
          ally.cleanseStun();
          ally.overdriveBuffTimer = Math.max(ally.overdriveBuffTimer, 10.0);
        }
      }
      for (const e of enemies) {
        if (e.isDead || e.reachedGoal) continue;
        if (Math.hypot(e.position.x - tx, e.position.z - tz) <= rng) {
          e.wetTimer = Math.max(e.wetTimer, 8.0);
        }
      }
      this.popups.spawnDamage(tx, tower.position.y + 1.4, tz, 0, 'freeze', '', 'OVERDRIVE MIST!');
      return true;
    }

    if (abilityId === 'tectonic_slam') {
      TimeScale.triggerHitStop('golem_smash');
      this.vfx.spawnShockwave(tx, 0.1, tz, rng * 1.1, 0xf97316, 0.7);
      this.vfx.spawnRecipe('soil_placement_clods', tx, 0.6, tz);
      this.decals.spawn('crater', tx, tz, 3.6, 14);
      this.grass.addReaction(tx, tz, rng, 'flatten', 2.8);
      EventBus.emit('camera:trauma', { amount: 0.6 });
      EventBus.emit('camera:fov_kick', { degrees: 6, duration: 0.4 });
      EventBus.emit('vfx:explosion_env', { x: tx, z: tz, radius: rng });
      EventBus.emit('audio:duck', { duration: 0.35 });
      SynthAudio.play('golem');

      const slamDmg = tower.getEffectiveDamage() * 5;
      let hitCount = 0;
      for (const e of enemies) {
        if (e.isDead || e.reachedGoal) continue;
        if (Math.hypot(e.position.x - tx, e.position.z - tz) <= rng) {
          e.freezeTimer = Math.max(e.freezeTimer, 2.5);
          const res = e.applyDamage(slamDmg, { isExplosive: true, sourceTowerId: tower.id });
          this.onDamageCredit?.(tower, res.hpDamage, e);
          this.popups.spawnDamage(e.position.x, e.position.y, e.position.z, res.hpDamage, 'crit', e.id);
          hitCount++;
        }
      }
      this.popups.spawnDamage(tx, tower.position.y + 1.5, tz, 0, 'crit', '', 'TECTONIC SLAM!');
      EventBus.emit('match:killfeed', { text: `Golem slammed ${hitCount} pests`, color: '#fb923c' });
      return true;
    }

    if (abilityId === 'chrono_tsunami') {
      TimeScale.triggerChronoTimeStop(5.0);
      this.vfx.spawnShockwave(tx, 0.1, tz, 28, 0x2dd4bf, 1.1);
      this.vfx.triggerChronoTsunamiWave();
      EventBus.emit('camera:fov_kick', { degrees: 6, duration: 0.45 });
      EventBus.emit('vfx:radial_blur', { strength: 0.9, duration: 0.5 });
      EventBus.emit('vfx:chromatic_pulse', { strength: 0.7, duration: 0.4 });
      SynthAudio.play('timestop');

      for (const ally of towers) {
        ally.chronoApmBuffTimer = Math.max(ally.chronoApmBuffTimer, 5.0);
      }
      for (const e of enemies) {
        if (e.isDead || e.reachedGoal) continue;
        e.applyKnockback(3.2, 1);
      }
      this.popups.spawnDamage(tx, tower.position.y + 1.6, tz, 0, 'freeze', '', 'CHRONO TSUNAMI!');
      return true;
    }

    if (abilityId === 'solar_flare') {
      this.vfx.spawnRecipe('solar_flare', tx, 1.2, tz);
      this.vfx.spawnShockwave(tx, 0.08, tz, rng, 0xfde047, 0.65);
      SynthAudio.play('upgrade_max');
      for (const ally of towers) {
        if (Math.hypot(ally.position.x - tx, ally.position.z - tz) <= rng) {
          ally.solarFlareTimer = Math.max(ally.solarFlareTimer, 4.0);
          // §7.2 Overcharge: Laser Plant ramp builds 2x faster!
          if (ally.def.id === 'laser_plant') {
            ally.laserRampStacks = Math.min(1.5, ally.laserRampStacks + 0.5);
          }
        }
      }
      this.popups.spawnDamage(tx, tower.position.y + 1.5, tz, 0, 'crit', '', 'SOLAR FLARE!');
      EventBus.emit('match:killfeed', { text: 'Solar Flare: All nearby towers 100% Crit!', color: '#fde047' });
      return true;
    }

    return false;
  }
}
