import * as THREE from 'three';
import { QualityManager } from '../core/QualityManager';
import { ProceduralTextures, type DecalType } from './ProceduralTextures';

interface DecalSlot {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  age: number;
  lifetime: number;
  maxOpacity: number;
}

export class DecalManager {
  private pool: DecalSlot[] = [];
  private cursor = 0;
  private readonly maxCapacity = 300;
  private group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);

    for (let i = 0; i < this.maxCapacity; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: ProceduralTextures.getDecalTexture('tomato'),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({
        mesh,
        mat,
        active: false,
        age: 0,
        lifetime: 6,
        maxOpacity: 0.85,
      });
    }
  }

  public spawn(type: DecalType, x: number, z: number, radius: number, lifetime: number): void {
    const cap = QualityManager.preset.decals;
    if (cap <= 0) return;

    // Pick first inactive slot within cap, or overwrite oldest at cursor
    let slot: DecalSlot | null = null;
    for (let i = 0; i < cap; i++) {
      const idx = (this.cursor + i) % cap;
      if (!this.pool[idx].active) {
        slot = this.pool[idx];
        this.cursor = (idx + 1) % cap;
        break;
      }
    }
    if (!slot) {
      slot = this.pool[this.cursor % cap];
      this.cursor = (this.cursor + 1) % cap;
    }

    slot.active = true;
    slot.age = 0;
    slot.lifetime = Math.max(1, lifetime);
    slot.maxOpacity = type === 'puddle' ? 0.5 : 0.85;
    slot.mat.map = ProceduralTextures.getDecalTexture(type);
    slot.mat.opacity = slot.maxOpacity;
    slot.mat.needsUpdate = true;

    slot.mesh.position.set(x, 0.062 + (this.cursor % 5) * 0.001, z);
    slot.mesh.rotation.y = Math.random() * Math.PI * 2;
    slot.mesh.scale.setScalar(radius * 2);
    slot.mesh.visible = true;
  }

  public update(dt: number): void {
    const cap = QualityManager.preset.decals;
    for (let i = 0; i < this.maxCapacity; i++) {
      const s = this.pool[i];
      if (!s.active) continue;
      if (i >= cap) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }
      s.age += dt;
      if (s.age >= s.lifetime) {
        s.active = false;
        s.mesh.visible = false;
      } else {
        const remain = 1 - s.age / s.lifetime;
        s.mat.opacity = remain < 0.35 ? s.maxOpacity * (remain / 0.35) : s.maxOpacity;
      }
    }
  }

  public clearAll(): void {
    for (const s of this.pool) {
      s.active = false;
      s.mesh.visible = false;
    }
  }
}
