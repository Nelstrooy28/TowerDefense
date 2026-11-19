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

  const shape = def.head.shape ?? 'box';

  if (shape === 'sphere') {
    const headMesh = new THREE.Mesh(BUG_SHARED_GEO.sphere, mainMat);
    headMesh.scale.set(hw * 2, hh * 2, hd * 2);
    headMesh.castShadow = true;
    headGroup.add(headMesh);
  } else if (shape === 'triangle_cone') {
    // Inverted cone tilted gently to form Brood Mantis triangle head
    const headMesh = new THREE.Mesh(BUG_SHARED_GEO.cone, mainMat);
    headMesh.scale.set(hw * 2, hh * 2, hd * 1.4);
    headMesh.rotation.x = Math.PI;
    headMesh.castShadow = true;
    headGroup.add(headMesh);
  } else {
    const headMesh = new THREE.Mesh(getCachedRoundedBox(hw, hh, hd), shape === 'rhino_horn' ? darkMat : mainMat);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    if (shape !== 'rhino_horn') {
      const ridge = new THREE.Mesh(getCachedRoundedBox(hw * 0.86, hh * 0.24, hd * 0.84, 0.05), darkMat);
      ridge.position.y = hh * 0.42;
      headGroup.add(ridge);
    } else {
      // Rhino Beetle curved front wedge horn cone (0.35 long)
      const horn = new THREE.Mesh(BUG_SHARED_GEO.cone, mainMat);
      horn.scale.set(0.16, 0.42, 0.18);
      horn.rotation.x = 0.65;
      horn.position.set(0, hh * 0.35, hd * 0.55);
      horn.castShadow = true;
      headGroup.add(horn);
    }
  }

  // Glossy black sphere eyes with crisp white shine dot on every bug (Doc 01 §1, Doc 03)
  const eyeMat = makeBugMaterial(0x0b0f19, { roughness: 0.08 });
  const shineMat = makeBugMaterial(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.48, roughness: 0.12 });
  matsOut.push(eyeMat);

  const eyeR = def.head.eyeRadius ?? Math.max(0.05, Math.min(hw, hh) * 0.24);
  const shineR = eyeR * 0.34;

  for (const sx of [-1, 1]) {
    if (def.head.antennae === 'stalks') {
      // Terracotta Snail tall capsule eye stalks (0.4) + sphere eyes
      const stalk = new THREE.Mesh(BUG_SHARED_GEO.capsule, mainMat);
      stalk.scale.set(0.08, 0.42, 0.08);
      stalk.position.set(sx * hw * 0.3, hh * 0.58, hd * 0.25);
      stalk.rotation.z = -sx * 0.16;
      headGroup.add(stalk);

      const eyeWrap = new THREE.Group();
      eyeWrap.position.set(sx * hw * 0.34, hh * 0.88, hd * 0.28);
      const eMesh = new THREE.Mesh(BUG_SHARED_GEO.sphere, eyeMat);
      eMesh.scale.setScalar(eyeR * 2);
      const sMesh = new THREE.Mesh(BUG_SHARED_GEO.sphere, shineMat);
      sMesh.scale.setScalar(shineR * 2);
      sMesh.position.set(eyeR * 0.32, eyeR * 0.34, eyeR * 0.8);
      eyeWrap.add(eMesh, sMesh);
      headGroup.add(eyeWrap);
      eyes.push(eyeWrap);
    } else {
      const eyeWrap = new THREE.Group();
      const ex = shape === 'triangle_cone' ? sx * hw * 0.58 : sx * hw * 0.28;
      const ey = shape === 'triangle_cone' ? hh * 0.28 : hh * 0.1;
      const ez = hd * (shape === 'sphere' ? 0.72 : 0.48);
      eyeWrap.position.set(ex, ey, ez);

      const eMesh = new THREE.Mesh(BUG_SHARED_GEO.sphere, eyeMat);
      eMesh.scale.setScalar(eyeR * 2);
      const sMesh = new THREE.Mesh(BUG_SHARED_GEO.sphere, shineMat);
      sMesh.scale.setScalar(shineR * 2);
      sMesh.position.set(eyeR * 0.3, eyeR * 0.34, eyeR * 0.78);
      eyeWrap.add(eMesh, sMesh);

      if (def.head.goggles) {
        const rim = new THREE.Mesh(getCachedRoundedBox(eyeR * 2.8, eyeR * 2.5, 0.05, 0.03), accentMat);
        rim.position.z = -0.01;
        eyeWrap.add(rim);
      }
      headGroup.add(eyeWrap);
      eyes.push(eyeWrap);
    }
  }

  // Antennae (bent, feathered, or long mantis)
  if (def.head.antennae === 'bent' || def.head.antennae === 'feathered' || def.head.antennae === 'long') {
    const isLong = def.head.antennae === 'long';
    for (const sx of [-1, 1]) {
      const baseAnt = new THREE.Mesh(
        getCachedRoundedBox(0.035, isLong ? 0.26 : 0.18, 0.035, 0.015),
        darkMat
      );
      baseAnt.position.set(sx * hw * 0.26, hh * 0.54, hd * 0.14);
      baseAnt.rotation.z = -sx * 0.32;
      baseAnt.rotation.x = 0.28;
      const tipAnt = new THREE.Mesh(
        getCachedRoundedBox(
          def.head.antennae === 'feathered' ? 0.1 : 0.03,
          isLong ? 0.24 : 0.16,
          0.03,
          0.015
        ),
        accentMat
      );
      tipAnt.position.set(0, isLong ? 0.2 : 0.14, 0.06);
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
