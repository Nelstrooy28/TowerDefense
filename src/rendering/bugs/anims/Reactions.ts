import type { EnemyRigRefs } from '../BugRigTypes';

export function updateBugReactions(
  rig: EnemyRigRefs,
  hpRatio: number,
  isStaggered: boolean,
  isSlowedOrFrozen: boolean,
  time: number,
  dt: number
): void {
  // Low HP (<25%) cute sweat drops & slight limp sway
  const isLowHp = hpRatio > 0 && hpRatio < 0.25;
  if (rig.sweatGroup) {
    rig.sweatGroup.visible = isLowHp;
    if (isLowHp) {
      rig.sweatGroup.position.y = Math.sin(time * 12) * 0.06;
    }
  }
  if (isLowHp && !isStaggered) {
    rig.bodyGroup.rotation.z += Math.sin(time * 7) * 0.08;
  }

  // Stun / Stagger orbiting stars
  if (rig.dizzyGroup) {
    const showStars = isStaggered;
    rig.dizzyGroup.visible = showStars;
    if (showStars) {
      rig.dizzyGroup.rotation.y += dt * 5.2;
    }
  }

  // Crown shine gentle tilt when moving cleanly
  if (rig.crownMesh && !isSlowedOrFrozen) {
    rig.crownMesh.rotation.y = Math.sin(time * 1.8) * 0.15;
  }
}
