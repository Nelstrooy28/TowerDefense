import * as THREE from 'three';
import type { MapDef } from '../data/MapRegistry';
import type { UnitDef } from '../data/UnitRegistry';

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
}

export class PlacementSystem {
  private map: MapDef | null = null;
  private trackSamples: THREE.Vector3[] = [];

  public setMap(map: MapDef, splines: THREE.CatmullRomCurve3[]): void {
    this.map = map;
    this.trackSamples = [];
    for (const sp of splines) {
      const steps = 140;
      for (let i = 0; i <= steps; i++) {
        this.trackSamples.push(sp.getPointAt(i / steps));
      }
    }
  }

  public validate(
    unit: UnitDef,
    x: number,
    z: number,
    placedTowers: PlacedFootprint[],
    cash: number
  ): PlacementResult {
    if (!this.map) return { valid: false, reason: 'No map loaded', y: 0, onCliff: false };

    const bound = this.map.boundsHalfSize - 1.5;
    if (Math.abs(x) > bound || Math.abs(z) > bound) {
      return { valid: false, reason: 'Out of garden bounds', y: 0, onCliff: false };
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

    // Pond check (only if not on cliff)
    if (!onCliff) {
      const pdx = (x - this.map.pond.x) / (this.map.pond.radiusX + unit.footprintRadius);
      const pdz = (z - this.map.pond.z) / (this.map.pond.radiusZ + unit.footprintRadius);
      if (pdx * pdx + pdz * pdz < 1) {
        return { valid: false, reason: 'Cannot place inside Pond', y: 0, onCliff };
      }
    }

    // Rule 1: d(p, Track) >= W_track + r_u (cliffs above track are allowed if hybrid)
    if (!onCliff) {
      const minTrackDist = this.map.trackHalfWidth + unit.footprintRadius;
      const minSq = minTrackDist * minTrackDist;
      for (let i = 0; i < this.trackSamples.length; i++) {
        const pt = this.trackSamples[i];
        const dx = x - pt.x;
        const dz = z - pt.z;
        if (dx * dx + dz * dz < minSq) {
          return { valid: false, reason: 'Too close to pest track', y: 0, onCliff };
        }
      }
    }

    // Rule 2: Tower footprint collision ||p - p_j|| >= r_u + r_j
    for (const t of placedTowers) {
      const dist = Math.hypot(x - t.x, z - t.z);
      if (dist < unit.footprintRadius + t.radius) {
        return { valid: false, reason: 'Overlaps another unit', y: cliffHeight, onCliff };
      }
    }

    // Rule 4: Placement Cap
    let sameCount = 0;
    for (const t of placedTowers) {
      if (t.unitId === unit.id) sameCount++;
    }
    if (sameCount >= unit.cap) {
      return { valid: false, reason: `Unit cap reached (${sameCount}/${unit.cap})`, y: cliffHeight, onCliff };
    }

    // Rule 5: Cash check
    if (cash < unit.cost) {
      return { valid: false, reason: `Need $${unit.cost}`, y: cliffHeight, onCliff };
    }

    return { valid: true, reason: 'Valid', y: cliffHeight, onCliff };
  }
}
