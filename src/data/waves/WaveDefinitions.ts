import type { EnemyTypeId } from '../EnemyRegistry';
import type { MapId } from '../MapRegistry';
import type { DifficultyId } from '../BalanceConfig';

export type WaveTag =
  | 'WARMUP'
  | 'FAST'
  | 'ARMOR'
  | 'AIR'
  | 'BURROW'
  | 'SWARM'
  | 'BREATHER'
  | 'MINI-BOSS'
  | 'BOSS';

export interface WaveGroupDef {
  e: EnemyTypeId;
  count: number;
  gap: number;
  delay?: number;
  lane?: number;
  hpMult?: number;
}

export interface AuthoredWaveDef {
  n: number;
  groups: WaveGroupDef[];
  tag?: WaveTag;
  tip?: string;
}

function unlockScaleOffset(diff: DifficultyId): number {
  if (diff === 'Easy') return 1;
  if (diff === 'Normal') return 0;
  if (diff === 'Hard') return -1;
  if (diff === 'Insane') return -2;
  return -2;
}

const SUNNY_BACKYARD_TIPS: Record<number, string> = {
  3: 'Fast Aphid Clusters split into speedy babies — splash damage cleans them up!',
  6: 'Pocket Mice steal cash instead of HP — stop them with Walnut Walls or Bramble Snares!',
  8: 'Iron-Shell Beetles resist bullets — place Pineapple Cannon to crack armor!',
  11: 'Burrowing Moles dig underground — bombs, moss slams, or Puffball spores hit them!',
  15: 'Flying Spore Wasps glide above ground traps — deploy Bamboo Archer or Cactus!',
};

/**
 * Authored wave generator adhering to Doc 02 §4.1–§4.4:
 * - 5-wave rhythm: Warm-up -> Build -> Test -> Breather -> Peak
 * - Caps simultaneous pest archetypes to 2–4 curated groups per wave so spikes stay <= 1.6×
 */
export function getAuthoredWave(
  mapId: MapId,
  difficultyId: DifficultyId,
  wave: number,
  totalWaves: number,
  isEndless = false
): AuthoredWaveDef {
  const offset = unlockScaleOffset(difficultyId);
  const blockIdx = (wave - 1) % 5; // 0: Warm-up, 1: Build, 2: Test, 3: Breather, 4: Peak
  const countFactor =
    blockIdx === 3
      ? 0.65
      : blockIdx === 4
        ? 1.18
        : 0.92 + blockIdx * 0.08;

  const mapCountMult = mapId === 'volcano_greenhouse' ? 0.56 : 1.0;
  const mapHpMult = mapId === 'volcano_greenhouse' ? 1.0 : 1.0;

  const isFinalBoss = !isEndless && wave === totalWaves;
  const isMiniBoss = wave % 10 === 0 && !isFinalBoss;

  let tag: WaveTag =
    blockIdx === 0
      ? 'WARMUP'
      : blockIdx === 3
        ? 'BREATHER'
        : blockIdx === 4
          ? isMiniBoss
            ? 'MINI-BOSS'
            : 'SWARM'
          : 'FAST';

  const groups: WaveGroupDef[] = [];
  const primaryCount = Math.max(
    5,
    Math.round(Math.min(34, 7 + wave * 1.1) * countFactor * mapCountMult)
  );
  const gap = Math.max(0.22, 0.58 - wave * 0.008);

  const primaryLane =
    mapId === 'enchanted_jungle'
      ? Math.floor((wave - 1) / 5) % 2
      : mapId === 'zen_garden'
        ? Math.floor((wave - 1) / 10) % 2
        : undefined;

  if (mapId === 'enchanted_jungle' && blockIdx !== 3) {
    const laneA = Math.max(3, Math.round(primaryCount * 0.7));
    const laneB = Math.max(1, primaryCount - laneA);
    groups.push({ e: 'garden_ant', count: laneA, gap, lane: primaryLane, hpMult: mapHpMult });
    groups.push({
      e: 'garden_ant',
      count: laneB,
      gap: gap * 1.1,
      delay: 1.8,
      lane: primaryLane === 0 ? 1 : 0,
      hpMult: mapHpMult,
    });
  } else {
    groups.push({ e: 'garden_ant', count: primaryCount, gap, lane: primaryLane, hpMult: mapHpMult });
  }

  const wUnlock = (normalWave: number) => Math.max(2, normalWave + offset);
  const fastBonus = mapId === 'frosty_allotment' ? 1.3 : 1.0;
  const airBonus = mapId === 'pond_isle' ? 1.35 : 1.0;

  // Build curated secondary + specialist groups rather than stacking all 11 types simultaneously
  const pool: EnemyTypeId[] = [];
  if (wave >= wUnlock(3)) pool.push('aphid_cluster');
  if (wave >= wUnlock(4)) pool.push('sprinter_mantis');
  if (wave >= wUnlock(6)) pool.push('pocket_mouse');
  if (wave >= wUnlock(7)) pool.push('iron_beetle');
  if (wave >= wUnlock(9)) pool.push('caterpillar_cocoon');
  if (wave >= wUnlock(11)) pool.push('burrowing_mole');
  if (wave >= wUnlock(13) && difficultyId !== 'Easy') pool.push('termite_gnawer');
  if (wave >= wUnlock(15) || (mapId === 'pond_isle' && wave >= wUnlock(11))) pool.push('spore_wasp');
  if (wave >= wUnlock(17) && difficultyId !== 'Easy') pool.push('glow_moth');
  if (wave >= wUnlock(18) && difficultyId !== 'Easy') pool.push('locust_swarm');
  if (wave >= wUnlock(22) && difficultyId !== 'Easy') pool.push('ember_fly');

  // Always spotlight the newest unlocked bug on its intro wave, otherwise rotate 2 specialists per wave
  const maxSpecialists = blockIdx === 3 ? 1 : blockIdx === 4 ? 3 : 2;
  const chosen: EnemyTypeId[] = [];
  if (pool.length > 0) {
    const newest = pool[pool.length - 1];
    chosen.push(newest);
    for (let s = 1; s < maxSpecialists && pool.length > chosen.length; s++) {
      const rotIdx = (wave * 3 + s * 5) % pool.length;
      const cand = pool[rotIdx];
      if (!chosen.includes(cand)) chosen.push(cand);
    }
  }

  chosen.forEach((eid, i) => {
    const isAir = eid === 'spore_wasp' || eid === 'glow_moth' || eid === 'ember_fly';
    const isFast = eid === 'sprinter_mantis' || eid === 'aphid_cluster' || eid === 'pocket_mouse';
    const baseCnt =
      eid === 'locust_swarm'
        ? Math.max(1, Math.floor(1 + (wave - 16) * 0.12))
        : eid === 'glow_moth' || eid === 'ember_fly'
          ? Math.max(1, Math.floor(1 + (wave - 15) * 0.18))
          : eid === 'iron_beetle' || eid === 'burrowing_mole' || eid === 'termite_gnawer'
            ? Math.max(2, Math.round((2 + wave * 0.22) * countFactor * mapCountMult))
            : Math.max(2, Math.round((2 + wave * 0.35) * countFactor * mapCountMult * (isFast ? fastBonus : 1) * (isAir ? airBonus : 1)));

    groups.push({
      e: eid,
      count: Math.min(18, baseCnt),
      gap: isFast ? 0.48 : 0.85,
      delay: 2.0 + i * 2.2,
      lane: isAir && mapId === 'pond_isle' ? 1 : primaryLane,
      hpMult: mapHpMult,
    });

    if (blockIdx === 2) {
      if (eid === 'iron_beetle') tag = 'ARMOR';
      else if (eid === 'burrowing_mole') tag = 'BURROW';
      else if (isAir) tag = 'AIR';
      else if (isFast) tag = 'FAST';
    }
  });

  if (isMiniBoss) {
    tag = 'MINI-BOSS';
    groups.push({
      e: 'gargantuan_snail',
      count: Math.max(1, Math.floor(wave / 18)),
      gap: 2.5,
      delay: 2.5,
      lane: 0,
      hpMult: mapHpMult,
    });
  }

  if (isFinalBoss || (isEndless && wave % 20 === 0)) {
    tag = 'BOSS';
  }

  const tip =
    mapId === 'sunny_backyard'
      ? SUNNY_BACKYARD_TIPS[wave]
      : mapId === 'zen_garden' && wave > 1 && wave % 10 === 1
        ? 'The Red Bridge rotated — routes swapped!'
        : undefined;

  return { n: wave, groups, tag, tip };
}
