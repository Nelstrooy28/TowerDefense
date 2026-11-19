import * as THREE from 'three';
import type { EnemyRigRefs } from '../BugRigTypes';

const _legFlip6 = [1, -1, -1, 1, 1, -1];
const _legFlip4 = [1, -1, -1, 1];
const DEG25 = THREE.MathUtils.degToRad(25);
const CORNER_LEAN = THREE.MathUtils.degToRad(6);

export function updateBugWalk(
  rig: EnemyRigRefs,
  speed: number,
  time: number,
  dt: number,
  isFrozen: boolean,
  isStopped: boolean,
  turnDeltaRad: number,
  skipLodSubAnim: boolean
): void {
  // Periodic eye blink every 3..6 seconds (scale.y -> 0.1 for 0.08 s)
  if (rig.eyes && rig.eyes.length > 0 && !skipLodSubAnim) {
    rig.blinkTimer = (rig.blinkTimer ?? 3.5) - dt;
    if (rig.blinkTimer <= -0.08) {
      rig.blinkTimer = 3.0 + ((rig.walkStepHz ?? 5) % 3);
    }
    const blinking = rig.blinkTimer < 0;
    const eyeScaleY = blinking ? 0.1 : 1.0;
    for (let i = 0; i < rig.eyes.length; i++) {
      rig.eyes[i].scale.y = eyeScaleY;
    }
  }

  // Smooth corner bank lean (up to 6 deg)
  const targetBank = THREE.MathUtils.clamp(-turnDeltaRad * 2.4, -CORNER_LEAN, CORNER_LEAN);
  rig.bodyGroup.rotation.z += (targetBank - rig.bodyGroup.rotation.z) * (1 - Math.exp(-10 * dt));

  if (isFrozen || skipLodSubAnim) return;

  // Idle reaction when blocked at Walnut Wall or stunned: look around
  if (isStopped || speed <= 0.05) {
    if (rig.headGroup) {
      rig.headGroup.rotation.y = Math.sin(time * 2.2) * 0.28;
    }
    return;
  }
  if (rig.headGroup) {
    rig.headGroup.rotation.y *= 1 - Math.exp(-10 * dt);
  }

  // Faster walk tempo visually when Rhino Beetle shell cracks off
  const lightBonus = rig.bugType === 'iron_beetle' && rig.shellMesh && !rig.shellMesh.visible ? 1.35 : 1.0;
  const stepHz = (rig.walkStepHz ?? 6.0) * lightBonus * Math.max(0.4, speed / 2.2);
  const phase = time * stepHz * Math.PI * 2;
  const gait = rig.gait ?? 'tripod';

  // Leg gaits
  if (rig.legs.length > 0) {
    if (gait === 'tripod') {
      for (let i = 0; i < rig.legs.length; i++) {
        const sign = _legFlip6[i % 6];
        rig.legs[i].rotation.x = Math.sin(phase) * DEG25 * sign;
      }
    } else if (gait === 'quad' || gait === 'stomp') {
      const amp = gait === 'stomp' ? 0.38 : DEG25;
      for (let i = 0; i < rig.legs.length; i++) {
        const sign = _legFlip4[i % 4];
        rig.legs[i].rotation.x = Math.sin(phase) * amp * sign;
      }
    } else {
      for (let i = 0; i < rig.legs.length; i++) {
        const sign = i % 2 === 0 ? 1 : -1;
        rig.legs[i].rotation.x = Math.sin(phase) * 0.42 * sign;
      }
    }
  }

  // Wing flap (~20 Hz fast wasp blur, ~14 Hz general flyers)
  if (rig.wings.length > 0) {
    const wingHz = rig.bugType === 'spore_wasp' ? 20 : 14;
    const flapAngle = Math.sin(time * wingHz * Math.PI * 2) * (rig.bugType === 'spore_wasp' ? 0.56 : 0.48);
    for (let i = 0; i < rig.wings.length; i++) {
      const sign = i % 2 === 0 ? -1 : 1;
      rig.wings[i].rotation.z = flapAngle * sign;
    }
  }

  // Segment chain gaits (Worm wave & Slither)
  if (rig.segments && rig.segments.length > 0) {
    if (gait === 'worm_wave') {
      for (let i = 0; i < rig.segments.length; i++) {
        const seg = rig.segments[i];
        const w = Math.sin(time * 8 - i * 0.9);
        seg.position.y += w * 0.06 * dt * 15;
        const sq = 1 + w * 0.08;
        seg.scale.set(sq, 1 / sq, sq);
      }
    } else if (gait === 'slither') {
      for (let i = 0; i < rig.segments.length; i++) {
        rig.segments[i].position.x = Math.sin(time * 7 - i * 0.85) * 0.1;
      }
    }
  }

  // Hydra 3 heads gentle sway
  if (rig.hydraHeads.length > 0) {
    for (let i = 0; i < rig.hydraHeads.length; i++) {
      rig.hydraHeads[i].rotation.y = Math.sin(time * 2.5 + i * 2.1) * 0.25;
      rig.hydraHeads[i].rotation.x = Math.cos(time * 3.0 + i * 1.4) * 0.15;
    }
  }

  // Chomp termite jaws
  if (rig.jaws && rig.jaws.length === 2) {
    const bite = Math.abs(Math.sin(time * 9)) * 0.24;
    rig.jaws[0].rotation.y = 0.22 + bite;
    rig.jaws[1].rotation.y = -0.22 - bite;
  }

  // Vertical gait bob / hop / fly float
  const bobAmp = rig.walkBob ?? 0.03;
  if (gait === 'fly_bob') {
    rig.bodyGroup.position.y = Math.sin(time * 3.0) * 0.15 + 0.12;
  } else if (gait === 'hop') {
    const h = Math.abs(Math.sin(time * 6.5));
    rig.bodyGroup.position.y = h * 0.32;
    const stretchY = h > 0.3 ? 1.2 : 0.8; // Art Sheet Doc 03 §2: squash 0.8 -> stretch 1.2 in air
    rig.bodyGroup.scale.set(1 / Math.sqrt(stretchY), stretchY, 1 / Math.sqrt(stretchY));
  } else {
    rig.bodyGroup.position.y = Math.abs(Math.sin(phase)) * bobAmp;
  }
}
