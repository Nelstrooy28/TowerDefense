import * as THREE from 'three';
import { DIFFICULTIES, MAPS, type DifficultyId, type MapDef, type MapId } from '../data/MapRegistry';
import { computeScaledEnemyHP, ENEMIES, type EnemyTypeId } from '../data/EnemyRegistry';
import { getEliteSpawnChance, rollEliteModifier } from '../data/ModifierConfig';
import { getUnitById } from '../data/UnitRegistry';
import { EventBus } from '../core/EventBus';
import { SaveManager } from '../core/SaveManager';
import { TimeScale } from '../core/TimeScale';
import { Engine } from '../core/Engine';
import { MeshFactory, type MapSceneHandles } from '../rendering/MeshFactory';
import { VFXManager } from '../rendering/VFXManager';
import { DecalManager } from '../rendering/DecalManager';
import { GrassField } from '../rendering/GrassField';
import { FloatingTextManager } from '../rendering/FloatingTextManager';
import { PlacementSystem, type PlacedFootprint } from './PlacementSystem';
import { SynergySystem } from './SynergySystem';
import { WeatherSystem } from './WeatherSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { AbilitySystem } from './AbilitySystem';
import { TowerEntity } from './TowerEntity';
import { EnemyEntity } from './EnemyEntity';
import { SynthAudio } from '../audio/SynthAudio';
import { AdaptiveMusic } from '../audio/AdaptiveMusic';

export interface WaveSpawnEntry {
  type: EnemyTypeId;
  count: number;
  interval: number;
}

export interface WavePreviewInfo {
  wave: number;
  entries: WaveSpawnEntry[];
  totalHp: number;
  isBossWave: boolean;
  threatLabel: 'Low' | 'Medium' | 'High' | 'Boss';
}

interface PendingSpawn {
  type: EnemyTypeId;
  splineIdx: number;
  delay: number;
}

interface MeteorHazard {
  x: number;
  z: number;
  timer: number;
}

export class MatchController {
  public engine: Engine;
  public vfx: VFXManager;
  public decals: DecalManager;
  public grass: GrassField;
  public popups: FloatingTextManager;
  public placement = new PlacementSystem();
  public synergy: SynergySystem;
  public weather: WeatherSystem;
  public projectiles: ProjectileSystem;
  public abilities: AbilitySystem;

  public mapDef: MapDef = MAPS.sunny_backyard;
  public difficultyId: DifficultyId = 'Easy';
  public mapHandles: MapSceneHandles | null = null;

  public inMatch = false;
  public isEndless = false;
  public matchEnded = false;

  public cash = 600;
  public baseHp = 150;
  public maxBaseHp = 150;
  public currentWave = 0;
  public totalWaves = 20;
  public autoSkip = false;
  public waveActive = false;
  public waveCountdown = 6.0;
  public skipBonusAvailable = false;

  public towers: TowerEntity[] = [];
  public enemies: EnemyEntity[] = [];
  private spawnQueue: PendingSpawn[] = [];
  private spawnTimer = 0;
  private meteorHazards: MeteorHazard[] = [];
  private meteorSpawnTimer = 9.0;

  private waterRippleAge = 10;
  private lawnmowerActive = false;
  private lawnmowerX = -24;
  private envWobbleTimer = 0;
  private envWobblePos = new THREE.Vector3();

  private bossFinaleTimer = 0;
  private bossFinaleActive = false;
  private bossEntranceTimer = 0;
  private worldPopupContainer: HTMLElement;

  constructor(engine: Engine, worldPopupContainer: HTMLElement) {
    this.engine = engine;
    this.worldPopupContainer = worldPopupContainer;
    this.vfx = new VFXManager(engine.scene, worldPopupContainer);
    this.decals = new DecalManager(engine.scene);
    this.grass = new GrassField(engine.scene);
    this.popups = new FloatingTextManager(worldPopupContainer);
    this.synergy = new SynergySystem(this.vfx, this.popups);
    this.weather = new WeatherSystem(this.vfx);
    this.projectiles = new ProjectileSystem(
      engine.scene,
      this.vfx,
      this.decals,
      this.popups,
      this.grass,
      this.synergy
    );
    this.abilities = new AbilitySystem(this.vfx, this.decals, this.grass, this.popups);

    this.projectiles.onDamageCredit = (tower, stripped, enemy) =>
      this.handleDamageCredit(tower, stripped, enemy);
    this.abilities.onDamageCredit = (tower, stripped, enemy) =>
      this.handleDamageCredit(tower, stripped, enemy);

    EventBus.on('vfx:explosion_env', ({ x, z }) => {
      this.envWobblePos.set(x, 0, z);
      this.envWobbleTimer = 0.45;
      if (this.mapHandles) {
        for (const bf of this.mapHandles.birdsButterflies) {
          bf.userData.scatterTimer = 6.0;
        }
      }
    });

    // Load Sunny Backyard diorama behind the Lobby Hub on startup
    this.loadDiorama('sunny_backyard');
  }

  public loadDiorama(mapId: MapId): void {
    this.clearMatchEntities();
    if (this.mapHandles) {
      this.engine.scene.remove(this.mapHandles.group);
    }
    this.mapDef = MAPS[mapId];
    this.mapHandles = MeshFactory.buildMapDiorama(this.mapDef);
    this.engine.scene.add(this.mapHandles.group);
    this.engine.setMapAtmosphere(
      this.mapDef.skyColor,
      this.mapDef.ambientSkyHex,
      this.mapDef.ambientGroundHex
    );
    this.engine.cameraRig.setBounds(this.mapDef.boundsHalfSize);
    this.placement.setMap(this.mapDef, this.mapHandles.splines);
    this.grass.rebuildForMap(this.mapDef, this.mapHandles.splines);
  }

  public startMatch(mapId: MapId, difficultyId: DifficultyId): void {
    this.loadDiorama(mapId);
    const diff = DIFFICULTIES[difficultyId];
    this.difficultyId = difficultyId;
    this.inMatch = true;
    this.isEndless = false;
    this.matchEnded = false;
    this.cash = diff.startingCash;
    this.baseHp = diff.baseHP;
    this.maxBaseHp = diff.baseHP;
    this.currentWave = 0;
    this.totalWaves = diff.waves;
    this.waveActive = false;
    this.waveCountdown = 5.0;
    this.skipBonusAvailable = false;
    this.meteorHazards = [];
    this.lawnmowerActive = false;
    this.bossFinaleActive = false;
    this.bossEntranceTimer = 0;

    TimeScale.resetMatch();
    this.weather.reset();
    this.engine.cameraRig.isLobbyMode = false;
    this.engine.cameraRig.resetView();
    this.engine.postFx.setLowHpDesaturate(false);
    this.engine.postFx.setEnvironmentTint(0xffffff, 0, 0, 0);
    this.engine.updateDayNight(0, false, false);

    EventBus.emit('match:state_changed', undefined);
    EventBus.emit('match:cash_changed', { cash: this.cash, delta: 0 });
    EventBus.emit('match:base_hp_changed', { hp: this.baseHp, maxHp: this.maxBaseHp, delta: 0 });
  }

  public returnToLobby(): void {
    this.clearMatchEntities();
    this.inMatch = false;
    this.matchEnded = false;
    this.waveActive = false;
    TimeScale.resetMatch();
    this.weather.reset();
    this.engine.cameraRig.isLobbyMode = true;
    this.engine.cameraRig.resetView();
    this.engine.postFx.setLowHpDesaturate(false);
    this.engine.postFx.setEnvironmentTint(0xffffff, 0, 0, 0);
    this.loadDiorama(SaveManager.data.selectedMap);
  }

  private clearMatchEntities(): void {
    for (const t of this.towers) t.destroy();
    this.towers = [];
    for (const e of this.enemies) e.destroy(this.engine.scene);
    this.enemies = [];
    this.spawnQueue = [];
    this.vfx.clearAll();
    this.decals.clearAll();
    this.popups.clear();
    this.projectiles.clearAll();
  }

  public getPlacedFootprints(): PlacedFootprint[] {
    return this.towers.map((t) => ({
      id: t.id,
      unitId: t.def.id,
      x: t.position.x,
      z: t.position.z,
      radius: t.def.footprintRadius,
    }));
  }

  public getUnitPlacedCount(unitId: string): number {
    let n = 0;
    for (const t of this.towers) if (t.def.id === unitId) n++;
    return n;
  }

  public placeTower(unitId: string, x: number, z: number): TowerEntity | null {
    if (!this.inMatch || this.matchEnded) return null;
    const unit = getUnitById(unitId);
    const check = this.placement.validate(unit, x, z, this.getPlacedFootprints(), this.cash);
    if (!check.valid) {
      if (check.reason.startsWith('Need')) {
        EventBus.emit('match:insufficient_cash', undefined);
      }
      SynthAudio.play('error');
      EventBus.emit('toast:show', { title: check.reason, color: '#f43f5e' });
      return null;
    }

    this.addCash(-unit.cost);
    const tower = new TowerEntity(unitId, x, check.y, z, this.engine.scene);
    this.towers.push(tower);

    this.vfx.spawnRecipe('soil_placement_clods', x, check.y + 0.2, z);
    this.grass.addReaction(x, z, 1.5, 'flatten', 1.2);
    SynthAudio.play('click');
    EventBus.emit('tower:placed', { unitId, x, z });
    EventBus.emit('match:state_changed', undefined);
    return tower;
  }

  public upgradeTower(tower: TowerEntity): boolean {
    const cost = tower.getNextUpgradeCost();
    if (cost === null) return false;
    if (this.cash < cost) {
      EventBus.emit('match:insufficient_cash', undefined);
      SynthAudio.play('error');
      return false;
    }
    this.addCash(-cost);
    tower.upgrade(cost);
    this.vfx.spawnRecipe('upgrade_spiral', tower.position.x, tower.position.y + 0.3, tower.position.z);
    if (tower.level === 5) {
      this.vfx.spawnUpgradeLightPillar(tower.position.x, tower.position.z);
      EventBus.emit('camera:fov_kick', { degrees: 6, duration: 0.4 });
      this.popups.spawnDamage(tower.position.x, tower.position.y + 1.8, tower.position.z, 0, 'crit', '', 'MAX!');
      SynthAudio.play('upgrade_max');
    } else {
      SynthAudio.play('upgrade');
    }
    EventBus.emit('tower:upgraded', { towerId: tower.id, level: tower.level });
    EventBus.emit('match:state_changed', undefined);
    return true;
  }

  public sellTower(tower: TowerEntity): void {
    const idx = this.towers.indexOf(tower);
    if (idx === -1) return;
    const refund = tower.getSellRefund();
    this.vfx.spawnRecipe('sell_leaf_swirl', tower.position.x, tower.position.y + 0.4, tower.position.z);
    this.popups.spawnDamage(tower.position.x, tower.position.y + 1.0, tower.position.z, refund, 'cash');
    this.addCash(refund);
    tower.destroy();
    this.towers.splice(idx, 1);
    SynthAudio.play('sell');
    EventBus.emit('tower:sold', { towerId: tower.id });
    EventBus.emit('tower:selected', { towerId: null });
    EventBus.emit('match:state_changed', undefined);
  }

  public addCash(delta: number): void {
    this.cash = Math.max(0, Math.round(this.cash + delta));
    EventBus.emit('match:cash_changed', { cash: this.cash, delta });
  }

  public getEarlySkipBonus(): number {
    return Math.round(45 + this.currentWave * 6);
  }

  public skipWave(): void {
    if (!this.inMatch || this.matchEnded) return;
    if (!this.waveActive || this.skipBonusAvailable) {
      if (this.waveActive && this.skipBonusAvailable) {
        const bonus = this.getEarlySkipBonus();
        this.addCash(bonus);
        SynthAudio.play('coin');
      }
      this.startNextWave();
    }
  }

  public continueIntoEndless(): void {
    this.isEndless = true;
    this.matchEnded = false;
    this.waveActive = false;
    this.waveCountdown = 3.0;
    EventBus.emit('match:state_changed', undefined);
  }

  public getWavePreview(waveNumber: number): WavePreviewInfo {
    const entries = this.buildWaveComposition(waveNumber);
    const diffMult = DIFFICULTIES[this.difficultyId].enemyHpMult;
    let totalHp = 0;
    for (const e of entries) {
      totalHp += computeScaledEnemyHP(ENEMIES[e.type].baseHP, waveNumber, diffMult) * e.count;
    }

    let totalDps = 0;
    for (const t of this.towers) totalDps += t.getDisplayedDps();
    const estimatedClearSec = totalHp / Math.max(40, totalDps);
    const isBossWave = !this.isEndless && waveNumber === this.totalWaves;
    const threatLabel: WavePreviewInfo['threatLabel'] = isBossWave
      ? 'Boss'
      : estimatedClearSec > 28
        ? 'High'
        : estimatedClearSec > 14
          ? 'Medium'
          : 'Low';

    return { wave: waveNumber, entries, totalHp, isBossWave, threatLabel };
  }

  private buildWaveComposition(wave: number): WaveSpawnEntry[] {
    const entries: WaveSpawnEntry[] = [];
    const isFinalBoss = !this.isEndless && wave === this.totalWaves;

    const antCount = Math.min(48, 8 + wave * 2);
    entries.push({ type: 'garden_ant', count: antCount, interval: Math.max(0.18, 0.55 - wave * 0.01) });

    if (wave >= 4) {
      entries.push({ type: 'sprinter_mantis', count: Math.min(24, 3 + Math.floor(wave * 0.7)), interval: 0.48 });
    }
    if (wave >= 7) {
      entries.push({ type: 'iron_beetle', count: Math.min(18, 2 + Math.floor((wave - 5) * 0.6)), interval: 0.75 });
    }
    if (wave >= 11) {
      entries.push({ type: 'burrowing_mole', count: Math.min(14, 2 + Math.floor((wave - 9) * 0.45)), interval: 0.85 });
    }
    if (wave >= 15) {
      entries.push({ type: 'spore_wasp', count: Math.min(12, 1 + Math.floor((wave - 13) * 0.4)), interval: 1.0 });
    }
    if (wave % 10 === 0 && !isFinalBoss) {
      entries.push({ type: 'gargantuan_snail', count: Math.max(1, Math.floor(wave / 15)), interval: 2.5 });
    }
    if (isFinalBoss || (this.isEndless && wave % 20 === 0)) {
      entries.push({ type: 'treant_overlord', count: 1, interval: 1.0 });
    }
    return entries;
  }

  public startNextWave(): void {
    if (!this.inMatch || this.matchEnded) return;
    this.currentWave++;
    this.waveActive = true;
    this.skipBonusAvailable = false;

    const preview = this.getWavePreview(this.currentWave);
    this.weather.onWaveStarted(this.currentWave, preview.isBossWave);

    // Queue spawns across map splines
    const splineCount = this.mapHandles?.splines.length ?? 1;
    let splineCursor = 0;
    for (const entry of preview.entries) {
      for (let i = 0; i < entry.count; i++) {
        this.spawnQueue.push({
          type: entry.type,
          splineIdx: splineCursor % splineCount,
          delay: entry.interval,
        });
        splineCursor++;
      }
    }
    this.spawnTimer = 0.25;

    // Sunny Backyard Wave 10 Signature Lawnmower (§5.1.1)
    if (this.mapDef.id === 'sunny_backyard' && this.currentWave === 10 && this.mapHandles?.lawnmower) {
      this.lawnmowerActive = true;
      this.lawnmowerX = -24;
      this.mapHandles.lawnmower.visible = true;
    }

    // Volcano Greenhouse spreading dome cracks
    if (this.mapDef.id === 'volcano_greenhouse' && this.mapHandles) {
      const cracks = this.mapHandles.glassCracks;
      const showCount = Math.min(cracks.length, Math.ceil(this.currentWave / 5));
      for (let i = 0; i < showCount; i++) cracks[i].visible = true;
    }

    this.engine.updateDayNight(
      Math.min(1, this.currentWave / Math.max(1, this.totalWaves)),
      preview.isBossWave,
      this.weather.currentWeather === 'night_fog'
    );

    EventBus.emit('match:wave_start', {
      wave: this.currentWave,
      totalWaves: this.totalWaves,
      isBoss: preview.isBossWave,
      enemyIcons: preview.entries.map((e) => ({
        id: e.type,
        count: e.count,
        name: ENEMIES[e.type].name,
      })),
    });

    if (preview.isBossWave) {
      SynthAudio.play('boss_roar');
    }
  }

  private spawnEnemy(type: EnemyTypeId, splineIdx: number, customProgress = 0): EnemyEntity | null {
    if (!this.mapHandles) return null;
    const spline = this.mapHandles.splines[splineIdx] ?? this.mapHandles.splines[0];
    const diffMult = DIFFICULTIES[this.difficultyId].enemyHpMult;
    const scaledHp = computeScaledEnemyHP(ENEMIES[type].baseHP, this.currentWave, diffMult);

    // §17 Performance Budget: Live enemies <= 150 (merge ants into swarm clumps beyond 150)
    if (this.enemies.length >= 150 && type === 'garden_ant') {
      const existingAnt = this.enemies.find((e) => !e.isDead && e.type === 'garden_ant' && e.progress < 0.25);
      if (existingAnt) {
        existingAnt.mergeSwarmAnt(scaledHp);
        return existingAnt;
      }
    }

    const eliteChance = !ENEMIES[type].isBoss && !ENEMIES[type].isMiniBoss ? getEliteSpawnChance(this.currentWave) : 0;
    const isElite = Math.random() < eliteChance;
    const eliteMod = isElite ? rollEliteModifier() : null;

    const enemy = new EnemyEntity(
      type,
      spline,
      scaledHp,
      isElite,
      eliteMod,
      this.engine.scene,
      this.worldPopupContainer
    );
    enemy.progress = customProgress;
    this.enemies.push(enemy);

    if (type === 'treant_overlord') {
      EventBus.emit('match:boss_spawned', {
        name: enemy.def.name,
        maxHp: enemy.maxHp,
        maxShield: enemy.maxArmor,
      });
      this.bossEntranceTimer = 3.0;
      EventBus.emit('camera:boss_pan', {
        x: enemy.position.x,
        y: enemy.position.y,
        z: enemy.position.z,
        duration: 3.0,
      });
      if (this.mapHandles.sleepingCat) {
        this.mapHandles.sleepingCat.visible = false; // Cat wakes & flees (§5.1.1)
      }
    }

    return enemy;
  }

  private handleDamageCredit(tower: TowerEntity | null, hpStripped: number, enemy: EnemyEntity): void {
    if (hpStripped <= 0) return;
    // §5.2 Cash income: $1 per 12 HP stripped
    const cashGain = Math.max(0, Math.floor(hpStripped / 12));
    if (cashGain > 0) this.addCash(cashGain);
    if (tower) {
      tower.totalDamageDealt += Math.round(hpStripped);
      SaveManager.addUnitMasteryXp(tower.def.id, hpStripped);
    }

    // Snail shell break at 50% HP spawns 6 Speedy Slugs (§7)
    if (enemy.type === 'gargantuan_snail' && !enemy.snailShattered && enemy.hp <= enemy.maxHp * 0.5) {
      enemy.snailShattered = true;
      this.vfx.spawnRecipe('frost_shatter', enemy.position.x, 0.8, enemy.position.z);
      for (let i = 0; i < 6; i++) {
        this.spawnEnemy('speedy_slug', 0, Math.max(0, enemy.progress - i * 0.015));
      }
    }

    // Boss Phase Change at 40% HP (§7 & §8.8)
    if (enemy.type === 'treant_overlord' && enemy.bossPhase === 1 && enemy.hp <= enemy.maxHp * 0.4) {
      enemy.bossPhase = 2;
      enemy.armor = Math.round(enemy.maxHp * 0.25);
      enemy.maxArmor = Math.max(enemy.maxArmor, enemy.armor);
      TimeScale.triggerHitStop('boss_phase');
      EventBus.emit('vfx:chromatic_pulse', { strength: 0.9, duration: 0.45 });
      EventBus.emit('match:boss_phase', { phase: 2 });
      SynthAudio.play('boss_roar');
    }
  }

  public update(rawDt: number): void {
    const { uiDt, simDt, enemyDt, shaderDt } = TimeScale.step(rawDt);

    // Pause simulation during Boss Entrance pan (3.0 s) (§8.8)
    let effectiveSimDt = simDt;
    let effectiveEnemyDt = enemyDt;
    if (this.bossEntranceTimer > 0) {
      this.bossEntranceTimer = Math.max(0, this.bossEntranceTimer - uiDt);
      effectiveSimDt = 0;
      effectiveEnemyDt = 0;
    }

    // Compute threat for adaptive music
    let threat = 0;
    let hasBoss = false;
    for (const e of this.enemies) {
      if (!e.isDead) {
        threat += e.progress * (e.hp / Math.max(1, e.maxHp)) * 0.14;
        if (e.def.isBoss) hasBoss = true;
      }
    }
    const lowHp = this.inMatch && this.baseHp / Math.max(1, this.maxBaseHp) < 0.25;
    AdaptiveMusic.update(uiDt, this.waveActive, Math.min(1, threat), hasBoss || lowHp);
    SynthAudio.updateLowHpHeartbeat(uiDt, lowHp);

    // Map ambient life & signature moments
    this.updateMapLife(uiDt, effectiveSimDt);

    if (this.inMatch && !this.matchEnded) {
      this.updateMatchSimulation(effectiveSimDt, effectiveEnemyDt, uiDt);
    } else {
      // Lobby diorama idle animations
      this.vfx.update(uiDt);
      this.grass.update(uiDt);
    }

    // Contact shadows pass
    this.engine.beginContactShadows();
    for (const t of this.towers) {
      this.engine.pushContactShadow(t.position.x, t.position.y, t.position.z, t.def.footprintRadius * 1.15);
    }
    for (const e of this.enemies) {
      if (!e.isDead && !e.isBurrowed) {
        this.engine.pushContactShadow(e.position.x, 0, e.position.z, 0.65 * e.def.scale);
      }
    }
    this.engine.commitContactShadows();

    this.engine.render(uiDt, shaderDt, this.vfx.activeParticleCount, this.enemies.length);
  }

  private updateMapLife(uiDt: number, simDt: number): void {
    if (!this.mapHandles) return;
    this.waterRippleAge += uiDt;
    this.mapHandles.waterMat.uniforms.uRippleAge.value = this.waterRippleAge;

    // Pulse mushrooms in Enchanted Jungle to music beat
    for (const m of this.mapHandles.mushrooms) {
      const s = 1 + AdaptiveMusic.currentBeatPulse * 0.15;
      m.scale.set(s, s, s);
    }

    // Pollen flowers scale open during Pollen Bloom weather
    const pollenOpen = this.weather.currentWeather === 'pollen_bloom' ? 1.35 : 1.0;
    for (const fl of this.mapHandles.pollenFlowers) {
      fl.scale.set(0.8 * pollenOpen, 0.45 * pollenOpen, 0.8 * pollenOpen);
    }

    // Bridge lanterns light up as enemies cross
    if (this.mapHandles.bridgeLanterns.length > 0) {
      const anyNearBridge = this.enemies.some((e) => !e.isDead && e.position.x > -1 && e.position.x < 8);
      for (let i = 0; i < this.mapHandles.bridgeLanterns.length; i++) {
        const mat = this.mapHandles.bridgeLanterns[i].material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = anyNearBridge ? 1.5 : 0.15;
      }
    }

    // Fence / flowerpot spring wobble on nearby explosion (§8.6)
    if (this.envWobbleTimer > 0) {
      this.envWobbleTimer = Math.max(0, this.envWobbleTimer - uiDt);
      const wAmp = (this.envWobbleTimer / 0.45) * 0.14 * Math.sin(this.envWobbleTimer * 40);
      for (const prop of this.mapHandles.wobbleProps) {
        if (prop.position.distanceToSquared(this.envWobblePos) < 100) {
          prop.rotation.z = wAmp;
        }
      }
    }

    // Butterflies drift & scatter from explosions
    for (const bf of this.mapHandles.birdsButterflies) {
      if (bf.userData.scatterTimer > 0) {
        bf.userData.scatterTimer = Math.max(0, bf.userData.scatterTimer - uiDt);
        bf.position.y += uiDt * 3.5;
        bf.position.x += uiDt * 2.5;
      } else {
        const t = performance.now() * 0.001 + bf.userData.homeX;
        bf.position.x += (bf.userData.homeX + Math.sin(t) * 2.4 - bf.position.x) * uiDt * 1.5;
        bf.position.z += (bf.userData.homeZ + Math.cos(t * 0.8) * 2.4 - bf.position.z) * uiDt * 1.5;
        bf.position.y += (2.5 + Math.sin(t * 3) * 0.35 - bf.position.y) * uiDt * 2.5;
      }
    }

    // Sunny Backyard Wave 10 Lawnmower
    if (this.lawnmowerActive && this.mapHandles.lawnmower) {
      this.lawnmowerX += simDt * 9;
      this.mapHandles.lawnmower.position.x = this.lawnmowerX;
      if (this.lawnmowerX > 25) {
        this.lawnmowerActive = false;
        this.mapHandles.lawnmower.visible = false;
      }
    }
  }

  private updateMatchSimulation(simDt: number, enemyDt: number, uiDt: number): void {
    // 1. Wave Countdown & Spawning
    if (!this.waveActive) {
      if (this.autoSkip) {
        this.startNextWave();
      } else {
        this.waveCountdown -= simDt;
        if (this.waveCountdown <= 0) {
          this.startNextWave();
        }
      }
    } else if (this.spawnQueue.length > 0) {
      this.spawnTimer -= simDt;
      if (this.spawnTimer <= 0) {
        const next = this.spawnQueue.shift()!;
        this.spawnEnemy(next.type, next.splineIdx);
        this.spawnTimer = this.spawnQueue.length > 0 ? this.spawnQueue[0].delay : 0;
        if (this.spawnQueue.length === 0) {
          this.skipBonusAvailable = true;
          EventBus.emit('match:state_changed', undefined);
        }
      }
    }

    // 2. Volcano Greenhouse Meteor Hazards (§5.1.1)
    if (this.mapDef.hasMeteorHazards && this.waveActive) {
      this.meteorSpawnTimer -= simDt;
      if (this.meteorSpawnTimer <= 0 && this.towers.length > 0) {
        this.meteorSpawnTimer = 11.0;
        const victim = this.towers[Math.floor(Math.random() * this.towers.length)];
        this.meteorHazards.push({ x: victim.position.x, z: victim.position.z, timer: 1.5 });
        this.vfx.spawnTelegraph(victim.position.x, victim.position.z, 2.2, 1.5);
      }
      for (let i = this.meteorHazards.length - 1; i >= 0; i--) {
        const m = this.meteorHazards[i];
        m.timer -= simDt;
        if (m.timer <= 0) {
          this.vfx.spawnRecipe('pineapple_tropical_explosion', m.x, 0.5, m.z);
          this.decals.spawn('crater', m.x, m.z, 2.2, 20.0);
          EventBus.emit('camera:trauma', { amount: 0.35 });
          SynthAudio.play('explosion');
          for (const t of this.towers) {
            if (Math.hypot(t.position.x - m.x, t.position.z - m.z) <= 2.2) {
              t.applyStun(2.5);
            }
          }
          this.meteorHazards.splice(i, 1);
        }
      }
    }

    // 3. Support Buffs & Stun Immunity Aura
    for (const t of this.towers) {
      t.buffDmg = 0;
      t.buffCd = 0;
      t.buffRange = 0;
      t.stunImmuneAura = false;
    }
    for (const src of this.towers) {
      if (src.stunnedTimer > 0) continue;
      if (src.def.isSupport) {
        const rng = src.getEffectiveRange();
        const cdBuff = src.def.levels[src.level].buffCd;
        const rngBuff = src.def.levels[src.level].buffRange;
        for (const ally of this.towers) {
          if (ally === src) continue;
          if (Math.hypot(ally.position.x - src.position.x, ally.position.z - src.position.z) <= rng) {
            ally.buffCd = Math.max(ally.buffCd, cdBuff);
            ally.buffRange = Math.max(ally.buffRange, rngBuff);
          }
        }
      }
      if (src.def.id === 'ancient_moss_golem') {
        for (const ally of this.towers) {
          if (Math.hypot(ally.position.x - src.position.x, ally.position.z - src.position.z) <= 8.0) {
            ally.stunImmuneAura = true;
          }
        }
      }
    }

    // 4. Update Towers & Combat
    const weatherDef = this.weather.activeDef;
    const weatherRangeMult = weatherDef?.rangeMult ?? 1.0;
    const weatherCritBonus = weatherDef?.critBonus ?? 0;
    const weatherFireMult = weatherDef?.fireMult ?? 1.0;
    const weatherIceMult = weatherDef?.iceMult ?? 1.0;
    const weatherFarmMult = weatherDef?.farmMult ?? 1.0;
    const weatherArcaneBonus = weatherDef?.arcaneBonusChains ?? 0;
    const weatherDrift = weatherDef?.projectileDrift ?? 0;
    const nowTime = performance.now() * 0.001;

    for (const t of this.towers) {
      if (t.stunnedTimer > 0) t.stunnedTimer = Math.max(0, t.stunnedTimer - simDt);
      if (t.overdriveBuffTimer > 0) t.overdriveBuffTimer = Math.max(0, t.overdriveBuffTimer - simDt);
      if (t.chronoApmBuffTimer > 0) t.chronoApmBuffTimer = Math.max(0, t.chronoApmBuffTimer - simDt);
      if (t.abilityCooldownRemaining > 0) t.abilityCooldownRemaining = Math.max(0, t.abilityCooldownRemaining - simDt);

      // Money Tree mid-wave cash crate (§6)
      if (t.def.isFarm && this.waveActive && t.stunnedTimer <= 0) {
        t.farmMidWaveTimer -= simDt;
        if (t.farmMidWaveTimer <= 0) {
          t.farmMidWaveTimer = 12.0;
          const midCash = Math.round(t.getFarmPayout(weatherFarmMult) * 0.35);
          this.spawnCashBurst(t.position.x, t.position.y, t.position.z, midCash);
        }
      }

      let target: EnemyEntity | null = null;
      if (t.stunnedTimer <= 0 && !t.def.isFarm && !t.def.isSupport) {
        target = this.acquireTarget(t, weatherRangeMult);
        if (target) {
          t.anim.aimToward(t.rig, target.position.x, target.position.y, target.position.z, simDt);
        }

        t.cooldownRemaining = Math.max(0, t.cooldownRemaining - simDt);
        if (target && t.cooldownRemaining <= 0) {
          t.cooldownRemaining = t.getEffectiveCooldown();
          this.fireTowerAttack(t, target, {
            weatherCritBonus,
            weatherFireMult,
            weatherIceMult,
            weatherArcaneBonus,
            weatherDrift,
            weatherRangeMult,
          });
        }
      } else if (t.def.isSupport && t.stunnedTimer <= 0) {
        t.cooldownRemaining = Math.max(0, t.cooldownRemaining - simDt);
        if (t.cooldownRemaining <= 0) {
          t.cooldownRemaining = 2.0;
          t.anim.triggerAttack(t.def.id);
          const rng = t.getEffectiveRange(weatherRangeMult);
          this.vfx.spawnShockwave(t.position.x, 0.08, t.position.z, rng, 0x38bdf8, 0.55);
          // Speed Sprinkler wets nearby enemies
          for (const e of this.enemies) {
            if (!e.isDead && Math.hypot(e.position.x - t.position.x, e.position.z - t.position.z) <= rng) {
              e.wetTimer = Math.max(e.wetTimer, 3.0);
            }
          }
        }
      }

      t.anim.update(
        t.rig,
        t.def.id,
        t.position.x,
        t.position.z,
        nowTime,
        simDt,
        !!target,
        t.stunnedTimer > 0,
        AdaptiveMusic.currentBeatPulse
      );
    }

    // 5. Update Projectiles
    const pondSplash = this.projectiles.update(
      simDt,
      this.enemies,
      this.mapDef.pond.x,
      this.mapDef.pond.z
    );
    if (pondSplash > 0) this.waterRippleAge = 0;

    // 6. Update Enemies, Special Enemy Attacks, Deaths
    const flyingMult = weatherDef?.flyingSpeedMult ?? 1.0;
    const allWet = weatherDef?.allEnemiesWet ?? false;
    let leadEnemy: EnemyEntity | null = null;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.isDead) {
        e.update(simDt, flyingMult, allWet);
        if (e.deathFinished) {
          e.destroy(this.engine.scene);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      const { burnTickDmg, bleedTickDmg } = e.update(enemyDt, flyingMult, allWet);
      if (burnTickDmg > 0) {
        const res = e.applyDamage(burnTickDmg, { element: 'burn', skipFlash: true });
        this.handleDamageCredit(null, res.hpDamage, e);
      }
      if (!e.isDead && bleedTickDmg > 0) {
        const res = e.applyDamage(bleedTickDmg, { skipFlash: true });
        this.handleDamageCredit(null, res.hpDamage, e);
      }

      if (!e.isDead && !e.reachedGoal) {
        if (!leadEnemy || e.progress > leadEnemy.progress) leadEnemy = e;
        this.updateEnemySpecialAbilities(e, enemyDt);
      }

      if (e.isDead) {
        this.onEnemyKilled(e);
      } else if (e.reachedGoal) {
        this.onEnemyReachedBase(e);
        e.destroy(this.engine.scene);
        this.enemies.splice(i, 1);
      } else {
        e.updateBillboardUI(this.engine.cameraRig.camera);
      }
    }

    // 7. Boss Finale Slow-Mo & Bloom Wave (§8.8)
    if (this.bossFinaleActive) {
      this.bossFinaleTimer -= uiDt;
      if (this.bossFinaleTimer <= 0) {
        this.bossFinaleActive = false;
        this.engine.postFx.setEnvironmentTint(0xffffff, 0, 0, 0);
      }
    }

    // PostFX environment tint (Chrono time-stop desaturation vs Volcano heat haze)
    if (TimeScale.isChronoTimeStopped()) {
      this.engine.postFx.setEnvironmentTint(0x67e8f9, 0.25, 0.72, 0);
    } else if (!this.bossFinaleActive) {
      this.engine.postFx.setEnvironmentTint(
        0xffffff,
        0,
        0,
        this.mapDef.hasMeteorHazards || this.weather.currentWeather === 'sunny_spell' ? 0.35 : 0
      );
    }

    // 8. Check Wave Clear
    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.every((e) => e.isDead)) {
      this.onWaveCleared();
    }

    this.vfx.update(simDt);
    this.decals.update(simDt);
    this.popups.update(uiDt, this.engine.cameraRig.camera);
    this.grass.update(simDt, leadEnemy?.position.x, leadEnemy?.position.z);
  }

  private acquireTarget(t: TowerEntity, weatherRangeMult: number): EnemyEntity | null {
    const rng = t.getEffectiveRange(weatherRangeMult);
    const rngSq = rng * rng;
    const isGroundAoe = t.def.id === 'pineapple_cannon' || t.def.id === 'sonic_bloom' || t.def.id === 'ancient_moss_golem' || t.def.id === 'chrono_bloom';
    const hasMaxRadar = t.def.id === 'laser_plant' && t.level >= 5;

    let best: EnemyEntity | null = null;
    for (const e of this.enemies) {
      if (e.isDead || e.reachedGoal) continue;
      if (e.def.isFlying && !t.def.canHitFlying) continue;
      if (e.isBurrowed && !isGroundAoe && !hasMaxRadar) continue;

      const dx = e.position.x - t.position.x;
      const dz = e.position.z - t.position.z;
      const dSq = dx * dx + dz * dz;
      if (dSq > rngSq) continue;

      if (!best) {
        best = e;
        continue;
      }
      if (t.targeting === 'First' && e.progress > best.progress) best = e;
      else if (t.targeting === 'Last' && e.progress < best.progress) best = e;
      else if (t.targeting === 'Strongest' && e.hp > best.hp) best = e;
      else if (t.targeting === 'Closest') {
        const bSq = (best.position.x - t.position.x) ** 2 + (best.position.z - t.position.z) ** 2;
        if (dSq < bSq) best = e;
      }
    }
    return best;
  }

  private fireTowerAttack(
    t: TowerEntity,
    target: EnemyEntity,
    w: {
      weatherCritBonus: number;
      weatherFireMult: number;
      weatherIceMult: number;
      weatherArcaneBonus: number;
      weatherDrift: number;
      weatherRangeMult: number;
    }
  ): void {
    t.anim.triggerAttack(t.def.id);
    const baseDmg = t.getEffectiveDamage();
    const isCrit = Math.random() < t.getCritChance(w.weatherCritBonus);
    const dmg = isCrit ? Math.round(baseDmg * 1.75) : baseDmg;
    const tx = t.position.x;
    const ty = t.position.y + 0.9;
    const tz = t.position.z;

    if (t.def.id === 'tomato_tosser') {
      SynthAudio.play('tomato');
      this.projectiles.launch({
        kind: 'tomato',
        startX: tx,
        startY: ty,
        startZ: tz,
        targetEnemy: target,
        targetTower: null,
        fallbackX: target.position.x,
        fallbackZ: target.position.z,
        speed: 14,
        arcHeight: 1.5,
        damage: dmg,
        splashRadius: t.getEffectiveSplashRadius(),
        isCrit,
        isExplosive: false,
        isLv5: t.level >= 5,
        canRicochet: false,
        sourceTower: t,
        weatherDrift: w.weatherDrift,
        weatherFireMult: w.weatherFireMult,
        weatherIceMult: w.weatherIceMult,
        weatherArcaneBonus: w.weatherArcaneBonus,
      });
    } else if (t.def.id === 'cactus_striker') {
      SynthAudio.play('cactus');
      const count = t.getProjectilesCount();
      for (let i = 0; i < count; i++) {
        this.projectiles.launch({
          kind: 'spine',
          startX: tx + (i - 1) * 0.14,
          startY: ty,
          startZ: tz,
          targetEnemy: target,
          targetTower: null,
          fallbackX: target.position.x,
          fallbackZ: target.position.z,
          speed: 22,
          arcHeight: 0.3,
          damage: dmg,
          splashRadius: 0,
          isCrit: isCrit && i === 0,
          isExplosive: false,
          isLv5: t.level >= 5,
          canRicochet: t.level >= 5 && i === 0,
          sourceTower: t,
          weatherDrift: w.weatherDrift,
          weatherFireMult: w.weatherFireMult,
          weatherIceMult: w.weatherIceMult,
          weatherArcaneBonus: w.weatherArcaneBonus,
        });
      }
    } else if (t.def.id === 'pineapple_cannon') {
      SynthAudio.play('pineapple');
      this.projectiles.launch({
        kind: 'pineapple',
        startX: tx,
        startY: ty + 0.2,
        startZ: tz,
        targetEnemy: target,
        targetTower: null,
        fallbackX: target.position.x,
        fallbackZ: target.position.z,
        speed: 11,
        arcHeight: 3.0,
        damage: dmg,
        splashRadius: t.getEffectiveSplashRadius(),
        isCrit,
        isExplosive: true,
        isLv5: t.level >= 5,
        canRicochet: false,
        sourceTower: t,
        weatherDrift: w.weatherDrift,
        weatherFireMult: w.weatherFireMult,
        weatherIceMult: w.weatherIceMult,
        weatherArcaneBonus: w.weatherArcaneBonus,
      });
    } else if (t.def.id === 'ghost_pepper') {
      SynthAudio.play('pepper');
      const rng = t.getEffectiveRange(w.weatherRangeMult);
      const aimX = target.position.x - tx;
      const aimZ = target.position.z - tz;
      const aimLen = Math.max(0.01, Math.hypot(aimX, aimZ));
      const dirX = aimX / aimLen;
      const dirZ = aimZ / aimLen;
      this.vfx.spawnRecipe('fire_cinders', tx + dirX * 1.6, 0.6, tz + dirZ * 1.6, t.level >= 5 ? 0x67e8f9 : undefined);
      this.decals.spawn('scorch', target.position.x, target.position.z, 1.4, 5);
      this.grass.addReaction(target.position.x, target.position.z, 2.2, 'burn', 1.8);

      for (const e of this.enemies) {
        if (e.isDead || e.reachedGoal || e.isBurrowed) continue;
        const ex = e.position.x - tx;
        const ez = e.position.z - tz;
        const d = Math.hypot(ex, ez);
        if (d > rng + 0.5) continue;
        const dot = (ex * dirX + ez * dirZ) / Math.max(0.01, d);
        if (dot >= Math.cos(THREE.MathUtils.degToRad(25))) {
          e.burnTimer = Math.max(e.burnTimer, 4.0);
          e.burnDps = Math.max(e.burnDps, dmg * 0.35 * w.weatherFireMult);
          const syn = this.synergy.tryTrigger(e, 'burn', dmg);
          const total = dmg + (syn?.bonusDamage ?? 0);
          const res = e.applyDamage(total, { element: 'burn', sourceTowerId: t.id });
          this.handleDamageCredit(t, res.hpDamage, e);
          this.popups.spawnDamage(e.position.x, e.position.y, e.position.z, total, isCrit ? 'crit' : 'burn', e.id);
        }
      }
    } else if (t.def.id === 'sonic_bloom') {
      SynthAudio.play('sonic');
      const rng = t.getEffectiveRange(w.weatherRangeMult);
      this.vfx.spawnShockwave(tx, 0.08, tz, rng, t.level >= 5 ? 0x2dd4bf : 0xe879f9, 0.5);
      this.grass.addReaction(tx, tz, rng, 'flatten', 1.4);
      for (const e of this.enemies) {
        if (e.isDead || e.reachedGoal) continue;
        if (Math.hypot(e.position.x - tx, e.position.z - tz) <= rng) {
          const syn = this.synergy.tryTrigger(e, 'knockback', dmg);
          e.applyKnockback(1.2, syn?.knockbackMult ?? 1);
          const res = e.applyDamage(dmg + (syn?.bonusDamage ?? 0), { sourceTowerId: t.id });
          this.handleDamageCredit(t, res.hpDamage, e);
          this.popups.spawnDamage(e.position.x, e.position.y, e.position.z, res.hpDamage, isCrit ? 'crit' : 'normal', e.id);
        }
      }
    } else if (t.def.id === 'ice_buds') {
      SynthAudio.play('ice');
      t.iceHitCounter++;
      this.vfx.spawnBeam(tx, ty, tz, target.position.x, 0.6, target.position.z, 0x38bdf8, 0.9, 0.14);
      this.vfx.spawnRecipe('frost_shatter', target.position.x, 0.5, target.position.z);
      this.decals.spawn('frost', target.position.x, target.position.z, 1.5, 6);
      this.grass.addReaction(target.position.x, target.position.z, 2.0, 'frost', 2.0);
      const triggersFreeze = t.iceHitCounter % 4 === 0;
      for (const e of this.enemies) {
        if (e.isDead || e.reachedGoal || e.isBurrowed) continue;
        if (e === target || Math.hypot(e.position.x - target.position.x, e.position.z - target.position.z) <= 1.5) {
          e.chillTimer = Math.max(e.chillTimer, 3.5 * w.weatherIceMult);
          if (triggersFreeze) e.freezeTimer = Math.max(e.freezeTimer, 1.2 * (1 - e.def.chillResist));
          const syn = this.synergy.tryTrigger(e, triggersFreeze ? 'freeze' : 'chill', dmg);
          const total = dmg + (syn?.bonusDamage ?? 0);
          const res = e.applyDamage(total, { element: 'freeze', sourceTowerId: t.id });
          this.handleDamageCredit(t, res.hpDamage, e);
          this.popups.spawnDamage(e.position.x, e.position.y, e.position.z, total, isCrit ? 'crit' : 'freeze', e.id);
        }
      }
    } else if (t.def.id === 'laser_plant') {
      SynthAudio.play('laser');
      if (t.laserTargetId === target.id) {
        t.laserRampStacks = Math.min(1.5, t.laserRampStacks + 0.1); // up to 2.5x
      } else {
        t.laserTargetId = target.id;
        t.laserRampStacks = 0;
      }
      const rampedDmg = Math.round(dmg * (1 + t.laserRampStacks));
      this.vfx.spawnBeam(tx, ty, tz, target.position.x, 0.6, target.position.z, 0xf43f5e, 1 + t.laserRampStacks * 0.4, 0.16);
      const syn = this.synergy.tryTrigger(target, 'arcane', rampedDmg);
      const res = target.applyDamage(rampedDmg + (syn?.bonusDamage ?? 0), {
        isBeam: true,
        element: 'arcane',
        sourceTowerId: t.id,
      });
      this.handleDamageCredit(t, res.hpDamage, target);
      this.popups.spawnDamage(target.position.x, target.position.y, target.position.z, res.hpDamage, isCrit ? 'crit' : 'normal', target.id);

      // Lv.5 forks to a 2nd target at 50% damage
      if (t.level >= 5) {
        const fork = this.enemies.find(
          (e) =>
            e !== target &&
            !e.isDead &&
            !e.reachedGoal &&
            Math.hypot(e.position.x - tx, e.position.z - tz) <= t.getEffectiveRange(w.weatherRangeMult)
        );
        if (fork) {
          this.vfx.spawnBeam(target.position.x, 0.6, target.position.z, fork.position.x, 0.6, fork.position.z, 0xe879f9, 0.7, 0.16);
          const fRes = fork.applyDamage(Math.round(rampedDmg * 0.5), { isBeam: true, element: 'arcane', sourceTowerId: t.id });
          this.handleDamageCredit(t, fRes.hpDamage, fork);
        }
      }
    } else if (t.def.id === 'venus_flytrap') {
      SynthAudio.play('flytrap');
      this.decals.spawn('vine', target.position.x, target.position.z, 1.5, t.level >= 5 ? 2.0 : 4.0);
      const canDevour = !target.def.isBoss && !target.def.isMiniBoss && target.hp <= target.maxHp * 0.18;
      if (canDevour) {
        TimeScale.triggerHitStop('flytrap_devour');
        const res = target.applyDamage(target.hp + 9999, { element: 'devour', sourceTowerId: t.id });
        this.handleDamageCredit(t, res.hpDamage, target);
        this.popups.spawnDamage(target.position.x, target.position.y + 0.8, target.position.z, res.hpDamage, 'crit', target.id, 'DEVOUR!');
      } else {
        target.bleedTimer = Math.max(target.bleedTimer, 3.0);
        target.bleedDps = Math.max(target.bleedDps, dmg * 0.15);
        const syn = this.synergy.tryTrigger(target, 'heavy', dmg);
        const res = target.applyDamage(dmg + (syn?.bonusDamage ?? 0), { sourceTowerId: t.id });
        this.handleDamageCredit(t, res.hpDamage, target);
        this.popups.spawnDamage(target.position.x, target.position.y, target.position.z, res.hpDamage, isCrit ? 'crit' : 'normal', target.id);
      }
      if (t.level >= 5) {
        target.applySlow(2.0, 0.35);
      }
    } else if (t.def.id === 'ancient_moss_golem') {
      SynthAudio.play('golem');
      this.projectiles.launch({
        kind: 'boulder',
        startX: tx,
        startY: ty + 0.5,
        startZ: tz,
        targetEnemy: target,
        targetTower: null,
        fallbackX: target.position.x,
        fallbackZ: target.position.z,
        speed: 10,
        arcHeight: 2.8,
        damage: dmg,
        splashRadius: t.getEffectiveSplashRadius(),
        isCrit,
        isExplosive: true,
        isLv5: t.level >= 5,
        canRicochet: false,
        sourceTower: t,
        weatherDrift: w.weatherDrift,
        weatherFireMult: w.weatherFireMult,
        weatherIceMult: w.weatherIceMult,
        weatherArcaneBonus: w.weatherArcaneBonus,
      });
    } else if (t.def.id === 'chrono_bloom') {
      const kinds = ['solar_orb', 'frost_orb', 'arcane_orb'] as const;
      const kind = kinds[t.chronoCycleIndex % 3];
      t.chronoCycleIndex++;
      SynthAudio.play(kind === 'frost_orb' ? 'ice' : kind === 'arcane_orb' ? 'crit' : 'pepper');
      this.projectiles.launch({
        kind,
        startX: tx,
        startY: ty + 0.3,
        startZ: tz,
        targetEnemy: target,
        targetTower: null,
        fallbackX: target.position.x,
        fallbackZ: target.position.z,
        speed: 16,
        arcHeight: 1.4,
        damage: dmg,
        splashRadius: kind === 'arcane_orb' ? 0 : t.getEffectiveSplashRadius(),
        isCrit,
        isExplosive: false,
        isLv5: t.level >= 5,
        canRicochet: false,
        sourceTower: t,
        weatherDrift: w.weatherDrift,
        weatherFireMult: w.weatherFireMult,
        weatherIceMult: w.weatherIceMult,
        weatherArcaneBonus: w.weatherArcaneBonus,
      });
    }
  }

  private updateEnemySpecialAbilities(e: EnemyEntity, dt: number): void {
    // Spore Stunner Wasp lobs spore bomb every 9 s (1.2 s red warning ring -> 3.5 s stun)
    if (e.type === 'spore_wasp' && this.towers.length > 0) {
      e.waspBombTimer -= dt;
      if (e.waspBombTimer <= 0) {
        e.waspBombTimer = 9.0;
        const victim = this.towers[Math.floor(Math.random() * this.towers.length)];
        this.vfx.spawnTelegraph(victim.position.x, victim.position.z, 1.4, 1.2);
        this.projectiles.launch({
          kind: 'spore_bomb',
          startX: e.position.x,
          startY: 1.8,
          startZ: e.position.z,
          targetEnemy: null,
          targetTower: victim,
          fallbackX: victim.position.x,
          fallbackZ: victim.position.z,
          speed: 8,
          arcHeight: 2.0,
          damage: 0,
          splashRadius: 0,
          isCrit: false,
          isExplosive: false,
          isLv5: false,
          canRicochet: false,
          sourceTower: null,
          weatherDrift: 0,
          weatherFireMult: 1,
          weatherIceMult: 1,
          weatherArcaneBonus: 0,
        });
      }
    }

    // Blighted Treant Overlord Boss skills (§7)
    if (e.type === 'treant_overlord') {
      e.bossRootSlamTimer -= dt;
      if (e.bossRootSlamTimer <= 0) {
        e.bossRootSlamTimer = 10.0;
        this.vfx.spawnShockwave(e.position.x, 0.1, e.position.z, 9.0, 0xc084fc, 0.7);
        EventBus.emit('camera:trauma', { amount: 0.4 });
        SynthAudio.play('boss_roar');
        for (const t of this.towers) {
          if (Math.hypot(t.position.x - e.position.x, t.position.z - e.position.z) <= 9.0) {
            t.applyStun(3.0);
          }
        }
      }
      e.bossSummonTimer -= dt;
      if (e.bossSummonTimer <= 0) {
        e.bossSummonTimer = 13.0;
        for (let i = 0; i < 4; i++) {
          this.spawnEnemy('garden_ant', 0, Math.max(0, e.progress - 0.04));
        }
      }
    }
  }

  private onEnemyKilled(e: EnemyEntity): void {
    const bountyMult = e.isElite ? 3 : 1;
    const totalBounty = e.def.bounty * bountyMult * e.swarmClumpCount;
    this.spawnCashBurst(e.position.x, e.position.y, e.position.z, totalBounty);

    SaveManager.data.stats.totalKills += e.swarmClumpCount;
    if (e.type === 'garden_ant') {
      EventBus.emit('quest:progress', { type: 'kill_ant', amount: e.swarmClumpCount });
    }

    // Elite Splitter spawns 2 smaller copies on death (§15.3)
    if (e.isElite && e.eliteMod === 'Splitter') {
      for (let i = 0; i < 2; i++) {
        const clone = this.spawnEnemy(e.type, 0, Math.max(0, e.progress - i * 0.02));
        if (clone) {
          clone.maxHp = Math.round(e.maxHp * 0.35);
          clone.hp = clone.maxHp;
          clone.isElite = false;
          clone.rig.root.scale.multiplyScalar(0.75);
        }
      }
    }

    // §7.1 Death VFX per archetype / element
    if (e.type === 'garden_ant') {
      this.vfx.spawnRecipe('ant_death_confetti', e.position.x, 0.4, e.position.z);
    } else if (e.type === 'iron_beetle') {
      this.vfx.spawnRecipe('shield_shatter', e.position.x, 0.5, e.position.z);
    } else if (e.type === 'burrowing_mole') {
      this.vfx.spawnRecipe('soil_placement_clods', e.position.x, 0.5, e.position.z);
    } else if (e.type === 'gargantuan_snail') {
      this.vfx.spawnRecipe('frost_shatter', e.position.x, 0.8, e.position.z);
      this.decals.spawn('slime', e.position.x, e.position.z, 2.2, 8);
    } else if (e.type === 'treant_overlord') {
      TimeScale.triggerHitStop('boss_kill');
      TimeScale.triggerSlowMo(0.25, 1.2, true);
      this.bossFinaleActive = true;
      this.bossFinaleTimer = 2.4;
      this.vfx.spawnRecipe('boss_core_explosion', e.position.x, 1.6, e.position.z);
      this.vfx.spawnShockwave(e.position.x, 0.1, e.position.z, 18, 0xc084fc, 1.0);
      EventBus.emit('camera:zoom_punch', { factor: 0.12, duration: 0.6 });
      EventBus.emit('camera:trauma', { amount: 0.85 });
      EventBus.emit('vfx:screen_flash', { color: '#ffffff', opacity: 0.65, duration: 0.25 });
      EventBus.emit('match:boss_defeated', undefined);
      SynthAudio.play('explosion');
    } else if (e.lastHitElement === 'freeze') {
      this.vfx.spawnRecipe('frost_shatter', e.position.x, 0.5, e.position.z);
    } else if (e.lastHitElement === 'burn') {
      this.vfx.spawnRecipe('fire_cinders', e.position.x, 0.5, e.position.z);
    }

    // §8.8 Last enemy of wave short slow-mo
    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.every((en) => en.isDead)) {
      TimeScale.triggerSlowMo(0.6, 0.4, false);
      EventBus.emit('camera:zoom_punch', { factor: 0.08, duration: 0.4 });
    }
  }

  private spawnCashBurst(wx: number, wy: number, wz: number, amount: number): void {
    const hudCashEl = document.getElementById('hud-cash-pill');
    if (hudCashEl) {
      const rect = hudCashEl.getBoundingClientRect();
      this.vfx.spawnCoinToHUD(
        wx,
        wy,
        wz,
        this.engine.cameraRig.camera,
        rect.left + rect.width * 0.5,
        rect.top + rect.height * 0.5,
        () => {
          this.addCash(amount);
        }
      );
    } else {
      this.addCash(amount);
    }
    this.popups.spawnDamage(wx, wy + 0.5, wz, amount, 'cash');
  }

  private onEnemyReachedBase(e: EnemyEntity): void {
    const dmg = e.def.baseDamage;
    this.baseHp = Math.max(0, this.baseHp - dmg);
    const lowHp = this.baseHp > 0 && this.baseHp / this.maxBaseHp < 0.25;
    EventBus.emit('match:base_hp_changed', { hp: this.baseHp, maxHp: this.maxBaseHp, delta: -dmg });
    EventBus.emit('vfx:base_hit_vignette', { lowHp });
    SynthAudio.play('base_hit');

    if (this.baseHp <= 0 && !this.matchEnded) {
      this.matchEnded = true;
      this.waveActive = false;
      for (const t of this.towers) t.anim.isWilting = true; // §8.7 Defeat wilt
      this.engine.postFx.setEnvironmentTint(0xffffff, 0, 0.78, 0);
      EventBus.emit('match:defeat', { wavesCleared: Math.max(0, this.currentWave - 1) });
    }
  }

  private onWaveCleared(): void {
    this.waveActive = false;
    this.skipBonusAvailable = false;
    this.waveCountdown = 6.0;

    // §5.2 WaveBonus(w) = floor(120 + 35*w + 4*w^1.35)
    const waveBonus = Math.floor(120 + 35 * this.currentWave + 4 * Math.pow(this.currentWave, 1.35));
    const farmMult = this.weather.activeDef?.farmMult ?? 1.0;
    let farmTotal = 0;
    for (const t of this.towers) {
      if (t.def.isFarm) {
        const pay = t.getFarmPayout(farmMult);
        farmTotal += pay;
        t.anim.triggerAttack(t.def.id);
        this.spawnCashBurst(t.position.x, t.position.y + 1, t.position.z, pay);
      }
    }

    this.addCash(waveBonus);
    SynthAudio.play('coin');
    EventBus.emit('match:wave_cleared', { wave: this.currentWave, bonus: waveBonus + farmTotal });

    if (this.isEndless) {
      if (this.currentWave > SaveManager.data.stats.highestEndlessWave) {
        SaveManager.data.stats.highestEndlessWave = this.currentWave;
      }
      if (this.currentWave >= 50) SaveManager.unlockAchievement('endless_50');

      // §5.2 Endless milestones: every 10 endless waves, award Bloom Chest
      if (this.currentWave % 10 === 0) {
        const seeds = 120;
        const dewdrops = 2;
        SaveManager.addSeeds(seeds);
        SaveManager.addDewdrops(dewdrops);
        EventBus.emit('match:bloom_chest', { seeds, dewdrops, wave: this.currentWave });
      }
      SaveManager.save();
    } else if (this.currentWave >= this.totalWaves && !this.matchEnded) {
      // Victory!
      this.matchEnded = true;
      const diff = DIFFICULTIES[this.difficultyId];
      SaveManager.addSeeds(diff.clearRewardSeeds);
      SaveManager.addPlayerXp(120 + this.totalWaves * 10);
      SaveManager.data.stats.matchesWon++;
      if (this.difficultyId === 'Hard' || this.difficultyId === 'Insane') {
        EventBus.emit('quest:progress', { type: 'win_hard', amount: 1 });
      }
      if (this.difficultyId === 'Insane') {
        SaveManager.unlockAchievement('beat_insane');
      }
      SaveManager.save();

      EventBus.emit('match:victory', {
        mapId: this.mapDef.id,
        difficulty: this.difficultyId,
        seedsEarned: diff.clearRewardSeeds,
        wavesCleared: this.currentWave,
      });
    }
  }
}
