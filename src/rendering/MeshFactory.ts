import * as THREE from 'three';
import { getUnitById, type UnitDef } from '../data/UnitRegistry';
import { RARITIES, type RarityId } from '../data/RarityConfig';
import { TRAITS, type TraitId } from '../data/TraitConfig';
import { ENEMIES, type EnemyTypeId } from '../data/EnemyRegistry';
import type { MapDef } from '../data/MapRegistry';
import type { PotSkinId } from '../core/SaveManager';
import {
  applyToonRimShader,
  createCelestialTraitShaderMaterial,
  createRuneRingMaterial,
  createWaterShaderMaterial,
} from './ShaderLib';
import { ELITE_MODIFIERS, type EliteModifierId } from '../data/ModifierConfig';

export interface TowerRigRefs {
  root: THREE.Group;
  basePot: THREE.Group;
  stemPivot: THREE.Group;
  headTurret: THREE.Group;
  jawUpper: THREE.Group;
  jawLower: THREE.Group;
  auraPlane: THREE.Group;
  orbiters: THREE.Object3D[];
  emissiveParts: THREE.MeshStandardMaterial[];
  traitVisuals: THREE.Object3D[];
  levelStars: THREE.Group;
  stunOverlay: THREE.Group;
}

export interface EnemyRigRefs {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  legs: THREE.Object3D[];
  wings: THREE.Object3D[];
  shellMesh?: THREE.Object3D;
  dirtMound?: THREE.Object3D;
  eliteShieldMesh?: THREE.Mesh;
  frozenShell: THREE.Mesh;
  bodyMaterials: THREE.MeshStandardMaterial[];
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
}

// Shared reusable primitives to minimize triangle/geometry bloat
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
    potSkin: PotSkinId = 'default'
  ): TowerRigRefs {
    const unit = getUnitById(unitId);
    const root = new THREE.Group();
    const basePot = new THREE.Group();
    const stemPivot = new THREE.Group();
    const headTurret = new THREE.Group();
    const jawUpper = new THREE.Group();
    const jawLower = new THREE.Group();
    const auraPlane = new THREE.Group();
    const orbiters: THREE.Object3D[] = [];
    const emissiveParts: THREE.MeshStandardMaterial[] = [];
    const traitVisuals: THREE.Object3D[] = [];

    root.add(auraPlane);
    root.add(basePot);
    basePot.add(stemPivot);
    stemPivot.add(headTurret);
    headTurret.add(jawUpper);
    headTurret.add(jawLower);

    const isGoldenTrait = trait === 'Golden';
    const isCelestialTrait = trait === 'Celestial';

    // 1. Base Pot & Visual Evolution + Mastery Skin
    let potColor = 0xc26a3d; // terracotta
    let potMetal = 0.05;
    let potRough = 0.72;
    let rimColor = 0xd97742;

    if (level >= 1 && level <= 2) {
      potColor = 0x78716c; // reinforced stone
      rimColor = 0xfbbf24; // gold trim
      potRough = 0.52;
    } else if (level >= 3) {
      potColor = 0x334155;
      rimColor = RARITIES[rarity].colorNum;
      potMetal = 0.35;
      potRough = 0.38;
    }

    if (potSkin === 'striped_ceramic') {
      potColor = 0xe2e8f0;
      rimColor = 0x38bdf8;
    } else if (potSkin === 'mossy_stone') {
      potColor = 0x4d7c0f;
      rimColor = 0x84cc16;
    } else if (potSkin === 'crystal') {
      potColor = 0x67e8f9;
      rimColor = 0xe0f2fe;
      potMetal = 0.5;
      potRough = 0.15;
    } else if (potSkin === 'golden' || isGoldenTrait) {
      potColor = 0xfbbf24;
      rimColor = 0xfef08a;
      potMetal = 0.85;
      potRough = 0.22;
    } else if (potSkin === 'galaxy') {
      potColor = 0x3b0764;
      rimColor = 0xc084fc;
      potMetal = 0.6;
    }

    const potMat = makeMat(potColor, { metalness: potMetal, roughness: potRough });
    const rimMat = makeMat(rimColor, {
      metalness: level >= 2 ? 0.6 : 0.2,
      roughness: 0.3,
      emissive: level >= 4 ? rimColor : 0x000000,
      emissiveIntensity: level >= 4 ? 0.9 : 0,
    });

    const potBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.34, 0.56, 12),
      potMat
    );
    potBody.position.y = 0.28;
    potBody.castShadow = true;
    potBody.receiveShadow = true;
    basePot.add(potBody);

    const potRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.48, 0.14, 12),
      rimMat
    );
    potRim.position.y = 0.55;
    potRim.castShadow = true;
    basePot.add(potRim);

    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.44, 0.06, 10),
      makeMat(0x451a03, { roughness: 0.95 })
    );
    soil.position.y = 0.58;
    basePot.add(soil);

    // 2. Stem & Leaves (grows with level)
    const stemHeight = 0.45 + level * 0.08;
    stemPivot.position.set(0, 0.58, 0);

    const stemMat = makeMat(isGoldenTrait ? 0xfbbf24 : 0x16a34a, {
      metalness: isGoldenTrait ? 0.8 : 0.1,
      roughness: isGoldenTrait ? 0.25 : 0.6,
    });
    const leafMat = makeMat(isGoldenTrait ? 0xfde047 : 0x4ade80, {
      metalness: isGoldenTrait ? 0.8 : 0.05,
    });

    const stemMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.15, stemHeight, 8),
      stemMat
    );
    stemMesh.position.y = stemHeight * 0.5;
    stemMesh.castShadow = true;
    stemPivot.add(stemMesh);

    const leafCount = 2 + Math.min(4, level);
    for (let i = 0; i < leafCount; i++) {
      const leaf = new THREE.Mesh(GEO.sphere, leafMat);
      leaf.scale.set(0.36, 0.08, 0.18);
      const ang = (i / leafCount) * Math.PI * 2 + 0.4;
      leaf.position.set(Math.cos(ang) * 0.22, 0.16 + (i % 2) * 0.14, Math.sin(ang) * 0.22);
      leaf.rotation.y = -ang;
      leaf.rotation.z = 0.35;
      leaf.castShadow = true;
      stemPivot.add(leaf);
    }

    headTurret.position.set(0, stemHeight + 0.18, 0);

    // 3. Unit-Specific Procedural Sculpture
    const pColor = isGoldenTrait ? 0xfbbf24 : unit.primaryColor;
    const sColor = isGoldenTrait ? 0xf59e0b : unit.secondaryColor;
    const aColor = unit.accentColor;

    const mainMat = makeMat(pColor, {
      metalness: isGoldenTrait ? 0.85 : 0.15,
      roughness: isGoldenTrait ? 0.2 : 0.45,
    });
    const secMat = makeMat(sColor, {
      metalness: isGoldenTrait ? 0.75 : 0.2,
      roughness: isGoldenTrait ? 0.25 : 0.5,
    });
    const veinMat = makeMat(aColor, {
      emissive: aColor,
      emissiveIntensity: level >= 5 ? 1.85 : level >= 3 ? 1.2 : 0.25,
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
      orbiters
    );

    // 4. Level 5 Awakened Halo / Crown
    if (level >= 5) {
      const crownMat = makeMat(unit.accentColor, {
        emissive: unit.accentColor,
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

    // 5. Rarity Ground Aura VFX (§4.1)
    this.buildRarityAura(auraPlane, rarity, orbiters);

    // 6. Trait 3D Visual Indicators (§4.2)
    this.buildTraitIndicators(trait, basePot, headTurret, traitVisuals, orbiters, isCelestialTrait);

    // 7. Scale by Overgrown / Trait scale
    const traitScale = TRAITS[trait].modelScale;
    root.scale.setScalar(traitScale);

    // 8. Level Stars Indicator (1..5 stars above head)
    const levelStars = new THREE.Group();
    levelStars.position.set(0, stemHeight + 1.15, 0);
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

    // 9. Stun Overlay (orbiting yellow stars when stunned by Wasp/Boss)
    const stunOverlay = new THREE.Group();
    stunOverlay.position.set(0, stemHeight + 1.0, 0);
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
    orbiters: THREE.Object3D[]
  ): void {
    const id = unit.id;

    if (id === 'tomato_tosser') {
      const body = new THREE.Mesh(GEO.sphere, mainMat);
      body.scale.set(0.78, 0.72, 0.78);
      body.castShadow = true;
      headTurret.add(body);
      const cap = new THREE.Mesh(GEO.cone, secMat);
      cap.scale.set(0.45, 0.2, 0.45);
      cap.position.y = 0.38;
      headTurret.add(cap);
      // Cute angry eyes
      const eyeMat = makeMat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.3 });
      for (const sx of [-0.14, 0.14]) {
        const eye = new THREE.Mesh(GEO.sphere, eyeMat);
        eye.scale.setScalar(0.12);
        eye.position.set(sx, 0.08, 0.34);
        headTurret.add(eye);
      }
      if (level >= 3) {
        const launcher = new THREE.Mesh(GEO.cylinder, veinMat);
        launcher.scale.set(0.24, 0.42, 0.24);
        launcher.rotation.x = Math.PI / 2;
        launcher.position.set(0, 0.05, 0.32);
        headTurret.add(launcher);
      }
    } else if (id === 'cactus_striker') {
      const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.56, 6, 10), mainMat);
      trunk.position.y = 0.22;
      trunk.castShadow = true;
      headTurret.add(trunk);
      const armCount = level >= 3 ? 3 : 2;
      for (let i = 0; i < armCount; i++) {
        const a = (i / armCount) * Math.PI * 2;
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.28, 4, 8), secMat);
        arm.position.set(Math.cos(a) * 0.32, 0.22, Math.sin(a) * 0.32);
        arm.rotation.z = -Math.cos(a) * 0.6;
        arm.rotation.x = Math.sin(a) * 0.6;
        headTurret.add(arm);
      }
      for (let i = 0; i < 8; i++) {
        const spine = new THREE.Mesh(GEO.cone, veinMat);
        spine.scale.set(0.06, 0.18, 0.06);
        const a = (i / 8) * Math.PI * 2;
        spine.position.set(Math.cos(a) * 0.26, 0.15 + (i % 3) * 0.16, Math.sin(a) * 0.26);
        spine.rotation.z = -Math.cos(a) * 1.4;
        headTurret.add(spine);
      }
    } else if (id === 'pineapple_cannon') {
      const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), mainMat);
      body.scale.set(0.95, 1.15, 0.95);
      body.position.y = 0.14;
      body.castShadow = true;
      headTurret.add(body);
      const barrelMat = makeMat(0x1e293b, { metalness: 0.7, roughness: 0.3 });
      const barrels = level >= 3 ? 2 : 1;
      for (let b = 0; b < barrels; b++) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.56, 10), barrelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(barrels === 2 ? (b === 0 ? -0.15 : 0.15) : 0, 0.18, 0.35);
        barrel.castShadow = true;
        headTurret.add(barrel);
        const muzzleRing = new THREE.Mesh(GEO.torus, veinMat);
        muzzleRing.scale.setScalar(0.32);
        muzzleRing.position.set(barrel.position.x, 0.18, 0.63);
        headTurret.add(muzzleRing);
      }
      const crown = new THREE.Mesh(GEO.cone, secMat);
      crown.scale.set(0.5, 0.45, 0.5);
      crown.position.y = 0.72;
      headTurret.add(crown);
    } else if (id === 'money_tree') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.5, 8), secMat);
      trunk.position.y = 0.1;
      headTurret.add(trunk);
      const puffs = level >= 3 ? 5 : 3;
      for (let i = 0; i < puffs; i++) {
        const puff = new THREE.Mesh(GEO.lowSphere, mainMat);
        const a = (i / puffs) * Math.PI * 2;
        puff.scale.setScalar(0.55);
        puff.position.set(Math.cos(a) * 0.25, 0.46 + (i === 0 ? 0.16 : 0), Math.sin(a) * 0.25);
        puff.castShadow = true;
        headTurret.add(puff);
      }
      const coinCount = 2 + level;
      for (let i = 0; i < coinCount; i++) {
        const coin = new THREE.Mesh(GEO.cylinder, veinMat);
        coin.scale.set(0.16, 0.04, 0.16);
        coin.rotation.x = Math.PI / 2;
        const a = (i / coinCount) * Math.PI * 2;
        coin.position.set(Math.cos(a) * 0.42, 0.42 + (i % 2) * 0.18, Math.sin(a) * 0.42);
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
      const shards = 3 + (level >= 3 ? 2 : 0);
      for (let i = 0; i < shards; i++) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), i % 2 === 0 ? mainMat : secMat);
        c.scale.set(0.8, 1.7, 0.8);
        const a = (i / shards) * Math.PI * 2;
        c.position.set(Math.cos(a) * 0.2, 0.24 + (i === 0 ? 0.18 : 0), Math.sin(a) * 0.2);
        c.rotation.z = -Math.cos(a) * 0.25;
        c.castShadow = true;
        headTurret.add(c);
      }
      const core = new THREE.Mesh(GEO.octahedron, veinMat);
      core.scale.setScalar(0.32);
      core.position.y = 0.36;
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

      // Teeth
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
      // Huge arms attached to jawUpper/jawLower so overhead smash animates cleanly
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
    if (trait === 'Sprouting') {
      const leaf = new THREE.Mesh(
        GEO.sphere,
        makeMat(0x4ade80, { emissive: 0x4ade80, emissiveIntensity: 0.9 })
      );
      leaf.scale.set(0.22, 0.07, 0.12);
      leaf.position.set(0.45, 0.9, 0);
      headTurret.add(leaf);
      traitVisuals.push(leaf);
    } else if (trait === 'Swift') {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.03, 6, 20),
        makeMat(0x38bdf8, { emissive: 0x38bdf8, emissiveIntensity: 1.3 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.2;
      basePot.add(ring);
      orbiters.push(ring);
    } else if (trait === 'Thorny') {
      const thornMat = makeMat(0xf43f5e, { emissive: 0x991b1b, emissiveIntensity: 0.6 });
      for (let i = 0; i < 8; i++) {
        const thorn = new THREE.Mesh(GEO.cone, thornMat);
        thorn.scale.set(0.08, 0.2, 0.08);
        const a = (i / 8) * Math.PI * 2;
        thorn.position.set(Math.cos(a) * 0.54, 0.55, Math.sin(a) * 0.54);
        thorn.rotation.z = -Math.cos(a) * 1.2;
        thorn.rotation.x = Math.sin(a) * 1.2;
        basePot.add(thorn);
      }
    } else if (trait === 'Sniper') {
      const laserLine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 2.2, 6),
        new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.85 })
      );
      laserLine.rotation.x = Math.PI / 2;
      laserLine.position.set(0, 0.2, 1.2);
      headTurret.add(laserLine);
      traitVisuals.push(laserLine);
    } else if (isCelestial) {
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
    }
  }

  public buildEnemyRig(
    type: EnemyTypeId,
    isElite = false,
    eliteMod: EliteModifierId | null = null
  ): EnemyRigRefs {
    const def = ENEMIES[type];
    const root = new THREE.Group();
    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    const legs: THREE.Object3D[] = [];
    const wings: THREE.Object3D[] = [];
    const bodyMaterials: THREE.MeshStandardMaterial[] = [];

    const mainMat = makeMat(def.primaryColor, { roughness: 0.5 });
    const secMat = makeMat(def.secondaryColor, { roughness: 0.65 });
    const accMat = makeMat(def.accentColor, {
      emissive: def.isBoss ? def.accentColor : 0x000000,
      emissiveIntensity: def.isBoss ? 1.45 : 0,
    });
    bodyMaterials.push(mainMat, secMat, accMat);

    let shellMesh: THREE.Object3D | undefined;
    let dirtMound: THREE.Object3D | undefined;

    if (type === 'garden_ant') {
      const head = new THREE.Mesh(GEO.lowSphere, mainMat);
      head.scale.set(0.45, 0.4, 0.45);
      head.position.set(0, 0.32, 0.35);
      const thorax = new THREE.Mesh(GEO.lowSphere, secMat);
      thorax.scale.set(0.36, 0.34, 0.42);
      thorax.position.set(0, 0.3, 0);
      const abdomen = new THREE.Mesh(GEO.lowSphere, mainMat);
      abdomen.scale.set(0.55, 0.48, 0.68);
      abdomen.position.set(0, 0.36, -0.45);
      bodyGroup.add(head, thorax, abdomen);

      for (let i = 0; i < 6; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const row = Math.floor(i / 2) - 1;
        const leg = new THREE.Mesh(GEO.box, secMat);
        leg.scale.set(0.32, 0.07, 0.07);
        leg.position.set(side * 0.28, 0.16, row * 0.22);
        leg.rotation.z = side * -0.45;
        bodyGroup.add(leg);
        legs.push(leg);
      }
    } else if (type === 'sprinter_mantis') {
      const torso = new THREE.Mesh(GEO.box, mainMat);
      torso.scale.set(0.36, 0.42, 0.92);
      torso.position.set(0, 0.46, 0);
      const head = new THREE.Mesh(GEO.cone, accMat);
      head.scale.set(0.38, 0.4, 0.38);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, 0.72, 0.48);
      bodyGroup.add(torso, head);
      for (const sx of [-0.3, 0.3]) {
        const scythe = new THREE.Mesh(GEO.box, accMat);
        scythe.scale.set(0.08, 0.56, 0.16);
        scythe.position.set(sx, 0.52, 0.42);
        scythe.rotation.x = 0.65;
        bodyGroup.add(scythe);
        legs.push(scythe);
      }
      for (let i = 0; i < 4; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const leg = new THREE.Mesh(GEO.box, secMat);
        leg.scale.set(0.38, 0.08, 0.08);
        leg.position.set(side * 0.28, 0.2, i < 2 ? 0.18 : -0.24);
        bodyGroup.add(leg);
        legs.push(leg);
      }
    } else if (type === 'iron_beetle') {
      const body = new THREE.Mesh(GEO.lowSphere, secMat);
      body.scale.set(0.95, 0.52, 1.15);
      body.position.set(0, 0.32, 0);
      bodyGroup.add(body);

      const metalMat = makeMat(0x94a3b8, { metalness: 0.85, roughness: 0.25 });
      bodyMaterials.push(metalMat);
      const armor = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
        metalMat
      );
      armor.scale.set(1.0, 0.8, 1.15);
      armor.position.set(0, 0.36, -0.05);
      bodyGroup.add(armor);
      shellMesh = armor;

      for (let i = 0; i < 6; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const leg = new THREE.Mesh(GEO.box, secMat);
        leg.scale.set(0.32, 0.09, 0.09);
        leg.position.set(side * 0.46, 0.14, (Math.floor(i / 2) - 1) * 0.3);
        bodyGroup.add(leg);
        legs.push(leg);
      }
    } else if (type === 'burrowing_mole') {
      const body = new THREE.Mesh(GEO.lowSphere, mainMat);
      body.scale.set(0.85, 0.72, 1.05);
      body.position.set(0, 0.42, 0);
      const snout = new THREE.Mesh(GEO.cone, accMat);
      snout.scale.set(0.32, 0.38, 0.32);
      snout.rotation.x = Math.PI / 2;
      snout.position.set(0, 0.38, 0.56);
      bodyGroup.add(body, snout);

      const mound = new THREE.Mesh(
        new THREE.ConeGeometry(0.78, 0.48, 10),
        makeMat(0x573b26, { roughness: 0.95 })
      );
      mound.position.set(0, 0.22, 0);
      mound.visible = false;
      root.add(mound);
      dirtMound = mound;
    } else if (type === 'spore_wasp') {
      const thorax = new THREE.Mesh(GEO.lowSphere, mainMat);
      thorax.scale.set(0.5, 0.45, 0.65);
      thorax.position.set(0, 1.45, 0);
      const tail = new THREE.Mesh(GEO.cone, secMat);
      tail.scale.set(0.45, 0.75, 0.45);
      tail.rotation.x = -Math.PI / 2;
      tail.position.set(0, 1.4, -0.5);
      bodyGroup.add(thorax, tail);

      const wingMat = makeMat(0xe0f2fe, { transparent: true, opacity: 0.65 });
      for (const sx of [-0.36, 0.36]) {
        const wing = new THREE.Mesh(GEO.plane, wingMat);
        wing.scale.set(0.75, 0.32, 1);
        wing.rotation.x = -Math.PI / 2;
        wing.position.set(sx, 1.66, 0.05);
        bodyGroup.add(wing);
        wings.push(wing);
      }
    } else if (type === 'gargantuan_snail') {
      const slugBody = new THREE.Mesh(GEO.lowSphere, secMat);
      slugBody.scale.set(0.85, 0.45, 1.45);
      slugBody.position.set(0, 0.28, 0.1);
      bodyGroup.add(slugBody);

      const crystalMat = makeMat(0x38bdf8, {
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.95,
        roughness: 0.15,
        metalness: 0.4,
      });
      bodyMaterials.push(crystalMat);
      const shell = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 0), crystalMat);
      shell.position.set(0, 0.78, -0.2);
      bodyGroup.add(shell);
      shellMesh = shell;
    } else if (type === 'speedy_slug') {
      const slug = new THREE.Mesh(GEO.lowSphere, mainMat);
      slug.scale.set(0.55, 0.35, 1.05);
      slug.position.set(0, 0.2, 0);
      bodyGroup.add(slug);
    } else {
      // Blighted Treant Overlord (Boss)
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 2.0, 10), secMat);
      trunk.position.y = 1.0;
      trunk.castShadow = true;
      const core = new THREE.Mesh(GEO.octahedron, accMat);
      core.scale.set(0.55, 0.68, 0.55);
      core.position.set(0, 1.15, 0.36);
      const head = new THREE.Mesh(GEO.box, mainMat);
      head.scale.set(0.95, 0.85, 0.85);
      head.position.set(0, 2.15, 0);
      bodyGroup.add(trunk, core, head);
      for (const sx of [-0.72, 0.72]) {
        const arm = new THREE.Mesh(GEO.box, secMat);
        arm.scale.set(0.35, 1.35, 0.35);
        arm.position.set(sx, 1.25, 0.15);
        arm.rotation.z = sx * 0.2;
        bodyGroup.add(arm);
        legs.push(arm);
      }
      for (const sx of [-0.32, 0.32]) {
        const leg = new THREE.Mesh(GEO.box, secMat);
        leg.scale.set(0.36, 0.75, 0.42);
        leg.position.set(sx, 0.35, 0);
        bodyGroup.add(leg);
        legs.push(leg);
      }
    }

    // Elite cues (§15.3)
    let eliteShieldMesh: THREE.Mesh | undefined;
    if (isElite && eliteMod) {
      const mod = ELITE_MODIFIERS[eliteMod];
      const outlineRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.055, 6, 20),
        makeMat(mod.colorNum, { emissive: mod.colorNum, emissiveIntensity: 1.35 })
      );
      outlineRing.rotation.x = Math.PI / 2;
      outlineRing.position.y = 0.08;
      root.add(outlineRing);

      if (eliteMod === 'Shielded') {
        eliteShieldMesh = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.95, 1),
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            wireframe: true,
            transparent: true,
            opacity: 0.72,
          })
        );
        eliteShieldMesh.position.y = 0.62;
        root.add(eliteShieldMesh);
      }
    }

    // Frozen crystal shell overlay (§8.1)
    const frozenShell = new THREE.Mesh(
      GEO.icosahedron,
      makeMat(0x7dd3fc, {
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
    root.scale.setScalar(def.scale * modScale);

    return {
      root,
      bodyGroup,
      legs,
      wings,
      shellMesh,
      dirtMound,
      eliteShieldMesh,
      frozenShell,
      bodyMaterials,
    };
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

    // Ground plane (keep emissiveIntensity <= 0.4 so grass never blooms!)
    const size = map.boundsHalfSize * 2 + 8;
    const groundGeo = new THREE.PlaneGeometry(size, size);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = makeMat(map.groundColor, { roughness: 0.9, metalness: 0.0, rim: false });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    groundMesh.name = 'ground';
    group.add(groundMesh);

    // Splines & Track Ribbons
    const splines: THREE.CatmullRomCurve3[] = map.paths.map((pts) => {
      const vecs = pts.map(([x, z]) => new THREE.Vector3(x, 0.04, z));
      return new THREE.CatmullRomCurve3(vecs, false, 'catmullrom', 0.45);
    });

    const trackMat = makeMat(map.trackColor, { roughness: 0.85, rim: false });
    const edgeMat = makeMat(map.trackEdgeColor, {
      roughness: 0.6,
      emissive: map.id === 'enchanted_jungle' ? 0x0ea5e9 : map.id === 'volcano_greenhouse' ? 0xea580c : 0x000000,
      emissiveIntensity: map.id === 'sunny_backyard' ? 0 : 0.35,
      rim: false,
    });

    for (const spline of splines) {
      const samples = 110;
      const trackGroup = this.buildTrackRibbon(spline, map.trackHalfWidth, samples, trackMat, edgeMat);
      group.add(trackGroup);

      // Start Portal & Garden Bastion Core (End)
      const startPt = spline.getPointAt(0);
      const portal = new THREE.Mesh(
        new THREE.TorusGeometry(1.3, 0.18, 8, 20),
        makeMat(0x7c3aed, { emissive: 0x7c3aed, emissiveIntensity: 1.25 })
      );
      portal.position.set(startPt.x, 1.35, startPt.z);
      portal.lookAt(spline.getPointAt(0.04).x, 1.35, spline.getPointAt(0.04).z);
      group.add(portal);
    }

    // End Bastion Gazebo (at final point of first spline)
    const endPt = splines[0].getPointAt(1);
    const bastion = new THREE.Group();
    bastion.position.set(endPt.x, 0, endPt.z);
    const gazeboBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 2.0, 0.4, 8),
      makeMat(0xf1f5f9, { roughness: 0.6 })
    );
    gazeboBase.position.y = 0.2;
    const crystalHeart = new THREE.Mesh(
      GEO.octahedron,
      makeMat(0x4ade80, { emissive: 0x22c55e, emissiveIntensity: 1.35 })
    );
    crystalHeart.scale.set(0.85, 1.15, 0.85);
    crystalHeart.position.y = 1.4;
    bastion.add(gazeboBase, crystalHeart);
    group.add(bastion);

    // Cliff Pillars
    const cliffMat = makeMat(map.id === 'volcano_greenhouse' ? 0x1e1b1e : 0x64748b, { roughness: 0.78 });
    for (const c of map.cliffs) {
      const cliff = new THREE.Mesh(
        new THREE.CylinderGeometry(c.radius, c.radius * 1.18, c.height, 10),
        cliffMat
      );
      cliff.position.set(c.x, c.height * 0.5, c.z);
      cliff.castShadow = true;
      cliff.receiveShadow = true;
      cliff.userData = { isCliff: true, cliffRadius: c.radius, cliffTopY: c.height };
      group.add(cliff);
      cliffMeshes.push(cliff);
    }

    // Pond with animated Water Shader
    const waterMat = createWaterShaderMaterial(
      map.id === 'volcano_greenhouse' ? 0x9a3412 : 0x0284c7,
      map.id === 'volcano_greenhouse' ? 0xf97316 : 0x38bdf8
    );
    const pondGeo = new THREE.CircleGeometry(1, 24);
    const pondMesh = new THREE.Mesh(pondGeo, waterMat);
    pondMesh.rotation.x = -Math.PI / 2;
    pondMesh.scale.set(map.pond.radiusX, map.pond.radiusZ, 1);
    pondMesh.position.set(map.pond.x, 0.03, map.pond.z);
    group.add(pondMesh);

    const pondRim = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.14, 8, 24),
      makeMat(0x78716c, { roughness: 0.85 })
    );
    pondRim.rotation.x = Math.PI / 2;
    pondRim.scale.set(map.pond.radiusX, map.pond.radiusZ, 1);
    pondRim.position.set(map.pond.x, 0.06, map.pond.z);
    group.add(pondRim);

    // Wooden Picket Fences & Flowerpots (wobble on nearby explosions §8.6)
    const fenceMat = makeMat(map.id === 'sunny_backyard' ? 0xf8fafc : 0x573b26, { roughness: 0.75 });
    const b = map.boundsHalfSize - 1.2;
    for (let i = -b; i <= b; i += 2.6) {
      for (const side of [-b, b]) {
        const post = new THREE.Mesh(GEO.box, fenceMat);
        post.scale.set(0.28, 1.3, 0.28);
        post.position.set(i, 0.65, side);
        post.castShadow = true;
        group.add(post);
        wobbleProps.push(post);
      }
    }

    // Oversized Flowerpots & Decorative Flowers (open on Pollen Bloom)
    const potDecoMat = makeMat(0xc26a3d, { roughness: 0.75 });
    const flowerMat = makeMat(0xfacc15, { emissive: 0xfde047, emissiveIntensity: 0.25 });
    const decoCorners: Array<[number, number]> = [
      [-16, -16],
      [16, -16],
      [-16, 16],
      [16, 16],
    ];
    for (const [dx, dz] of decoCorners) {
      const bigPot = new THREE.Group();
      bigPot.position.set(dx, 0, dz);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.7, 1.1, 10), potDecoMat);
      pot.position.y = 0.55;
      pot.castShadow = true;
      const flower = new THREE.Mesh(GEO.sphere, flowerMat);
      flower.scale.set(0.8, 0.45, 0.8);
      flower.position.y = 1.28;
      bigPot.add(pot, flower);
      group.add(bigPot);
      wobbleProps.push(bigPot);
      pollenFlowers.push(flower);
    }

    // Ambient Birds/Butterflies (§8.6 scatter from explosions)
    const butterflyMat = makeMat(0xfbbf24, { emissive: 0xfde047, emissiveIntensity: 0.35 });
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

    // Map-specific Signature Props (§5.1.1)
    let sleepingCat: THREE.Group | null = null;
    let lawnmower: THREE.Group | null = null;

    if (map.id === 'sunny_backyard') {
      // Wooden Deck + Sleeping Cat
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

      // Wave 10 Lawnmower (parked behind fence until wave 10)
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
      // Glowing Mushrooms (pulse with music beat)
      const mushStemMat = makeMat(0xe2e8f0, { roughness: 0.7 });
      const mushCapMat = makeMat(0x22d3ee, { emissive: 0x06b6d4, emissiveIntensity: 0.9 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = 13 + (i % 2) * 3;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.9, 8), mushStemMat);
        stem.position.set(Math.cos(a) * r, 0.45, Math.sin(a) * r);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), mushCapMat);
        cap.position.set(stem.position.x, 0.92, stem.position.z);
        group.add(stem, cap);
        mushrooms.push(cap);
      }
      // Stone Bridge & Lanterns along merge [0,0] -> [7,0]
      const bridge = new THREE.Mesh(GEO.box, makeMat(0x64748b, { roughness: 0.85 }));
      bridge.scale.set(8.5, 0.25, 3.4);
      bridge.position.set(3.5, 0.1, 0);
      group.add(bridge);
      for (let i = 0; i < 4; i++) {
        const lanternMat = makeMat(0xfbbf24, { emissive: 0xfbbf24, emissiveIntensity: 0.1 });
        const lantern = new THREE.Mesh(GEO.octahedron, lanternMat);
        lantern.scale.setScalar(0.32);
        lantern.position.set(i * 2.2, 0.9, i % 2 === 0 ? -1.8 : 1.8);
        group.add(lantern);
        bridgeLanterns.push(lantern);
      }
    } else if (map.id === 'volcano_greenhouse') {
      // Obsidian Dome Ribs & Glass Cracks
      const ribMat = makeMat(0x0f172a, { roughness: 0.4, metalness: 0.5 });
      for (let i = 0; i < 4; i++) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(22, 0.35, 6, 32, Math.PI), ribMat);
        arch.rotation.y = (i / 4) * Math.PI;
        group.add(arch);
      }
      const crackMat = makeMat(0xf97316, { emissive: 0xea580c, emissiveIntensity: 1.15 });
      for (let i = 0; i < 6; i++) {
        const crack = new THREE.Mesh(GEO.box, crackMat);
        crack.scale.set(2.5, 0.08, 0.08);
        crack.position.set(-12 + i * 5, 11 - Math.abs(i - 2.5) * 1.4, -14 + (i % 2) * 28);
        crack.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.4;
        crack.visible = false;
        group.add(crack);
        glassCracks.push(crack);
      }
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
    };
  }

  private buildTrackRibbon(
    spline: THREE.CatmullRomCurve3,
    halfWidth: number,
    segments: number,
    mat: THREE.Material,
    edgeMat: THREE.Material
  ): THREE.Group {
    const g = new THREE.Group();
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    const edgePositions: number[] = [];
    const edgeNormals: number[] = [];
    const edgeIndices: number[] = [];

    const up = new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3();
    const side = new THREE.Vector3();

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const pt = spline.getPointAt(t);
      spline.getTangentAt(t, tangent).normalize();
      side.crossVectors(up, tangent).normalize();

      const lx = pt.x - side.x * halfWidth;
      const lz = pt.z - side.z * halfWidth;
      const rx = pt.x + side.x * halfWidth;
      const rz = pt.z + side.z * halfWidth;

      positions.push(lx, 0.05, lz, rx, 0.05, rz);
      normals.push(0, 1, 0, 0, 1, 0);

      const elx = pt.x - side.x * (halfWidth + 0.16);
      const elz = pt.z - side.z * (halfWidth + 0.16);
      const erx = pt.x + side.x * (halfWidth + 0.16);
      const erz = pt.z + side.z * (halfWidth + 0.16);
      edgePositions.push(elx, 0.03, elz, erx, 0.03, erz);
      edgeNormals.push(0, 1, 0, 0, 1, 0);

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        edgeIndices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
    edgeGeo.setAttribute('normal', new THREE.Float32BufferAttribute(edgeNormals, 3));
    edgeGeo.setIndex(edgeIndices);
    const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
    edgeMesh.receiveShadow = true;

    g.add(edgeMesh, mesh);
    return g;
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
