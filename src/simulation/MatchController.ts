import * as THREE from 'three';
import { DIFFICULTIES, MAPS, type DifficultyId, type MapDef, type MapId } from '../data/MapRegistry';
import { computeScaledEnemyHP, ENEMIES, type EnemyTypeId } from '../data/EnemyRegistry';
import { getEliteSpawnChance, rollEliteModifier } from '../data/ModifierConfig';
import { getUnitById } from '../data/UnitRegistry';
import { getCalendarSeason } from '../data/WeatherConfig';
import {
  GARDEN_PUZZLES,
  getWeeklyChallengeForDate,
  type GameModeId,
} from '../data/GameModesConfig';
import { EventBus } from '../core/EventBus';
import { SaveManager } from '../core/SaveManager';
import { TimeScale } from '../core/TimeScale';
import { Engine } from '../core/Engine';
import { MeshFactory, type MapSceneHandles } from '../rendering/MeshFactory';
import { VFXManager } from '../rendering/VFXManager';
import { DecalManager } from '../rendering/DecalManager';
import { GrassField } from '../rendering/GrassField';
import { FloatingTextManager } from '../rendering/FloatingTextManager';
import { RootNetworkRenderer } from '../rendering/RootNetworkRenderer';
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

interface PoisonCloudZone {
  x: number;
  z: number;
  radius: number;
  dps: number;
  remaining: number;
  tickTimer: number;
  sourceTower: TowerEntity;
  tracksEnemies: boolean;
}

export class MatchController {
  public engine: Engine;
  public vfx: VFXManager;
  public decals: DecalManager;
  public grass: GrassField;
  public popups: FloatingTextManager;
  public rootNetwork: RootNetworkRenderer;
  public placement = new PlacementSystem();
  public synergy: SynergySystem;
  public weather: WeatherSystem;
  public projectiles: ProjectileSystem;
  public abilities: AbilitySystem;

  public mapDef: MapDef = MAPS.sunny_backyard;
  public difficultyId: DifficultyId = 'Easy';
  public gameMode: GameModeId = 'standard';
  public activePuzzleId: number | null = null;
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
  private sellingTowers: TowerEntity[] = [];
  public enemies: EnemyEntity[] = [];
  private poisonClouds: PoisonCloudZone[] = [];
  private spawnQueue: PendingSpawn[] = [];
  private spawnTimer = 0;
  private meteorHazards: MeteorHazard[] = [];
  private meteorSpawnTimer = 9.0;
  private blizzardTimer = 0;

  private matchElapsedSec = 0;
  private topSingleHit = 0;
  private multiKillCount = 0;
  private multiKillWindow = 0;

  private waterRippleAge = 10;
  private lawnmowerActive = false;
  private lawnmowerX = -24;
  private envWobbleTimer = 0;
  private envWobblePos = new THREE.Vector3();
  private waveFlowerTimer = 0;

  private bossFinaleTimer = 0;
  private bossFinaleActive = false;
  private bossEntranceTimer = 0;
  private worldPopupContainer: HTMLElement;

  // Living Garden Hub plants (§13.1)
  public hubPlants: Array<{ unitId: string; root: THREE.Group }> = [];

  constructor(engine: Engine, worldPopupContainer: HTMLElement) {
    this.engine = engine;
    this.worldPopupContainer = worldPopupContainer;
    this.vfx = new VFXManager(engine.scene, worldPopupContainer);
    this.decals = new DecalManager(engine.scene);
    this.grass = new GrassField(engine.scene);
    this.popups = new FloatingTextManager(worldPopupContainer);
    this.rootNetwork = new RootNetworkRenderer(engine.scene);
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

    EventBus.on('match:boss_staggered', () => {
      SynthAudio.play('stagger');
      EventBus.emit('match:killfeed', { text: 'STAGGERED! Boss takes +25% damage!', color: '#fde047' });
    });

    this.loadDiorama('sunny_backyard');
    this.rebuildHubGarden();
    this.engine.applyLobbySeasonTint(getCalendarSeason());
  }

  public rebuildHubGarden(): void {
    for (const h of this.hubPlants) this.engine.scene.remove(h.root);
    this.hubPlants = [];
    if (this.inMatch) return;

    const ownedIds = Object.keys(SaveManager.data.owned);
    ownedIds.forEach((uId, idx) => {
      const unit = getUnitById(uId);
      const owned = SaveManager.data.owned[uId];
      const rig = MeshFactory.buildTowerRig(
        uId,
        Math.min(5, Math.floor(owned.masteryLevel / 2)),
        unit.rarity,
        owned.trait,
        owned.soilSkin,
        owned.isPrime
      );
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      const isRoyal = unit.rarity === 'Godly' || unit.rarity === 'Exclusive';
      rig.root.position.set(-7 + col * 2.4, isRoyal ? 0.35 : 0, -14 + row * 2.4);
      rig.root.userData.hubUnitId = uId;
      this.engine.scene.add(rig.root);
      this.hubPlants.push({ unitId: uId, root: rig.root });
    });
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
    AdaptiveMusic.mapId = mapId;
    AdaptiveMusic.bossPhase3 = false;
  }

  public startMatch(
    mapId: MapId,
    difficultyId: DifficultyId,
    mode: GameModeId = 'standard',
    puzzleId?: number
  ): void {
    this.gameMode = mode;
    this.activePuzzleId = puzzleId ?? null;

    let actualMap = mapId;
    let actualDiff = difficultyId;
    const diff = DIFFICULTIES[actualDiff];
    let startingCash = diff.startingCash;
    let waves = diff.waves;

    if (mode === 'weekly') {
      const weekly = getWeeklyChallengeForDate();
      actualMap = weekly.mapId;
      actualDiff = weekly.difficulty;
      startingCash = weekly.enemySpeedMult >= 2 ? diff.startingCash * 2 : diff.startingCash;
    } else if (mode === 'boss_rush') {
      startingCash = 5000;
      waves = 8; // 4 bosses separated by 1 minion wave each (§12)
    } else if (mode === 'puzzle' && puzzleId) {
      const puz = GARDEN_PUZZLES.find((p) => p.id === puzzleId) ?? GARDEN_PUZZLES[0];
      actualMap = puz.mapId;
      startingCash = puz.startingCash;
      waves = 1;
    }

    this.inMatch = true;
    this.rebuildHubGarden();
    this.loadDiorama(actualMap);

    this.difficultyId = actualDiff;
    this.isEndless = false;
    this.matchEnded = false;
    this.cash = startingCash;
    this.baseHp = diff.baseHP;
    this.maxBaseHp = diff.baseHP;
    this.currentWave = 0;
    this.totalWaves = waves;
    this.waveActive = false;
    this.waveCountdown = 5.0;
    this.skipBonusAvailable = false;
    this.meteorHazards = [];
    this.poisonClouds = [];
    this.blizzardTimer = 0;
    this.lawnmowerActive = false;
    this.bossFinaleActive = false;
    this.bossEntranceTimer = 0;
    this.matchElapsedSec = 0;
    this.topSingleHit = 0;

    TimeScale.resetMatch();
    this.weather.reset();
    this.engine.cameraRig.isLobbyMode = false;
    this.engine.cameraRig.photoMode = false;
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
    this.engine.cameraRig.photoMode = false;
    this.engine.cameraRig.resetView();
    this.engine.postFx.setLowHpDesaturate(false);
    this.engine.postFx.setEnvironmentTint(0xffffff, 0, 0, 0);
    this.loadDiorama(SaveManager.data.selectedMap);
    this.rebuildHubGarden();
    this.engine.applyLobbySeasonTint(getCalendarSeason());
  }

  private clearMatchEntities(): void {
    for (const t of this.towers) t.destroy();
    this.towers = [];
    for (const t of this.sellingTowers) t.destroy();
    this.sellingTowers = [];
    for (const e of this.enemies) e.destroy(this.engine.scene);
    this.enemies = [];
    this.poisonClouds = [];
    this.spawnQueue = [];
    this.vfx.clearAll();
    this.decals.clearAll();
    this.popups.clear();
    this.projectiles.clearAll();
    this.rootNetwork.computeLinks([]);
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

    if (this.gameMode === 'weekly') {
      const w = getWeeklyChallengeForDate();
      if (w.onlyRarity && unit.rarity !== w.onlyRarity) {
        SynthAudio.play('error');
        EventBus.emit('toast:show', { title: `Weekly Rule: ${w.onlyRarity} units only!`, color: '#f43f5e' });
        return null;
      }
    } else if (this.gameMode === 'puzzle' && this.activePuzzleId) {
      const puz = GARDEN_PUZZLES.find((p) => p.id === this.activePuzzleId);
      if (puz && !puz.allowedUnits.includes(unitId)) {
        SynthAudio.play('error');
        EventBus.emit('toast:show', { title: 'Puzzle allows specific units only!', color: '#f43f5e' });
        return null;
      }
    }

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
    this.rootNetwork.computeLinks(this.towers);

    // §4.1 Placement Seed-to-Plant VFX + audio
    this.vfx.spawnRecipe('root_burst_clods', x, check.y + 0.2, z);
    this.decals.spawn('crack', x, z, 0.9, 3.0);
    this.grass.addReaction(x, z, 1.5, 'flatten', 1.2);
    SynthAudio.play('place_root');
    EventBus.emit('tower:placed', { unitId, x, z });
    EventBus.emit('match:state_changed', undefined);
    return tower;
  }

  public undoLastPlacement(): boolean {
    if (!this.inMatch || this.towers.length === 0) return false;
    const last = this.towers[this.towers.length - 1];
    const age = performance.now() * 0.001 - last.placedAtRealTime;
    if (age <= 3.0 && !last.hasAttacked) {
      this.sellTower(last, true);
      EventBus.emit('toast:show', { title: 'Placement Undone (100% Refund)', color: '#4ade80' });
      return true;
    }
    return false;
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
    this.rootNetwork.computeLinks(this.towers);
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

  public upgradeMaxAffordable(tower: TowerEntity): number {
    let count = 0;
    while (this.upgradeTower(tower)) {
      count++;
    }
    return count;
  }

  public sellTower(tower: TowerEntity, forceUndo = false): void {
    if (this.gameMode === 'weekly' && !forceUndo && getWeeklyChallengeForDate().noSelling) {
      SynthAudio.play('error');
      EventBus.emit('toast:show', { title: 'Weekly Rule: Selling disabled!', color: '#f43f5e' });
      return;
    }
    const idx = this.towers.indexOf(tower);
    if (idx === -1) return;
    const refund = forceUndo ? tower.totalSpentCash : tower.getSellRefund();
    this.vfx.spawnRecipe('wilt_leaves', tower.position.x, tower.position.y + 0.4, tower.position.z);
    this.popups.spawnDamage(tower.position.x, tower.position.y + 1.0, tower.position.z, refund, 'cash');
    this.addCash(refund);

    this.towers.splice(idx, 1);
    tower.anim.startSellAnimation();
    this.sellingTowers.push(tower);
    this.rootNetwork.computeLinks(this.towers);

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
    const isBossWave =
      this.gameMode === 'boss_rush'
        ? waveNumber % 2 === 0
        : !this.isEndless && waveNumber === this.totalWaves;
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
    if (this.gameMode === 'boss_rush') {
      const bosses: EnemyTypeId[] = ['treant_overlord', 'vinewyrm_hydra', 'magma_beetle_queen', 'frost_moth_empress'];
      if (wave % 2 === 1) {
        return [
          { type: 'sprinter_mantis', count: 10 + wave * 2, interval: 0.4 },
          { type: 'iron_beetle', count: 4 + wave, interval: 0.6 },
        ];
      }
      return [{ type: bosses[(wave / 2 - 1) % bosses.length], count: 1, interval: 1.0 }];
    }

    if (this.gameMode === 'puzzle' && this.activePuzzleId) {
      const puz = GARDEN_PUZZLES.find((p) => p.id === this.activePuzzleId);
      const pw = puz?.waveNumber ?? 10;
      return [
        { type: 'garden_ant', count: 14, interval: 0.4 },
        { type: 'iron_beetle', count: 4, interval: 0.7 },
        { type: pw >= 12 ? 'burrowing_mole' : 'aphid_cluster', count: 5, interval: 0.75 },
      ];
    }

    const entries: WaveSpawnEntry[] = [];
    const isFinalBoss = !this.isEndless && wave === this.totalWaves;

    const antCount = Math.min(48, 8 + wave * 2);
    entries.push({ type: 'garden_ant', count: antCount, interval: Math.max(0.18, 0.55 - wave * 0.01) });

    if (wave >= 3) entries.push({ type: 'aphid_cluster', count: Math.min(12, 2 + Math.floor(wave * 0.35)), interval: 0.75 });
    if (wave >= 4) entries.push({ type: 'sprinter_mantis', count: Math.min(24, 3 + Math.floor(wave * 0.7)), interval: 0.48 });
    if (wave >= 7) entries.push({ type: 'iron_beetle', count: Math.min(18, 2 + Math.floor((wave - 5) * 0.6)), interval: 0.75 });
    if (wave >= 9) entries.push({ type: 'caterpillar_cocoon', count: Math.min(10, 1 + Math.floor((wave - 7) * 0.4)), interval: 0.9 });
    if (wave >= 11) entries.push({ type: 'burrowing_mole', count: Math.min(14, 2 + Math.floor((wave - 9) * 0.45)), interval: 0.85 });
    if (wave >= 13) entries.push({ type: 'termite_gnawer', count: Math.min(10, 1 + Math.floor((wave - 11) * 0.4)), interval: 0.9 });
    if (wave >= 15) entries.push({ type: 'spore_wasp', count: Math.min(12, 1 + Math.floor((wave - 13) * 0.4)), interval: 1.0 });
    if (wave >= 18) entries.push({ type: 'locust_swarm', count: Math.min(4, 1 + Math.floor((wave - 16) * 0.25)), interval: 1.5 });
    if (wave % 10 === 0 && !isFinalBoss) {
      entries.push({ type: 'gargantuan_snail', count: Math.max(1, Math.floor(wave / 15)), interval: 2.5 });
    }
    if (isFinalBoss || (this.isEndless && wave % 20 === 0)) {
      entries.push({ type: this.mapDef.bossId, count: 1, interval: 1.0 });
    }
    return entries;
  }

  public startNextWave(): void {
    if (!this.inMatch || this.matchEnded) return;
    this.currentWave++;
    this.waveActive = true;
    this.skipBonusAvailable = false;

    const preview = this.getWavePreview(this.currentWave);
    this.weather.onWaveStarted(this.currentWave, preview.isBossWave, !!this.mapDef.hasBlizzardHazards);

    if (this.mapDef.hasBlizzardHazards && this.currentWave % 4 === 0) {
      this.blizzardTimer = 20.0;
      EventBus.emit('toast:show', {
        title: '❄️ Blizzard Approaching!',
        subtitle: 'Towers lose 10% range for 20 s (Fire plants immune)',
        color: '#bae6fd',
      });
    }

    if (this.mapHandles?.rainbowArc) {
      this.mapHandles.rainbowArc.visible = this.weather.currentWeather === 'rainbow';
    }

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

    if (this.mapDef.id === 'sunny_backyard' && this.currentWave === 10 && this.mapHandles?.lawnmower) {
      this.lawnmowerActive = true;
      this.lawnmowerX = -24;
      this.mapHandles.lawnmower.visible = true;
    }

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

    if (this.enemies.length >= 150 && type === 'garden_ant') {
      const existingAnt = this.enemies.find((e) => !e.isDead && e.type === 'garden_ant' && e.progress < 0.25);
      if (existingAnt) {
        existingAnt.mergeSwarmAnt(scaledHp);
        return existingAnt;
      }
    }

    const endlessExtraMod = this.isEndless && this.currentWave >= 25 ? rollEliteModifier() : null;
    const eliteChance = !ENEMIES[type].isBoss && !ENEMIES[type].isMiniBoss ? getEliteSpawnChance(this.currentWave) : 0;
    const isElite = Boolean(endlessExtraMod) || Math.random() < eliteChance;
    const eliteMod = endlessExtraMod ?? (isElite ? rollEliteModifier() : null);

    const speedMult = this.gameMode === 'weekly' ? getWeeklyChallengeForDate().enemySpeedMult : 1.0;

    const enemy = new EnemyEntity(
      type,
      spline,
      scaledHp,
      isElite,
      eliteMod,
      this.engine.scene,
      this.worldPopupContainer,
      speedMult
    );
    enemy.progress = customProgress;
    this.enemies.push(enemy);
    SaveManager.markEnemySeen(type);

    // §6.1 Spawn entrance puff
    if (customProgress === 0 && this.mapHandles.spawnMarkers[splineIdx]) {
      const sp = this.mapHandles.spawnMarkers[splineIdx].position;
      this.vfx.spawnRecipe(
        this.mapDef.id === 'volcano_greenhouse'
          ? 'fire_cinders'
          : this.mapDef.id === 'frosty_allotment'
            ? 'frost_shatter'
            : 'soil_placement_clods',
        sp.x,
        0.5,
        sp.z
      );
    }

    if (ENEMIES[type].isBoss) {
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
        this.mapHandles.sleepingCat.visible = false;
      }
    }

    return enemy;
  }

  private handleDamageCredit(tower: TowerEntity | null, hpStripped: number, enemy: EnemyEntity): void {
    if (hpStripped <= 0) return;
    if (hpStripped > this.topSingleHit) this.topSingleHit = Math.round(hpStripped);
    const cashGain = Math.max(0, Math.floor(hpStripped / 12));
    if (cashGain > 0) this.addCash(cashGain);
    if (tower) {
      tower.totalDamageDealt += Math.round(hpStripped);
      tower.recordWaveDamage(this.currentWave, hpStripped);
      SaveManager.addUnitMasteryXp(tower.def.id, hpStripped);
    }

    if (enemy.type === 'gargantuan_snail' && !enemy.snailShattered && enemy.hp <= enemy.maxHp * 0.5) {
      enemy.snailShattered = true;
      this.vfx.spawnRecipe('frost_shatter', enemy.position.x, 0.8, enemy.position.z);
      for (let i = 0; i < 6; i++) {
        this.spawnEnemy('speedy_slug', 0, Math.max(0, enemy.progress - i * 0.015));
      }
    }

    // §9 3-Phase Map Boss Transitions (60% -> Phase 2, 25% -> Phase 3)
    if (enemy.def.isBoss) {
      if (enemy.bossPhase === 1 && enemy.hp <= enemy.maxHp * 0.6) {
        enemy.bossPhase = 2;
        enemy.armor = Math.round(enemy.maxHp * 0.22);
        enemy.maxArmor = Math.max(enemy.maxArmor, enemy.armor);
        TimeScale.triggerHitStop('boss_phase');
        EventBus.emit('vfx:chromatic_pulse', { strength: 0.9, duration: 0.45 });
        EventBus.emit('match:boss_phase', { phase: 2 });
        SynthAudio.play('boss_roar');

        if (enemy.type === 'vinewyrm_hydra') {
          for (const h of enemy.rig.hydraHeads) h.visible = true; // grows 2 extra heads
        }
      } else if (enemy.bossPhase === 2 && enemy.hp <= enemy.maxHp * 0.25) {
        enemy.bossPhase = 3;
        AdaptiveMusic.bossPhase3 = true;
        TimeScale.triggerHitStop('boss_phase');
        EventBus.emit('vfx:chromatic_pulse', { strength: 1.0, duration: 0.5 });
        EventBus.emit('match:boss_phase', { phase: 3 });
        SynthAudio.play('boss_roar');

        if (enemy.type === 'frost_moth_empress' && !enemy.bossSplitDone) {
          enemy.bossSplitDone = true;
          for (let i = 0; i < 2; i++) {
            this.spawnEnemy('moth_flyer', 0, Math.max(0, enemy.progress - i * 0.03));
          }
        }
      }
    }
  }

  public update(rawDt: number): void {
    const { uiDt, simDt, enemyDt, shaderDt } = TimeScale.step(rawDt);

    let effectiveSimDt = simDt;
    let effectiveEnemyDt = enemyDt;
    if (this.bossEntranceTimer > 0) {
      this.bossEntranceTimer = Math.max(0, this.bossEntranceTimer - uiDt);
      effectiveSimDt = 0;
      effectiveEnemyDt = 0;
    }

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

    this.updateMapLife(uiDt, effectiveSimDt);

    if (this.inMatch && !this.matchEnded) {
      this.updateMatchSimulation(effectiveSimDt, effectiveEnemyDt, uiDt);
    } else {
      // Hub Garden idle animations
      const nowTime = performance.now() * 0.001;
      for (let i = 0; i < this.hubPlants.length; i++) {
        this.hubPlants[i].root.rotation.y = Math.sin(nowTime * 0.8 + i) * 0.12;
      }
      this.vfx.update(uiDt);
      this.vfx.syncStatusIcons([], this.engine.cameraRig.camera);
      this.grass.update(uiDt);
    }

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
    const tNow = performance.now() * 0.001;

    for (const m of this.mapHandles.mushrooms) {
      const s = 1 + AdaptiveMusic.currentBeatPulse * 0.15;
      m.scale.set(s, s, s);
    }

    // Sunny Backyard gnomes look at boss (§10.2)
    const activeBoss = this.enemies.find((e) => !e.isDead && e.def.isBoss);
    if (activeBoss) {
      for (const g of this.mapHandles.gnomes) {
        g.lookAt(activeBoss.position.x, 0, activeBoss.position.z);
      }
    }

    // Enchanted Jungle hanging vines sway + waveFlower opens on clear
    for (let i = 0; i < this.mapHandles.hangingVines.length; i++) {
      const v = this.mapHandles.hangingVines[i];
      v.rotation.z = Math.sin(tNow * 2.0 + i) * 0.12;
    }
    if (this.mapHandles.waveFlower) {
      if (this.waveFlowerTimer > 0) this.waveFlowerTimer = Math.max(0, this.waveFlowerTimer - uiDt);
      const wfScale = this.waveFlowerTimer > 0 ? 1.45 : 1.0;
      this.mapHandles.waveFlower.scale.setScalar(wfScale);
    }

    // Volcano popping lava bubbles
    for (let i = 0; i < this.mapHandles.lavaBubbles.length; i++) {
      const b = this.mapHandles.lavaBubbles[i];
      const cyc = ((tNow * 0.9 + i * 0.25) % 1);
      b.scale.setScalar(0.15 + cyc * 0.35);
      b.position.y = 0.08 + Math.sin(cyc * Math.PI) * 0.16;
    }

    // Frosty Allotment hopping robins
    for (let i = 0; i < this.mapHandles.robins.length; i++) {
      const r = this.mapHandles.robins[i];
      r.position.y = 1.38 + Math.abs(Math.sin(tNow * 4 + i * 1.3)) * 0.22;
    }

    const pollenOpen = this.weather.currentWeather === 'pollen_bloom' ? 1.35 : 1.0;
    for (const fl of this.mapHandles.pollenFlowers) {
      fl.scale.set(0.8 * pollenOpen, 0.45 * pollenOpen, 0.8 * pollenOpen);
    }

    if (this.mapHandles.bridgeLanterns.length > 0) {
      const anyNearBridge = this.enemies.some((e) => !e.isDead && e.position.x > -1 && e.position.x < 8);
      for (let i = 0; i < this.mapHandles.bridgeLanterns.length; i++) {
        const mat = this.mapHandles.bridgeLanterns[i].material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = anyNearBridge ? 1.5 : 0.15;
      }
    }

    if (this.envWobbleTimer > 0) {
      this.envWobbleTimer = Math.max(0, this.envWobbleTimer - uiDt);
      const wAmp = (this.envWobbleTimer / 0.45) * 0.14 * Math.sin(this.envWobbleTimer * 40);
      for (const prop of this.mapHandles.wobbleProps) {
        if (prop.position.distanceToSquared(this.envWobblePos) < 100) {
          prop.rotation.z = wAmp;
        }
      }
    }

    for (const bf of this.mapHandles.birdsButterflies) {
      if (bf.userData.scatterTimer > 0) {
        bf.userData.scatterTimer = Math.max(0, bf.userData.scatterTimer - uiDt);
        bf.position.y += uiDt * 3.5;
        bf.position.x += uiDt * 2.5;
      } else {
        const t = tNow + bf.userData.homeX;
        bf.position.x += (bf.userData.homeX + Math.sin(t) * 2.4 - bf.position.x) * uiDt * 1.5;
        bf.position.z += (bf.userData.homeZ + Math.cos(t * 0.8) * 2.4 - bf.position.z) * uiDt * 1.5;
        bf.position.y += (2.5 + Math.sin(t * 3) * 0.35 - bf.position.y) * uiDt * 2.5;
      }
    }

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
    this.matchElapsedSec += simDt;

    if (this.multiKillWindow > 0) {
      this.multiKillWindow -= uiDt;
      if (this.multiKillWindow <= 0) this.multiKillCount = 0;
    }

    if (this.blizzardTimer > 0) {
      this.blizzardTimer = Math.max(0, this.blizzardTimer - simDt);
    }

    // Animate selling towers ("Return to Soil" 0.6 s)
    for (let i = this.sellingTowers.length - 1; i >= 0; i--) {
      const st = this.sellingTowers[i];
      st.anim.update(st.rig, st.def.id, st.position.x, st.position.z, 0, simDt, uiDt, false, false, 0);
      if (st.anim.sellFinished) {
        st.destroy();
        this.sellingTowers.splice(i, 1);
      }
    }

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

    // Volcano Meteors
    if (this.mapDef.hasMeteorHazards && this.waveActive) {
      this.meteorSpawnTimer -= simDt;
      if (this.meteorSpawnTimer <= 0 && this.towers.length > 0) {
        this.meteorSpawnTimer = 11.0;
        const victim = this.towers[Math.floor(Math.random() * this.towers.length)];
        this.meteorHazards.push({ x: victim.position.x, z: victim.position.z, timer: 1.5 });
        this.vfx.spawnTelegraph(victim.position.x, victim.position.z, 2.2, 1.5);
      }
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

    // Update Poison Clouds (Puffball Mushroom §7)
    for (let i = this.poisonClouds.length - 1; i >= 0; i--) {
      const c = this.poisonClouds[i];
      c.remaining -= simDt;
      if (c.remaining <= 0) {
        this.poisonClouds.splice(i, 1);
        continue;
      }
      if (c.tracksEnemies) {
        const nearest = this.enemies.find((e) => !e.isDead && Math.hypot(e.position.x - c.x, e.position.z - c.z) <= 5);
        if (nearest) {
          c.x += (nearest.position.x - c.x) * simDt * 0.9;
          c.z += (nearest.position.z - c.z) * simDt * 0.9;
        }
      }
      c.tickTimer -= simDt;
      if (c.tickTimer <= 0) {
        c.tickTimer = 0.5;
        this.vfx.spawnRecipe('poison_cloud', c.x, 0.35, c.z);
        for (const e of this.enemies) {
          if (e.isDead || e.reachedGoal) continue;
          if (Math.hypot(e.position.x - c.x, e.position.z - c.z) <= c.radius) {
            e.applyPoison(c.dps);
            const syn = this.synergy.tryTrigger(e, 'poison', c.dps, 1 + c.sourceTower.comboDmgBonus, this.enemies);
            if (syn && syn.synergy.id === 'toxic_blaze') {
              const res = e.applyDamage(syn.bonusDamage, { element: 'burn', sourceTowerId: c.sourceTower.id });
              this.handleDamageCredit(c.sourceTower, res.hpDamage, e);
              c.remaining = 0; // Toxic Blaze clears cloud (§7.2)
            }
          }
        }
      }
    }

    // Weather Update (Thunderstorm bolts)
    this.weather.update(simDt, this.enemies);

    // Support Buffs, Blizzard Penalty, Crit Aura & Stun Immunity Aura
    for (const t of this.towers) {
      t.buffDmg = 0;
      t.buffCd = 0;
      t.buffRange = 0;
      t.buffCrit = 0;
      t.stunImmuneAura = false;
      t.blizzardRangePenalty = this.blizzardTimer > 0 && t.def.id !== 'ghost_pepper' ? 0.1 : 0;
    }
    for (const src of this.towers) {
      if (src.stunnedTimer > 0) continue;
      if (src.def.id === 'ghost_pepper' && this.blizzardTimer > 0) {
        for (const ally of this.towers) {
          if (Math.hypot(ally.position.x - src.position.x, ally.position.z - src.position.z) <= 5.5) {
            ally.blizzardRangePenalty = 0; // Fire towers melt snow around them (§10.1)
          }
        }
      }
      if (src.def.isSupport) {
        const rng = src.getEffectiveRange();
        const cdBuff = src.def.levels[src.level].buffCd;
        const rngBuff = src.def.levels[src.level].buffRange;
        const critBuff = src.def.levels[src.level].buffCrit;
        for (const ally of this.towers) {
          if (ally === src) continue;
          if (Math.hypot(ally.position.x - src.position.x, ally.position.z - src.position.z) <= rng) {
            ally.buffCd = Math.max(ally.buffCd, cdBuff);
            ally.buffRange = Math.max(ally.buffRange, rngBuff);
            ally.buffCrit = Math.max(ally.buffCrit, critBuff);
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

    const weatherDef = this.weather.activeDef;
    const weatherRangeMult = weatherDef?.rangeMult ?? 1.0;
    const weatherCritBonus = weatherDef?.critBonus ?? 0;
    const weatherFireMult = weatherDef?.fireMult ?? 1.0;
    const weatherIceMult = (weatherDef?.iceMult ?? 1.0) * (weatherDef?.chillDurationMult ?? 1.0);
    const weatherFarmMult = weatherDef?.farmMult ?? 1.0;
    const weatherArcaneBonus = weatherDef?.arcaneBonusChains ?? 0;
    const weatherDrift = weatherDef?.projectileDrift ?? 0;
    const nowTime = performance.now() * 0.001;

    for (const t of this.towers) {
      if (t.stunnedTimer > 0) t.stunnedTimer = Math.max(0, t.stunnedTimer - simDt);
      if (t.overdriveBuffTimer > 0) t.overdriveBuffTimer = Math.max(0, t.overdriveBuffTimer - simDt);
      if (t.chronoApmBuffTimer > 0) t.chronoApmBuffTimer = Math.max(0, t.chronoApmBuffTimer - simDt);
      if (t.solarFlareTimer > 0) t.solarFlareTimer = Math.max(0, t.solarFlareTimer - simDt);
      if (t.gnawedTimer > 0) t.gnawedTimer = Math.max(0, t.gnawedTimer - simDt);
      if (t.frostSlowTimer > 0) t.frostSlowTimer = Math.max(0, t.frostSlowTimer - simDt);
      if (t.abilityCooldownRemaining > 0) t.abilityCooldownRemaining = Math.max(0, t.abilityCooldownRemaining - simDt);

      if (t.def.isFarm && this.waveActive && t.stunnedTimer <= 0) {
        t.farmMidWaveTimer -= simDt;
        if (t.farmMidWaveTimer <= 0) {
          t.farmMidWaveTimer = 12.0;
          const midCash = Math.round(t.getFarmPayout(weatherFarmMult) * 0.35);
          this.spawnCashBurst(t.position.x, t.position.y, t.position.z, midCash);
        }
      }

      const canAttackNow = t.anim.placementTimer < 0 || t.anim.placementTimer >= 0.5;
      let target: EnemyEntity | null = null;
      if (canAttackNow && t.stunnedTimer <= 0 && !t.def.isFarm && !t.def.isSupport) {
        target = this.acquireTarget(t, weatherRangeMult);
        if (target) {
          t.anim.aimToward(t.rig, target.position.x, target.position.y, target.position.z, simDt);
        }

        t.cooldownRemaining = Math.max(0, t.cooldownRemaining - simDt);
        if (target && t.cooldownRemaining <= 0) {
          t.hasAttacked = true;
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
          const col = t.def.id === 'sunflower_beacon' ? 0xfde047 : 0x38bdf8;
          this.vfx.spawnShockwave(t.position.x, 0.08, t.position.z, rng, col, 0.55);
          if (t.def.id === 'speed_sprinkler') {
            for (const e of this.enemies) {
              if (!e.isDead && Math.hypot(e.position.x - t.position.x, e.position.z - t.position.z) <= rng) {
                e.wetTimer = Math.max(e.wetTimer, 3.0);
              }
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
        uiDt,
        !!target,
        t.stunnedTimer > 0,
        AdaptiveMusic.currentBeatPulse
      );
    }

    const pondSplash = this.projectiles.update(simDt, this.enemies, this.mapDef.pond.x, this.mapDef.pond.z);
    if (pondSplash > 0) this.waterRippleAge = 0;

    const flyingMult = weatherDef?.flyingSpeedMult ?? 1.0;
    const allWet = weatherDef?.allEnemiesWet ?? false;
    let leadEnemy: EnemyEntity | null = null;
    const camPos = this.engine.cameraRig.camera.position;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.isDead) {
        e.update(simDt, flyingMult, allWet, camPos);
        if (e.deathFinished) {
          e.destroy(this.engine.scene);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      // Check Frosty Allotment frozen pond speed boost (§10.1)
      if (this.mapDef.pond.frozen) {
        const dx = (e.position.x - this.mapDef.pond.x) / this.mapDef.pond.radiusX;
        const dz = (e.position.z - this.mapDef.pond.z) / this.mapDef.pond.radiusZ;
        e.onIcePond = dx * dx + dz * dz <= 1.05;
      } else {
        e.onIcePond = false;
      }

      const { burnTickDmg, bleedTickDmg, poisonTickDmg } = e.update(enemyDt, flyingMult, allWet, camPos);

      // Caterpillar Cocoon hatch into Flying Moth (§8)
      if (e.type === 'caterpillar_cocoon' && e.hatchedToMoth && !e.isDead) {
        this.vfx.spawnRecipe('wing_dust', e.position.x, 0.7, e.position.z);
        this.spawnEnemy('moth_flyer', 0, e.progress);
        e.destroy(this.engine.scene);
        this.enemies.splice(i, 1);
        continue;
      }

      if (burnTickDmg > 0) {
        const res = e.applyDamage(burnTickDmg, { element: 'burn', skipFlash: true });
        this.handleDamageCredit(null, res.hpDamage, e);
      }
      if (!e.isDead && bleedTickDmg > 0) {
        const res = e.applyDamage(bleedTickDmg, { skipFlash: true });
        this.handleDamageCredit(null, res.hpDamage, e);
      }
      if (!e.isDead && poisonTickDmg > 0) {
        const res = e.applyDamage(poisonTickDmg, { element: 'poison', skipFlash: true });
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

    if (this.bossFinaleActive) {
      this.bossFinaleTimer -= uiDt;
      if (this.bossFinaleTimer <= 0) {
        this.bossFinaleActive = false;
        this.engine.postFx.setEnvironmentTint(0xffffff, 0, 0, 0);
      }
    }

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

    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.every((e) => e.isDead)) {
      this.onWaveCleared();
    }

    this.vfx.update(simDt);
    this.vfx.syncStatusIcons(this.enemies, this.engine.cameraRig.camera);
    this.decals.update(simDt);
    this.popups.update(uiDt, this.engine.cameraRig.camera);
    this.grass.update(simDt, leadEnemy?.position.x, leadEnemy?.position.z);
  }

  private acquireTarget(t: TowerEntity, weatherRangeMult: number): EnemyEntity | null {
    const rng = t.getEffectiveRange(weatherRangeMult);
    const rngSq = rng * rng;
    const isGroundAoe =
      t.def.id === 'pineapple_cannon' ||
      t.def.id === 'sonic_bloom' ||
      t.def.id === 'ancient_moss_golem' ||
      t.def.id === 'chrono_bloom' ||
      t.def.id === 'puffball_mushroom';
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
    const ty = t.position.y + 0.85;
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
    } else if (t.def.id === 'bamboo_archer') {
      SynthAudio.play('bamboo');
      this.projectiles.launch({
        kind: 'bamboo_arrow',
        startX: tx,
        startY: ty + 0.3,
        startZ: tz,
        targetEnemy: target,
        targetTower: null,
        fallbackX: target.position.x,
        fallbackZ: target.position.z,
        speed: 26,
        arcHeight: 0.2,
        damage: dmg,
        splashRadius: 0,
        isCrit,
        isExplosive: false,
        isLv5: t.level >= 5,
        canRicochet: false,
        sourceTower: t,
        weatherDrift: w.weatherDrift,
        weatherFireMult: w.weatherFireMult,
        weatherIceMult: w.weatherIceMult,
        weatherArcaneBonus: w.weatherArcaneBonus,
        pierceLeft: 3,
      });
    } else if (t.def.id === 'puffball_mushroom') {
      SynthAudio.play('mushroom');
      this.decals.spawn('poison', target.position.x, target.position.z, 2.4, 4.0);
      this.vfx.spawnRecipe('poison_cloud', target.position.x, 0.4, target.position.z);
      this.poisonClouds.push({
        x: target.position.x,
        z: target.position.z,
        radius: 2.5,
        dps: dmg,
        remaining: 4.0,
        tickTimer: 0.1,
        sourceTower: t,
        tracksEnemies: t.level >= 5,
      });
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
          e.refreshStatusPulse('burn');
          const syn = this.synergy.tryTrigger(e, 'burn', dmg, 1 + t.comboDmgBonus, this.enemies);
          const total = dmg + (syn?.bonusDamage ?? 0);
          const res = e.applyDamage(total, { element: 'burn', reaction: 'burn', isCrit, sourceTowerId: t.id });
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
          const syn = this.synergy.tryTrigger(e, 'knockback', dmg, 1 + t.comboDmgBonus, this.enemies);
          e.applyKnockback(1.2, syn?.knockbackMult ?? 1);
          const res = e.applyDamage(dmg + (syn?.bonusDamage ?? 0), { isCrit, sourceTowerId: t.id });
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
          e.refreshStatusPulse('chill');
          if (triggersFreeze) e.freezeTimer = Math.max(e.freezeTimer, 1.2 * (1 - e.def.chillResist));
          const syn = this.synergy.tryTrigger(e, triggersFreeze ? 'freeze' : 'chill', dmg, 1 + t.comboDmgBonus, this.enemies);
          const total = dmg + (syn?.bonusDamage ?? 0);
          const res = e.applyDamage(total, { element: 'freeze', reaction: 'freeze', isCrit, sourceTowerId: t.id });
          this.handleDamageCredit(t, res.hpDamage, e);
          this.popups.spawnDamage(e.position.x, e.position.y, e.position.z, total, isCrit ? 'crit' : 'freeze', e.id);
        }
      }
    } else if (t.def.id === 'laser_plant') {
      SynthAudio.play('laser');
      const rampStep = t.solarFlareTimer > 0 ? 0.2 : 0.1; // §7.2 Overcharge: 2x ramp speed
      if (t.laserTargetId === target.id) {
        t.laserRampStacks = Math.min(1.5, t.laserRampStacks + rampStep);
      } else {
        t.laserTargetId = target.id;
        t.laserRampStacks = 0;
      }
      const rampedDmg = Math.round(dmg * (1 + t.laserRampStacks));
      this.vfx.spawnBeam(tx, ty, tz, target.position.x, 0.6, target.position.z, 0xf43f5e, 1 + t.laserRampStacks * 0.4, 0.16);
      const syn = this.synergy.tryTrigger(target, 'arcane', rampedDmg, 1 + t.comboDmgBonus, this.enemies);
      const res = target.applyDamage(rampedDmg + (syn?.bonusDamage ?? 0), {
        isBeam: true,
        isCrit,
        element: 'arcane',
        reaction: 'beam',
        sourceTowerId: t.id,
      });
      this.handleDamageCredit(t, res.hpDamage, target);
      this.popups.spawnDamage(target.position.x, target.position.y, target.position.z, res.hpDamage, isCrit ? 'crit' : 'normal', target.id);

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
          const fRes = fork.applyDamage(Math.round(rampedDmg * 0.5), { isBeam: true, element: 'arcane', reaction: 'beam', sourceTowerId: t.id });
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
        const syn = this.synergy.tryTrigger(target, 'heavy', dmg, 1 + t.comboDmgBonus, this.enemies);
        const res = target.applyDamage(dmg + (syn?.bonusDamage ?? 0), { isCrit, sourceTowerId: t.id });
        this.handleDamageCredit(t, res.hpDamage, target);
        this.popups.spawnDamage(target.position.x, target.position.y, target.position.z, res.hpDamage, isCrit ? 'crit' : 'normal', target.id);
      }
      if (t.level >= 5) target.applySlow(2.0, 0.35);
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
    // §8 Termite Gnawer gnaws tower roots within 2 units (-20% attack speed for 5 s)
    if (e.type === 'termite_gnawer' && e.gnawCooldown <= 0) {
      for (const t of this.towers) {
        if (Math.hypot(t.position.x - e.position.x, t.position.z - e.position.z) <= 2.2) {
          e.gnawCooldown = 3.0;
          t.gnawedTimer = Math.max(t.gnawedTimer, 5.0);
          t.anim.termiteGnawFlashTimer = 0.6;
          this.vfx.spawnRecipe('soil_placement_clods', t.position.x, 0.3, t.position.z);
          break;
        }
      }
    }

    // Spore Stunner Wasp
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

    // §9 Map Bosses (all telegraphs >= 1.2 s)
    if (e.def.isBoss && e.staggerTimer <= 0) {
      e.bossSkillTimer -= dt;
      if (e.type === 'treant_overlord') {
        if (e.bossSkillTimer <= 0) {
          e.bossSkillTimer = 9.0;
          this.vfx.spawnTelegraph(e.position.x, e.position.z, 9.0, 1.3);
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
          for (let i = 0; i < 4; i++) this.spawnEnemy('garden_ant', 0, Math.max(0, e.progress - 0.04));
        }
      } else if (e.type === 'vinewyrm_hydra') {
        if (e.bossSkillTimer <= 0 && this.towers.length > 0) {
          e.bossSkillTimer = 8.0;
          const victim = this.towers[Math.floor(Math.random() * this.towers.length)];
          this.vfx.spawnTelegraph(victim.position.x, victim.position.z, 1.6, 1.4);
          this.projectiles.launch({
            kind: 'spore_bomb',
            startX: e.position.x,
            startY: 2.0,
            startZ: e.position.z,
            targetEnemy: null,
            targetTower: victim,
            fallbackX: victim.position.x,
            fallbackZ: victim.position.z,
            speed: 9,
            arcHeight: 2.5,
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
        if (e.bossPhase >= 3) {
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.008 * dt); // Phase 3 head regen
        }
      } else if (e.type === 'magma_beetle_queen') {
        if (e.bossSkillTimer <= 0) {
          e.bossSkillTimer = 8.5;
          this.decals.spawn('lava', e.position.x, e.position.z, 2.2, 6.0);
          this.vfx.spawnRecipe('lava_trail', e.position.x, 0.5, e.position.z);
          if (e.bossPhase >= 2 && this.towers.length > 0) {
            const count = Math.min(3, this.towers.length);
            for (let k = 0; k < count; k++) {
              const victim = this.towers[(Math.floor(Math.random() * this.towers.length) + k) % this.towers.length];
              this.meteorHazards.push({ x: victim.position.x, z: victim.position.z, timer: 1.5 });
              this.vfx.spawnTelegraph(victim.position.x, victim.position.z, 2.2, 1.5);
            }
          }
        }
      } else if (e.type === 'frost_moth_empress') {
        if (e.bossSkillTimer <= 0) {
          e.bossSkillTimer = 9.0;
          this.vfx.spawnTelegraph(e.position.x, e.position.z, 8.0, 1.3);
          this.vfx.spawnShockwave(e.position.x, 0.1, e.position.z, 8.0, 0x38bdf8, 0.7);
          for (const t of this.towers) {
            if (Math.hypot(t.position.x - e.position.x, t.position.z - e.position.z) <= 8.0) {
              t.frostSlowTimer = Math.max(t.frostSlowTimer, 5.0);
            }
          }
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

    // §6.3 Multi-kill Combo tracker (5+ kills within 0.5 s)
    this.multiKillCount++;
    this.multiKillWindow = 0.5;
    if (this.multiKillCount >= 5) {
      this.popups.spawnDamage(
        e.position.x,
        e.position.y + 1.4,
        e.position.z,
        0,
        'crit',
        '',
        `COMBO ×${this.multiKillCount}`
      );
      SynthAudio.playComboChord(this.multiKillCount);
      if (this.multiKillCount === 5) {
        EventBus.emit('match:killfeed', { text: `Multi-kill Combo ×5+!`, color: '#fde047' });
      }
    }

    // Aphid Cluster splits into 4 Mini Aphids (§8)
    if (e.type === 'aphid_cluster') {
      this.vfx.spawnRecipe('poison_cloud', e.position.x, 0.4, e.position.z, 0x84cc16);
      for (let i = 0; i < 4; i++) {
        this.spawnEnemy('aphid_mini', 0, Math.max(0, e.progress - i * 0.012));
      }
    }

    // Elite Splitter
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

    if (e.type === 'garden_ant') {
      this.vfx.spawnRecipe('ant_death_confetti', e.position.x, 0.4, e.position.z);
    } else if (e.type === 'iron_beetle') {
      this.vfx.spawnRecipe('shield_shatter', e.position.x, 0.5, e.position.z);
    } else if (e.type === 'burrowing_mole') {
      this.vfx.spawnRecipe('soil_placement_clods', e.position.x, 0.5, e.position.z);
    } else if (e.type === 'gargantuan_snail') {
      this.vfx.spawnRecipe('frost_shatter', e.position.x, 0.8, e.position.z);
      this.decals.spawn('slime', e.position.x, e.position.z, 2.2, 8);
    } else if (e.def.isBoss) {
      TimeScale.triggerHitStop('boss_kill');
      TimeScale.triggerSlowMo(0.25, 1.2, true);
      this.bossFinaleActive = true;
      this.bossFinaleTimer = 2.4;
      const bossColor =
        e.type === 'vinewyrm_hydra'
          ? 0x4ade80
          : e.type === 'magma_beetle_queen'
            ? 0xf97316
            : e.type === 'frost_moth_empress'
              ? 0x38bdf8
              : 0xc084fc;
      this.vfx.spawnRecipe('boss_core_explosion', e.position.x, 1.6, e.position.z, bossColor);
      this.vfx.spawnShockwave(e.position.x, 0.1, e.position.z, 18, bossColor, 1.0);
      EventBus.emit('camera:zoom_punch', { factor: 0.12, duration: 0.6 });
      EventBus.emit('camera:trauma', { amount: 0.85 });
      EventBus.emit('vfx:screen_flash', { color: '#ffffff', opacity: 0.65, duration: 0.25 });
      EventBus.emit('match:boss_defeated', undefined);
      EventBus.emit('match:killfeed', { text: `${e.def.name} defeated!`, color: '#4ade80' });
      SynthAudio.play('explosion');
    } else if (e.lastHitElement === 'freeze') {
      this.vfx.spawnRecipe('frost_shatter', e.position.x, 0.5, e.position.z);
    } else if (e.lastHitElement === 'burn') {
      this.vfx.spawnRecipe('dissolve_embers', e.position.x, 0.5, e.position.z);
    }

    // §6.3 Last kill of wave: slow-mo + flower bloom ripple down track
    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.every((en) => en.isDead)) {
      TimeScale.triggerSlowMo(0.6, 0.4, false);
      EventBus.emit('camera:zoom_punch', { factor: 0.08, duration: 0.4 });
      if (this.mapHandles) {
        const sp = this.mapHandles.splines[0];
        for (let k = 0; k <= 8; k++) {
          const pt = sp.getPointAt(k / 8);
          this.vfx.spawnRecipe('flower_bloom_ripple', pt.x, 0.2, pt.z);
        }
      }
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
      for (const t of this.towers) t.anim.isWilting = true;
      this.engine.postFx.setEnvironmentTint(0xffffff, 0, 0.78, 0);
      SaveManager.recordLeaderboard(this.mapDef.id, this.difficultyId, Math.max(0, this.currentWave - 1), 0, this.topSingleHit);
      EventBus.emit('match:defeat', { wavesCleared: Math.max(0, this.currentWave - 1) });
    }
  }

  private onWaveCleared(): void {
    this.waveActive = false;
    this.skipBonusAvailable = false;
    this.waveCountdown = 6.0;
    this.waveFlowerTimer = 3.0;

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
    SaveManager.addPlayerXp(25 + this.currentWave * 3);
    SynthAudio.play('coin');
    EventBus.emit('match:wave_cleared', { wave: this.currentWave, bonus: waveBonus + farmTotal });

    if (this.isEndless) {
      if (this.currentWave > SaveManager.data.stats.highestEndlessWave) {
        SaveManager.data.stats.highestEndlessWave = this.currentWave;
      }
      if (this.currentWave >= 50) SaveManager.unlockAchievement('endless_50');

      if (this.currentWave % 10 === 0) {
        const seeds = 120;
        const dewdrops = 2;
        SaveManager.addSeeds(seeds);
        SaveManager.addDewdrops(dewdrops);
        EventBus.emit('match:bloom_chest', { seeds, dewdrops, wave: this.currentWave });
      }
      SaveManager.save();
    } else if (this.currentWave >= this.totalWaves && !this.matchEnded) {
      this.matchEnded = true;
      const diff = DIFFICULTIES[this.difficultyId];
      const seedMult = this.weather.activeDef?.seedsBonusMult ?? 1.0;
      const earnedSeeds = Math.round(diff.clearRewardSeeds * seedMult);

      SaveManager.addSeeds(earnedSeeds);
      SaveManager.addPlayerXp(120 + this.totalWaves * 10);
      SaveManager.data.stats.matchesWon++;
      SaveManager.recordLeaderboard(this.mapDef.id, this.difficultyId, this.currentWave, this.matchElapsedSec, this.topSingleHit);

      if (this.gameMode === 'boss_rush') {
        SaveManager.unlockAchievement('boss_slayer');
      } else if (this.gameMode === 'puzzle' && this.activePuzzleId) {
        const stars = this.baseHp >= this.maxBaseHp ? 3 : this.baseHp >= this.maxBaseHp * 0.5 ? 2 : 1;
        SaveManager.data.puzzleStars[this.activePuzzleId] = Math.max(
          SaveManager.data.puzzleStars[this.activePuzzleId] ?? 0,
          stars
        );
      }

      if (this.difficultyId === 'Hard' || this.difficultyId === 'Insane') {
        EventBus.emit('quest:progress', { type: 'win_hard', amount: 1 });
      }
      if (this.difficultyId === 'Insane') {
        SaveManager.unlockAchievement('beat_insane');
        if (this.mapDef.id === 'volcano_greenhouse') {
          SaveManager.unlockAchievement('volcano_insane');
        }
      }
      SaveManager.save();

      // §14 End Screen MVP Tower Spotlight
      const mvp = [...this.towers].sort((a, b) => b.totalDamageDealt - a.totalDamageDealt)[0];
      if (mvp) {
        this.engine.cameraRig.focusPoint(mvp.position.x, mvp.position.z, 12);
        mvp.anim.scaleSpring.impulse(0, 2.5, 0);
      }

      EventBus.emit('match:victory', {
        mapId: this.mapDef.id,
        difficulty: this.difficultyId,
        seedsEarned: earnedSeeds,
        wavesCleared: this.currentWave,
      });
    }
  }
}
