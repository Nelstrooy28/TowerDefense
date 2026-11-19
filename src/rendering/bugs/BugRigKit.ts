import * as THREE from 'three';
import { ENEMIES, type EnemyTypeId } from '../../data/EnemyRegistry';
import { ELITE_MODIFIERS, type EliteModifierId } from '../../data/ModifierConfig';
import { BUG_RIG_DEFS } from './BugRigDefs';
import { BUG_SHARED_GEO, makeBugMaterial, type EnemyRigRefs } from './BugRigTypes';
import { buildBugHead } from './parts/Head';
import { buildBugBody } from './parts/Body';
import { buildBugLegs } from './parts/Legs';
import { buildBugWings } from './parts/Wings';
import { buildBugShell } from './parts/Shell';
import { buildBugExtras } from './parts/Extras';
import { updateBugWalk } from './anims/Walk';
import { updateBugReactions } from './anims/Reactions';
import { animateBugDeathPose } from './anims/Deaths';

export type { EnemyRigRefs, BugGait, BugDeathKind, BugRigDef } from './BugRigTypes';
export { BUG_RIG_DEFS };

export const BugRigKit = {
  buildBugRig(
    type: EnemyTypeId,
    options: { isElite?: boolean; eliteMod?: EliteModifierId | null; isMiniBoss?: boolean } = {}
  ): EnemyRigRefs {
    const enemyDef = ENEMIES[type];
    const rigDef = BUG_RIG_DEFS[type];
    const isElite = Boolean(options.isElite);
    const eliteMod = options.eliteMod ?? null;
    const isMiniBoss = Boolean(options.isMiniBoss);

    const root = new THREE.Group();
    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    const bodyMaterials: THREE.MeshStandardMaterial[] = [];
    const mainMat = makeBugMaterial(rigDef.palette.main, { roughness: 0.45 });
    const darkMat = makeBugMaterial(rigDef.palette.dark, { roughness: 0.58 });
    const accentMat = makeBugMaterial(rigDef.palette.accent, {
      emissive: enemyDef.isBoss ? rigDef.palette.accent : 0x000000,
      emissiveIntensity: enemyDef.isBoss ? 1.4 : 0,
    });
    bodyMaterials.push(mainMat, darkMat, accentMat);

    const { segments, headZ, headY } = buildBugBody(rigDef, bodyGroup, mainMat, darkMat, accentMat, bodyMaterials);
    const headRes = buildBugHead(
      rigDef,
      mainMat,
      darkMat,
      accentMat,
      bodyMaterials,
      rigDef.head.z ?? headZ,
      headY
    );
    bodyGroup.add(headRes.headGroup);

    const legs = buildBugLegs(rigDef, bodyGroup, darkMat, accentMat);
    const wings = buildBugWings(rigDef, bodyGroup, bodyMaterials);
    const shellMesh = buildBugShell(rigDef, bodyGroup, bodyMaterials);
    const extras = buildBugExtras(rigDef, root, bodyGroup, mainMat, darkMat, accentMat, bodyMaterials, {
      isElite,
      eliteMod,
      isMiniBoss,
    });

    const frozenShell = new THREE.Mesh(
      BUG_SHARED_GEO.icosa,
      makeBugMaterial(0x7dd3fc, {
        emissive: 0x38bdf8,
        emissiveIntensity: 0.65,
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
      })
    );
    frozenShell.position.y = 0.55;
    frozenShell.visible = false;
    root.add(frozenShell);

    const modScale = isElite && eliteMod ? ELITE_MODIFIERS[eliteMod].scaleMult : 1.0;
    const bossKingMult = isMiniBoss ? 2.5 : 1.0;
    root.scale.setScalar(enemyDef.scale * modScale * bossKingMult);

    const bodyMeshes: THREE.Mesh[] = [];
    bodyGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        bodyMeshes.push(child as THREE.Mesh);
      }
    });

    return {
      root,
      bodyGroup,
      legs,
      wings,
      shellMesh,
      dirtMound: extras.dirtMound,
      cocoonMesh: extras.cocoonMesh,
      hydraHeads: extras.hydraHeads,
      locustFlock: extras.locustFlock,
      eliteShieldMesh: extras.eliteShieldMesh,
      frozenShell,
      bodyMeshes,
      bodyMaterials,
      bugType: type,
      headGroup: headRes.headGroup,
      eyes: headRes.eyes,
      segments,
      jaws: headRes.jaws,
      crownMesh: extras.crownMesh,
      sweatGroup: extras.sweatGroup,
      dizzyGroup: extras.dizzyGroup,
      gait: rigDef.walk.gait,
      deathKind: rigDef.death,
      walkStepHz: rigDef.walk.stepHz,
      walkBob: rigDef.walk.bob,
      blinkTimer: 3.0 + Math.random() * 2.5,
    };
  },

  animateAlive(
    rig: EnemyRigRefs,
    speed: number,
    time: number,
    dt: number,
    isFrozen: boolean,
    isStopped: boolean,
    turnDeltaRad: number,
    hpRatio: number,
    isStaggered: boolean,
    skipLodSubAnim: boolean
  ): void {
    updateBugWalk(rig, speed, time, dt, isFrozen, isStopped, turnDeltaRad, skipLodSubAnim);
    updateBugReactions(rig, hpRatio, isStaggered, isFrozen, time, dt);
  },

  animateDeathPose(rig: EnemyRigRefs, type: EnemyTypeId, poseT: number, dt: number): void {
    const deathKind = rig.deathKind ?? BUG_RIG_DEFS[type]?.death ?? 'flip_pop';
    animateBugDeathPose(rig, deathKind, poseT, dt);
  },
};
