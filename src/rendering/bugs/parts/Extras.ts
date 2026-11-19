import * as THREE from 'three';
import { ELITE_MODIFIERS, type EliteModifierId } from '../../../data/ModifierConfig';
import { BUG_SHARED_GEO, getCachedRoundedBox, makeBugMaterial, type BugRigDef } from '../BugRigTypes';

export interface BugExtrasResult {
  crownMesh?: THREE.Object3D;
  dirtMound?: THREE.Object3D;
  cocoonMesh?: THREE.Object3D;
  hydraHeads: THREE.Object3D[];
  locustFlock?: THREE.InstancedMesh;
  sweatGroup: THREE.Group;
  dizzyGroup: THREE.Group;
  eliteShieldMesh?: THREE.Mesh;
}

export function buildBugExtras(
  def: BugRigDef,
  root: THREE.Group,
  bodyGroup: THREE.Group,
  mainMat: THREE.MeshStandardMaterial,
  darkMat: THREE.MeshStandardMaterial,
  accentMat: THREE.MeshStandardMaterial,
  matsOut: THREE.MeshStandardMaterial[],
  options: { isElite?: boolean; eliteMod?: EliteModifierId | null; isMiniBoss?: boolean }
): BugExtrasResult {
  const hydraHeads: THREE.Object3D[] = [];
  let crownMesh: THREE.Object3D | undefined;
  let dirtMound: THREE.Object3D | undefined;
  let cocoonMesh: THREE.Object3D | undefined;
  let locustFlock: THREE.InstancedMesh | undefined;

  const goldMat = makeBugMaterial(0xfbbf24, { emissive: 0xf59e0b, emissiveIntensity: 0.45, metalness: 0.65, roughness: 0.25 });
  matsOut.push(goldMat);

  if (options.isMiniBoss || def.extras.includes('crown') || def.extras.includes('tiara')) {
    const crown = new THREE.Group();
    const isTiara = def.extras.includes('tiara');
    const cMat = isTiara ? accentMat : goldMat;
    const band = new THREE.Mesh(getCachedRoundedBox(0.38, 0.1, 0.38, 0.03), cMat);
    crown.add(band);
    for (const sx of [-0.12, 0, 0.12]) {
      const spike = new THREE.Mesh(BUG_SHARED_GEO.cone, cMat);
      spike.scale.set(0.08, 0.18, 0.08);
      spike.position.set(sx, 0.12, 0.1);
      crown.add(spike);
    }
    const topY = def.body.treeBody ? 2.75 : (def.body.yOffset ?? 0.3) + (def.body.segments[0]?.[1] ?? 0.4) + 0.35;
    crown.position.set(0, topY, def.body.treeBody ? 0.1 : 0.36);
    bodyGroup.add(crown);
    crownMesh = crown;
  }

  if (def.extras.includes('horns')) {
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(BUG_SHARED_GEO.cone, goldMat);
      horn.scale.set(0.14, 0.45, 0.14);
      horn.position.set(sx * 0.35, 1.05, 0.72);
      horn.rotation.x = 0.55;
      horn.rotation.z = -sx * 0.35;
      bodyGroup.add(horn);
    }
  }

  if (def.extras.includes('sack')) {
    const sackMat = makeBugMaterial(0x92400e, { roughness: 0.8 });
    matsOut.push(sackMat);
    const sack = new THREE.Mesh(getCachedRoundedBox(0.46, 0.42, 0.48, 0.12), sackMat);
    sack.position.set(0, 0.62, -0.2);
    const coinBadge = new THREE.Mesh(getCachedRoundedBox(0.16, 0.16, 0.06, 0.03), goldMat);
    coinBadge.position.set(0, 0.02, -0.25);
    sack.add(coinBadge);
    bodyGroup.add(sack);
  }

  if (def.extras.includes('spore_sack')) {
    const sack = new THREE.Mesh(getCachedRoundedBox(0.32, 0.28, 0.36, 0.09), accentMat);
    sack.position.set(0, 0.54, -0.28);
    bodyGroup.add(sack);
  }

  if (def.extras.includes('treant_core')) {
    const core = new THREE.Mesh(getCachedRoundedBox(0.48, 0.48, 0.48, 0.1), accentMat);
    core.position.set(0, 1.05, 0.35);
    bodyGroup.add(core);
  }

  if (def.extras.includes('treant_limbs')) {
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(getCachedRoundedBox(0.32, 1.05, 0.32, 0.06), darkMat);
      arm.position.set(sx * 0.85, 1.05, 0.15);
      arm.rotation.z = sx * 0.35;
      bodyGroup.add(arm);
    }
  }

  if (def.extras.includes('hydra_heads')) {
    for (let i = -1; i <= 1; i++) {
      const hGroup = new THREE.Group();
      const neck = new THREE.Mesh(getCachedRoundedBox(0.24, 0.65, 0.24, 0.06), mainMat);
      neck.position.set(0, 0.32, 0.1);
      neck.rotation.x = 0.28;
      const headBox = new THREE.Mesh(getCachedRoundedBox(0.4, 0.34, 0.44, 0.08), accentMat);
      headBox.position.set(0, 0.64, 0.26);
      hGroup.add(neck, headBox);
      hGroup.position.set(i * 0.56, 0.66, 0.44);
      bodyGroup.add(hGroup);
      hydraHeads.push(hGroup);
    }
  }

  if (def.extras.includes('dirt_mound')) {
    const moundMat = makeBugMaterial(0x78350f, { roughness: 0.92 });
    matsOut.push(moundMat);
    const mound = new THREE.Group();
    const bump = new THREE.Mesh(getCachedRoundedBox(0.9, 0.35, 0.9, 0.14), moundMat);
    bump.position.y = 0.14;
    mound.add(bump);
    mound.visible = false;
    root.add(mound);
    dirtMound = mound;
  }

  if (def.extras.includes('cocoon')) {
    const silkMat = makeBugMaterial(0xfef3c7, { roughness: 0.9 });
    matsOut.push(silkMat);
    const coc = new THREE.Mesh(getCachedRoundedBox(0.75, 0.88, 1.05, 0.2), silkMat);
    coc.position.set(0, 0.48, 0);
    coc.visible = false;
    root.add(coc);
    cocoonMesh = coc;
  }

  if (def.extras.includes('locust_flock')) {
    const mat = makeBugMaterial(0x84cc16, { roughness: 0.45 });
    matsOut.push(mat);
    locustFlock = new THREE.InstancedMesh(getCachedRoundedBox(0.18, 0.12, 0.24, 0.04), mat, 20);
    bodyGroup.add(locustFlock);
  }

  // Cute Low-HP (<25%) sweat drops
  const sweatGroup = new THREE.Group();
  const sweatMat = makeBugMaterial(0x38bdf8, { emissive: 0x7dd3fc, emissiveIntensity: 0.8 });
  matsOut.push(sweatMat);
  for (const sx of [-0.34, 0.34]) {
    const drop = new THREE.Mesh(getCachedRoundedBox(0.08, 0.14, 0.08, 0.03), sweatMat);
    drop.position.set(sx, 0.85, 0.22);
    sweatGroup.add(drop);
  }
  sweatGroup.visible = false;
  root.add(sweatGroup);

  // Orbiting stun/stagger stars
  const dizzyGroup = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2;
    const star = new THREE.Mesh(getCachedRoundedBox(0.11, 0.11, 0.11, 0.02), goldMat);
    star.position.set(Math.cos(ang) * 0.42, 0.95, Math.sin(ang) * 0.42);
    dizzyGroup.add(star);
  }
  dizzyGroup.visible = false;
  root.add(dizzyGroup);

  // Elite inverted-hull colored outline & Shielded bubble (Doc 02 §2.7)
  let eliteShieldMesh: THREE.Mesh | undefined;
  if (options.isElite && options.eliteMod) {
    const mod = ELITE_MODIFIERS[options.eliteMod];
    const ring = new THREE.Mesh(
      BUG_SHARED_GEO.torus,
      makeBugMaterial(mod.colorNum, { emissive: mod.colorNum, emissiveIntensity: 1.35 })
    );
    ring.scale.set(1.45, 1.45, 0.4);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    root.add(ring);

    // Inverted-hull silhouette shell on first body segment
    const hull = new THREE.Mesh(
      getCachedRoundedBox(0.92, 0.72, 1.02, 0.14),
      new THREE.MeshBasicMaterial({ color: mod.colorNum, side: THREE.BackSide, transparent: true, opacity: 0.72 })
    );
    hull.position.set(0, 0.45, 0);
    root.add(hull);

    if (options.eliteMod === 'Shielded') {
      eliteShieldMesh = new THREE.Mesh(
        BUG_SHARED_GEO.icosa,
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.72 })
      );
      eliteShieldMesh.position.y = 0.62;
      root.add(eliteShieldMesh);
    }
  }

  return {
    crownMesh,
    dirtMound,
    cocoonMesh,
    hydraHeads,
    locustFlock,
    sweatGroup,
    dizzyGroup,
    eliteShieldMesh,
  };
}
