import * as THREE from 'three';
import { BUG_SHARED_GEO, getCachedRoundedBox, makeBugMaterial, type BugRigDef } from '../BugRigTypes';
import { ProceduralTextures } from '../../ProceduralTextures';

export interface ShellBuildResult {
  shellMesh?: THREE.Object3D;
  shellHalves?: [THREE.Object3D, THREE.Object3D];
}

export function buildBugShell(
  def: BugRigDef,
  bodyGroup: THREE.Group,
  matsOut: THREE.MeshStandardMaterial[]
): ShellBuildResult {
  if (def.shell.kind === 'none') return {};
  const shellGroup = new THREE.Group();
  const baseY = (def.body.yOffset ?? 0.3) + 0.25;

  // Art Sheet: Rhino Beetle Obsidian Purple shiny dome with split halves for armor shatter
  if (def.shell.kind === 'rhino_dome') {
    const carapaceMat = makeBugMaterial(0x4b2a8c, {
      roughness: 0.28,
      metalness: 0.22,
    });
    const seamMat = makeBugMaterial(0x2b1554, { roughness: 0.5 });
    matsOut.push(carapaceMat, seamMat);

    const makeHalf = (side: -1 | 1) => {
      const halfGrp = new THREE.Group();
      const lobe = new THREE.Mesh(
        new THREE.SphereGeometry(0.48, 14, 10, 0, Math.PI, 0, Math.PI * 0.55),
        carapaceMat
      );
      lobe.scale.set(0.68, 0.72, 1.05);
      lobe.rotation.y = side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      lobe.position.x = side * 0.04;
      lobe.castShadow = true;
      halfGrp.add(lobe);
      shellGroup.add(halfGrp);
      return halfGrp;
    };

    const leftHalf = makeHalf(-1);
    const rightHalf = makeHalf(1);
    const seam = new THREE.Mesh(getCachedRoundedBox(0.06, 0.34, 0.96, 0.02), seamMat);
    seam.position.y = 0.16;
    shellGroup.add(seam);

    shellGroup.position.set(0, baseY - 0.12, -0.05);
    bodyGroup.add(shellGroup);
    return { shellMesh: shellGroup, shellHalves: [leftHalf, rightHalf] };
  }

  // Art Sheet: Terracotta Snail spiral shell (3 shrinking stacked torus rings + cone tip in Mint #A8DDB5)
  if (def.shell.kind === 'snail_terracotta') {
    const tex = ProceduralTextures.getSnailShellTexture();
    const mintMat = makeBugMaterial(tex ? 0xffffff : 0xa8ddb5, {
      map: tex,
      roughness: 0.38,
    });
    matsOut.push(mintMat);

    const radii = [0.54, 0.38, 0.24];
    for (let i = 0; i < radii.length; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radii[i], 0.14 - i * 0.025, 8, 18), mintMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(0, 0.14 + i * 0.05, 0);
      ring.scale.x = 0.7 + i * 0.08;
      ring.castShadow = true;
      shellGroup.add(ring);
    }
    const spire = new THREE.Mesh(BUG_SHARED_GEO.cone, mintMat);
    spire.scale.set(0.24, 0.28, 0.24);
    spire.rotation.z = Math.PI / 2;
    spire.position.set(-0.22, 0.24, 0);
    shellGroup.add(spire);

    shellGroup.position.set(0, baseY + 0.35, -0.2);
    bodyGroup.add(shellGroup);
    return { shellMesh: shellGroup };
  }

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
    return { shellMesh: shellGroup };
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
    return { shellMesh: shellGroup };
  }

  return {};
}
