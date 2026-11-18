import * as THREE from 'three';
import type { MapDef } from '../data/MapRegistry';
import type { UnitDef } from '../data/UnitRegistry';
import { ECONOMY_CONFIG } from '../data/BalanceConfig';

export interface PlacedFootprint {
  id: string;
  unitId: string;
  x: number;
  z: number;
  radius: number;
}

export interface PlacementResult {
  valid: boolean;
  reason: string;
  y: number;
  onCliff: boolean;
  nearestSplineIdx?: number;
  nearestT?: number;
}

interface TrackSamplePoint {
  x: number;
  z: number;
  splineIdx: number;
  t: number;
}

export class PlacementSystem {
  private map: MapDef | null = null;
  private trackSamples: TrackSamplePoint[] = [];
  private splineEndpoints: Array<{ x: number; z: number }> = [];

  public setMap(map: MapDef, splines: THREE.CatmullRomCurve3[]): void {
    this.map = map;
    this.trackSamples = [];
    this.splineEndpoints = [];
    splines.forEach((sp, splineIdx) => {
      const steps = 140;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = sp.getPointAt(t);
        this.trackSamples.push({ x: p.x, z: p.z, splineIdx, t });
      }
      const p0 = sp.getPointAt(0);
      const p1 = sp.getPointAt(1);
      this.splineEndpoints.push({ x: p0.x, z: p0.z }, { x: p1.x, z: p1.z });
    });
  }

  public validate(
    unit: UnitDef,
    x: number,
    z: number,
    placedTowers: PlacedFootprint[],
    cash: number,
    maxGlobalTowers: number = ECONOMY_CONFIG.globalTowerCap,
    costMult = 1.0
  ): PlacementResult {
    if (!this.map) return { valid: false, reason: 'No map loaded', y: 0, onCliff: false };

    const bound = this.map.boundsHalfSize - 1.5;
    if (Math.abs(x) > bound || Math.abs(z) > bound) {
      return { valid: false, reason: 'Out of garden bounds', y: 0, onCliff: false };
    }

    if (placedTowers.length >= maxGlobalTowers) {
      return { valid: false, reason: `Garden limit (${maxGlobalTowers}) reached`, y: 0, onCliff: false };
    }

    // Check Cliff Zone
    let cliffHeight = 0;
    let onCliff = false;
    for (const c of this.map.cliffs) {
      const dist = Math.hypot(x - c.x, z - c.z);
      if (dist <= c.radius - unit.footprintRadius * 0.35) {
        onCliff = true;
        cliffHeight = c.height;
        break;
      }
    }

    if (unit.terrain === 'GROUND' && onCliff) {
      return { valid: false, reason: 'Ground unit cannot sit on Cliff', y: cliffHeight, onCliff };
    }
    if (unit.terrain === 'CLIFF' && !onCliff) {
      return { valid: false, reason: 'Requires elevated Cliff Pillar', y: 0, onCliff };
    }

    // Closest sample on any pest track
    let bestDistSq = Infinity;
    let bestSplineIdx = 0;
    let bestT = 0.5;
    for (let i = 0; i < this.trackSamples.length; i++) {
      const pt = this.trackSamples[i];
      const dx = x - pt.x;
      const dz = z - pt.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestSplineIdx = pt.splineIdx;
        bestT = pt.t;
      }
    }

    if (unit.terrain === 'PATH') {
      if (onCliff) {
        return { valid: false, reason: 'Must be placed ON the pest track', y: 0, onCliff: false };
      }
      const maxPathDist = Math.max(0.4, this.map.trackHalfWidth - 0.15);
      if (bestDistSq > maxPathDist * maxPathDist) {
        return { valid: false, reason: 'Must be placed ON the pest track', y: 0.06, onCliff: false };
      }
      for (const ep of this.splineEndpoints) {
        if (Math.hypot(x - ep.x, z - ep.z) <= 1.5) {
          return { valid: false, reason: 'Too close to spawn or base', y: 0.06, onCliff: false };
        }
      }
      cliffHeight = 0.06;
    } else {
      // Pond check (non-PATH, non-cliff)
      if (!onCliff) {
        const pdx = (x - this.map.pond.x) / (this.map.pond.radiusX + unit.footprintRadius);
        const pdz = (z - this.map.pond.z) / (this.map.pond.radiusZ + unit.footprintRadius);
        if (pdx * pdx + pdz * pdz < 1) {
          return { valid: false, reason: 'Cannot place inside Pond', y: 0, onCliff };
        }
      }

      // Track distance exclusion for Ground/Hybrid units
      if (!onCliff) {
        const minTrackDist = this.map.trackHalfWidth + unit.footprintRadius;
        if (bestDistSq < minTrackDist * minTrackDist) {
          return { valid: false, reason: 'Too close to pest track', y: 0, onCliff };
        }
      }
    }

    // Tower footprint collision
    for (const t of placedTowers) {
      const dist = Math.hypot(x - t.x, z - t.z);
      if (dist < unit.footprintRadius + t.radius) {
        return { valid: false, reason: 'Overlaps another unit', y: cliffHeight, onCliff };
      }
    }

    // Unit cap
    let sameCount = 0;
    for (const t of placedTowers) {
      if (t.unitId === unit.id) sameCount++;
    }
    if (sameCount >= unit.cap) {
      return { valid: false, reason: `Unit cap reached (${sameCount}/${unit.cap})`, y: cliffHeight, onCliff };
    }

    const effectiveCost = Math.round((unit.cost * costMult) / 5) * 5;
    if (cash < effectiveCost) {
      return { valid: false, reason: `Need $${effectiveCost}`, y: cliffHeight, onCliff };
    }

    return {
      valid: true,
      reason: 'Valid',
      y: cliffHeight,
      onCliff,
      nearestSplineIdx: bestSplineIdx,
      nearestT: bestT,
    };
  }
}
