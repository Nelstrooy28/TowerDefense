import * as THREE from 'three';
import { BUG_SHARED_GEO, getCachedRoundedBox, makeBugMaterial, type BugRigDef } from '../BugRigTypes';

export interface BodyPartResult {
  segments: THREE.Object3D[];
  headZ: number;
  headY: number;
}

export function buildBugBody(
  def: BugRigDef,
  bodyGroup: THREE.Group,
  mainMat: THREE.MeshStandardMaterial,
  darkMat: THREE.MeshStandardMaterial,
  accentMat: THREE.MeshStandardMaterial,
  matsOut: THREE.MeshStandardMaterial[]
): BodyPartResult {
  const segments: THREE.Object3D[] = [];
  const baseY = def.body.yOffset ?? 0.3;

  if (def.body.isAphidCluster) {
    const count = def.body.segments.length;
    for (let i = 0; i < count; i++) {
      const [w, h, d] = def.body.segments[i];
      const seg = new THREE.Mesh(getCachedRoundedBox(w, h, d), i % 2 === 0 ? mainMat : darkMat);
      const ang = (i / Math.max(1, count)) * Math.PI * 2;
      const rad = count > 1 ? 0.22 : 0;
      seg.position.set(Math.cos(ang) * rad, baseY + (i === 0 && count > 1 ? 0.12 : 0), Math.sin(ang) * rad);
      seg.castShadow = true;
      bodyGroup.add(seg);
      segments.push(seg);
    }
    return { segments, headZ: 0.34, headY: baseY + 0.12 };
  }

  if (def.body.treeBody) {
    const trunk = new THREE.Mesh(getCachedRoundedBox(1.15, 1.85, 1.05, 0.12), mainMat);
    trunk.position.set(0, 1.12, 0);
    trunk.castShadow = true;
    bodyGroup.add(trunk);
    segments.push(trunk);

    const canopy = new THREE.Mesh(getCachedRoundedBox(1.5, 0.8, 1.4, 0.14), darkMat);
    canopy.position.set(0, 2.25, -0.05);
    canopy.castShadow = true;
    bodyGroup.add(canopy);
    segments.push(canopy);

    return { segments, headZ: 0.52, headY: 1.55 };
  }

  // Chain segments from front-thorax toward abdomen
  let cursorZ = 0.08;
  for (let i = 0; i < def.body.segments.length; i++) {
    const [w, h, d] = def.body.segments[i];
    const segGroup = new THREE.Group();
    const y = baseY + h * 0.45;
    segGroup.position.set(0, y, cursorZ);

    const mesh = new THREE.Mesh(getCachedRoundedBox(w, h, d), i % 2 === 0 ? darkMat : mainMat);
    mesh.castShadow = true;
    segGroup.add(mesh);

    // Optional stripe/dot bands for cute caterpillar/wasp readability
    if (def.extras.includes('dots')) {
      for (const sx of [-1, 1]) {
        const dot = new THREE.Mesh(getCachedRoundedBox(0.08, 0.08, 0.08, 0.025), accentMat);
        dot.position.set(sx * w * 0.42, h * 0.25, 0);
        segGroup.add(dot);
      }
    }
    if (def.extras.includes('racing_stripe')) {
      const stripe = new THREE.Mesh(getCachedRoundedBox(w * 0.26, h * 0.18, d * 0.96, 0.03), accentMat);
      stripe.position.y = h * 0.48;
      segGroup.add(stripe);
    }

    bodyGroup.add(segGroup);
    segments.push(segGroup);
    cursorZ -= d * 0.88 + 0.04;
  }

  // Wasp stinger or tail tip for multi-segment bugs
  if (def.wings.kind === 'wasp' && segments.length > 0) {
    const stingMat = makeBugMaterial(0x1f2937);
    matsOut.push(stingMat);
    const stinger = new THREE.Mesh(BUG_SHARED_GEO.cone, stingMat);
    stinger.scale.set(0.14, 0.34, 0.14);
    stinger.rotation.x = -Math.PI / 2;
    stinger.position.set(0, baseY + 0.22, cursorZ - 0.12);
    bodyGroup.add(stinger);
  }

  const firstH = def.body.segments[0]?.[1] ?? 0.34;
  const frontZ = (def.body.segments[0]?.[2] ?? 0.36) * 0.5 + 0.08;
  return {
    segments,
    headZ: frontZ + def.head.size[2] * 0.42,
    headY: baseY + firstH * 0.52 + (def.head.y ?? 0),
  };
}
