import * as THREE from 'three';
import { BUG_SHARED_GEO, getCachedRoundedBox, makeBugMaterial, type BugRigDef } from '../BugRigTypes';

export function buildBugShell(
  def: BugRigDef,
  bodyGroup: THREE.Group,
  matsOut: THREE.MeshStandardMaterial[]
): THREE.Object3D | undefined {
  if (def.shell.kind === 'none') return undefined;
  const shellGroup = new THREE.Group();
  const baseY = (def.body.yOffset ?? 0.3) + 0.25;

  if (def.shell.kind === 'iron_plates' || def.shell.kind === 'magma_plates') {
    const isMagma = def.shell.kind === 'magma_plates';
    const plateMat = makeBugMaterial(isMagma ? 0x1c1917 : 0x94a3b8, {
      metalness: isMagma ? 0.3 : 0.78,
      roughness: isMagma ? 0.55 : 0.28,
    });
    const trimMat = makeBugMaterial(isMagma ? 0xf97316 : 0x3b82f6, {
      emissive: isMagma ? 0xf97316 : 0x000000,
      emissiveIntensity: isMagma ? 1.4 : 0,
    });
    matsOut.push(plateMat, trimMat);

    const w = isMagma ? 1.25 : 0.78;
    const h = isMagma ? 0.56 : 0.36;
    const d = isMagma ? 1.45 : 0.92;
    const dome = new THREE.Mesh(getCachedRoundedBox(w, h, d, 0.12), plateMat);
    dome.castShadow = true;
    shellGroup.add(dome);

    const seam = new THREE.Mesh(getCachedRoundedBox(0.1, h + 0.04, d * 0.92, 0.03), trimMat);
    shellGroup.add(seam);

    for (const bx of [-w * 0.34, w * 0.34]) {
      for (const bz of [-d * 0.28, d * 0.28]) {
        const bolt = new THREE.Mesh(getCachedRoundedBox(0.09, 0.08, 0.09, 0.025), trimMat);
        bolt.position.set(bx, h * 0.48, bz);
        shellGroup.add(bolt);
      }
    }

    shellGroup.position.set(0, baseY + (isMagma ? 0.42 : 0.16), -0.05);
    bodyGroup.add(shellGroup);
    return shellGroup;
  }

  if (def.shell.kind === 'spiral_crystal') {
    const tealMat = makeBugMaterial(0x14b8a6, {
      emissive: 0x0d9488,
      emissiveIntensity: 0.4,
      roughness: 0.22,
    });
    matsOut.push(tealMat);
    const outer = new THREE.Mesh(BUG_SHARED_GEO.torus, tealMat);
    outer.scale.setScalar(0.95);
    outer.rotation.y = Math.PI / 2;
    const core = new THREE.Mesh(getCachedRoundedBox(0.45, 0.55, 0.55, 0.12), tealMat);
    shellGroup.add(outer, core);
    shellGroup.position.set(0, baseY + 0.38, -0.18);
    bodyGroup.add(shellGroup);
    return shellGroup;
  }

  return undefined;
}
