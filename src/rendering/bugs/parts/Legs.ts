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
  const style = def.legs.style ?? 'default';

  if (count > 0) {
    const pairs = count / 2;
    const lenRatio = Math.max(0.4, def.legs.length / 0.3);
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const zOff = (pairs > 1 ? 0.28 - (row / (pairs - 1)) * 0.58 : 0) * Math.max(1, def.body.segments.length * 0.42);

      const hip = new THREE.Group();
      hip.position.set(side * spreadX, baseY, zOff);

      if (style === 'ant_long' || style === 'mantis_jade') {
        const legMat = style === 'mantis_jade' ? accentMat : darkMat;
        const femur = new THREE.Mesh(BUG_SHARED_GEO.capsule, legMat);
        femur.scale.set(0.65, lenRatio * 0.65, 0.65);
        femur.rotation.z = -side * 0.85;
        femur.position.set(side * def.legs.length * 0.35, 0.08, 0);

        const tibia = new THREE.Mesh(BUG_SHARED_GEO.capsule, legMat);
        tibia.scale.set(0.55, lenRatio * 0.85, 0.55);
        tibia.rotation.z = side * 0.22;
        tibia.position.set(side * def.legs.length * 0.72, -def.legs.length * 0.32, 0);
        hip.add(femur, tibia);
      } else if (style === 'rhino_thick') {
        const femur = new THREE.Mesh(BUG_SHARED_GEO.capsule, darkMat);
        femur.scale.set(1.45, lenRatio * 0.7, 1.45);
        femur.rotation.z = side * 0.72;
        femur.position.set(side * 0.14, -0.1, 0);

        const tibia = new THREE.Mesh(BUG_SHARED_GEO.capsule, darkMat);
        tibia.scale.set(1.2, lenRatio * 0.65, 1.2);
        tibia.rotation.z = side * 0.15;
        tibia.position.set(side * 0.25, -0.24, 0);
        hip.add(femur, tibia);
      } else if (style === 'wasp_dangle') {
        const legMesh = new THREE.Mesh(BUG_SHARED_GEO.capsule, darkMat);
        legMesh.scale.set(0.55, lenRatio * 0.7, 0.55);
        legMesh.rotation.x = 0.45;
        legMesh.rotation.z = side * 0.25;
        legMesh.position.set(side * 0.08, -0.16, -0.05);
        hip.add(legMesh);
      } else if (style === 'aphid_stub') {
        const stub = new THREE.Mesh(BUG_SHARED_GEO.capsule, darkMat);
        stub.scale.set(0.75, 0.32, 0.75);
        stub.rotation.z = side * 0.3;
        stub.position.set(side * 0.04, -0.08, 0);
        hip.add(stub);
      } else {
        const legMesh = new THREE.Mesh(BUG_SHARED_GEO.capsule, darkMat);
        legMesh.scale.set(1, lenRatio, 1);
        legMesh.rotation.z = side * 0.52;
        legMesh.position.set(side * def.legs.length * 0.45, -def.legs.length * 0.38, 0);
        hip.add(legMesh);
      }

      bodyGroup.add(hip);
      legs.push(hip);
    }
  }

  // Folded 2-segment spiked Jade mantis blade arms (Art Sheet Doc 03 §6)
  if (def.legs.bladeArms) {
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.22, baseY + 0.45, 0.22);

      const upper = new THREE.Mesh(getCachedRoundedBox(0.08, 0.3, 0.1, 0.03), accentMat);
      upper.rotation.x = -0.55;
      upper.position.set(0, -0.08, 0.1);

      const forearm = new THREE.Mesh(getCachedRoundedBox(0.075, 0.34, 0.11, 0.03), accentMat);
      forearm.rotation.x = 0.95;
      forearm.position.set(0, 0.04, 0.28);

      const spike = new THREE.Mesh(BUG_SHARED_GEO.cone, darkMat);
      spike.scale.set(0.06, 0.14, 0.06);
      spike.rotation.x = Math.PI * 0.85;
      spike.position.set(0, -0.06, 0.34);

      arm.add(upper, forearm, spike);
      bodyGroup.add(arm);
      legs.push(arm);
    }
  }

  return legs;
}
