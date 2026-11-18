import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { UNITS, getUnitById } from '../src/data/UnitRegistry';
import { TRAITS, TRAIT_ORDER, migrateTraitId } from '../src/data/TraitConfig';
import { RARITIES, RARITY_ORDER } from '../src/data/RarityConfig';
import { computeScaledEnemyHP } from '../src/data/EnemyRegistry';
import { DIFFICULTY_ORDER, DIFFICULTY_LADDER, computeModifierEffects } from '../src/data/BalanceConfig';
import { MAPS } from '../src/data/MapRegistry';
import { PlacementSystem } from '../src/simulation/PlacementSystem';
import { mapV1PotSkinToSoilSkin, migrateSaveToV2, migrateSaveToV3, SaveManager } from '../src/core/SaveManager';

describe('Garden Bastion TD v4 Math & Registries', () => {
  it('registers all 20 units with upgrade costs rounded to nearest $25', () => {
    expect(UNITS.length).toBe(20);
    for (const u of UNITS) {
      expect(u.levels.length).toBe(6);
      for (const lvl of u.levels) {
        expect(lvl.upgradeCost % 25).toBe(0);
      }
    }
  });

  it('registers 22 Traits 2.0 whose weights sum to 100% and migrates legacy traits', () => {
    expect(TRAIT_ORDER.length).toBe(22);
    const sum = TRAIT_ORDER.reduce((acc, id) => acc + TRAITS[id].weight, 0);
    expect(sum).toBeCloseTo(100, 4);
    expect(migrateTraitId('Sprouting')).toBe('Keen II');
    expect(migrateTraitId('Golden')).toBe('Golden');
  });

  it('registers 7 difficulty tiers and 6 maps', () => {
    expect(DIFFICULTY_ORDER.length).toBe(7);
    expect(Object.keys(DIFFICULTY_LADDER).length).toBe(7);
    expect(Object.keys(MAPS).length).toBe(6);
  });

  it('computes modifier board effects accurately', () => {
    const fx = computeModifierEffects({ fast_pests: 4, small_garden: 3, fog: 2 });
    expect(fx.enemySpeedMult).toBe(2.0);
    expect(fx.maxTowers).toBe(8);
    expect(fx.towerRangeMult).toBe(0.8);
    expect(fx.seedBonusTotal).toBeCloseTo(0.69, 4);
  });

  it('crate rarity weights sum to 100%', () => {
    const classicSum = RARITY_ORDER.reduce((acc, r) => acc + RARITIES[r].classicWeight, 0);
    const enchSum = RARITY_ORDER.reduce((acc, r) => acc + RARITIES[r].enchantedWeight, 0);
    expect(classicSum).toBeCloseTo(100, 4);
    expect(enchSum).toBeCloseTo(100, 4);
  });

  it('computes wave HP scaling accurately', () => {
    expect(computeScaledEnemyHP(100, 1, 1.0)).toBe(100);
    expect(computeScaledEnemyHP(100, 10, 1.0)).toBe(244);
    expect(computeScaledEnemyHP(100, 20, 1.15)).toBeGreaterThan(500);
  });

  it('computes WaveBonus(w) formula accurately', () => {
    const waveBonus = (w: number) => Math.floor(120 + 35 * w + 4 * Math.pow(w, 1.35));
    expect(waveBonus(1)).toBe(159);
    expect(waveBonus(10)).toBe(559);
  });

  it('enforces placement rules for track, cliffs, PATH units, footprints, and cash', () => {
    const ps = new PlacementSystem();
    const map = MAPS.sunny_backyard;
    const splines = map.paths.map(
      (pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.04, z)))
    );
    ps.setMap(map, splines);

    const tomato = getUnitById('tomato_tosser');
    const bamboo = getUnitById('bamboo_archer');
    const bramble = getUnitById('bramble_snare');

    // Valid open lawn spot far from track
    const okLawn = ps.validate(tomato, 0, -16, [], 600);
    expect(okLawn.valid).toBe(true);

    // Invalid: directly on track waypoint (-11, -11) for non-PATH unit
    const onTrack = ps.validate(tomato, -11, -11, [], 600);
    expect(onTrack.valid).toBe(false);

    // PATH unit: valid directly on track (-11, -11), invalid off-track on open lawn (0, -16)
    expect(ps.validate(bramble, -11, -11, [], 600).valid).toBe(true);
    expect(ps.validate(bramble, 0, -16, [], 600).valid).toBe(false);

    // Invalid: insufficient cash
    const noCash = ps.validate(tomato, 0, -16, [], 100);
    expect(noCash.valid).toBe(false);

    // CLIFF-only unit on ground vs on cliff (-1, 3)
    expect(ps.validate(bamboo, 0, -16, [], 600).valid).toBe(false);
    const onCliff = ps.validate(bamboo, -1, 3, [], 600);
    expect(onCliff.valid).toBe(true);
    expect(onCliff.y).toBe(1.5);
  });

  it('migrates v1/v2 save data to v3 schema without losing progress', () => {
    expect(mapV1PotSkinToSoilSkin('golden')).toBe('golden_sand');
    expect(mapV1PotSkinToSoilSkin('striped_ceramic')).toBe('garden_loam');

    const v2 = migrateSaveToV2({
      version: 1,
      seeds: 950,
      dewdrops: 12,
      owned: {
        tomato_tosser: {
          unitId: 'tomato_tosser',
          copies: 3,
          fusedStacks: 1,
          trait: 'Golden',
          traitLocked: true,
          masteryXp: 40,
          masteryLevel: 10,
          potSkin: 'galaxy',
        },
      },
    });
    expect(v2.version).toBe(2);
    expect(v2.owned.tomato_tosser.soilSkin).toBe('galaxy_soil');

    const v3 = migrateSaveToV3(v2 as unknown as Record<string, unknown>);
    expect(v3.version).toBe(3);
    expect(v3.seeds).toBe(950);
    expect(v3.teamPresets.length).toBeGreaterThanOrEqual(3);
    expect(v3.owned.tomato_tosser.variant).toBe('none');
    expect(v3.unlockedDifficulties).toEqual({});
    expect(SaveManager.isDifficultyUnlocked('sunny_backyard', 'Easy')).toBe(true);
  });
});
