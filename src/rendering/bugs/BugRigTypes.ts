import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { EnemyTypeId } from '../../data/EnemyRegistry';

export type BugGait =
  | 'tripod'
  | 'quad'
  | 'worm_wave'
  | 'slither'
  | 'fly_bob'
  | 'hop'
  | 'stomp'
  | 'flock';

export type BugDeathKind =
  | 'flip_pop'
  | 'split_goo'
  | 'tumble'
  | 'crack_bounce'
  | 'silk_melt'
  | 'spiral_dust'
  | 'pop_dizzy'
  | 'snap_crumbs'
  | 'flatten_puddle'
  | 'coins_spill'
  | 'ash_reborn'
  | 'boss_implode'
  | 'hydra_wilt'
  | 'lava_cool'
  | 'ice_shatter';

export type BugExtraKind =
  | 'crown'
  | 'horns'
  | 'tiara'
  | 'sack'
  | 'treant_core'
  | 'treant_limbs'
  | 'hydra_heads'
  | 'spore_sack'
  | 'dirt_mound'
  | 'cocoon'
  | 'locust_flock'
  | 'dots'
  | 'racing_stripe';

export interface BugRigDef {
  palette: {
    main: number;
    dark: number;
    accent: number;
    eye?: number;
  };
  head: {
    size: [number, number, number];
    y?: number;
    z?: number;
    antennae?: 'none' | 'bent' | 'feathered' | 'stalks';
    mandibles?: boolean;
    jaws?: boolean;
    moleNose?: boolean;
    goggles?: boolean;
    smile?: boolean;
    hidden?: boolean;
  };
  body: {
    segments: Array<[number, number, number]>;
    yOffset?: number;
    isAphidCluster?: boolean;
    treeBody?: boolean;
  };
  legs: {
    count: 0 | 4 | 6;
    length: number;
    spreadX?: number;
    bladeArms?: boolean;
  };
  wings: {
    kind: 'none' | 'soft' | 'wasp' | 'glow' | 'flame' | 'crystal';
    span?: number;
  };
  shell: {
    kind: 'none' | 'iron_plates' | 'spiral_crystal' | 'spotted_dome' | 'magma_plates';
  };
  extras: BugExtraKind[];
  walk: {
    gait: BugGait;
    stepHz: number;
    bob: number;
  };
  death: BugDeathKind;
}

export interface EnemyRigRefs {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  legs: THREE.Object3D[];
  wings: THREE.Object3D[];
  shellMesh?: THREE.Object3D;
  dirtMound?: THREE.Object3D;
  cocoonMesh?: THREE.Object3D;
  hydraHeads: THREE.Object3D[];
  locustFlock?: THREE.InstancedMesh;
  eliteShieldMesh?: THREE.Mesh;
  frozenShell: THREE.Mesh;
  bodyMeshes: THREE.Mesh[];
  bodyMaterials: THREE.MeshStandardMaterial[];
  // v5 BugRigKit modular handles
  bugType?: EnemyTypeId;
  headGroup?: THREE.Group;
  eyes?: THREE.Object3D[];
  segments?: THREE.Object3D[];
  jaws?: THREE.Object3D[];
  crownMesh?: THREE.Object3D;
  sweatGroup?: THREE.Group;
  dizzyGroup?: THREE.Group;
  gait?: BugGait;
  deathKind?: BugDeathKind;
  walkStepHz?: number;
  walkBob?: number;
  blinkTimer?: number;
}

const ROUND_BOX_CACHE = new Map<string, RoundedBoxGeometry>();
const BASIC_GEO_CACHE = {
  sphere: new THREE.SphereGeometry(0.5, 10, 8),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cone: new THREE.ConeGeometry(0.5, 1, 7),
  torus: new THREE.TorusGeometry(0.5, 0.16, 7, 14),
  capsule: new THREE.CapsuleGeometry(0.055, 0.24, 3, 6),
  icosa: new THREE.IcosahedronGeometry(0.75, 0),
  wingPlane: new THREE.PlaneGeometry(0.65, 0.34),
};

export const BUG_SHARED_GEO = BASIC_GEO_CACHE;

export function getCachedRoundedBox(w: number, h: number, d: number, radius = 0.08): THREE.BufferGeometry {
  const r = Math.min(radius, Math.min(w, h, d) * 0.28);
  const key = `${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}_${r.toFixed(3)}`;
  let geo = ROUND_BOX_CACHE.get(key);
  if (!geo) {
    geo = new RoundedBoxGeometry(w, h, d, 2, r);
    ROUND_BOX_CACHE.set(key, geo);
  }
  return geo;
}

export function makeBugMaterial(
  color: number,
  extra: Partial<THREE.MeshStandardMaterialParameters> = {}
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.48,
    metalness: 0.05,
    ...extra,
  });
  mat.userData.baseEmissiveHex = (extra.emissive as number | undefined) ?? 0x000000;
  mat.userData.baseEmissiveInt = extra.emissiveIntensity ?? 0;
  return mat;
}
