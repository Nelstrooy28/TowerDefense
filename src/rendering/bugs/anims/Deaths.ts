import type { BugDeathKind, EnemyRigRefs } from '../BugRigTypes';

export function animateBugDeathPose(
  rig: EnemyRigRefs,
  deathKind: BugDeathKind,
  poseT: number,
  dt: number
): void {
  switch (deathKind) {
    case 'flip_pop': {
      rig.bodyGroup.rotation.z = Math.min(Math.PI, poseT * Math.PI * 1.45);
      rig.bodyGroup.position.y = Math.sin(poseT * Math.PI) * 0.48;
      break;
    }
    case 'split_goo': {
      const flat = Math.max(0.25, 1 - poseT * 0.72);
      rig.bodyGroup.scale.set(1 + poseT * 0.45, flat, 1 + poseT * 0.45);
      break;
    }
    case 'tumble': {
      // Brood Mantis: stumbles forward, core flashes & fades, Queen crown drops & spins
      rig.bodyGroup.rotation.x = poseT * Math.PI * 0.85;
      rig.bodyGroup.position.z = poseT * 0.65;
      if (rig.mantisCoreMesh) {
        const cMat = rig.mantisCoreMesh.material as { emissiveIntensity?: number };
        if (typeof cMat.emissiveIntensity === 'number') {
          cMat.emissiveIntensity = poseT < 0.45 ? 3.2 : Math.max(0, (1 - poseT) * 2.5);
        }
      }
      if (rig.crownMesh) {
        rig.crownMesh.position.y = Math.max(0.15, (1 - poseT) * 1.1);
        rig.crownMesh.rotation.y += dt * 10;
      }
      break;
    }
    case 'crack_bounce': {
      // Rhino Beetle: rolls on side, shell rocks/splits apart
      rig.bodyGroup.rotation.z = poseT * 1.45;
      if (rig.shellHalves) {
        rig.shellHalves[0].position.x = -poseT * 0.65;
        rig.shellHalves[0].rotation.z = -poseT * 0.9;
        rig.shellHalves[1].position.x = poseT * 0.65;
        rig.shellHalves[1].rotation.z = poseT * 0.9;
      } else if (rig.shellMesh) {
        rig.shellMesh.position.y = 0.4 + Math.sin(poseT * Math.PI) * 1.1;
        rig.shellMesh.rotation.z = poseT * 2.4;
      }
      break;
    }
    case 'silk_melt': {
      if (rig.cocoonMesh) {
        rig.cocoonMesh.visible = true;
        rig.cocoonMesh.scale.set(1 + poseT * 0.25, Math.max(0.2, 1 - poseT * 0.75), 1 + poseT * 0.25);
      } else {
        rig.bodyGroup.scale.set(1 + poseT * 0.35, Math.max(0.2, 1 - poseT * 0.75), 1 + poseT * 0.35);
      }
      break;
    }
    case 'spiral_dust': {
      rig.bodyGroup.rotation.y += dt * 11;
      rig.bodyGroup.rotation.z = poseT * 1.15;
      rig.bodyGroup.position.y = Math.max(-0.5, 0.3 - poseT * 1.1);
      break;
    }
    case 'pop_dizzy': {
      rig.bodyGroup.visible = true;
      if (rig.dirtMound) rig.dirtMound.visible = false;
      rig.bodyGroup.position.y = Math.sin(poseT * Math.PI) * 1.15;
      rig.bodyGroup.rotation.y = poseT * Math.PI * 4;
      if (rig.dizzyGroup) {
        rig.dizzyGroup.visible = true;
        rig.dizzyGroup.rotation.y += dt * 9;
      }
      break;
    }
    case 'snap_crumbs': {
      if (rig.jaws && rig.jaws.length === 2) {
        rig.jaws[0].position.x -= dt * 1.4;
        rig.jaws[1].position.x += dt * 1.4;
      }
      rig.bodyGroup.rotation.x = -poseT * 0.8;
      break;
    }
    case 'flatten_puddle': {
      // Terracotta Snail: shell rolls away to the side while clay body melts into a puddle
      if (rig.shellMesh) {
        rig.shellMesh.position.x += dt * 1.6;
        rig.shellMesh.rotation.z -= dt * 3.5;
      }
      rig.bodyGroup.scale.set(1 + poseT * 0.65, Math.max(0.15, 1 - poseT * 0.85), 1 + poseT * 0.65);
      break;
    }
    case 'coins_spill': {
      rig.bodyGroup.position.y = Math.sin(poseT * Math.PI) * 0.75;
      rig.bodyGroup.rotation.x = poseT * Math.PI;
      break;
    }
    case 'ash_reborn': {
      rig.bodyGroup.rotation.z = poseT * 1.4;
      rig.bodyGroup.scale.setScalar(Math.max(0.25, 1 - poseT * 0.75));
      break;
    }
    case 'boss_implode': {
      const s = 1 + Math.sin(poseT * Math.PI) * 0.18;
      rig.bodyGroup.scale.setScalar(s);
      rig.bodyGroup.rotation.y += dt * 2.5;
      break;
    }
    case 'hydra_wilt': {
      for (let i = 0; i < rig.hydraHeads.length; i++) {
        rig.hydraHeads[i].rotation.x = poseT * (1.2 + i * 0.2);
      }
      rig.bodyGroup.scale.y = Math.max(0.3, 1 - poseT * 0.65);
      break;
    }
    case 'lava_cool': {
      for (const m of rig.bodyMaterials) {
        m.emissiveIntensity = Math.max(0, 1.4 * (1 - poseT));
      }
      rig.bodyGroup.scale.y = Math.max(0.35, 1 - poseT * 0.6);
      break;
    }
    case 'ice_shatter': {
      for (let i = 0; i < rig.wings.length; i++) {
        rig.wings[i].scale.setScalar(Math.max(0.05, 1 - poseT * 1.5));
      }
      rig.bodyGroup.rotation.z = poseT * 1.25;
      break;
    }
  }
}
