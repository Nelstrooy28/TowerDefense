import * as THREE from 'three';
import type { TowerEntity } from '../simulation/TowerEntity';
import { getUnitById } from '../data/UnitRegistry';
import { SYNERGIES } from '../data/SynergyConfig';

export interface ActiveLinkInfo {
  fromId: string;
  toId: string;
  kind: 'support' | 'kin' | 'combo';
  colorHex: number;
  label: string;
}

const MAX_LINKS = 40;

/**
 * §5 Root Network — renders up to 40 visible underground root links in ONE merged ribbon draw call.
 */
export class RootNetworkRenderer {
  private mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private positions: Float32Array;
  private colors: Float32Array;
  private geo: THREE.BufferGeometry;

  public altHeld = false;
  public currentLinks: ActiveLinkInfo[] = [];

  constructor(scene: THREE.Scene) {
    // Each link = 1 quad = 2 tris = 6 vertices
    this.positions = new Float32Array(MAX_LINKS * 6 * 3);
    this.colors = new Float32Array(MAX_LINKS * 6 * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geo.setDrawRange(0, 0);

    this.mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  public computeLinks(
    towers: TowerEntity[],
    ghostUnitId?: string | null,
    ghostX?: number,
    ghostZ?: number
  ): ActiveLinkInfo[] {
    const links: ActiveLinkInfo[] = [];

    for (const t of towers) {
      t.kinDmgBonus = 0;
      t.comboDmgBonus = 0;
    }

    for (let i = 0; i < towers.length; i++) {
      const a = towers[i];
      for (let j = i + 1; j < towers.length; j++) {
        if (links.length >= MAX_LINKS) break;
        const b = towers[j];
        const dist = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);

        // Support link (Speed Sprinkler or Sunflower Beacon)
        if (
          (a.def.isSupport && dist <= a.getEffectiveRange()) ||
          (b.def.isSupport && dist <= b.getEffectiveRange())
        ) {
          const isSolar = a.def.id === 'sunflower_beacon' || b.def.id === 'sunflower_beacon';
          links.push({
            fromId: a.id,
            toId: b.id,
            kind: 'support',
            colorHex: isSolar ? 0xfde047 : 0x38bdf8,
            label: isSolar ? 'Solar Crit Link' : 'Sprinkler Haste Link',
          });
        }

        // Kin link: 2+ same unit within 4 units (+4% dmg each, max +12%)
        if (a.def.id === b.def.id && dist <= 4.0) {
          a.kinDmgBonus = Math.min(0.12, a.kinDmgBonus + 0.04);
          b.kinDmgBonus = Math.min(0.12, b.kinDmgBonus + 0.04);
          links.push({
            fromId: a.id,
            toId: b.id,
            kind: 'kin',
            colorHex: a.def.primaryColor,
            label: `${a.def.name} Kin (+4% DMG)`,
          });
        }

        // Combo link: compatible synergy elements within 6 units (+15% synergy dmg)
        if (dist <= 6.0) {
          const hasSynergy = SYNERGIES.some(
            (s) =>
              s.id !== 'fizzle' &&
              ((a.def.elements.includes(s.requires[0]) && b.def.elements.includes(s.requires[1])) ||
                (a.def.elements.includes(s.requires[1]) && b.def.elements.includes(s.requires[0])))
          );
          if (hasSynergy) {
            a.comboDmgBonus = 0.15;
            b.comboDmgBonus = 0.15;
            links.push({
              fromId: a.id,
              toId: b.id,
              kind: 'combo',
              colorHex: 0xe879f9,
              label: `Combo Link (${a.def.name} + ${b.def.name})`,
            });
          }
        }
      }
    }

    this.currentLinks = links;
    this.mat.opacity = this.altHeld ? 0.88 : 0.35;

    // Render merged ribbon quads
    let writeLinks = 0;
    const mapById = new Map<string, TowerEntity>();
    for (const t of towers) mapById.set(t.id, t);

    for (const l of links) {
      if (writeLinks >= MAX_LINKS) break;
      const ta = mapById.get(l.fromId);
      const tb = mapById.get(l.toId);
      if (!ta || !tb) continue;
      this.writeRibbonQuad(
        writeLinks,
        ta.position.x,
        ta.position.y + 0.07,
        ta.position.z,
        tb.position.x,
        tb.position.y + 0.07,
        tb.position.z,
        l.colorHex
      );
      writeLinks++;
    }

    // Preview prospective links for Placement Ghost (§5)
    if (ghostUnitId && ghostX !== undefined && ghostZ !== undefined) {
      const gUnit = getUnitById(ghostUnitId);
      for (const t of towers) {
        if (writeLinks >= MAX_LINKS) break;
        const dist = Math.hypot(t.position.x - ghostX, t.position.z - ghostZ);
        let col = 0;
        if (t.def.isSupport && dist <= t.getEffectiveRange()) col = 0x38bdf8;
        else if (gUnit.isSupport && dist <= gUnit.rangeBase) col = 0x38bdf8;
        else if (t.def.id === gUnit.id && dist <= 4.0) col = gUnit.primaryColor;
        else if (
          dist <= 6.0 &&
          SYNERGIES.some(
            (s) =>
              s.id !== 'fizzle' &&
              ((t.def.elements.includes(s.requires[0]) && gUnit.elements.includes(s.requires[1])) ||
                (t.def.elements.includes(s.requires[1]) && gUnit.elements.includes(s.requires[0])))
          )
        ) {
          col = 0xe879f9;
        }
        if (col !== 0) {
          this.writeRibbonQuad(writeLinks, ghostX, 0.08, ghostZ, t.position.x, t.position.y + 0.07, t.position.z, col);
          writeLinks++;
        }
      }
    }

    this.geo.setDrawRange(0, writeLinks * 6);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;

    return links;
  }

  private writeRibbonQuad(
    index: number,
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    colorHex: number
  ): void {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.max(0.01, Math.hypot(dx, dz));
    const nx = (-dz / len) * 0.09;
    const nz = (dx / len) * 0.09;

    const p = this.positions;
    const c = this.colors;
    const v = index * 18;

    // Tri 1
    p[v + 0] = ax - nx; p[v + 1] = ay; p[v + 2] = az - nz;
    p[v + 3] = ax + nx; p[v + 4] = ay; p[v + 5] = az + nz;
    p[v + 6] = bx + nx; p[v + 7] = by; p[v + 8] = bz + nz;
    // Tri 2
    p[v + 9] = ax - nx; p[v + 10] = ay; p[v + 11] = az - nz;
    p[v + 12] = bx + nx; p[v + 13] = by; p[v + 14] = bz + nz;
    p[v + 15] = bx - nx; p[v + 16] = by; p[v + 17] = bz - nz;

    const r = ((colorHex >> 16) & 255) / 255;
    const g = ((colorHex >> 8) & 255) / 255;
    const b = (colorHex & 255) / 255;
    for (let k = 0; k < 6; k++) {
      c[v + k * 3 + 0] = r;
      c[v + k * 3 + 1] = g;
      c[v + k * 3 + 2] = b;
    }
  }
}
