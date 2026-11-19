import * as THREE from 'three';
import { getUnitById, type UnitDef } from '../data/UnitRegistry';
import { RARITIES, type RarityId } from '../data/RarityConfig';
import { TRAITS, type TraitId } from '../data/TraitConfig';
import type { EnemyTypeId } from '../data/EnemyRegistry';
import type { MapDef } from '../data/MapRegistry';
import type { SoilSkinId } from '../core/SaveManager';
import type { VariantId } from '../data/BalanceConfig';
import { PropKit } from './props/PropKit';
import { BugRigKit, type EnemyRigRefs } from './bugs/BugRigKit';
import {
  applyToonRimShader,
  attachCartoonOutline,
  createCelestialTraitShaderMaterial,
  createRuneRingMaterial,
  createWaterShaderMaterial,
} from './ShaderLib';
import { ProceduralTextures } from './ProceduralTextures';
import type { EliteModifierId } from '../data/ModifierConfig';

export type { EnemyRigRefs };

export interface TowerRigRefs {
  root: THREE.Group;
  basePot: THREE.Group; // Root & Soil Mound collar group
  stemPivot: THREE.Group;
  headTurret: THREE.Group;
  jawUpper: THREE.Group;
  jawLower: THREE.Group;
  auraPlane: THREE.Group;
  roots: THREE.Mesh[];
  rootMats: THREE.MeshStandardMaterial[];
  groundDetails: THREE.Object3D[];
  fallingSeed: THREE.Mesh;
  lv5RuneMesh?: THREE.Mesh;
  orbiters: THREE.Object3D[];
  emissiveParts: THREE.MeshStandardMaterial[];
  traitVisuals: THREE.Object3D[];
  levelStars: THREE.Group;
  stunOverlay: THREE.Group;
}

export interface MapSceneHandles {
  group: THREE.Group;
  groundMesh: THREE.Mesh;
  cliffMeshes: THREE.Mesh[];
  splines: THREE.CatmullRomCurve3[];
  pondMesh: THREE.Mesh;
  waterMat: THREE.ShaderMaterial;
  wobbleProps: THREE.Object3D[];
  mushrooms: THREE.Mesh[];
  bridgeLanterns: THREE.Mesh[];
  sleepingCat: THREE.Group | null;
  lawnmower: THREE.Group | null;
  birdsButterflies: THREE.Group[];
  glassCracks: THREE.Mesh[];
  pollenFlowers: THREE.Mesh[];
  gnomes: THREE.Group[];
  hangingVines: THREE.Mesh[];
  waveFlower: THREE.Group | null;
  lavaBubbles: THREE.Mesh[];
  robins: THREE.Group[];
  spawnMarkers: THREE.Group[];
  rainbowArc: THREE.Mesh | null;
  rotatingBridge?: THREE.Group;
  baseStructure?: THREE.Group;
}

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.5, 14, 12),
  lowSphere: new THREE.SphereGeometry(0.5, 10, 8),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cone: new THREE.ConeGeometry(0.5, 1, 10),
  torus: new THREE.TorusGeometry(0.5, 0.1, 8, 24),
  octahedron: new THREE.OctahedronGeometry(0.5, 0),
  icosahedron: new THREE.IcosahedronGeometry(0.75, 0),
  plane: new THREE.PlaneGeometry(1, 1),
};

// Prebuilt shared custom geometries for v6 Art-Sheet towers (Rule 11 / zero per-tower alloc)
const V6_SPROUT_STEM_GEO = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.14, 0.28, -0.05),
    new THREE.Vector3(0.14, 0.6, 0.06),
    new THREE.Vector3(0, 0.88, 0.04),
  ]),
  14,
  0.07,
  8,
  false
);

const V6_MARIGOLD_STEM_GEO = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, 0.32, 0.03),
    new THREE.Vector3(-0.04, 0.66, 0.06),
    new THREE.Vector3(0, 0.88, 0.08),
  ]),
  12,
  0.06,
  8,
  false
);

const V6_PITCHER_TENDRIL_GEO = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.32, 0.1, 0),
    new THREE.Vector3(0.54, 0.12, 0.34),
    new THREE.Vector3(0.18, 0.1, 0.62),
    new THREE.Vector3(-0.34, 0.12, 0.45),
    new THREE.Vector3(-0.52, 0.15, -0.1),
  ]),
  18,
  0.04,
  7,
  false
);

const V6_PITCHER_BELLY_GEO = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.01, -0.35),
    new THREE.Vector2(0.36, -0.32),
    new THREE.Vector2(0.46, -0.1),
    new THREE.Vector2(0.41, 0.16),
    new THREE.Vector2(0.21, 0.35),
  ],
  16
);

const V6_CACTUS_BARREL_GEO = (() => {
  const g = new THREE.SphereGeometry(0.42, 20, 14);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const rib = 1 + 0.085 * Math.cos(ang * 10);
    pos.setXYZ(i, x * rib, y * 0.92, z * rib);
  }
  g.computeVertexNormals();
  return g;
})();

const V6_STUMP_TRUNK_GEO = (() => {
  const g = new THREE.CylinderGeometry(0.58, 0.74, 0.7, 16, 4);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const flare = y < -0.15 ? 1.12 : 1.0;
    const ridge = 1 + 0.075 * Math.sin(ang * 9 + y * 2.1);
    pos.setXYZ(i, x * ridge * flare, y, z * ridge * flare);
  }
  g.computeVertexNormals();
  return g;
})();

const V6_LILY_PAD_GEO = new THREE.CylinderGeometry(0.55, 0.55, 0.04, 22, 1, false, 0.25, Math.PI * 1.88);
const V6_POT_GEO = new THREE.CylinderGeometry(0.42, 0.32, 0.5, 16);
const V6_POT_SOIL_GEO = new THREE.CylinderGeometry(0.38, 0.36, 0.04, 16);
const V6_POT_RIM_GEO = new THREE.TorusGeometry(0.42, 0.06, 8, 20);
const V6_TRUMPET_HEAD_GEO = new THREE.ConeGeometry(0.22, 0.38, 14, 1, true);
const V6_TRUMPET_MOUTH_GEO = new THREE.TorusGeometry(0.22, 0.05, 8, 16);

/**
 * Rule 11 (§3.3): 6 shared tapered TubeGeometry root shapes built once at startup.
 */
const SHARED_ROOT_GEOS: THREE.TubeGeometry[] = Array.from({ length: 6 }, (_, i) => {
  const arch = 0.08 + (i % 3) * 0.04;
  const bend = ((i % 2 === 0 ? 1 : -1) * (i + 1)) * 0.035;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.06, 0.14, 0),
    new THREE.Vector3(0.28, arch + 0.08, bend),
    new THREE.Vector3(0.52, 0.04, bend * 0.5),
    new THREE.Vector3(0.74, -0.02, 0),
  ]);
  return new THREE.TubeGeometry(curve, 8, 0.065 + (i % 2) * 0.015, 6, false);
});

function makeMat(
  color: number,
  options: {
    roughness?: number;
    metalness?: number;
    emissive?: number;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
    rim?: boolean;
    map?: THREE.Texture | null;
    emissiveMap?: THREE.Texture | null;
    side?: THREE.Side;
  } = {}
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.55,
    metalness: options.metalness ?? 0.1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    map: options.map ?? null,
    emissiveMap: options.emissiveMap ?? null,
    side: options.side ?? THREE.FrontSide,
  });
  if (options.rim !== false) {
    applyToonRimShader(mat);
  }
  return mat;
}

class MeshFactoryImpl {
  public buildTowerRig(
    unitId: string,
    level: number,
    rarity: RarityId,
    trait: TraitId,
    soilSkin: SoilSkinId = 'garden_loam',
    isPrime = false,
    variant: VariantId = 'none'
  ): TowerRigRefs {
    const unit = getUnitById(unitId);
    const root = new THREE.Group();
    const basePot = new THREE.Group();
    const stemPivot = new THREE.Group();
    const headTurret = new THREE.Group();
    const jawUpper = new THREE.Group();
    const jawLower = new THREE.Group();
    const auraPlane = new THREE.Group();
    const roots: THREE.Mesh[] = [];
    const rootMats: THREE.MeshStandardMaterial[] = [];
    const groundDetails: THREE.Object3D[] = [];
    const orbiters: THREE.Object3D[] = [];
    const emissiveParts: THREE.MeshStandardMaterial[] = [];
    const traitVisuals: THREE.Object3D[] = [];

    root.add(auraPlane);
    root.add(basePot);
    basePot.add(stemPivot);
    stemPivot.add(headTurret);
    headTurret.add(jawUpper);
    headTurret.add(jawLower);

    const isGoldenTrait = trait === 'Golden' || isPrime;
    const isCelestialTrait = trait === 'Celestial';
    const rarityColor = RARITIES[rarity].colorNum;

    // 1. Soil Mound & Roots Evolution (§3.1, §3.2, §3.4)
    let moundColor = 0x452c1a;
    let rootColor = 0x6b4423;
    let rootEmissive = 0x000000;
    let rootEmissiveInt = 0;
    let rootMetal = 0.05;
    let rootRough = 0.85;

    if (rarity === 'Uncommon') rootColor = 0x5c5144;
    else if (rarity === 'Rare') {
      rootColor = 0x4338ca;
      rootEmissive = 0x6366f1;
    } else if (rarity === 'Legendary') {
      rootColor = 0x92400e;
      rootEmissive = 0xfbbf24;
    } else if (rarity === 'Mythical') {
      rootColor = 0xbe123c;
      rootEmissive = 0xf43f5e;
    } else if (rarity === 'Godly') {
      rootColor = 0xa855f7;
      rootEmissive = 0xc084fc;
      rootRough = 0.22;
      rootMetal = 0.35;
    } else if (rarity === 'Exclusive') {
      rootColor = 0x2dd4bf;
      rootEmissive = 0x2dd4bf;
      rootRough = 0.18;
      rootMetal = 0.45;
    }

    if (level >= 3) {
      rootEmissive = rarityColor;
      rootEmissiveInt = level >= 5 ? 1.4 : level === 4 ? 0.9 : 0.6;
    }

    // Soil Skin overrides (§3.4)
    if (soilSkin === 'mossy_stone') {
      moundColor = 0x365314;
    } else if (soilSkin === 'crystal_bed') {
      moundColor = 0x164e63;
      rootEmissive = 0x67e8f9;
      rootEmissiveInt = Math.max(rootEmissiveInt, 0.55);
    } else if (soilSkin === 'golden_sand' || isGoldenTrait) {
      moundColor = 0x92400e;
      rootColor = 0xfbbf24;
      rootMetal = 0.82;
      rootRough = 0.25;
    } else if (soilSkin === 'galaxy_soil') {
      moundColor = 0x1e1b4b;
      rootEmissive = 0xc084fc;
      rootEmissiveInt = Math.max(rootEmissiveInt, 0.7);
    } else if (soilSkin === 'lava_rock') {
      moundColor = 0x1c1917;
      rootEmissive = 0xf97316;
      rootEmissiveInt = Math.max(rootEmissiveInt, 0.85);
    }

    const isSproutV6 = unitId === 'tomato_tosser';
    const isCactusV6 = unitId === 'cactus_striker';
    const isPitcherV6 = unitId === 'pineapple_cannon';
    const isMarigoldV6 = unitId === 'money_tree';
    const isLilyV6 = unitId === 'ice_buds';
    const isStumpV6 = unitId === 'walnut_wall';
    const isCustomV6StemOrBase =
      isSproutV6 || isCactusV6 || isPitcherV6 || isMarigoldV6 || isLilyV6 || isStumpV6;

    if (isSproutV6) {
      // Art Sheet Rule 10 exception: Terracotta pot base for Sprout Striker
      const potHex = isGoldenTrait ? 0xfbbf24 : 0xc8643b;
      const rimHex = level >= 5 ? 0xffb300 : isGoldenTrait ? 0xf59e0b : 0x9e4625;
      const pot = new THREE.Mesh(V6_POT_GEO, makeMat(potHex, { roughness: 0.72 }));
      pot.position.y = 0.25;
      pot.castShadow = true;
      pot.receiveShadow = true;
      attachCartoonOutline(pot, potHex, 0.025);

      const rim = new THREE.Mesh(
        V6_POT_RIM_GEO,
        makeMat(rimHex, {
          roughness: level >= 5 ? 0.3 : 0.65,
          metalness: level >= 5 ? 0.6 : 0.05,
        })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.5;
      attachCartoonOutline(rim, rimHex, 0.02);

      const potSoil = new THREE.Mesh(V6_POT_SOIL_GEO, makeMat(0x5b3a22, { roughness: 0.95 }));
      potSoil.position.y = 0.49;
      potSoil.receiveShadow = true;
      basePot.add(pot, rim, potSoil);
    } else if (isLilyV6) {
      // Art Sheet Rule 10 exception: pond water disc + Mint notched lily pad
      const waterGeo = new THREE.CircleGeometry(0.65, 24);
      waterGeo.rotateX(-Math.PI / 2);
      const waterMat = createWaterShaderMaterial(0x0284c7, 0x38bdf8);
      waterMat.uniforms.uRippleAge.value = 10;
      const waterDisc = new THREE.Mesh(waterGeo, waterMat);
      waterDisc.position.y = 0.03;

      const padMat = makeMat(0x5ec9a8, { roughness: 0.52 });
      const pad = new THREE.Mesh(V6_LILY_PAD_GEO, padMat);
      pad.position.y = 0.06;
      pad.receiveShadow = true;
      attachCartoonOutline(pad, 0x5ec9a8, 0.025);
      basePot.add(waterDisc, pad);
    } else if (isStumpV6) {
      // Art Sheet Rule 10 exception: Ironwood Stump's own spreading roots
      const rootHex = 0x5a3a22;
      const stumpRootMat = makeMat(rootHex, { roughness: 0.85 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const rootCone = new THREE.Mesh(GEO.cone, stumpRootMat);
        rootCone.scale.set(0.32, 0.48, 0.32);
        rootCone.position.set(Math.cos(a) * 0.68, 0.16, Math.sin(a) * 0.68);
        rootCone.rotation.z = -Math.cos(a) * 0.88;
        rootCone.rotation.x = Math.sin(a) * 0.88;
        rootCone.castShadow = true;
        attachCartoonOutline(rootCone, rootHex, 0.025);
        basePot.add(rootCone);
        roots.push(rootCone);
        rootMats.push(stumpRootMat);
      }
    } else {
      const moundMat = makeMat(moundColor, { roughness: 0.95, metalness: 0.0 });
      const moundRadius = 0.45 * (1 + level * 0.12);
      const mound = new THREE.Mesh(GEO.lowSphere, moundMat);
      mound.scale.set(moundRadius * 2.1, 0.28 + level * 0.02, moundRadius * 2.1);
      mound.position.y = 0.06;
      mound.receiveShadow = true;
      mound.castShadow = true;
      basePot.add(mound);

      if (isPitcherV6) {
        const tendril = new THREE.Mesh(V6_PITCHER_TENDRIL_GEO, makeMat(0x558b2f, { roughness: 0.6 }));
        tendril.castShadow = true;
        basePot.add(tendril);
      }

      // Radiating Roots using SHARED_ROOT_GEOS (Lv.0: 3, Lv.1: 4, Lv.2+: 5-6)
      const rootCount = level === 0 ? 3 : level === 1 ? 4 : level >= 4 ? 6 : 5;
      for (let i = 0; i < rootCount; i++) {
        const rMat = makeMat(rootColor, {
          metalness: rootMetal,
          roughness: rootRough,
          emissive: rootEmissive,
          emissiveIntensity: rootEmissiveInt,
        });
        rMat.userData.baseEmissiveInt = rootEmissiveInt;
        rootMats.push(rMat);
        if (rootEmissiveInt > 0) emissiveParts.push(rMat);

        const rMesh = new THREE.Mesh(SHARED_ROOT_GEOS[i % SHARED_ROOT_GEOS.length], rMat);
        const ang = (i / rootCount) * Math.PI * 2 + 0.15;
        rMesh.rotation.y = ang;
        const rScale = 0.78 + level * 0.1;
        rMesh.scale.set(rScale, 0.85 + level * 0.06, rScale);
        rMesh.castShadow = true;
        rMesh.receiveShadow = true;
        basePot.add(rMesh);
        roots.push(rMesh);
      }

      // Level 1+ or Cactus 2-pebble detail
      if (isCactusV6) {
        const pebMat = makeMat(0x78716c, { roughness: 0.85 });
        for (const [px, pz] of [[-0.45, 0.32], [0.44, -0.25]]) {
          const pebble = new THREE.Mesh(GEO.lowSphere, pebMat);
          pebble.scale.set(0.22, 0.14, 0.2);
          pebble.position.set(px, 0.08, pz);
          basePot.add(pebble);
          groundDetails.push(pebble);
        }
      } else if (level >= 1 || soilSkin !== 'garden_loam') {
        const stoneCount = level >= 2 ? 5 : 3;
        const stoneCol =
          soilSkin === 'crystal_bed'
            ? 0x67e8f9
            : soilSkin === 'lava_rock'
              ? 0xf97316
              : level >= 2
                ? 0x4d7c0f
                : 0x78716c;
        const stoneMat = makeMat(stoneCol, {
          roughness: soilSkin === 'crystal_bed' ? 0.15 : 0.78,
          emissive: soilSkin === 'lava_rock' || level >= 3 ? stoneCol : 0x000000,
          emissiveIntensity: level >= 4 ? 0.9 : level === 3 ? 0.5 : 0.25,
        });

        for (let i = 0; i < stoneCount; i++) {
          const a = (i / stoneCount) * Math.PI * 2 + 0.5;
          const pebble = new THREE.Mesh(
            soilSkin === 'crystal_bed' ? GEO.octahedron : GEO.lowSphere,
            stoneMat
          );
          pebble.scale.set(0.18, 0.13, 0.16);
          pebble.position.set(Math.cos(a) * 0.44, 0.08, Math.sin(a) * 0.44);
          pebble.castShadow = true;
          basePot.add(pebble);
          groundDetails.push(pebble);
        }
      }
    }

    if (level >= 3) {
      // Tiny mushrooms + 2 orbiting fireflies
      const mushMat = makeMat(rarityColor, { emissive: rarityColor, emissiveIntensity: 0.75 });
      for (let i = 0; i < 2; i++) {
        const a = i * Math.PI + 0.9;
        const m = new THREE.Mesh(GEO.sphere, mushMat);
        m.scale.set(0.16, 0.11, 0.16);
        m.position.set(Math.cos(a) * 0.52, 0.14, Math.sin(a) * 0.52);
        basePot.add(m);
        groundDetails.push(m);
      }
      const flyMat = makeMat(0xfde047, { emissive: 0xfde047, emissiveIntensity: 1.5 });
      for (let i = 0; i < 2; i++) {
        const fly = new THREE.Mesh(GEO.sphere, flyMat);
        fly.scale.setScalar(0.08);
        fly.position.set(i === 0 ? 0.55 : -0.55, 0.48, 0);
        auraPlane.add(fly);
        orbiters.push(fly);
      }
    }

    if (level >= 4) {
      // Blooming mound flowers
      const flMat = makeMat(unit.accentColor, { emissive: unit.accentColor, emissiveIntensity: 0.65 });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.3;
        const fl = new THREE.Mesh(GEO.sphere, flMat);
        fl.scale.set(0.16, 0.08, 0.16);
        fl.position.set(Math.cos(a) * 0.56, 0.14, Math.sin(a) * 0.56);
        basePot.add(fl);
        groundDetails.push(fl);
      }
    }

    let lv5RuneMesh: THREE.Mesh | undefined;
    if (level >= 5) {
      const runeGeo = new THREE.PlaneGeometry(2.2, 2.2);
      runeGeo.rotateX(-Math.PI / 2);
      const runeMat = createRuneRingMaterial(rarityColor);
      lv5RuneMesh = new THREE.Mesh(runeGeo, runeMat);
      lv5RuneMesh.position.y = 0.045;
      auraPlane.add(lv5RuneMesh);
    }

    // Basal ground foliage collar (omitted for Rule-10 custom pot/lily/stump bases)
    if (!isSproutV6 && !isLilyV6 && !isStumpV6) {
      const basalLeaves = 4 + Math.min(4, level);
      const groundLeafMat = makeMat(isGoldenTrait ? 0xfde047 : 0x22c55e, {
        metalness: isGoldenTrait ? 0.75 : 0.05,
        roughness: 0.65,
      });
      for (let i = 0; i < basalLeaves; i++) {
        const a = (i / basalLeaves) * Math.PI * 2 + 0.55;
        const gLeaf = new THREE.Mesh(GEO.sphere, groundLeafMat);
        gLeaf.scale.set(0.36, 0.07, 0.18);
        gLeaf.position.set(Math.cos(a) * 0.38, 0.13, Math.sin(a) * 0.38);
        gLeaf.rotation.y = -a;
        gLeaf.rotation.z = 0.22;
        gLeaf.castShadow = true;
        basePot.add(gLeaf);
        groundDetails.push(gLeaf);
      }
    }

    // Glowing Seed for Placement §4.1 animation (hidden once planted)
    const fallingSeed = new THREE.Mesh(
      GEO.octahedron,
      makeMat(rarityColor, { emissive: rarityColor, emissiveIntensity: 1.5 })
    );
    fallingSeed.scale.set(0.24, 0.34, 0.24);
    fallingSeed.visible = false;
    root.add(fallingSeed);

    // 2. Stem & Leaves (custom curved/low bases for v6 sheet towers, standard cylinder+leaves for others)
    let stemHeight = 0.54 + level * 0.09;
    const stemGrow = level >= 1 ? 1 + Math.min(2, level) * 0.03 + Math.max(0, level - 2) * 0.02 : 1.0;

    const stemMat = makeMat(
      isGoldenTrait ? 0xfbbf24 : isSproutV6 ? 0x4caf50 : isMarigoldV6 ? 0x558b2f : 0x16a34a,
      {
        metalness: isGoldenTrait ? 0.8 : 0.08,
        roughness: isGoldenTrait ? 0.25 : 0.58,
      }
    );
    const leafMat = makeMat(
      isGoldenTrait ? 0xfde047 : isSproutV6 ? 0x4caf50 : isMarigoldV6 ? 0x558b2f : 0x4ade80,
      {
        metalness: isGoldenTrait ? 0.8 : 0.05,
      }
    );

    if (isSproutV6) {
      stemPivot.position.set(0, 0.48, 0);
      const sCurveStem = new THREE.Mesh(V6_SPROUT_STEM_GEO, stemMat);
      sCurveStem.castShadow = true;
      attachCartoonOutline(sCurveStem, 0x4caf50, 0.018);
      stemPivot.add(sCurveStem);

      const thornMat = makeMat(0x2e7d32, { roughness: 0.65 });
      for (let i = 0; i < 3; i++) {
        const thorn = new THREE.Mesh(GEO.cone, thornMat);
        thorn.scale.set(0.08, 0.14, 0.08);
        const side = i % 2 === 0 ? -1 : 1;
        thorn.position.set(side * 0.09, 0.24 + i * 0.2, 0);
        thorn.rotation.z = -side * 1.1;
        stemPivot.add(thorn);
      }
      for (const sx of [-1, 1]) {
        const leaf = new THREE.Mesh(GEO.sphere, leafMat);
        leaf.scale.set(0.25, 0.05, 0.12);
        leaf.position.set(sx * 0.2, sx < 0 ? 0.34 : 0.56, 0.02);
        leaf.rotation.z = sx * 0.35;
        attachCartoonOutline(leaf, 0x4caf50, 0.02);
        stemPivot.add(leaf);
      }
      stemHeight = 1.24;
      headTurret.position.set(0, 0.88, 0.04);
      headTurret.userData.baseY = 0.88;
    } else if (isMarigoldV6) {
      stemPivot.position.set(0, 0.14, 0);
      const curvedStem = new THREE.Mesh(V6_MARIGOLD_STEM_GEO, stemMat);
      curvedStem.castShadow = true;
      attachCartoonOutline(curvedStem, 0x558b2f, 0.016);
      stemPivot.add(curvedStem);
      for (const sx of [-1, 1]) {
        const leaf = new THREE.Mesh(GEO.cone, leafMat);
        leaf.scale.set(0.16, 0.32, 0.08);
        leaf.position.set(sx * 0.16, 0.32 + (sx > 0 ? 0.14 : 0), 0.04);
        leaf.rotation.z = -sx * 1.05;
        attachCartoonOutline(leaf, 0x558b2f, 0.02);
        stemPivot.add(leaf);
      }
      stemHeight = 0.92;
      headTurret.position.set(0, 0.92, 0.08);
      headTurret.userData.baseY = 0.92;
    } else if (isCactusV6 || isPitcherV6 || isLilyV6 || isStumpV6) {
      stemPivot.position.set(0, 0, 0);
      const yBase = isCactusV6 ? 0.42 : isPitcherV6 ? 0.38 : isLilyV6 ? 0.1 : 0.36;
      stemHeight = isCactusV6 ? 0.65 : isPitcherV6 ? 0.72 : isLilyV6 ? 0.35 : 0.65;
      headTurret.position.set(0, yBase, 0);
      headTurret.userData.baseY = yBase;
    } else {
      stemPivot.position.set(0, 0.14, 0);
      const stemMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, stemHeight, 8),
        stemMat
      );
      stemMesh.position.y = stemHeight * 0.5;
      stemMesh.castShadow = true;
      attachCartoonOutline(stemMesh, 0x16a34a, 0.02);
      stemPivot.add(stemMesh);

      const leafCount = 2 + Math.min(4, level);
      for (let i = 0; i < leafCount; i++) {
        const leaf = new THREE.Mesh(GEO.sphere, leafMat);
        leaf.scale.set(0.36, 0.08, 0.18);
        const ang = (i / leafCount) * Math.PI * 2 + 0.4;
        leaf.position.set(Math.cos(ang) * 0.22, 0.18 + (i % 2) * 0.14, Math.sin(ang) * 0.22);
        leaf.rotation.y = -ang;
        leaf.rotation.z = 0.35;
        leaf.castShadow = true;
        stemPivot.add(leaf);
      }

      headTurret.position.set(0, stemHeight + 0.18, 0);
      headTurret.userData.baseY = stemHeight + 0.18;
    }

    if (isCustomV6StemOrBase && stemGrow !== 1) {
      stemPivot.scale.setScalar(stemGrow);
    }

    // 3. Unit-Specific Procedural Sculpture (with Variant Sheen overrides Doc 06 §6)
    const variantGold = variant === 'gold';
    const variantSilver = variant === 'silver';
    const variantBronze = variant === 'bronze';
    const variantGlass = variant === 'glass';
    const variantRainbow = variant === 'rainbow';

    const pColor = isGoldenTrait || variantGold
      ? 0xfbbf24
      : variantSilver
        ? 0xe2e8f0
        : variantBronze
          ? 0xd97706
          : unit.primaryColor;
    const sColor = isGoldenTrait || variantGold
      ? 0xf59e0b
      : variantSilver
        ? 0x94a3b8
        : variantBronze
          ? 0x92400e
          : unit.secondaryColor;
    const aColor = variantRainbow ? 0xf472b6 : unit.accentColor;

    const metallicBoost = variantGold || variantSilver || variantBronze || isGoldenTrait;
    const mainMat = makeMat(pColor, {
      metalness: metallicBoost ? 0.85 : variantGlass ? 0.25 : 0.15,
      roughness: metallicBoost ? 0.22 : variantGlass ? 0.12 : 0.45,
      transparent: variantGlass,
      opacity: variantGlass ? 0.72 : 1,
      emissive: variantRainbow ? 0xa855f7 : 0x000000,
      emissiveIntensity: variantRainbow ? 0.65 : 0,
    });
    const secMat = makeMat(sColor, {
      metalness: metallicBoost ? 0.78 : 0.2,
      roughness: metallicBoost ? 0.26 : 0.5,
      transparent: variantGlass,
      opacity: variantGlass ? 0.78 : 1,
    });
    const veinMat = makeMat(aColor, {
      emissive: aColor,
      emissiveIntensity: variantRainbow ? 1.8 : level >= 5 ? 1.85 : level >= 3 ? 1.2 : 0.25,
      roughness: 0.25,
    });
    emissiveParts.push(veinMat);

    this.populateUnitHead(
      unit,
      level,
      headTurret,
      jawUpper,
      jawLower,
      mainMat,
      secMat,
      veinMat,
      orbiters,
      emissiveParts,
      variant !== 'none' || isGoldenTrait
    );

    // 4. Level 5 Awakened Halo / Crown
    if (level >= 5 || isPrime) {
      const crownCol = isPrime ? 0xfbbf24 : unit.accentColor;
      const crownMat = makeMat(crownCol, {
        emissive: crownCol,
        emissiveIntensity: 1.75,
        roughness: 0.2,
      });
      emissiveParts.push(crownMat);
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 24), crownMat);
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 0.72;
      headTurret.add(crown);
      orbiters.push(crown);

      for (let i = 0; i < 4; i++) {
        const shard = new THREE.Mesh(GEO.octahedron, crownMat);
        shard.scale.set(0.12, 0.2, 0.12);
        const a = (i / 4) * Math.PI * 2;
        shard.position.set(Math.cos(a) * 0.48, 0.72, Math.sin(a) * 0.48);
        headTurret.add(shard);
        orbiters.push(shard);
      }
    }

    this.buildRarityAura(auraPlane, rarity, orbiters);
    this.buildTraitIndicators(trait, basePot, headTurret, traitVisuals, orbiters, isCelestialTrait);

    const traitScale = TRAITS[trait].modelScale * (isPrime ? 1.08 : 1.0);
    root.scale.setScalar(traitScale);

    // Level Stars Indicator
    const levelStars = new THREE.Group();
    levelStars.position.set(0, stemHeight + 0.88, 0);
    for (let i = 0; i < level; i++) {
      const star = new THREE.Mesh(
        GEO.octahedron,
        makeMat(level === 5 ? 0xfde047 : 0xfbbf24, {
          emissive: 0xfbbf24,
          emissiveIntensity: level === 5 ? 1.5 : 0.7,
        })
      );
      star.scale.setScalar(0.12);
      const xOff = (i - (level - 1) / 2) * 0.2;
      star.position.set(xOff, 0, 0);
      levelStars.add(star);
    }
    root.add(levelStars);

    const stunOverlay = new THREE.Group();
    stunOverlay.position.set(0, stemHeight + 0.72, 0);
    stunOverlay.visible = false;
    const starMat = makeMat(0xfde047, { emissive: 0xfacc15, emissiveIntensity: 1.5 });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(GEO.octahedron, starMat);
      s.scale.setScalar(0.14);
      const a = (i / 3) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.48, 0, Math.sin(a) * 0.48);
      stunOverlay.add(s);
    }
    root.add(stunOverlay);

    return {
      root,
      basePot,
      stemPivot,
      headTurret,
      jawUpper,
      jawLower,
      auraPlane,
      roots,
      rootMats,
      groundDetails,
      fallingSeed,
      lv5RuneMesh,
      orbiters,
      emissiveParts,
      traitVisuals,
      levelStars,
      stunOverlay,
    };
  }

  private populateUnitHead(
    unit: UnitDef,
    level: number,
    headTurret: THREE.Group,
    jawUpper: THREE.Group,
    jawLower: THREE.Group,
    mainMat: THREE.MeshStandardMaterial,
    secMat: THREE.MeshStandardMaterial,
    veinMat: THREE.MeshStandardMaterial,
    orbiters: THREE.Object3D[],
    emissiveParts: THREE.MeshStandardMaterial[],
    hasVariantOverride = false
  ): void {
    const id = unit.id;
    const blackEyeMat = makeMat(0x0f172a, { roughness: 0.12, rim: false });
    const eyeShineMat = makeMat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5, rim: false });

    if (id === 'tomato_tosser') {
      // Art Sheet: Sprout Striker — sideways trumpet shooter head with cream mouth
      const mouthCol = 0xf5e9c8;
      const mouthMat = makeMat(mouthCol, {
        emissive: level >= 3 ? mouthCol : 0x000000,
        emissiveIntensity: level >= 5 ? 1.25 : level >= 3 ? 0.55 : 0,
      });
      const hornMat = mainMat.clone();
      hornMat.side = THREE.DoubleSide;
      const throatMat = makeMat(0x1b5e20, { roughness: 0.9, rim: false });

      const addTrumpetHead = (ox: number, oy: number, oz: number, sc: number) => {
        const g = new THREE.Group();
        g.position.set(ox, oy, oz);
        g.scale.setScalar(sc);

        const cone = new THREE.Mesh(V6_TRUMPET_HEAD_GEO, hornMat);
        cone.rotation.x = -Math.PI / 2;
        cone.castShadow = true;
        attachCartoonOutline(cone, unit.primaryColor, 0.025);

        const mouth = new THREE.Mesh(V6_TRUMPET_MOUTH_GEO, mouthMat);
        mouth.position.z = 0.19;
        attachCartoonOutline(mouth, mouthCol, 0.02);

        const throat = new THREE.Mesh(GEO.sphere, throatMat);
        throat.scale.set(0.26, 0.26, 0.16);
        throat.position.z = 0.06;

        for (const sx of [-0.09, 0.09]) {
          const eye = new THREE.Mesh(GEO.sphere, blackEyeMat);
          eye.scale.setScalar(0.085);
          eye.position.set(sx, 0.11, -0.02);
          const shine = new THREE.Mesh(GEO.sphere, eyeShineMat);
          shine.scale.setScalar(0.032);
          shine.position.set(sx + 0.014, 0.13, 0.02);
          g.add(eye, shine);
        }
        g.add(cone, mouth, throat);
        headTurret.add(g);
      };

      addTrumpetHead(0, 0.02, 0.08, level >= 1 ? 1.06 : 1.0);
      if (level >= 5) {
        addTrumpetHead(-0.26, 0.16, 0.02, 0.72);
        addTrumpetHead(0.26, 0.16, 0.02, 0.72);
      }
    } else if (id === 'cactus_striker') {
      // Art Sheet: Needle Barrel Cactus — fat ribbed barrel + 24 white spines + magenta flower scope
      const barrel = new THREE.Mesh(V6_CACTUS_BARREL_GEO, mainMat);
      barrel.castShadow = true;
      attachCartoonOutline(barrel, unit.primaryColor, 0.025);
      headTurret.add(barrel);

      // Subtle lighter vertical rib strips (#2E7D32)
      const stripeMat = makeMat(0x2e7d32, { roughness: 0.65 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const rib = new THREE.Mesh(GEO.cylinder, stripeMat);
        rib.scale.set(0.06, 0.64, 0.06);
        rib.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
        headTurret.add(rib);
      }

      // 24 white spines in rows (pink-glowing tips at Lv5)
      const spineMat = makeMat(level >= 5 ? 0xf9a8d4 : 0xfafafa, {
        emissive: level >= 5 ? 0xe91e8c : 0x000000,
        emissiveIntensity: level >= 5 ? 1.2 : 0,
      });
      for (let i = 0; i < 24; i++) {
        const ring = Math.floor(i / 8); // 3 rows of 8
        const a = ((i % 8) / 8) * Math.PI * 2 + ring * 0.25;
        const lat = (ring - 1) * 0.45;
        const r = Math.cos(lat) * 0.43;
        const y = Math.sin(lat) * 0.36;
        const spine = new THREE.Mesh(GEO.cone, spineMat);
        spine.scale.set(0.045, 0.14, 0.045);
        spine.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        spine.lookAt(Math.cos(a) * 2, y * 2, Math.sin(a) * 2);
        spine.rotateX(Math.PI / 2);
        headTurret.add(spine);
      }

      // Magenta flower "scope" on top (inside jawUpper so Animator can squeeze it on sniper aim)
      jawUpper.position.set(0, 0.42, 0);
      const centerDot = new THREE.Mesh(
        GEO.sphere,
        makeMat(0xfde047, { emissive: 0xfacc15, emissiveIntensity: 0.85 })
      );
      centerDot.scale.setScalar(0.16);
      jawUpper.add(centerDot);

      const addFlowerRing = (petalCount: number, radius: number, yOff: number, petalScale: number) => {
        for (let i = 0; i < petalCount; i++) {
          const a = (i / petalCount) * Math.PI * 2;
          const p = new THREE.Mesh(GEO.octahedron, secMat);
          p.scale.set(0.14 * petalScale, 0.1 * petalScale, 0.24 * petalScale);
          p.position.set(Math.cos(a) * radius, yOff, Math.sin(a) * radius);
          p.rotation.y = -a + Math.PI / 2;
          attachCartoonOutline(p, unit.secondaryColor, 0.02);
          jawUpper.add(p);
        }
      };
      addFlowerRing(8, 0.18, 0.02, 1.0);
      if (level >= 5) {
        addFlowerRing(8, 0.22, 0.1, 0.85);
      }
    } else if (id === 'pineapple_cannon') {
      // Art Sheet: Pitcher Mortar — bulbous chartreuse/violet striped belly, angled rim, hinged lid, glowing lime sap
      const stripeTex = !hasVariantOverride ? ProceduralTextures.getPitcherStripesTexture() : null;
      const bellyMat = stripeTex
        ? makeMat(0xffffff, {
            map: stripeTex,
            emissive: level >= 4 ? 0x7b3fa0 : 0x000000,
            emissiveIntensity: level >= 5 ? 0.85 : level >= 4 ? 0.35 : 0,
            roughness: 0.55,
          })
        : mainMat;
      const belly = new THREE.Mesh(V6_PITCHER_BELLY_GEO, bellyMat);
      belly.castShadow = true;
      attachCartoonOutline(belly, unit.primaryColor, 0.025);
      headTurret.add(belly);

      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.25, 14), mainMat);
      neck.position.set(0, 0.42, 0.03);
      neck.rotation.x = 0.16;
      neck.castShadow = true;
      attachCartoonOutline(neck, unit.primaryColor, 0.02);
      headTurret.add(neck);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 18), secMat);
      rim.rotation.x = Math.PI / 2 + 0.16;
      rim.position.set(0, 0.54, 0.05);
      attachCartoonOutline(rim, unit.secondaryColor, 0.022);
      headTurret.add(rim);

      const sapMat = makeMat(0xd4ff5a, {
        emissive: 0xd4ff5a,
        emissiveIntensity: 1.35,
        roughness: 0.15,
      });
      emissiveParts.push(sapMat);
      const sapGlow = new THREE.Mesh(GEO.cylinder, sapMat);
      sapGlow.scale.set(0.32, 0.05, 0.32);
      sapGlow.position.set(0, 0.52, 0.05);
      sapGlow.rotation.x = 0.16;
      headTurret.add(sapGlow);

      // Hinged chartreuse lid in jawUpper
      jawUpper.position.set(0, 0.57, -0.15);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 14), mainMat);
      lid.position.set(0, 0.03, 0.2);
      lid.rotation.x = -0.35;
      attachCartoonOutline(lid, unit.primaryColor, 0.02);
      const lidTip = new THREE.Mesh(GEO.cone, secMat);
      lidTip.scale.set(0.12, 0.16, 0.12);
      lidTip.position.set(0, 0.1, 0.38);
      lidTip.rotation.x = 0.7;
      jawUpper.add(lid, lidTip);
      if (level >= 5) {
        const lid2 = lid.clone();
        lid2.scale.set(0.75, 1, 0.75);
        lid2.position.set(0, 0.14, 0.16);
        jawUpper.add(lid2);
      }
    } else if (id === 'money_tree') {
      // Art Sheet: Solar Marigold — big tilted gold flower with glowing amber center
      const flowerGroup = new THREE.Group();
      flowerGroup.rotation.x = -0.35;
      headTurret.add(flowerGroup);

      const amberMat = makeMat(0xff6f00, {
        emissive: 0xff6f00,
        emissiveIntensity: level >= 5 ? 1.6 : 1.4,
        roughness: 0.25,
      });
      emissiveParts.push(amberMat);
      const centerOrb = new THREE.Mesh(GEO.sphere, amberMat);
      centerOrb.scale.set(0.42, 0.42, 0.26);
      attachCartoonOutline(centerOrb, 0xff6f00, 0.025);
      flowerGroup.add(centerOrb);

      const bumpMat = makeMat(0xb45309, { roughness: 0.7 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const bump = new THREE.Mesh(GEO.sphere, bumpMat);
        bump.scale.setScalar(0.06);
        bump.position.set(Math.cos(a) * 0.11, Math.sin(a) * 0.11, 0.12);
        flowerGroup.add(bump);
      }

      const ringCount = level >= 5 ? 3 : 2;
      for (let r = 0; r < ringCount; r++) {
        const count = 10;
        const rad = 0.34 + r * 0.1;
        const zOff = -0.03 * r;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + r * 0.31;
          const petal = new THREE.Mesh(GEO.sphere, mainMat);
          petal.scale.set(0.16, 0.32, 0.07);
          petal.position.set(Math.cos(a) * rad, Math.sin(a) * rad, zOff);
          petal.rotation.z = a - Math.PI / 2;
          petal.rotation.y = 0.18;
          attachCartoonOutline(petal, unit.primaryColor, 0.02);
          flowerGroup.add(petal);
        }
      }

      const coinCount = 2 + level;
      for (let i = 0; i < coinCount; i++) {
        const coin = new THREE.Mesh(GEO.cylinder, veinMat);
        coin.scale.set(0.14, 0.035, 0.14);
        coin.rotation.x = Math.PI / 2;
        const a = (i / coinCount) * Math.PI * 2;
        coin.position.set(Math.cos(a) * 0.56, Math.sin(a) * 0.25, Math.sin(a) * 0.56);
        headTurret.add(coin);
        orbiters.push(coin);
      }
    } else if (id === 'ghost_pepper') {
      const pepper = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.85, 10), mainMat);
      pepper.position.y = 0.28;
      pepper.castShadow = true;
      headTurret.add(pepper);
      const flameCore = new THREE.Mesh(GEO.octahedron, veinMat);
      flameCore.scale.set(0.32, 0.42, 0.32);
      flameCore.position.set(0, 0.15, 0.22);
      headTurret.add(flameCore);
      for (const sx of [-0.12, 0.12]) {
        const eye = new THREE.Mesh(GEO.sphere, veinMat);
        eye.scale.setScalar(0.11);
        eye.position.set(sx, 0.28, 0.24);
        headTurret.add(eye);
      }
    } else if (id === 'sonic_bloom') {
      const core = new THREE.Mesh(GEO.sphere, secMat);
      core.scale.setScalar(0.45);
      core.position.y = 0.2;
      headTurret.add(core);
      const petals = 6 + (level >= 3 ? 2 : 0);
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2;
        const p = new THREE.Mesh(GEO.box, mainMat);
        p.scale.set(0.24, 0.42, 0.08);
        p.position.set(Math.cos(a) * 0.38, 0.26, Math.sin(a) * 0.38);
        p.rotation.y = -a + Math.PI / 2;
        p.rotation.x = 0.35;
        headTurret.add(p);
      }
      const speakerRing = new THREE.Mesh(GEO.torus, veinMat);
      speakerRing.scale.setScalar(0.56);
      speakerRing.position.set(0, 0.24, 0.2);
      headTurret.add(speakerRing);
    } else if (id === 'ice_buds') {
      // Art Sheet: Cryo Water-Lily — 2 opposite-rotating rings of 8 Ice Cyan crystal octahedrons + glowing white core
      const petalMat = makeMat(0x9be7f5, {
        emissive: 0x9be7f5,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.85,
        roughness: 0.15,
      });
      emissiveParts.push(petalMat);

      const addPetalRing = (ringRadius: number, yPos: number, tilt: number, spinDir: number, scaleMult: number) => {
        const ringGrp = new THREE.Group();
        ringGrp.position.y = yPos;
        ringGrp.userData.spinDir = spinDir;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const petal = new THREE.Mesh(GEO.octahedron, petalMat);
          petal.scale.set(0.16 * scaleMult, 0.34 * scaleMult, 0.12 * scaleMult);
          petal.position.set(Math.cos(a) * ringRadius, 0.08, Math.sin(a) * ringRadius);
          petal.rotation.y = -a + Math.PI / 2;
          petal.rotation.x = tilt;
          attachCartoonOutline(petal, 0x9be7f5, 0.02);
          ringGrp.add(petal);
        }
        headTurret.add(ringGrp);
        orbiters.push(ringGrp);
      };

      addPetalRing(0.32, 0.02, 0.72, 1, 1.0);
      addPetalRing(0.19, 0.08, 0.4, -1, 0.85);
      if (level >= 5) {
        addPetalRing(0.11, 0.16, 0.22, 1, 0.72);
      }

      const coreMat = makeMat(0xffffff, {
        emissive: 0xffffff,
        emissiveIntensity: 1.5,
        roughness: 0.1,
      });
      emissiveParts.push(coreMat);
      const core = new THREE.Mesh(GEO.octahedron, coreMat);
      core.scale.setScalar(0.24);
      core.position.y = 0.18;
      headTurret.add(core);
    } else if (id === 'speed_sprinkler') {
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.42, 10), secMat);
      hub.position.y = 0.18;
      headTurret.add(hub);
      const bar = new THREE.Mesh(GEO.box, mainMat);
      bar.scale.set(0.95, 0.1, 0.14);
      bar.position.y = 0.35;
      headTurret.add(bar);
      orbiters.push(bar);
      if (level >= 3) {
        const bar2 = new THREE.Mesh(GEO.box, veinMat);
        bar2.scale.set(0.14, 0.1, 0.95);
        bar2.position.y = 0.35;
        headTurret.add(bar2);
        orbiters.push(bar2);
      }
    } else if (id === 'laser_plant') {
      const housing = new THREE.Mesh(GEO.sphere, secMat);
      housing.scale.set(0.72, 0.72, 0.85);
      housing.position.y = 0.24;
      housing.castShadow = true;
      headTurret.add(housing);
      const lens = new THREE.Mesh(GEO.sphere, veinMat);
      lens.scale.set(0.36, 0.36, 0.24);
      lens.position.set(0, 0.24, 0.38);
      headTurret.add(lens);
      const fins = level >= 3 ? 4 : 2;
      for (let i = 0; i < fins; i++) {
        const fin = new THREE.Mesh(GEO.box, mainMat);
        fin.scale.set(0.12, 0.45, 0.26);
        const a = (i / fins) * Math.PI * 2;
        fin.position.set(Math.cos(a) * 0.38, 0.24, Math.sin(a) * 0.38);
        fin.rotation.y = -a;
        headTurret.add(fin);
      }
    } else if (id === 'venus_flytrap') {
      jawUpper.position.set(0, 0.2, 0);
      jawLower.position.set(0, 0.12, 0);
      const upperShell = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        mainMat
      );
      upperShell.rotation.x = -0.35;
      upperShell.scale.set(1, 0.8, 1.3);
      jawUpper.add(upperShell);

      const lowerShell = new THREE.Mesh(
        new THREE.SphereGeometry(0.44, 12, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
        secMat
      );
      lowerShell.scale.set(1, 0.8, 1.3);
      jawLower.add(lowerShell);

      for (let i = -2; i <= 2; i++) {
        const tooth = new THREE.Mesh(GEO.cone, veinMat);
        tooth.scale.set(0.08, 0.18, 0.08);
        tooth.position.set(i * 0.14, -0.02, 0.46 - Math.abs(i) * 0.06);
        tooth.rotation.x = Math.PI;
        jawUpper.add(tooth);
      }
      jawUpper.rotation.x = THREE.MathUtils.degToRad(-28);
    } else if (id === 'ancient_moss_golem') {
      const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), secMat);
      torso.scale.set(1.15, 0.95, 0.95);
      torso.position.y = 0.28;
      torso.castShadow = true;
      headTurret.add(torso);
      const mossCap = new THREE.Mesh(GEO.sphere, mainMat);
      mossCap.scale.set(1.05, 0.45, 0.95);
      mossCap.position.y = 0.65;
      headTurret.add(mossCap);
      for (const sx of [-0.68, 0.68]) {
        const arm = new THREE.Mesh(GEO.box, secMat);
        arm.scale.set(0.34, 0.72, 0.34);
        arm.position.set(sx, 0.22, 0.16);
        arm.castShadow = true;
        jawUpper.add(arm);
      }
      for (const sx of [-0.18, 0.18]) {
        const eye = new THREE.Mesh(GEO.box, veinMat);
        eye.scale.set(0.14, 0.08, 0.1);
        eye.position.set(sx, 0.35, 0.52);
        headTurret.add(eye);
      }
    } else if (id === 'bamboo_archer') {
      // Tall segmented bamboo stalk + leaf bow
      for (let seg = 0; seg < 3; seg++) {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.32, 8), seg % 2 === 0 ? mainMat : secMat);
        cyl.position.y = 0.12 + seg * 0.32;
        cyl.castShadow = true;
        headTurret.add(cyl);
      }
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 6, 14, Math.PI * 1.15), veinMat);
      bow.position.set(0, 0.55, 0.2);
      bow.rotation.y = Math.PI / 2;
      bow.rotation.z = -Math.PI * 0.55;
      headTurret.add(bow);
    } else if (id === 'puffball_mushroom') {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
        mainMat
      );
      cap.position.y = 0.22;
      cap.castShadow = true;
      headTurret.add(cap);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spot = new THREE.Mesh(GEO.sphere, i % 2 === 0 ? secMat : veinMat);
        spot.scale.setScalar(0.15);
        spot.position.set(Math.cos(a) * 0.36, 0.42, Math.sin(a) * 0.36);
        headTurret.add(spot);
      }
    } else if (id === 'sunflower_beacon') {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 14), secMat);
      disc.rotation.x = Math.PI / 2;
      disc.position.y = 0.36;
      headTurret.add(disc);
      const petals = level >= 3 ? 12 : 8;
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2;
        const p = new THREE.Mesh(GEO.sphere, i % 2 === 0 ? mainMat : veinMat);
        p.scale.set(0.18, 0.32, 0.08);
        p.position.set(Math.cos(a) * 0.48, 0.36 + Math.sin(a) * 0.48, 0);
        p.rotation.z = a - Math.PI / 2;
        headTurret.add(p);
      }
      const sunCore = new THREE.Mesh(GEO.sphere, veinMat);
      sunCore.scale.setScalar(0.32);
      sunCore.position.set(0, 0.36, 0.06);
      headTurret.add(sunCore);
    } else if (id === 'bramble_snare') {
      const matCoils = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 6, 16), mainMat);
      matCoils.rotation.x = Math.PI / 2;
      matCoils.position.y = -0.35;
      headTurret.add(matCoils);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spike = new THREE.Mesh(GEO.cone, veinMat);
        spike.scale.set(0.14, 0.42, 0.14);
        spike.position.set(Math.cos(a) * 0.34, -0.22, Math.sin(a) * 0.34);
        spike.rotation.z = -Math.cos(a) * 0.3;
        spike.rotation.x = Math.sin(a) * 0.3;
        headTurret.add(spike);
      }
    } else if (id === 'garden_roller') {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.88, 12), secMat);
      drum.rotation.z = Math.PI / 2;
      drum.position.y = 0.05;
      drum.castShadow = true;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.22, 12), veinMat);
      band.rotation.z = Math.PI / 2;
      band.position.y = 0.05;
      const frame = new THREE.Mesh(GEO.box, mainMat);
      frame.scale.set(0.95, 0.12, 0.45);
      frame.position.set(0, 0.45, -0.1);
      headTurret.add(drum, band, frame);
    } else if (id === 'gnome_barracks') {
      const cabin = new THREE.Mesh(GEO.box, secMat);
      cabin.scale.set(0.85, 0.65, 0.78);
      cabin.position.y = 0.1;
      cabin.castShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.62, 4), mainMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 0.72;
      roof.castShadow = true;
      const door = new THREE.Mesh(GEO.box, veinMat);
      door.scale.set(0.28, 0.42, 0.08);
      door.position.set(0, -0.02, 0.4);
      headTurret.add(cabin, roof, door);
    } else if (id === 'walnut_wall') {
      // Art Sheet: Ironwood Stump — gnarled walnut trunk + mossy top disc + glowing amber sap cracks
      const crackTex = !hasVariantOverride ? ProceduralTextures.getStumpSapCrackTexture() : null;
      const topTex = !hasVariantOverride ? ProceduralTextures.getStumpTopTexture() : null;
      const trunkMat = makeMat(hasVariantOverride ? mainMat.color.getHex() : 0x5a3a22, {
        roughness: 0.82,
        emissive: 0xffa726,
        emissiveMap: crackTex,
        emissiveIntensity: crackTex ? 1.3 : level >= 3 ? 0.7 : 0.25,
      });
      trunkMat.userData.isStumpSapMat = true;
      emissiveParts.push(trunkMat);

      const trunk = new THREE.Mesh(V6_STUMP_TRUNK_GEO, trunkMat);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      attachCartoonOutline(trunk, 0x5a3a22, 0.025);
      headTurret.add(trunk);

      const topMat = topTex
        ? makeMat(0xffffff, { map: topTex, roughness: 0.78 })
        : secMat;
      const topDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.06, 16), topMat);
      topDisc.position.y = 0.36;
      topDisc.receiveShadow = true;
      headTurret.add(topDisc);

      const mossRimMat = makeMat(0x7ca33a, { roughness: 0.8 });
      const mossRim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.075, 7, 16), mossRimMat);
      mossRim.rotation.x = Math.PI / 2;
      mossRim.position.y = 0.36;
      attachCartoonOutline(mossRim, 0x7ca33a, 0.02);
      headTurret.add(mossRim);

      const knot = new THREE.Mesh(GEO.torus, makeMat(0x3e2715, { roughness: 0.85 }));
      knot.scale.setScalar(0.18);
      knot.position.set(0.58, 0.02, 0.14);
      knot.rotation.y = Math.PI * 0.42;
      headTurret.add(knot);

      if (level >= 5) {
        const saplingStem = new THREE.Mesh(GEO.cylinder, makeMat(0x7ca33a));
        saplingStem.scale.set(0.06, 0.32, 0.06);
        saplingStem.position.set(0.18, 0.52, -0.05);
        const saplingLeaf = new THREE.Mesh(GEO.sphere, makeMat(0x4caf50, { emissive: 0x4caf50, emissiveIntensity: 0.45 }));
        saplingLeaf.scale.set(0.28, 0.08, 0.15);
        saplingLeaf.position.set(0.26, 0.66, -0.05);
        saplingLeaf.rotation.z = 0.35;
        headTurret.add(saplingStem, saplingLeaf);
      }
    } else if (id === 'sunflower_producer') {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 12), secMat);
      disc.rotation.x = Math.PI / 2;
      disc.position.y = 0.34;
      headTurret.add(disc);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const petal = new THREE.Mesh(GEO.sphere, mainMat);
        petal.scale.set(0.16, 0.28, 0.08);
        petal.position.set(Math.cos(a) * 0.42, 0.34 + Math.sin(a) * 0.42, 0);
        petal.rotation.z = a - Math.PI / 2;
        headTurret.add(petal);
      }
      const coinGem = new THREE.Mesh(GEO.octahedron, veinMat);
      coinGem.scale.setScalar(0.22);
      coinGem.position.set(0, 0.78, 0);
      headTurret.add(coinGem);
      orbiters.push(coinGem);
    } else {
      // Elemental Chrono-Bloom
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.12, 16), mainMat);
      dial.rotation.x = Math.PI / 2;
      dial.position.y = 0.34;
      headTurret.add(dial);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.06, 8, 28), secMat);
      ring.position.y = 0.34;
      headTurret.add(ring);

      const orbColors = [0xf97316, 0x38bdf8, 0xa855f7];
      for (let i = 0; i < 3; i++) {
        const orbMat = makeMat(orbColors[i], {
          emissive: orbColors[i],
          emissiveIntensity: 1.8,
        });
        const orb = new THREE.Mesh(GEO.sphere, orbMat);
        orb.scale.setScalar(0.24);
        const a = (i / 3) * Math.PI * 2;
        orb.position.set(Math.cos(a) * 0.78, 0.34 + Math.sin(a) * 0.25, Math.sin(a) * 0.78);
        headTurret.add(orb);
        orbiters.push(orb);
      }
      const hand = new THREE.Mesh(GEO.box, veinMat);
      hand.scale.set(0.06, 0.42, 0.06);
      hand.position.set(0, 0.46, 0.1);
      headTurret.add(hand);
      orbiters.push(hand);
    }
  }

  private buildRarityAura(
    auraPlane: THREE.Group,
    rarity: RarityId,
    orbiters: THREE.Object3D[]
  ): void {
    if (rarity === 'Common') return;
    const colorNum = RARITIES[rarity].colorNum;
    const radius = rarity === 'Exclusive' ? 1.15 : rarity === 'Godly' ? 1.05 : 0.9;

    const ringGeo = new THREE.PlaneGeometry(radius * 2, radius * 2);
    ringGeo.rotateX(-Math.PI / 2);
    const runeMat = createRuneRingMaterial(colorNum);
    const ringMesh = new THREE.Mesh(ringGeo, runeMat);
    ringMesh.position.y = 0.04;
    auraPlane.add(ringMesh);

    if (rarity === 'Mythical' || rarity === 'Godly' || rarity === 'Exclusive') {
      const innerGeo = new THREE.PlaneGeometry(radius * 1.45, radius * 1.45);
      innerGeo.rotateX(-Math.PI / 2);
      const innerMat = createRuneRingMaterial(colorNum);
      innerMat.uniforms.uSpeed.value = -0.65;
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      innerMesh.position.y = 0.05;
      auraPlane.add(innerMesh);
    }

    if (rarity === 'Godly' || rarity === 'Exclusive') {
      const pillarMat = new THREE.MeshBasicMaterial({
        color: colorNum,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 2.2, 16, 1, true), pillarMat);
      pillar.position.y = 1.1;
      auraPlane.add(pillar);

      const shardMat = makeMat(colorNum, { emissive: colorNum, emissiveIntensity: 1.7 });
      for (let i = 0; i < 4; i++) {
        const shard = new THREE.Mesh(GEO.octahedron, shardMat);
        shard.scale.set(0.1, 0.22, 0.1);
        const a = (i / 4) * Math.PI * 2;
        shard.position.set(Math.cos(a) * 0.85, 0.85, Math.sin(a) * 0.85);
        auraPlane.add(shard);
        orbiters.push(shard);
      }
    }
  }

  private buildTraitIndicators(
    trait: TraitId,
    basePot: THREE.Group,
    headTurret: THREE.Group,
    traitVisuals: THREE.Object3D[],
    orbiters: THREE.Object3D[],
    isCelestial: boolean
  ): void {
    const def = TRAITS[trait];
    if (isCelestial || trait === 'Celestial') {
      const starShell = new THREE.Mesh(
        new THREE.SphereGeometry(0.76, 12, 10),
        createCelestialTraitShaderMaterial()
      );
      starShell.position.y = 0.2;
      headTurret.add(starShell);
      const miniStar = new THREE.Mesh(
        GEO.octahedron,
        makeMat(0xc084fc, { emissive: 0xe879f9, emissiveIntensity: 2.0 })
      );
      miniStar.scale.setScalar(0.18);
      miniStar.position.set(0.68, 0.65, 0);
      headTurret.add(miniStar);
      orbiters.push(miniStar);
    } else if (def.tier === 'Legendary' || trait === 'Ironbark') {
      const rune = new THREE.Mesh(
        new THREE.TorusGeometry(0.68, 0.04, 6, 20),
        makeMat(0xfbbf24, { emissive: 0xf59e0b, emissiveIntensity: 1.45 })
      );
      rune.rotation.x = Math.PI / 2;
      rune.position.y = 0.14;
      basePot.add(rune);
      orbiters.push(rune);
      if (trait === 'Bullseye') {
        const laserLine = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 2.2, 6),
          new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.85 })
        );
        laserLine.rotation.x = Math.PI / 2;
        laserLine.position.set(0, 0.2, 1.2);
        headTurret.add(laserLine);
        traitVisuals.push(laserLine);
      }
    } else if (trait.startsWith('Swift')) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.64, 0.03, 6, 20),
        makeMat(0x38bdf8, { emissive: 0x38bdf8, emissiveIntensity: 1.1 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.14;
      basePot.add(ring);
      orbiters.push(ring);
    } else if (trait.startsWith('Mighty')) {
      const thornMat = makeMat(0xf43f5e, { emissive: 0x991b1b, emissiveIntensity: 0.6 });
      const count = def.tier === 'III' ? 8 : 5;
      for (let i = 0; i < count; i++) {
        const thorn = new THREE.Mesh(GEO.cone, thornMat);
        thorn.scale.set(0.08, 0.2, 0.08);
        const a = (i / count) * Math.PI * 2;
        thorn.position.set(Math.cos(a) * 0.56, 0.16, Math.sin(a) * 0.56);
        thorn.rotation.z = -Math.cos(a) * 1.1;
        thorn.rotation.x = Math.sin(a) * 1.1;
        basePot.add(thorn);
      }
    } else {
      const leafCount = def.tier === 'III' ? 3 : def.tier === 'II' ? 2 : 1;
      for (let i = 0; i < leafCount; i++) {
        const leaf = new THREE.Mesh(
          GEO.sphere,
          makeMat(0x4ade80, { emissive: 0x4ade80, emissiveIntensity: def.tier === 'I' ? 0.45 : 0.9 })
        );
        leaf.scale.set(0.2, 0.07, 0.12);
        leaf.position.set(0.4 + i * 0.12, 0.85 + i * 0.08, 0);
        headTurret.add(leaf);
        traitVisuals.push(leaf);
      }
    }
  }

  public buildEnemyRig(
    type: EnemyTypeId,
    isElite = false,
    eliteMod: EliteModifierId | null = null,
    isMiniBoss = false
  ): EnemyRigRefs {
    return BugRigKit.buildBugRig(type, { isElite, eliteMod, isMiniBoss });
  }

  public buildMapDiorama(map: MapDef): MapSceneHandles {
    const group = new THREE.Group();
    const wobbleProps: THREE.Object3D[] = [];
    const cliffMeshes: THREE.Mesh[] = [];
    const mushrooms: THREE.Mesh[] = [];
    const bridgeLanterns: THREE.Mesh[] = [];
    const birdsButterflies: THREE.Group[] = [];
    const glassCracks: THREE.Mesh[] = [];
    const pollenFlowers: THREE.Mesh[] = [];
    const gnomes: THREE.Group[] = [];
    const hangingVines: THREE.Mesh[] = [];
    const lavaBubbles: THREE.Mesh[] = [];
    const robins: THREE.Group[] = [];
    const spawnMarkers: THREE.Group[] = [];
    let waveFlower: THREE.Group | null = null;
    let rainbowArc: THREE.Mesh | null = null;
    let rotatingBridge: THREE.Group | undefined;

    // 1. Floating Diorama Plinth with cross-section layers (AGENTS Rule 19, Doc 05 §2)
    const plinth = PropKit.buildDioramaPlinth(map.layout.size.w, map.layout.size.d, map.layout.palette);
    group.add(plinth);
    const groundMesh = plinth.getObjectByName('ground') as THREE.Mesh;

    // 2. Three Height Zones
    for (const hz of map.layout.heightZones) {
      if (hz.style !== 'pond' && hz.style !== 'lava_pool') {
        group.add(PropKit.buildHeightZone(hz, map.layout.palette));
      }
    }

    // 3. Splines & Styled Paths via PropKit
    const splines: THREE.CatmullRomCurve3[] = map.paths.map((pts) => {
      const vecs = pts.map(([x, z]) => new THREE.Vector3(x, 0.04, z));
      return new THREE.CatmullRomCurve3(vecs, false, 'catmullrom', 0.45);
    });

    for (const spline of splines) {
      const styledPath = PropKit.buildStyledPath(
        spline,
        map.trackHalfWidth,
        map.layout.pathStyle,
        map.layout.palette
      );
      group.add(styledPath);

      const startPt = spline.getPointAt(0);
      const lookAtPt = spline.getPointAt(0.05);
      const marker = PropKit.buildSpawnMarker(map.layout.spawnStyle, startPt.x, startPt.z, lookAtPt);
      group.add(marker);
      spawnMarkers.push(marker);
    }

    // 4. Base Structure (visibly reflects base HP via guardian pods)
    const endPt = splines[0].getPointAt(1);
    const baseStructure = PropKit.buildBaseStructure(map.layout.baseStyle, endPt.x, endPt.z);
    group.add(baseStructure);

    // 5. Map Landmark
    group.add(PropKit.buildLandmark(map.layout.landmark.style, map.layout.landmark.at[0], map.layout.landmark.at[1]));

    // 6. Cliff Pillars (stone outcrops with glowing placement rune ring)
    const cliffMat = makeMat(
      map.id === 'volcano_greenhouse' ? 0x1e1b1e : map.id === 'frosty_allotment' ? 0x94a3b8 : 0x64748b,
      { roughness: 0.78 }
    );
    const runeMat = makeMat(map.layout.palette.accent, {
      emissive: map.layout.palette.accent,
      emissiveIntensity: 0.35,
    });
    for (const c of map.cliffs) {
      const cliff = new THREE.Mesh(
        new THREE.CylinderGeometry(c.radius, c.radius * 1.18, c.height, 9),
        cliffMat
      );
      cliff.position.set(c.x, c.height * 0.5, c.z);
      cliff.castShadow = true;
      cliff.receiveShadow = true;
      cliff.userData = { isCliff: true, cliffRadius: c.radius, cliffTopY: c.height };
      const rim = new THREE.Mesh(new THREE.TorusGeometry(c.radius * 0.85, 0.06, 6, 18), runeMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = c.height * 0.5 + 0.02;
      cliff.add(rim);
      group.add(cliff);
      cliffMeshes.push(cliff);
    }

    // 7. Animated Pond / Lava Pool
    const waterMat = createWaterShaderMaterial(
      map.id === 'volcano_greenhouse'
        ? 0x9a3412
        : map.pond.frozen
          ? 0x93c5fd
          : map.layout.palette.water,
      map.id === 'volcano_greenhouse'
        ? 0xf97316
        : map.pond.frozen
          ? 0xe0f2fe
          : 0x38bdf8
    );
    const pondMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 24), waterMat);
    pondMesh.rotation.x = -Math.PI / 2;
    pondMesh.scale.set(map.pond.radiusX, map.pond.radiusZ, 1);
    pondMesh.position.set(map.pond.x, 0.03, map.pond.z);
    group.add(pondMesh);

    const pondRim = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.14, 8, 24),
      makeMat(map.layout.palette.soil, { roughness: 0.85 })
    );
    pondRim.rotation.x = Math.PI / 2;
    pondRim.scale.set(map.pond.radiusX, map.pond.radiusZ, 1);
    pondRim.position.set(map.pond.x, 0.05, map.pond.z);
    group.add(pondRim);

    // 8. Seeded Prop Clusters (3–7 grouped props from PropKit)
    for (const cluster of map.layout.clusters) {
      group.add(PropKit.buildClusterProps(cluster, wobbleProps, pollenFlowers));
    }

    // Rainbow Arc (§11 hidden unless Rainbow weather active)
    rainbowArc = new THREE.Mesh(
      new THREE.TorusGeometry(18, 0.35, 6, 36, Math.PI),
      new THREE.MeshBasicMaterial({
        color: 0xf472b6,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    rainbowArc.position.set(0, 0, -14);
    rainbowArc.visible = false;
    group.add(rainbowArc);

    // Butterflies / Dragonflies
    const butterflyMat = makeMat(map.layout.palette.accent, {
      emissive: map.layout.palette.accent,
      emissiveIntensity: 0.35,
    });
    for (let i = 0; i < 6; i++) {
      const bf = new THREE.Group();
      const wingL = new THREE.Mesh(GEO.plane, butterflyMat);
      wingL.scale.set(0.28, 0.2, 1);
      wingL.position.x = -0.14;
      const wingR = new THREE.Mesh(GEO.plane, butterflyMat);
      wingR.scale.set(0.28, 0.2, 1);
      wingR.position.x = 0.14;
      bf.add(wingL, wingR);
      const a = (i / 6) * Math.PI * 2;
      bf.position.set(Math.cos(a) * 9, 2.4 + (i % 2) * 0.6, Math.sin(a) * 9);
      bf.userData = { homeX: bf.position.x, homeZ: bf.position.z, scatterTimer: 0 };
      group.add(bf);
      birdsButterflies.push(bf);
    }

    let sleepingCat: THREE.Group | null = null;
    let lawnmower: THREE.Group | null = null;

    if (map.id === 'sunny_backyard') {
      const deck = new THREE.Mesh(GEO.box, makeMat(0x9a6b42, { roughness: 0.78 }));
      deck.scale.set(6.5, 0.35, 4.5);
      deck.position.set(14, 0.17, -15);
      deck.receiveShadow = true;
      group.add(deck);

      sleepingCat = new THREE.Group();
      sleepingCat.position.set(14, 0.45, -15);
      const catBody = new THREE.Mesh(GEO.sphere, makeMat(0xfb923c, { roughness: 0.6 }));
      catBody.scale.set(0.85, 0.48, 0.65);
      const catHead = new THREE.Mesh(GEO.sphere, makeMat(0xfb923c, { roughness: 0.6 }));
      catHead.scale.setScalar(0.42);
      catHead.position.set(0.4, 0.16, 0.1);
      sleepingCat.add(catBody, catHead);
      group.add(sleepingCat);

      for (const [gx, gz] of [[-14, -14], [14, 15]]) {
        const gnome = new THREE.Group();
        gnome.position.set(gx, 0, gz);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.75, 8), makeMat(0x2563eb));
        body.position.y = 0.38;
        const hat = new THREE.Mesh(GEO.cone, makeMat(0xef4444));
        hat.scale.set(0.55, 0.75, 0.55);
        hat.position.y = 1.05;
        gnome.add(body, hat);
        group.add(gnome);
        gnomes.push(gnome);
      }

      lawnmower = new THREE.Group();
      lawnmower.position.set(-24, 0.5, -22.8);
      const mowerBody = new THREE.Mesh(GEO.box, makeMat(0xef4444, { roughness: 0.4 }));
      mowerBody.scale.set(1.6, 0.7, 1.1);
      const mowerHandle = new THREE.Mesh(GEO.box, makeMat(0x94a3b8));
      mowerHandle.scale.set(0.12, 1.3, 0.9);
      mowerHandle.position.set(-0.75, 0.65, 0);
      mowerHandle.rotation.z = 0.5;
      lawnmower.add(mowerBody, mowerHandle);
      lawnmower.visible = false;
      group.add(lawnmower);
    } else if (map.id === 'enchanted_jungle') {
      const mushStemMat = makeMat(0xe2e8f0, { roughness: 0.7 });
      const mushCapMat = makeMat(0x22d3ee, { emissive: 0x06b6d4, emissiveIntensity: 0.38 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = 13 + (i % 2) * 3;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.9, 8), mushStemMat);
        stem.position.set(Math.cos(a) * r, 0.45, Math.sin(a) * r);
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
          mushCapMat
        );
        cap.position.set(stem.position.x, 0.92, stem.position.z);
        group.add(stem, cap);
        mushrooms.push(cap);
      }
      for (let i = 0; i < 4; i++) {
        const lanternMat = makeMat(0xfbbf24, { emissive: 0xfbbf24, emissiveIntensity: 0.1 });
        const lantern = new THREE.Mesh(GEO.octahedron, lanternMat);
        lantern.scale.setScalar(0.32);
        lantern.position.set(i * 2.2, 0.9, i % 2 === 0 ? -1.8 : 1.8);
        group.add(lantern);
        bridgeLanterns.push(lantern);
      }
      const vineMat = makeMat(0x16a34a);
      for (let i = 0; i < 5; i++) {
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), vineMat);
        vine.position.set(-10 + i * 5, 5.2, i % 2 === 0 ? -12 : 12);
        group.add(vine);
        hangingVines.push(vine);
      }
      waveFlower = new THREE.Group();
      waveFlower.position.set(-14, 0.4, 0);
      const wfMat = makeMat(0xe879f9, { emissive: 0xc084fc, emissiveIntensity: 0.38 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const p = new THREE.Mesh(GEO.sphere, wfMat);
        p.scale.set(0.45, 0.16, 0.75);
        p.position.set(Math.cos(a) * 0.65, 0.35, Math.sin(a) * 0.65);
        p.rotation.y = -a;
        waveFlower.add(p);
      }
      group.add(waveFlower);
    } else if (map.id === 'volcano_greenhouse') {
      const ribMat = makeMat(0x0f172a, { roughness: 0.4, metalness: 0.5 });
      for (let i = 0; i < 4; i++) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(22, 0.35, 6, 32, Math.PI), ribMat);
        arch.rotation.y = (i / 4) * Math.PI;
        group.add(arch);
      }
      const crackMat = makeMat(0xf97316, { emissive: 0xea580c, emissiveIntensity: 0.38 });
      for (let i = 0; i < 6; i++) {
        const crack = new THREE.Mesh(GEO.box, crackMat);
        crack.scale.set(2.5, 0.08, 0.08);
        crack.position.set(-12 + i * 5, 11 - Math.abs(i - 2.5) * 1.4, -14 + (i % 2) * 28);
        crack.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.4;
        crack.visible = false;
        group.add(crack);
        glassCracks.push(crack);
      }
      const bubMat = makeMat(0xfde047, { emissive: 0xf97316, emissiveIntensity: 0.4 });
      for (let i = 0; i < 4; i++) {
        const bub = new THREE.Mesh(GEO.sphere, bubMat);
        bub.scale.setScalar(0.32);
        bub.position.set(map.pond.x + (i - 1.5) * 0.9, 0.12, map.pond.z + (i % 2 === 0 ? 0.5 : -0.5));
        group.add(bub);
        lavaBubbles.push(bub);
      }
    } else if (map.id === 'frosty_allotment') {
      const b = map.boundsHalfSize - 1.5;
      for (let i = 0; i < 4; i++) {
        const robin = new THREE.Group();
        const rBody = new THREE.Mesh(GEO.sphere, makeMat(0x78350f));
        rBody.scale.setScalar(0.32);
        const rChest = new THREE.Mesh(GEO.sphere, makeMat(0xef4444));
        rChest.scale.setScalar(0.22);
        rChest.position.set(0, -0.04, 0.1);
        robin.add(rBody, rChest);
        robin.position.set(-15 + i * 10, 1.38, -b);
        group.add(robin);
        robins.push(robin);
      }
    } else if (map.id === 'zen_garden') {
      rotatingBridge = new THREE.Group();
      rotatingBridge.position.set(0, 0.18, 0);
      const deck = new THREE.Mesh(GEO.box, makeMat(0xdc2626, { roughness: 0.55 }));
      deck.scale.set(5.4, 0.24, 2.6);
      const railL = new THREE.Mesh(GEO.box, makeMat(0x991b1b));
      railL.scale.set(5.4, 0.35, 0.14);
      railL.position.set(0, 0.3, -1.25);
      const railR = railL.clone();
      railR.position.set(0, 0.3, 1.25);
      rotatingBridge.add(deck, railL, railR);
      group.add(rotatingBridge);
    }

    return {
      group,
      groundMesh,
      cliffMeshes,
      splines,
      pondMesh,
      waterMat,
      wobbleProps,
      mushrooms,
      bridgeLanterns,
      sleepingCat,
      lawnmower,
      birdsButterflies,
      glassCracks,
      pollenFlowers,
      gnomes,
      hangingVines,
      waveFlower,
      lavaBubbles,
      robins,
      spawnMarkers,
      rainbowArc,
      rotatingBridge,
      baseStructure,
    };
  }

  public buildSeedPodMesh(isEnchanted: boolean): THREE.Group {
    const pod = new THREE.Group();
    const bodyColor = isEnchanted ? 0x6d28d9 : 0x92400e;
    const bandColor = isEnchanted ? 0x2dd4bf : 0xfbbf24;

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 16, 12),
      makeMat(bodyColor, { roughness: 0.35, metalness: isEnchanted ? 0.55 : 0.15 })
    );
    shell.scale.set(1, 1.3, 1);
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.94, 0.1, 8, 24),
      makeMat(bandColor, { emissive: bandColor, emissiveIntensity: 1.15, metalness: 0.7 })
    );
    band.rotation.x = Math.PI / 2;
    const gem = new THREE.Mesh(
      GEO.octahedron,
      makeMat(bandColor, { emissive: bandColor, emissiveIntensity: 1.7 })
    );
    gem.scale.set(0.32, 0.44, 0.32);
    gem.position.set(0, 0.1, 0.96);
    pod.add(shell, band, gem);
    return pod;
  }

  public buildTraitWheelMesh(): THREE.Group {
    const wheel = new THREE.Group();
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.25, 14),
      makeMat(0xfbbf24, { metalness: 0.8, roughness: 0.2 })
    );
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);

    const traitColors = [
      0x4ade80, 0x38bdf8, 0xf43f5e, 0xfacc15, 0x60a5fa, 0x22c55e, 0xfbbf24, 0xc084fc,
    ];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.28, 0.75, 4, 8),
        makeMat(traitColors[i], { emissive: traitColors[i], emissiveIntensity: 0.35 })
      );
      petal.position.set(Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0);
      petal.rotation.z = a - Math.PI / 2;
      wheel.add(petal);
    }
    return wheel;
  }
}

export const MeshFactory = new MeshFactoryImpl();
