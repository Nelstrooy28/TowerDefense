import { getUnitById } from '../../src/data/UnitRegistry';
import { TRAITS, type TraitId } from '../../src/data/TraitConfig';
import { VARIANTS, type VariantId } from '../../src/data/BalanceConfig';
import type { SimTeamSlot } from './teams';

export type BotStrategyId = 'greedy_upgrader' | 'spread_placer' | 'farm_first';

export interface SimPlacedTower {
  unitId: string;
  level: number;
  traitDmgMult: number;
  traitCdMult: number;
  traitRangeMult: number;
  upgradeCostMult: number;
  masteryMult: number;
  totalSpent: number;
}

export function getTowerEffectiveDps(
  t: SimPlacedTower,
  supportCdBonus = 1,
  critBonus = 0,
  isBossWave = false
): number {
  const def = getUnitById(t.unitId);
  if (def.isFarm || def.isSupport || def.isWall) return 0;
  const lvl = def.levels[t.level] ?? def.levels[0];

  let multiTargetMult = 1.0;
  if (!isBossWave) {
    if (def.elements.includes('burn') && def.splashRadius >= 2) multiTargetMult = 3.2;
    else if (def.splashRadius >= 6) multiTargetMult = 3.6;
    else if (def.splashRadius >= 3) multiTargetMult = 2.9;
    else if (def.splashRadius >= 1.4) multiTargetMult = 2.1;
    else if (def.isPiercing) multiTargetMult = 2.2;
    else if (def.isBeam && t.level >= 5) multiTargetMult = 1.45;
  }

  let mechanicMult = 1.0;
  if (def.elements.includes('bleed')) mechanicMult *= 1.3;
  if (def.elements.includes('burn')) mechanicMult *= 1.35;
  if (def.isBeam && def.id === 'laser_plant') mechanicMult *= 1.65;
  if (def.isMelee && !isBossWave) mechanicMult *= 1.22;

  const projCount = Math.max(1, lvl.projectiles);
  const rawDps = (lvl.dmg * projCount) / Math.max(0.15, lvl.cd * t.traitCdMult * supportCdBonus);
  return rawDps * t.traitDmgMult * t.masteryMult * multiTargetMult * mechanicMult * (1 + critBonus * 0.75);
}

function makeTower(slot: SimTeamSlot): SimPlacedTower {
  const def = getUnitById(slot.unitId);
  const tr = TRAITS[slot.trait as TraitId];
  const varMult = VARIANTS[(slot.variant ?? 'none') as VariantId]?.statMult ?? 1.0;
  const primeMult = slot.isPrime ? 1.12 : 1.0;
  return {
    unitId: slot.unitId,
    level: 0,
    traitDmgMult: tr.dmgMult,
    traitCdMult: tr.cdMult,
    traitRangeMult: tr.rangeMult,
    upgradeCostMult: tr.upgradeCostMult,
    masteryMult: (1 + slot.masteryLevel * 0.01) * varMult * primeMult,
    totalSpent: def.cost,
  };
}

export function botSpendCash(
  strategy: BotStrategyId,
  cash: number,
  slots: SimTeamSlot[],
  towers: SimPlacedTower[],
  maxTowers: number,
  wave: number
): number {
  let guard = 0;
  while (guard++ < 22) {
    const combatCount = towers.filter(
      (t) => !getUnitById(t.unitId).isFarm && !getUnitById(t.unitId).isSupport
    ).length;
    const farms = towers.filter((t) => getUnitById(t.unitId).isFarm);
    const farmSlot = slots.find((s) => getUnitById(s.unitId).isFarm);

    // 1. Place 1st farm at wave >= 4 after 3 combat towers, 2nd farm at wave >= 9
    if (farmSlot && combatCount >= 3 && wave >= 4) {
      const farmDef = getUnitById(farmSlot.unitId);
      const targetFarms = wave >= 9 ? (strategy === 'farm_first' ? Math.min(3, farmDef.cap) : 2) : 1;
      if (farms.length < targetFarms && towers.length < maxTowers && cash >= farmDef.cost) {
        cash -= farmDef.cost;
        towers.push(makeTower(farmSlot));
        continue;
      }
    }

    // 2. Ensure at least 1 support tower once >= 4 attackers exist
    const supportCount = towers.filter((t) => getUnitById(t.unitId).isSupport).length;
    const supportSlot = slots.find((s) => getUnitById(s.unitId).isSupport);
    if (supportSlot && combatCount >= 4 && supportCount < 1 && towers.length < maxTowers) {
      const supDef = getUnitById(supportSlot.unitId);
      if (cash >= supDef.cost) {
        cash -= supDef.cost;
        towers.push(makeTower(supportSlot));
        continue;
      }
    }

    // 2b. Save briefly for an unplaced high-tier carry once early defense stabilizes
    const avgLvl = combatCount > 0 ? towers.reduce((s, t) => s + t.level, 0) / towers.length : 0;
    if (wave >= 8 && combatCount >= 4) {
      const nextBigCarry = slots
        .map((s) => ({ s, def: getUnitById(s.unitId) }))
        .filter(({ s, def }) => {
          const placed = towers.filter((t) => t.unitId === s.unitId).length;
          return (
            !def.isFarm &&
            !def.isSupport &&
            def.cost >= 1100 &&
            (def.cost < 3000 || (wave >= 16 && avgLvl >= 1.8)) &&
            placed === 0
          );
        })
        .sort((a, b) => a.def.cost - b.def.cost)[0];
      if (nextBigCarry) {
        if (cash >= nextBigCarry.def.cost) {
          cash -= nextBigCarry.def.cost;
          towers.push(makeTower(nextBigCarry.s));
          continue;
        }
        if (cash >= nextBigCarry.def.cost * 0.72) break;
      }
    }

    const desiredCount =
      strategy === 'greedy_upgrader'
        ? Math.min(maxTowers, Math.max(4, 3 + Math.floor(wave * 0.42)))
        : Math.min(maxTowers, Math.max(4, Math.floor(3 + wave * 0.48)));

    const candidates = slots
      .map((s) => ({ s, def: getUnitById(s.unitId) }))
      .filter(({ s, def }) => {
        const placedOfType = towers.filter((t) => t.unitId === s.unitId).length;
        return placedOfType < def.cap && cash >= def.cost && !def.isFarm;
      })
      .sort((a, b) => (combatCount < 3 ? a.def.cost - b.def.cost : b.def.cost - a.def.cost));

    const cheapestNewCost =
      candidates.length > 0 ? Math.min(...candidates.map((c) => c.def.cost)) : Infinity;

    // 3. Upgrade highest-impact units first (prefer high base-cost carries & lower level first)
    const upgradeOrder = [...towers]
      .filter((t) => t.level < 5)
      .sort((a, b) => {
        const costA = getUnitById(a.unitId).cost;
        const costB = getUnitById(b.unitId).cost;
        if (strategy === 'greedy_upgrader') {
          if (a.level !== b.level) return a.level - b.level;
          return costB - costA;
        }
        if (a.level !== b.level) return a.level - b.level;
        return costB - costA;
      });

    let upgraded = false;
    for (const t of upgradeOrder) {
      const def = getUnitById(t.unitId);
      const nextCost = Math.round(def.levels[t.level + 1].upgradeCost * t.upgradeCostMult);
      if (cash >= nextCost && (wave >= 12 || nextCost <= 1.2 * cheapestNewCost || towers.length >= desiredCount || combatCount >= 4)) {
        cash -= nextCost;
        t.level++;
        t.totalSpent += nextCost;
        upgraded = true;
        break;
      }
    }
    if (upgraded) continue;

    // 4. Place another unit
    if (towers.length < desiredCount && candidates.length > 0) {
      const pick = candidates[0];
      cash -= pick.def.cost;
      towers.push(makeTower(pick.s));
      continue;
    }

    // 5. Fallback upgrade any affordable tower
    let upgradedFallback = false;
    for (const t of upgradeOrder) {
      const def = getUnitById(t.unitId);
      const nextCost = Math.round(def.levels[t.level + 1].upgradeCost * t.upgradeCostMult);
      if (cash >= nextCost) {
        cash -= nextCost;
        t.level++;
        t.totalSpent += nextCost;
        upgradedFallback = true;
        break;
      }
    }
    if (upgradedFallback) continue;

    break;
  }
  return cash;
}
