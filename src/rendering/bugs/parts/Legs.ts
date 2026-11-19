import * as THREE from 'three';
import { BUG_SHARED_GEO, getCachedRoundedBox, type BugRigDef } from '../BugRigTypes';

export function buildBugLegs(
  def: BugRigDef,
  bodyGroup: THREE.Group,
  darkMat: THREE.MeshStandardMaterial,
  accentMat: THREE.MeshStandardMaterial
): THREE.Object3D[] {
  const legs: THREE.Object3D[] = [];
  const count = def.legs.count;
  const spreadX = def.legs.spreadX ?? 0.26;
  const baseY = def.body.yOffset ?? 0.26;

  if (count > 0) {
    const pairs = count / 2;
    const lenRatio = Math.max(0.5, def.legs.length / 0.3);
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const zOff = (pairs > 1 ? 0.28 - (row / (pairs - 1)) * 0.58 : 0) * Math.max(1, def.body.segments.length * 0.45);

      const hip = new THREE.Group();
      hip.position.set(side * spreadX, baseY, zOff);

      const legMesh = new THREE.Mesh(BUG_SHARED_GEO.capsule, darkMat);
      legMesh.scale.set(1, lenRatio, 1);
      legMesh.rotation.z = side * 0.52;
      legMesh.position.set(side * def.legs.length * 0.45, -def.legs.length * 0.38, 0);
      hip.add(legMesh);

      bodyGroup.add(hip);
      legs.push(hip);
    }
  }

  // Folded mantis scythe/blade arms
  if (def.legs.bladeArms) {
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.28, 0.52, 0.32);
      const blade = new THREE.Mesh(getCachedRoundedBox(0.08, 0.46, 0.14, 0.03), accentMat);
      blade.rotation.x = 0.62;
      arm.add(blade);
      bodyGroup.add(arm);
      legs.push(arm);
    }
  }

  return legs;
}
