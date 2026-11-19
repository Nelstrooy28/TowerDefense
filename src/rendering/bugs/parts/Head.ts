import * as THREE from 'three';
import { BUG_SHARED_GEO, getCachedRoundedBox, makeBugMaterial, type BugRigDef } from '../BugRigTypes';

export interface HeadPartResult {
  headGroup: THREE.Group;
  eyes: THREE.Object3D[];
  jaws: THREE.Object3D[];
}

export function buildBugHead(
  def: BugRigDef,
  mainMat: THREE.MeshStandardMaterial,
  darkMat: THREE.MeshStandardMaterial,
  accentMat: THREE.MeshStandardMaterial,
  matsOut: THREE.MeshStandardMaterial[],
  headZ: number,
  headY: number
): HeadPartResult {
  const headGroup = new THREE.Group();
  headGroup.position.set(0, headY, headZ);

  const [hw, hh, hd] = def.head.size;
  const eyes: THREE.Object3D[] = [];
  const jaws: THREE.Object3D[] = [];

  if (def.head.hidden) {
    return { headGroup, eyes, jaws };
  }

  const headMesh = new THREE.Mesh(getCachedRoundedBox(hw, hh, hd), mainMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Darker cap ridge for cute blocky silhouette contrast
  const ridge = new THREE.Mesh(getCachedRoundedBox(hw * 0.86, hh * 0.24, hd * 0.84, 0.05), darkMat);
  ridge.position.y = hh * 0.42;
  headGroup.add(ridge);

  // Cute GTD rectangle eyes with tiny white shine dot
  const eyeMat = makeBugMaterial(def.palette.eye ?? 0x0f172a, { roughness: 0.2 });
  const shineMat = makeBugMaterial(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.45 });
  matsOut.push(eyeMat);

  const eyeW = Math.max(0.08, hw * 0.22);
  const eyeH = Math.max(0.09, hh * 0.34);
  const eyeGeo = getCachedRoundedBox(eyeW, eyeH, 0.04, 0.02);
  const shineGeo = getCachedRoundedBox(eyeW * 0.32, eyeH * 0.28, 0.02, 0.01);

  for (const sx of [-1, 1]) {
    if (def.head.antennae === 'stalks') {
      const stalk = new THREE.Mesh(BUG_SHARED_GEO.cylinder, mainMat);
      stalk.scale.set(0.05, 0.26, 0.05);
      stalk.position.set(sx * hw * 0.28, hh * 0.52, hd * 0.28);
      headGroup.add(stalk);

      const eyeWrap = new THREE.Group();
      eyeWrap.position.set(sx * hw * 0.28, hh * 0.68, hd * 0.32);
      const eMesh = new THREE.Mesh(eyeGeo, eyeMat);
      const sMesh = new THREE.Mesh(shineGeo, shineMat);
      sMesh.position.set(eyeW * 0.18, eyeH * 0.2, 0.022);
      eyeWrap.add(eMesh, sMesh);
      headGroup.add(eyeWrap);
      eyes.push(eyeWrap);
    } else {
      const eyeWrap = new THREE.Group();
      eyeWrap.position.set(sx * hw * 0.25, hh * 0.08, hd * 0.5 + 0.01);
      const eMesh = new THREE.Mesh(eyeGeo, eyeMat);
      const sMesh = new THREE.Mesh(shineGeo, shineMat);
      sMesh.position.set(eyeW * 0.18, eyeH * 0.2, 0.022);
      eyeWrap.add(eMesh, sMesh);
      if (def.head.goggles) {
        const rim = new THREE.Mesh(getCachedRoundedBox(eyeW * 1.45, eyeH * 1.35, 0.05, 0.03), accentMat);
        rim.position.z = -0.01;
        eyeWrap.add(rim);
      }
      headGroup.add(eyeWrap);
      eyes.push(eyeWrap);
    }
  }

  // Antennae
  if (def.head.antennae === 'bent' || def.head.antennae === 'feathered') {
    for (const sx of [-1, 1]) {
      const baseAnt = new THREE.Mesh(getCachedRoundedBox(0.04, 0.18, 0.04, 0.015), darkMat);
      baseAnt.position.set(sx * hw * 0.26, hh * 0.52, hd * 0.14);
      baseAnt.rotation.z = -sx * 0.28;
      baseAnt.rotation.x = 0.25;
      const tipAnt = new THREE.Mesh(
        getCachedRoundedBox(def.head.antennae === 'feathered' ? 0.1 : 0.035, 0.16, 0.035, 0.015),
        accentMat
      );
      tipAnt.position.set(0, 0.14, 0.06);
      tipAnt.rotation.x = 0.65;
      baseAnt.add(tipAnt);
      headGroup.add(baseAnt);
    }
  }

  // Mandibles or square termite jaws
  if (def.head.mandibles || def.head.jaws) {
    const jawLen = def.head.jaws ? 0.28 : 0.16;
    const jawW = def.head.jaws ? 0.1 : 0.055;
    const jawMat = def.head.jaws ? accentMat : darkMat;
    for (const sx of [-1, 1]) {
      const jaw = new THREE.Mesh(getCachedRoundedBox(jawW, jawW * 0.9, jawLen, 0.02), jawMat);
      jaw.position.set(sx * hw * 0.26, -hh * 0.22, hd * 0.5 + jawLen * 0.42);
      jaw.rotation.y = -sx * 0.28;
      headGroup.add(jaw);
      jaws.push(jaw);
    }
  }

  // Pink mole nose + white smile
  if (def.head.moleNose) {
    const noseMat = makeBugMaterial(0xf472b6, { roughness: 0.35 });
    matsOut.push(noseMat);
    const nose = new THREE.Mesh(getCachedRoundedBox(0.18, 0.14, 0.14, 0.05), noseMat);
    nose.position.set(0, -hh * 0.08, hd * 0.5 + 0.05);
    headGroup.add(nose);
  }
  if (def.head.smile) {
    const mouth = new THREE.Mesh(getCachedRoundedBox(hw * 0.34, 0.03, 0.03, 0.01), darkMat);
    mouth.position.set(0, -hh * 0.24, hd * 0.5 + 0.015);
    headGroup.add(mouth);
  }

  return { headGroup, eyes, jaws };
}
