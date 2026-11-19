import * as THREE from 'three';
import { BUG_SHARED_GEO, getCachedRoundedBox, makeBugMaterial, type BugRigDef } from '../BugRigTypes';

export function buildBugWings(
  def: BugRigDef,
  bodyGroup: THREE.Group,
  matsOut: THREE.MeshStandardMaterial[]
): THREE.Object3D[] {
  const wings: THREE.Object3D[] = [];
  if (def.wings.kind === 'none') return wings;

  const span = def.wings.span ?? 0.65;
  const wingY = (def.body.yOffset ?? 0.35) + (def.body.segments[0]?.[1] ?? 0.4) * 0.85;

  let wingColor = 0xe9d5ff;
  let emissiveColor = 0x000000;
  let emissiveInt = 0;
  let opacity = 0.82;

  if (def.wings.kind === 'wasp') {
    wingColor = 0xfef9c3;
    opacity = 0.65;
  } else if (def.wings.kind === 'wasp_dual') {
    wingColor = 0xfef3c7;
    opacity = 0.42;
  } else if (def.wings.kind === 'aphid_mini') {
    wingColor = 0xe0f2fe;
    opacity = 0.5;
  } else if (def.wings.kind === 'glow') {
    wingColor = 0x4ade80;
    emissiveColor = 0x22c55e;
    emissiveInt = 1.25;
    opacity = 0.88;
  } else if (def.wings.kind === 'flame') {
    wingColor = 0xfb923c;
    emissiveColor = 0xf97316;
    emissiveInt = 1.45;
    opacity = 0.9;
  } else if (def.wings.kind === 'crystal') {
    wingColor = 0xbae6fd;
    emissiveColor = 0x38bdf8;
    emissiveInt = 1.1;
    opacity = 0.82;
  }

  const wingMat = makeBugMaterial(wingColor, {
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    emissive: emissiveColor,
    emissiveIntensity: emissiveInt,
  });
  matsOut.push(wingMat);

  if (def.wings.kind === 'wasp_dual') {
    // Two pairs (4 total translucent wings) for Stinger Wasp
    for (let pair = 0; pair < 2; pair++) {
      const pScale = pair === 0 ? 1.0 : 0.68;
      const pZ = pair === 0 ? 0.14 : -0.02;
      for (const sx of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(sx * 0.12, wingY + 0.04, pZ);
        const plane = new THREE.Mesh(BUG_SHARED_GEO.wingPlane, wingMat);
        plane.scale.set((span / 0.65) * pScale, 1, (span / 0.65) * pScale * 0.72);
        plane.rotation.x = -Math.PI / 2;
        plane.rotation.z = sx * (pair === 0 ? -0.25 : -0.48);
        plane.position.set(sx * span * 0.46 * pScale, 0, -0.08);
        pivot.add(plane);
        bodyGroup.add(pivot);
        wings.push(pivot);
      }
    }
    return wings;
  }

  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.16, wingY, 0.04);

    if (def.wings.kind === 'crystal') {
      const shard = new THREE.Mesh(getCachedRoundedBox(span, 0.05, span * 0.56, 0.02), wingMat);
      shard.position.set(sx * span * 0.52, 0.05, -0.05);
      pivot.add(shard);
    } else {
      const plane = new THREE.Mesh(BUG_SHARED_GEO.wingPlane, wingMat);
      plane.scale.set(span / 0.65, 1, span / 0.65);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(sx * span * 0.52, 0, -0.04);
      pivot.add(plane);

      if (def.wings.kind === 'soft') {
        const spotMat = makeBugMaterial(0x9333ea, { emissive: 0x7e22ce, emissiveIntensity: 0.4 });
        matsOut.push(spotMat);
        const spot = new THREE.Mesh(getCachedRoundedBox(0.14, 0.03, 0.14, 0.02), spotMat);
        spot.position.set(sx * span * 0.56, 0.02, -0.04);
        pivot.add(spot);
      }
    }

    bodyGroup.add(pivot);
    wings.push(pivot);
  }

  return wings;
}
