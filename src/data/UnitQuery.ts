import {
  getUnitById,
  getUnitRoleCategory,
  UNITS,
  type ElementTag,
  type TerrainTag,
  type UnitDef,
  type UnitRoleCategory,
} from '../data/UnitRegistry';
import { RARITIES, RARITY_ORDER, type RarityId } from '../data/RarityConfig';
import { TRAITS } from '../data/TraitConfig';
import { VARIANTS } from '../data/BalanceConfig';
import type { OwnedUnitData } from '../core/SaveManager';

export type UnitSortKey = 'rarity' | 'power' | 'cost' | 'mastery' | 'name' | 'newest';

export interface UnitFilterOpts {
  search: string;
  rarity: RarityId | 'All';
  role: UnitRoleCategory | 'All';
  terrain: TerrainTag | 'All';
  element: ElementTag | 'All';
  ownedOnly: boolean;
  favoritesOnly: boolean;
}

const RARITY_FACTOR: Record<RarityId, number> = {
  Common: 1.0,
  Uncommon: 1.2,
  Rare: 1.45,
  Legendary: 1.85,
  Mythical: 2.3,
  Godly: 2.9,
  Exclusive: 3.4,
};

export function computeUnitPower(unit: UnitDef, owned?: OwnedUnitData): number {
  const lv5 = unit.levels[5];
  const baseDps = lv5.cd > 0 ? (lv5.dmg * Math.max(1, lv5.projectiles)) / lv5.cd : unit.isFarm ? 450 : 520;
  const rFactor = RARITY_FACTOR[unit.rarity];
  if (!owned) return Math.round(baseDps * rFactor);
  const tr = TRAITS[owned.trait];
  const vMult = VARIANTS[owned.variant ?? 'none']?.statMult ?? 1.0;
  const pMult = owned.isPrime ? 1.12 : 1.0;
  const mMult = 1 + owned.masteryLevel * 0.01 + owned.fusedStacks * 0.05;
  return Math.round(baseDps * rFactor * (tr.dmgMult / tr.cdMult) * vMult * pMult * mMult);
}

export function computeTeamPower(
  slots: Array<string | null>,
  ownedMap: Record<string, OwnedUnitData>
): { power: number; warnings: string[] } {
  let sum = 0;
  let hasAntiAir = false;
  let hasGroundAoe = false;
  let hasFarm = false;
  let supportCount = 0;

  for (const id of slots) {
    if (!id) continue;
    const def = getUnitById(id);
    const owned = ownedMap[id];
    const p = computeUnitPower(def, owned);
    sum += def.isFarm ? Math.round(p * 0.4) : p;
    if (def.canHitFlying) hasAntiAir = true;
    if (def.canHitBurrowed || def.splashRadius >= 1.5 || def.isTrap) hasGroundAoe = true;
    if (def.isFarm) hasFarm = true;
    if (def.isSupport) supportCount++;
  }

  const warnings: string[] = [];
  if (!hasAntiAir) warnings.push('⚠ No anti-air unit');
  if (!hasGroundAoe) warnings.push('⚠ No ground AoE for Moles');
  if (!hasFarm) warnings.push('💡 No Farm equipped');
  if (supportCount > 2) warnings.push('⚠ Over 2 support units');

  return { power: sum, warnings };
}

export function queryUnits(
  ownedMap: Record<string, OwnedUnitData>,
  sort: UnitSortKey,
  filter: UnitFilterOpts
): UnitDef[] {
  const q = filter.search.trim().toLowerCase();
  const list = UNITS.filter((u) => {
    const owned = ownedMap[u.id];
    if (filter.ownedOnly && !owned) return false;
    if (filter.favoritesOnly && !owned?.favorite) return false;
    if (filter.rarity !== 'All' && u.rarity !== filter.rarity) return false;
    if (filter.terrain !== 'All' && u.terrain !== filter.terrain) return false;
    if (filter.role !== 'All' && getUnitRoleCategory(u) !== filter.role) return false;
    if (filter.element !== 'All' && !u.elements.includes(filter.element)) return false;
    if (q) {
      const role = getUnitRoleCategory(u).toLowerCase();
      const haystack = `${u.name.toLowerCase()} ${role} ${u.elements.join(' ')} ${u.roleSummary.toLowerCase()}`;
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  list.sort((a, b) => {
    const oa = ownedMap[a.id];
    const ob = ownedMap[b.id];
    if (sort === 'rarity') {
      const d = RARITIES[b.rarity].order - RARITIES[a.rarity].order;
      return d !== 0 ? d : a.index - b.index;
    }
    if (sort === 'power') {
      return computeUnitPower(b, ob) - computeUnitPower(a, oa);
    }
    if (sort === 'cost') return b.cost - a.cost;
    if (sort === 'mastery') return (ob?.masteryLevel ?? -1) - (oa?.masteryLevel ?? -1);
    if (sort === 'newest') return (ob && !ob.seen ? 1 : 0) - (oa && !oa.seen ? 1 : 0) || b.index - a.index;
    return a.name.localeCompare(b.name);
  });

  return list;
}

export const ALL_RARITY_FILTERS: Array<RarityId | 'All'> = ['All', ...RARITY_ORDER];
