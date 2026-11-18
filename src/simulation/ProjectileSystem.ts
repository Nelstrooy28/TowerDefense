import * as THREE from 'three';
import { VFXManager } from '../rendering/VFXManager';
import { DecalManager } from '../rendering/DecalManager';
import { FloatingTextManager } from '../rendering/FloatingTextManager';
import { GrassField } from '../rendering/GrassField';
import { TimeScale } from '../core/TimeScale';
import { EventBus } from '../core/EventBus';
import { SynthAudio } from '../audio/SynthAudio';
import type { EnemyEntity } from './EnemyEntity';
import type { TowerEntity } from './TowerEntity';
import type { SynergySystem } from './SynergySystem';
import type { ElementTag } from '../data/UnitRegistry';

export interface ProjectileLaunchParams {
  kind: 'tomato' | 'spine' | 'pineapple' | 'boulder' | 'solar_orb' | 'frost_orb' | 'arcane_orb' | 'mini_bomb' | 'spore_bomb';
  startX: number;
  startY: number;
  startZ: number;
  targetEnemy: EnemyEntity | null;
  targetTower: TowerEntity | null;
  fallbackX: number;
  fallbackZ: number;
  speed: number;
  arcHeight: number;
  damage: number;
  splashRadius: number;
  isCrit: boolean;
  isExplosive: boolean;
  isLv5: boolean;
  canRicochet: boolean;
  sourceTower: TowerEntity | null;
  weatherDrift: number;
  weatherFireMult: number;
  weatherIceMult: number;
  weatherArcaneBonus: number;
}

interface ActiveProjectile {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  trailLine: THREE.Line;
  trailPositions: Float32Array;
  params: ProjectileLaunchParams;
  x: number;
  y: number;
  z: number;
  startX: number;
  startY: number;
  startZ: number;
  destX: number;
  destY: number;
  destZ: number;
  progress: number;
  duration: number;
}

const POOL_SIZE = 120;

export class ProjectileSystem {
  private pool: ActiveProjectile[] = [];
  private vfx: VFXManager;
  private decals: DecalManager;
  private popups: FloatingTextManager;
  private grass: GrassField;
  private synergy: SynergySystem;

  public onDamageCredit?: (tower: TowerEntity | null, hpStripped: number, enemy: EnemyEntity) => void;

  constructor(
    scene: THREE.Scene,
    vfx: VFXManager,
    decals: DecalManager,
    popups: FloatingTextManager,
    grass: GrassField,
    synergy: SynergySystem
  ) {
    this.vfx = vfx;
    this.decals = decals;
    this.popups = popups;
    this.grass = grass;
    this.synergy = synergy;

    const geo = new THREE.SphereGeometry(0.18, 8, 6);
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);

      // 10-segment Ribbon Trail ring buffer (§8.2)
      const trailPositions = new Float32Array(10 * 3);
      const tGeo = new THREE.BufferGeometry();
      tGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
      const tMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 });
      const trailLine = new THREE.Line(tGeo, tMat);
      trailLine.visible = false;
      trailLine.frustumCulled = false;
      scene.add(trailLine);

      this.pool.push({
        active: false,
        mesh,
        mat,
        trailLine,
        trailPositions,
        params: {} as ProjectileLaunchParams,
        x: 0,
        y: 0,
        z: 0,
        startX: 0,
        startY: 0,
        startZ: 0,
        destX: 0,
        destY: 0,
        destZ: 0,
        progress: 0,
        duration: 0.3,
      });
    }
  }

  public launch(p: ProjectileLaunchParams): void {
    for (const slot of this.pool) {
      if (!slot.active) {
        slot.active = true;
        slot.params = p;
        slot.startX = p.startX;
        slot.startY = p.startY;
        slot.startZ = p.startZ;
        slot.x = p.startX;
        slot.y = p.startY;
        slot.z = p.startZ;

        const tx = p.targetEnemy ? p.targetEnemy.position.x : p.targetTower ? p.targetTower.position.x : p.fallbackX;
        const tz = p.targetEnemy ? p.targetEnemy.position.z : p.targetTower ? p.targetTower.position.z : p.fallbackZ;
        slot.destX = tx + p.weatherDrift * (Math.random() - 0.5) * 0.6;
        slot.destY = 0.4;
        slot.destZ = tz + p.weatherDrift * (Math.random() - 0.5) * 0.6;

        const dist = Math.max(0.5, Math.hypot(slot.destX - p.startX, slot.destZ - p.startZ));
        slot.duration = Math.max(0.08, dist / Math.max(2, p.speed));
        slot.progress = 0;

        let color = 0xef4444;
        let scale = 1.0;
        if (p.kind === 'spine') {
          color = p.isLv5 ? 0x4ade80 : 0xfef08a;
          scale = 0.65;
        } else if (p.kind === 'pineapple' || p.kind === 'mini_bomb') {
          color = 0xfacc15;
          scale = p.kind === 'mini_bomb' ? 0.85 : 1.5;
        } else if (p.kind === 'boulder') {
          color = 0x78716c;
          scale = 2.2;
        } else if (p.kind === 'solar_orb') {
          color = 0xf97316;
          scale = 1.4;
        } else if (p.kind === 'frost_orb') {
          color = 0x38bdf8;
          scale = 1.4;
        } else if (p.kind === 'arcane_orb') {
          color = 0xa855f7;
          scale = 1.4;
        } else if (p.kind === 'spore_bomb') {
          color = 0xa855f7;
          scale = 1.25;
        } else if (p.kind === 'tomato' && p.isLv5) {
          color = 0xf97316;
          scale = 1.25;
        }

        slot.mat.color.setHex(color);
        (slot.trailLine.material as THREE.LineBasicMaterial).color.setHex(color);
        slot.mesh.scale.setScalar(scale);
        slot.mesh.position.set(slot.x, slot.y, slot.z);
        slot.mesh.visible = true;
        slot.trailLine.visible = true;

        for (let i = 0; i < 10; i++) {
          slot.trailPositions[i * 3] = slot.x;
          slot.trailPositions[i * 3 + 1] = slot.y;
          slot.trailPositions[i * 3 + 2] = slot.z;
        }
        slot.trailLine.geometry.attributes.position.needsUpdate = true;
        return;
      }
    }
  }

  public update(dt: number, enemies: EnemyEntity[], pondX: number, pondZ: number): number {
    let waterSplashAgeReset = false;

    for (const slot of this.pool) {
      if (!slot.active) continue;
      const p = slot.params;
      slot.progress += dt / slot.duration;

      // Homing tracking if target enemy still alive
      if (p.targetEnemy && !p.targetEnemy.isDead && !p.targetEnemy.reachedGoal && p.kind !== 'boulder' && p.kind !== 'pineapple') {
        slot.destX = p.targetEnemy.position.x;
        slot.destZ = p.targetEnemy.position.z;
      }

      const t = Math.min(1, slot.progress);
      const nx = THREE.MathUtils.lerp(slot.startX, slot.destX, t);
      const nz = THREE.MathUtils.lerp(slot.startZ, slot.destZ, t);
      const ny = THREE.MathUtils.lerp(slot.startY, slot.destY, t) + Math.sin(t * Math.PI) * p.arcHeight;

      const vx = (nx - slot.x) / Math.max(0.001, dt);
      const vy = (ny - slot.y) / Math.max(0.001, dt);
      const vz = (nz - slot.z) / Math.max(0.001, dt);
      const speedMag = Math.hypot(vx, vy, vz);

      slot.x = nx;
      slot.y = ny;
      slot.z = nz;
      slot.mesh.position.set(nx, ny, nz);

      // §8.3.2 Squash & Stretch along velocity: scaleZ = clamp(1 + |v| * 0.04, 1, 2.0)
      const stretchZ = Math.min(2.0, 1 + speedMag * 0.04);
      slot.mesh.lookAt(nx + vx, ny + vy, nz + vz);
      slot.mesh.scale.z = stretchZ * (p.kind === 'spine' ? 1.3 : 1.0);

      // Update ring-buffer trail
      const tp = slot.trailPositions;
      for (let i = 9; i > 0; i--) {
        tp[i * 3] = tp[(i - 1) * 3];
        tp[i * 3 + 1] = tp[(i - 1) * 3 + 1];
        tp[i * 3 + 2] = tp[(i - 1) * 3 + 2];
      }
      tp[0] = nx;
      tp[1] = ny;
      tp[2] = nz;
      slot.trailLine.geometry.attributes.position.needsUpdate = true;

      if (Math.hypot(nx - pondX, nz - pondZ) < 2.8 && ny < 1.2) {
        waterSplashAgeReset = true;
      }

      if (slot.progress >= 1) {
        slot.active = false;
        slot.mesh.visible = false;
        slot.trailLine.visible = false;
        this.resolveImpact(slot, enemies);
      }
    }

    return waterSplashAgeReset ? 1 : 0;
  }

  private resolveImpact(slot: ActiveProjectile, enemies: EnemyEntity[]): void {
    const p = slot.params;
    const ix = slot.destX;
    const iz = slot.destZ;

    if (p.kind === 'spore_bomb') {
      if (p.targetTower) {
        const stunned = p.targetTower.applyStun(3.5);
        if (stunned) {
          this.popups.spawnDamage(
            p.targetTower.position.x,
            p.targetTower.position.y + 1.2,
            p.targetTower.position.z,
            0,
            'synergy',
            '',
            'STUNNED!'
          );
        }
      }
      this.vfx.spawnShockwave(ix, 0.05, iz, 1.8, 0xa855f7, 0.4);
      return;
    }

    // Impact VFX & Decals
    if (p.kind === 'tomato') {
      this.vfx.spawnRecipe('tomato_juicy_burst', ix, 0.4, iz);
      this.decals.spawn('tomato', ix, iz, 1.2, 4.0);
    } else if (p.kind === 'pineapple' || p.kind === 'mini_bomb') {
      this.vfx.spawnRecipe('pineapple_tropical_explosion', ix, 0.5, iz);
      this.vfx.spawnShockwave(ix, 0.05, iz, p.splashRadius || 3.5, 0xf97316, 0.45);
      this.decals.spawn('scorch', ix, iz, 2.0, 8.0);
      this.grass.addReaction(ix, iz, p.splashRadius, 'flatten', 2.0);
      EventBus.emit('camera:trauma', { amount: p.kind === 'mini_bomb' ? 0.08 : 0.25 });
      EventBus.emit('vfx:explosion_env', { x: ix, z: iz, radius: p.splashRadius });
      EventBus.emit('audio:duck', { duration: 0.3 });
      SynthAudio.play('explosion');

      if (p.kind === 'pineapple' && p.isLv5) {
        // Shrapnel splits into 6 mini-bombs (§6.1)
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          this.launch({
            ...p,
            kind: 'mini_bomb',
            startX: ix,
            startY: 0.5,
            startZ: iz,
            targetEnemy: null,
            fallbackX: ix + Math.cos(a) * 2.6,
            fallbackZ: iz + Math.sin(a) * 2.6,
            speed: 9,
            arcHeight: 1.4,
            damage: Math.round(p.damage * 0.35),
            splashRadius: 2.0,
            isLv5: false,
          });
        }
      }
    } else if (p.kind === 'boulder') {
      this.vfx.spawnRecipe('soil_placement_clods', ix, 0.5, iz);
      this.vfx.spawnShockwave(ix, 0.05, iz, p.splashRadius, 0xa855f7, 0.5);
      this.decals.spawn('crater', ix, iz, 2.4, 12.0);
      this.grass.addReaction(ix, iz, p.splashRadius, 'flatten', 2.4);
      TimeScale.triggerHitStop('golem_smash');
      EventBus.emit('camera:trauma', { amount: 0.45 });
      EventBus.emit('vfx:explosion_env', { x: ix, z: iz, radius: p.splashRadius });
      EventBus.emit('audio:duck', { duration: 0.3 });
      SynthAudio.play('golem');
    } else if (p.kind === 'solar_orb') {
      this.vfx.spawnRecipe('fire_cinders', ix, 0.5, iz);
      this.vfx.spawnShockwave(ix, 0.05, iz, 3.0, 0xf97316, 0.4);
      this.decals.spawn('scorch', ix, iz, 1.8, 7.0);
    } else if (p.kind === 'frost_orb') {
      this.vfx.spawnRecipe('frost_shatter', ix, 0.5, iz);
      this.decals.spawn('frost', ix, iz, 1.8, 6.0);
    }

    // Apply damage
    const isGroundAoe = p.splashRadius > 0;
    let ricochetTarget: EnemyEntity | null = null;

    for (const enemy of enemies) {
      if (enemy.isDead || enemy.reachedGoal) continue;
      if (enemy.isBurrowed && !isGroundAoe) continue;
      if (enemy.def.isFlying && p.kind === 'boulder') continue;

      const d = Math.hypot(enemy.position.x - ix, enemy.position.z - iz);
      const hitMatch = p.targetEnemy === enemy || (p.splashRadius > 0 && d <= p.splashRadius + 0.45);
      if (!hitMatch) continue;

      let elem: 'normal' | 'burn' | 'freeze' | 'arcane' = 'normal';
      let synElem: ElementTag = p.isExplosive ? 'heavy' : 'physical';

      if (p.kind === 'spine') {
        enemy.bleedTimer = Math.max(enemy.bleedTimer, 3.0);
        enemy.bleedDps = Math.max(enemy.bleedDps, p.damage * 0.2);
        synElem = 'bleed';
      } else if (p.kind === 'solar_orb' || (p.kind === 'tomato' && p.isLv5)) {
        enemy.burnTimer = Math.max(enemy.burnTimer, 4.0);
        enemy.burnDps = Math.max(enemy.burnDps, p.damage * 0.35 * p.weatherFireMult);
        elem = 'burn';
        synElem = 'burn';
      } else if (p.kind === 'frost_orb') {
        enemy.chillTimer = Math.max(enemy.chillTimer, 3.5 * p.weatherIceMult);
        elem = 'freeze';
        synElem = 'chill';
      } else if (p.kind === 'arcane_orb') {
        elem = 'arcane';
        synElem = 'arcane';
      }

      const syn = this.synergy.tryTrigger(enemy, synElem, p.damage);
      const totalDmg = p.damage + (syn?.bonusDamage ?? 0);

      const res = enemy.applyDamage(totalDmg, {
        isExplosive: p.isExplosive,
        element: elem,
        sourceTowerId: p.sourceTower?.id ?? null,
      });

      this.onDamageCredit?.(p.sourceTower, res.hpDamage, enemy);

      if (res.shieldShattered) {
        TimeScale.triggerHitStop('shield_shatter');
        this.vfx.spawnRecipe('shield_shatter', enemy.position.x, 0.7, enemy.position.z);
      }

      if (p.isCrit) {
        TimeScale.triggerHitStop('crit');
        SynthAudio.play('crit');
        this.popups.spawnDamage(enemy.position.x, enemy.position.y, enemy.position.z, totalDmg, 'crit', enemy.id);
      } else {
        this.popups.spawnDamage(
          enemy.position.x,
          enemy.position.y,
          enemy.position.z,
          totalDmg,
          elem === 'burn' ? 'burn' : elem === 'freeze' ? 'freeze' : 'normal',
          enemy.id
        );
      }

      // Chrono-Bloom Arcane Chain Lightning
      if (p.kind === 'arcane_orb') {
        let chains = 3 + p.weatherArcaneBonus + (syn?.extraChainCount ?? 0);
        let prev = enemy;
        for (const other of enemies) {
          if (chains <= 0) break;
          if (other === enemy || other.isDead || other.reachedGoal || other.isBurrowed) continue;
          if (Math.hypot(other.position.x - prev.position.x, other.position.z - prev.position.z) <= 6.5) {
            this.vfx.spawnChainLightning(
              prev.position.x,
              0.7,
              prev.position.z,
              other.position.x,
              0.7,
              other.position.z
            );
            const cRes = other.applyDamage(Math.round(p.damage * 0.65), {
              element: 'arcane',
              sourceTowerId: p.sourceTower?.id ?? null,
            });
            this.onDamageCredit?.(p.sourceTower, cRes.hpDamage, other);
            prev = other;
            chains--;
          }
        }
      }

      if (p.kind === 'spine' && p.canRicochet && !ricochetTarget) {
        for (const other of enemies) {
          if (other !== enemy && !other.isDead && !other.reachedGoal && !other.isBurrowed) {
            if (Math.hypot(other.position.x - ix, other.position.z - iz) <= 5.5) {
              ricochetTarget = other;
              break;
            }
          }
        }
      }
    }

    if (ricochetTarget) {
      this.launch({
        ...p,
        startX: ix,
        startY: 0.5,
        startZ: iz,
        targetEnemy: ricochetTarget,
        canRicochet: false,
        damage: Math.round(p.damage * 0.75),
      });
    }
  }

  public clearAll(): void {
    for (const s of this.pool) {
      s.active = false;
      s.mesh.visible = false;
      s.trailLine.visible = false;
    }
  }
}
