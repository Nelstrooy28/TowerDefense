import type { MapId } from '../../src/data/MapRegistry';
import type { DifficultyId } from '../../src/data/BalanceConfig';
import { simulateMatch } from './sim';
import { TEST_TEAMS, type SimTeamPreset } from './teams';
import type { BotStrategyId } from './bots';

interface BenchmarkSpec {
  mapId: MapId;
  diff: DifficultyId;
  team: SimTeamPreset['id'];
  bot: BotStrategyId;
  minWinPct: number;
}

const BENCHMARKS: BenchmarkSpec[] = [
  { mapId: 'sunny_backyard', diff: 'Easy', team: 'starter', bot: 'spread_placer', minWinPct: 80 },
  { mapId: 'sunny_backyard', diff: 'Normal', team: 'starter_leg', bot: 'farm_first', minWinPct: 75 },
  { mapId: 'enchanted_jungle', diff: 'Normal', team: 'mid', bot: 'farm_first', minWinPct: 70 },
  { mapId: 'volcano_greenhouse', diff: 'Hard', team: 'mid', bot: 'farm_first', minWinPct: 50 },
  { mapId: 'enchanted_jungle', diff: 'Insane', team: 'best', bot: 'farm_first', minWinPct: 60 },
  { mapId: 'zen_garden', diff: 'Insane', team: 'best', bot: 'farm_first', minWinPct: 50 },
  { mapId: 'pond_isle', diff: 'Nightmare', team: 'best', bot: 'farm_first', minWinPct: 40 },
];

export function runBalanceSuite(): number {
  const TRIALS = 10;
  let allPassed = true;

  console.log('\n=== Garden Bastion TD v4 Balance Suite ===');
  console.log('map                | diff       | team         | win%  | avgWave | bossSec | cash@20');
  console.log('-------------------+------------+--------------+-------+---------+---------+--------');

  for (const b of BENCHMARKS) {
    let wins = 0;
    let sumWave = 0;
    let sumBoss = 0;
    let sumCash20 = 0;

    for (let t = 1; t <= TRIALS; t++) {
      const res = simulateMatch(b.mapId, b.diff, TEST_TEAMS[b.team], b.bot, t);
      if (res.won) wins++;
      sumWave += res.wavesCleared;
      sumBoss += res.bossFightSec;
      sumCash20 += res.cashAtWave20;
    }

    const winPct = Math.round((wins / TRIALS) * 100);
    const avgWave = (sumWave / TRIALS).toFixed(1);
    const avgBoss = Math.round(sumBoss / TRIALS);
    const avgCash = `$${(sumCash20 / TRIALS / 1000).toFixed(1)}k`;
    const ok = winPct >= b.minWinPct;
    if (!ok) allPassed = false;

    console.log(
      `${b.mapId.padEnd(18)} | ${b.diff.padEnd(10)} | ${b.team.padEnd(12)} | ${`${winPct}%`.padStart(4)}  | ${avgWave.padStart(7)} | ${`${avgBoss}s`.padStart(7)} | ${avgCash.padStart(6)} ${ok ? 'OK' : `FAIL (<${b.minWinPct}%)`}`
    );
  }

  console.log('');
  return allPassed ? 0 : 1;
}
