import { MAPS, type MapId } from '../../src/data/MapRegistry';
import { ENEMIES, computeScaledEnemyHP } from '../../src/data/EnemyRegistry';
import { getUnitById } from '../../src/data/UnitRegistry';
import { DIFFICULTY_LADDER, ECONOMY_CONFIG, type DifficultyId } from '../../src/data/BalanceConfig';
import { getAuthoredWave } from '../../src/data/waves/WaveDefinitions';
import { botSpendCash, getTowerEffectiveDps, type BotStrategyId, type SimPlacedTower } from './bots';
import type { SimTeamPreset } from './teams';

export interface SimMatchResult {
  won: boolean;
  wavesCleared: number;
  bossFightSec: number;
  cashAtWave20: number;
  totalCashEarned: number;
  maxWaveSpikeRatio: number;
}

function estimatePathLength(mapId: MapId): number {
  const pts = MAPS[mapId].paths[0];
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return Math.max(52, len);
}

export function simulateMatch(
  mapId: MapId,
  difficultyId: DifficultyId,
  team: SimTeamPreset,
  strategy: BotStrategyId = 'spread_placer',
  seed = 1
): SimMatchResult {
  const diff = DIFFICULTY_LADDER[difficultyId];
  const map = MAPS[mapId];
  const pathLen = estimatePathLength(mapId);

  let cash = diff.startingCash;
  let totalCashEarned = diff.startingCash;
  let baseHp = diff.baseHP;
  const towers: SimPlacedTower[] = [];
  let cashAtWave20 = 0;
  let bossFightSec = 0;
  let wavesCleared = 0;
  let prevWaveHp = 0;
  let maxWaveSpikeRatio = 1;

  for (let w = 1; w <= diff.waves; w++) {
    cash = botSpendCash(strategy, cash, team.slots, towers, ECONOMY_CONFIG.globalTowerCap, w);

    const hasSupport = towers.some((t) => getUnitById(t.unitId).isSupport);
    const supportCdBonus = hasSupport ? 0.78 : 1.0;
    const critBonus = towers.some((t) => t.unitId === 'sunflower_beacon') ? 0.14 : 0.05;
    const hasChill = towers.some((t) => getUnitById(t.unitId).elements.includes('chill'));
    const hasKnockback = towers.some((t) => getUnitById(t.unitId).elements.includes('knockback'));
    const hasChrono = towers.some((t) => t.unitId === 'chrono_bloom');
    const hasSynergy =
      towers.some((t) => getUnitById(t.unitId).elements.includes('burn')) && hasChill;

    let mobDps = 0;
    let bossDps = 0;
    let avgRange = 0;
    let combatTowers = 0;
    for (const t of towers) {
      const mDps = getTowerEffectiveDps(t, supportCdBonus, critBonus, false);
      const bDps = getTowerEffectiveDps(t, supportCdBonus, critBonus, true);
      if (mDps > 0) {
        mobDps += mDps;
        bossDps += bDps;
        avgRange += getUnitById(t.unitId).levels[t.level].range * t.traitRangeMult;
        combatTowers++;
      }
    }
    if (hasSynergy) {
      mobDps *= 1.32;
      bossDps *= 1.18;
    }
    const lv4PlusCount = towers.filter((t) => t.level >= 4 && getUnitById(t.unitId).ability).length;
    if (lv4PlusCount > 0) {
      const abilityMult = 1 + Math.min(0.45, lv4PlusCount * 0.14);
      mobDps *= abilityMult;
      bossDps *= 1 + Math.min(0.35, lv4PlusCount * 0.11);
    }

    const effectiveRange = combatTowers > 0 ? avgRange / combatTowers : 10;
    const coverageFraction = Math.min(1.0, (combatTowers >= 2 ? 0.56 : 0.42) + effectiveRange / pathLen);

    const controlSlowMult =
      (hasChill ? 1.42 : 1.0) * (hasKnockback ? 1.15 : 1.0) * (hasChrono ? 1.42 : 1.0);

    const authored = getAuthoredWave(mapId, difficultyId, w, diff.waves, false);
    const mobs: Array<{ hp: number; speed: number; dmg: number }> = [];
    let spawnDurationSec = 0;
    for (const grp of authored.groups) {
      const def = ENEMIES[grp.e];
      const hp = computeScaledEnemyHP(def.baseHP, w, diff.enemyHpMult) * (grp.hpMult ?? 1);
      spawnDurationSec = Math.max(spawnDurationSec, (grp.delay ?? 0) + grp.count * grp.gap);
      for (let c = 0; c < grp.count; c++) {
        mobs.push({
          hp,
          speed: def.speed * diff.enemySpeedMult,
          dmg: def.baseDamage,
        });
      }
    }

    let mobTotalHp = 0;
    let avgMobSpeed = 0;
    for (const m of mobs) {
      mobTotalHp += m.hp;
      avgMobSpeed += m.speed;
    }
    avgMobSpeed = mobs.length > 0 ? avgMobSpeed / mobs.length : 3.0;

    const jitter = 0.88 + ((Math.sin(seed * 97 + w * 13) + 1) * 0.5) * 0.24;
    const avgWalkTimeSec = ((pathLen * coverageFraction) / Math.max(0.5, avgMobSpeed)) * controlSlowMult;
    const mobEngagementSec = Math.max(10, spawnDurationSec * 0.85 + avgWalkTimeSec);
    const mobDamageBudget = mobDps * mobEngagementSec * jitter;

    let waveTotalHp = mobTotalHp;
    let waveDamageDone = Math.min(mobTotalHp, mobDamageBudget);
    let waveKills = mobTotalHp > 0 ? Math.floor(mobs.length * Math.min(1, mobDamageBudget / mobTotalHp)) : 0;

    if (mobDamageBudget < mobTotalHp) {
      let remDmg = mobDamageBudget;
      for (const m of mobs) {
        if (remDmg >= m.hp) {
          remDmg -= m.hp;
        } else {
          baseHp -= m.dmg;
        }
      }
    }

    if (w === diff.waves) {
      const bossDef = ENEMIES[map.bossId];
      const bossHp = computeScaledEnemyHP(bossDef.baseHP, w, diff.enemyHpMult);
      waveTotalHp += bossHp;
      const bossWalkTimeSec =
        ((pathLen * coverageFraction) / Math.max(0.45, bossDef.speed * diff.enemySpeedMult)) * controlSlowMult;
      bossFightSec = Math.min(120, Math.round(bossHp / Math.max(1, bossDps)));
      const bossDamageBudget = bossDps * bossWalkTimeSec * jitter;
      if (bossDamageBudget >= bossHp) {
        waveDamageDone += bossHp;
        waveKills++;
      } else {
        waveDamageDone += bossDamageBudget;
        baseHp -= bossDef.baseDamage;
      }
    }

    if (prevWaveHp > 0 && w < diff.waves) {
      maxWaveSpikeRatio = Math.max(maxWaveSpikeRatio, waveTotalHp / prevWaveHp);
    }
    prevWaveHp = waveTotalHp;

    if (baseHp <= 0) {
      return {
        won: false,
        wavesCleared: w - 1,
        bossFightSec,
        cashAtWave20,
        totalCashEarned,
        maxWaveSpikeRatio,
      };
    }

    const dmgCash = Math.floor(waveDamageDone / ECONOMY_CONFIG.damageCashDivisor);
    const killCash = waveKills * ECONOMY_CONFIG.computeKillBounty(65);
    const waveBonus = ECONOMY_CONFIG.waveBonus(w);

    let farmCash = 0;
    for (const t of towers) {
      const def = getUnitById(t.unitId);
      if (def.isFarm) farmCash += def.levels[t.level].farmPayout;
    }
    const combatIncome = dmgCash + killCash + waveBonus;
    const farmCap = (combatIncome * ECONOMY_CONFIG.farmWaveShareCap) / (1 - ECONOMY_CONFIG.farmWaveShareCap);
    const cappedFarm = farmCash <= farmCap ? farmCash : farmCap + (farmCash - farmCap) * ECONOMY_CONFIG.farmPostCapMult;

    const gained = Math.round(combatIncome + cappedFarm);
    cash += gained;
    totalCashEarned += gained;
    wavesCleared = w;

    if (w === 20) cashAtWave20 = totalCashEarned;
  }

  return {
    won: true,
    wavesCleared,
    bossFightSec,
    cashAtWave20: cashAtWave20 || totalCashEarned,
    totalCashEarned,
    maxWaveSpikeRatio,
  };
}
