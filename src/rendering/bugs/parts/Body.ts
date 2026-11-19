import * as THREE from 'three';
import { BUG_SHARED_GEO, getCachedRoundedBox, makeBugMaterial, type BugRigDef } from '../BugRigTypes';

export interface BodyPartResult {
  segments: THREE.Object3D[];
  headZ: number;
  headY: number;
  mantisCoreMesh?: THREE.Mesh;
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
  const style = def.body.style ?? 'default';

  // Art Sheet: Scout Ant — spherical thorax + stretched darker abdomen behind sphere head
  if (style === 'ant_spheres') {
    const thorax = new THREE.Mesh(BUG_SHARED_GEO.sphere, mainMat);
    thorax.scale.set(0.28, 0.26, 0.3);
    thorax.position.set(0, baseY + 0.12, 0.06);
    thorax.castShadow = true;

    const abdomen = new THREE.Mesh(BUG_SHARED_GEO.sphere, darkMat);
    abdomen.scale.set(0.44, 0.36, 0.54);
    abdomen.position.set(0, baseY + 0.18, -0.34);
    abdomen.rotation.x = 0.12;
    abdomen.castShadow = true;

    bodyGroup.add(thorax, abdomen);
    segments.push(thorax, abdomen);
    return { segments, headZ: 0.36, headY: baseY + 0.22 };
  }

  // Art Sheet: Aphid Hopper & Cluster (3 round Toxic Lime bugs or 1 hopper)
  if (style === 'aphid_hopper') {
    const body = new THREE.Mesh(BUG_SHARED_GEO.sphere, mainMat);
    body.scale.set(0.56, 0.52, 0.62);
    body.position.set(0, baseY + 0.08, 0);
    body.castShadow = true;
    bodyGroup.add(body);
    segments.push(body);
    return { segments, headZ: 0.18, headY: baseY + 0.12 };
  }

  if (style === 'aphid_cluster_3' || def.body.isAphidCluster) {
    const offsets: Array<[number, number, number]> = [
      [0, baseY + 0.16, 0.14],
      [-0.18, baseY + 0.04, -0.14],
      [0.18, baseY + 0.04, -0.14],
    ];
    for (let i = 0; i < offsets.length; i++) {
      const [ox, oy, oz] = offsets[i];
      const ball = new THREE.Mesh(BUG_SHARED_GEO.sphere, i === 0 ? mainMat : darkMat);
      ball.scale.set(0.44, 0.4, 0.46);
      ball.position.set(ox, oy, oz);
      ball.castShadow = true;
      bodyGroup.add(ball);
      segments.push(ball);
    }
    return { segments, headZ: 0.24, headY: baseY + 0.2 };
  }

  // Art Sheet: Terracotta Snail & Speedy Slug flat Clay Orange foot capsule
  if (style === 'snail_foot') {
    const isSmallSlug = (def.body.segments[0]?.[2] ?? 1.2) < 0.7;
    const len = isSmallSlug ? 0.72 : 1.15;
    const foot = new THREE.Mesh(BUG_SHARED_GEO.sphere, mainMat);
    foot.scale.set(isSmallSlug ? 0.42 : 0.62, isSmallSlug ? 0.32 : 0.44, len * 1.15);
    foot.position.set(0, isSmallSlug ? 0.16 : 0.22, -0.05);
    foot.castShadow = true;

    const neck = new THREE.Mesh(BUG_SHARED_GEO.sphere, mainMat);
    neck.scale.set(isSmallSlug ? 0.28 : 0.42, isSmallSlug ? 0.36 : 0.48, isSmallSlug ? 0.28 : 0.38);
    neck.position.set(0, isSmallSlug ? 0.26 : 0.42, isSmallSlug ? 0.24 : 0.36);
    neck.rotation.x = -0.35;
    bodyGroup.add(foot, neck);
    segments.push(foot, neck);

    if (def.extras.includes('racing_stripe')) {
      const stripe = new THREE.Mesh(getCachedRoundedBox(0.14, 0.08, len * 0.9, 0.03), accentMat);
      stripe.position.set(0, isSmallSlug ? 0.31 : 0.42, -0.05);
      bodyGroup.add(stripe);
    }

    return {
      segments,
      headZ: isSmallSlug ? 0.34 : 0.48,
      headY: isSmallSlug ? 0.36 : 0.58,
    };
  }

  // Art Sheet: Stinger Wasp — Charcoal thorax + narrow waist + sharply angled 4-stripe abdomen cone + stinger
  if (style === 'wasp_stinger') {
    const thorax = new THREE.Mesh(BUG_SHARED_GEO.sphere, darkMat);
    thorax.scale.set(0.28, 0.28, 0.32);
    thorax.position.set(0, baseY + 0.22, 0.12);
    thorax.castShadow = true;

    const waist = new THREE.Mesh(BUG_SHARED_GEO.cylinder, darkMat);
    waist.scale.set(0.06, 0.14, 0.06);
    waist.rotation.x = Math.PI / 2;
    waist.position.set(0, baseY + 0.18, -0.04);

    // Downward-angled striped abdomen
    const abdPivot = new THREE.Group();
    abdPivot.position.set(0, baseY + 0.16, -0.1);
    abdPivot.rotation.x = -0.78; // sharp downward tilt
    for (let i = 0; i < 4; i++) {
      const r = (1 - i * 0.18) * 0.34;
      const band = new THREE.Mesh(BUG_SHARED_GEO.sphere, i % 2 === 0 ? mainMat : darkMat);
      band.scale.set(r, r, 0.22);
      band.position.z = -0.12 - i * 0.1;
      abdPivot.add(band);
    }
    const stinger = new THREE.Mesh(BUG_SHARED_GEO.cone, darkMat);
    stinger.scale.set(0.08, 0.24, 0.08);
    stinger.rotation.x = -Math.PI / 2;
    stinger.position.set(0, 0, -0.58);
    abdPivot.add(stinger);

    bodyGroup.add(thorax, waist, abdPivot);
    segments.push(thorax, abdPivot);
    return { segments, headZ: 0.34, headY: baseY + 0.28 };
  }

  // Art Sheet: Brood Mantis — tall Crimson thorax + Jade-striped capsule abdomen + glowing mint core
  if (style === 'mantis_upright') {
    const thorax = new THREE.Mesh(getCachedRoundedBox(0.2, 0.56, 0.18, 0.06), mainMat);
    thorax.position.set(0, baseY + 0.34, 0.16);
    thorax.rotation.x = 0.26;
    thorax.castShadow = true;

    const abdGroup = new THREE.Group();
    abdGroup.position.set(0, baseY + 0.1, -0.22);
    abdGroup.rotation.x = -0.35;

    const abdMat = makeBugMaterial(0xb3263a, { transparent: true, opacity: 0.78 });
    matsOut.push(abdMat);
    const abd = new THREE.Mesh(BUG_SHARED_GEO.sphere, abdMat);
    abd.scale.set(0.38, 0.38, 0.78);
    abdGroup.add(abd);

    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(BUG_SHARED_GEO.torus, darkMat);
      ring.scale.set(0.32 - i * 0.04, 0.32 - i * 0.04, 0.15);
      ring.position.z = 0.14 - i * 0.18;
      abdGroup.add(ring);
    }

    const coreMat = makeBugMaterial(0x5fffd0, {
      emissive: 0x5fffd0,
      emissiveIntensity: 1.5,
      roughness: 0.15,
    });
    matsOut.push(coreMat);
    const mantisCoreMesh = new THREE.Mesh(BUG_SHARED_GEO.sphere, coreMat);
    mantisCoreMesh.scale.setScalar(0.24);
    abdGroup.add(mantisCoreMesh);

    bodyGroup.add(thorax, abdGroup);
    segments.push(thorax, abdGroup);
    return { segments, headZ: 0.3, headY: baseY + 0.7, mantisCoreMesh };
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

  const firstH = def.body.segments[0]?.[1] ?? 0.34;
  const frontZ = (def.body.segments[0]?.[2] ?? 0.36) * 0.5 + 0.08;
  return {
    segments,
    headZ: frontZ + def.head.size[2] * 0.42,
    headY: baseY + firstH * 0.52 + (def.head.y ?? 0),
  };
}
