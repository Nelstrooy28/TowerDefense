import * as THREE from 'three';
import type {
  BaseStructureStyle,
  LandmarkStyle,
  MapCluster,
  MapHeightZone,
  MapLayout,
  PathVisualStyle,
  PropKind,
  SpawnMarkerStyle,
} from '../../data/MapRegistry';
import { applyToonRimShader } from '../ShaderLib';

const SHARED_GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.5, 10, 8),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  dodeca: new THREE.DodecahedronGeometry(0.65, 0),
  torus: new THREE.TorusGeometry(0.5, 0.12, 6, 18),
  octa: new THREE.OctahedronGeometry(0.5, 0),
};

function makeMat(
  color: number,
  opts: {
    roughness?: number;
    metalness?: number;
    emissive?: number;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
    side?: THREE.Side;
  } = {}
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.78,
    metalness: opts.metalness ?? 0.08,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: Math.min(0.4, opts.emissiveIntensity ?? 0),
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
  applyToonRimShader(mat);
  return mat;
}

function seededRandom(seed: number): () => number {
  let s = seed | 0 || 1234567;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function hashCoords(x: number, z: number): number {
  return Math.round(x * 73856093) ^ Math.round(z * 19349663);
}

export class PropKitImpl {
  /**
   * Doc 05 §2 rule 1: Floating garden island with layered soil cross-section edge
   * (top grass lip, dark soil strata, root tendrils, embedded stones, clay base) + mist/water apron.
   */
  public buildDioramaPlinth(w: number, d: number, palette: MapLayout['palette']): THREE.Group {
    const group = new THREE.Group();

    // Trim top grass deck
    const grassMat = makeMat(palette.grass, { roughness: 0.9 });
    const topGeo = new THREE.BoxGeometry(w, 0.25, d);
    const topMesh = new THREE.Mesh(topGeo, grassMat);
    topMesh.position.y = -0.125;
    topMesh.receiveShadow = true;
    topMesh.name = 'ground';
    group.add(topMesh);

    // Grass edge lip bevel
    const lipMat = makeMat(palette.grassDark, { roughness: 0.92 });
    const lipGeo = new THREE.BoxGeometry(w + 0.35, 0.22, d + 0.35);
    const lipMesh = new THREE.Mesh(lipGeo, lipMat);
    lipMesh.position.y = -0.22;
    group.add(lipMesh);

    // Dark rich soil layer
    const soilMat = makeMat(palette.soil, { roughness: 0.95 });
    const soilGeo = new THREE.BoxGeometry(w - 0.1, 1.4, d - 0.1);
    const soilMesh = new THREE.Mesh(soilGeo, soilMat);
    soilMesh.position.y = -0.98;
    group.add(soilMesh);

    // Deeper clay & stone sub-stratum
    const clayMat = makeMat(0x451a03, { roughness: 0.96 });
    const clayGeo = new THREE.BoxGeometry(w - 0.7, 1.6, d - 0.7);
    const clayMesh = new THREE.Mesh(clayGeo, clayMat);
    clayMesh.position.y = -2.3;
    group.add(clayMesh);

    // Cross-section details around perimeter: embedded pebbles & dangling roots
    const stoneMat = makeMat(0x64748b, { roughness: 0.88 });
    const rootMat = makeMat(0x78350f, { roughness: 0.9 });
    const rng = seededRandom(w * 97 + d * 31);
    const halfW = w * 0.5;
    const halfD = d * 0.5;

    for (let i = 0; i < 24; i++) {
      const side = i % 4;
      const t = (rng() - 0.5) * (side < 2 ? w - 3 : d - 3);
      const px = side === 0 ? t : side === 1 ? t : side === 2 ? -halfW - 0.05 : halfW + 0.05;
      const pz = side === 2 ? t : side === 3 ? t : side === 0 ? -halfD - 0.05 : halfD + 0.05;

      const stone = new THREE.Mesh(SHARED_GEO.dodeca, stoneMat);
      stone.scale.set(0.55 + rng() * 0.45, 0.45 + rng() * 0.35, 0.55 + rng() * 0.45);
      stone.position.set(px, -0.8 - rng() * 1.1, pz);
      stone.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      group.add(stone);

      if (i % 2 === 0) {
        const root = new THREE.Mesh(SHARED_GEO.cylinder, rootMat);
        root.scale.set(0.14, 0.9 + rng() * 0.8, 0.14);
        root.position.set(px * 0.98, -2.9 - rng() * 0.4, pz * 0.98);
        root.rotation.z = (rng() - 0.5) * 0.35;
        group.add(root);
      }
    }

    // Soft sea/cloud apron under floating island
    const apronMat = new THREE.MeshBasicMaterial({
      color: palette.water,
      transparent: true,
      opacity: 0.32,
    });
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.9, d * 1.9), apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -3.4;
    group.add(apron);

    return group;
  }

  public buildHeightZone(zone: MapHeightZone, palette: MapLayout['palette']): THREE.Group {
    const g = new THREE.Group();
    g.position.set(zone.x, 0, zone.z);

    if (zone.style === 'raised_bed' || zone.style === 'stone_terrace' || zone.style === 'moss_mound') {
      const frameColor = zone.style === 'raised_bed' ? 0x78350f : zone.style === 'stone_terrace' ? 0x64748b : palette.grassDark;
      const fillColor = zone.style === 'raised_bed' ? 0x451a03 : zone.style === 'stone_terrace' ? 0x94a3b8 : palette.grass;
      const frameMat = makeMat(frameColor, { roughness: 0.85 });
      const fillMat = makeMat(fillColor, { roughness: 0.9 });

      if (zone.shape === 'rect') {
        const outer = new THREE.Mesh(SHARED_GEO.box, frameMat);
        outer.scale.set(zone.rx * 2, zone.height, zone.rz * 2);
        outer.position.y = zone.height * 0.5;
        outer.castShadow = true;
        outer.receiveShadow = true;

        const inner = new THREE.Mesh(SHARED_GEO.box, fillMat);
        inner.scale.set(zone.rx * 2 - 0.45, 0.16, zone.rz * 2 - 0.45);
        inner.position.y = zone.height + 0.04;
        inner.receiveShadow = true;
        g.add(outer, inner);
      } else {
        const mound = new THREE.Mesh(SHARED_GEO.sphere, fillMat);
        mound.scale.set(zone.rx * 2, zone.height * 1.4, zone.rz * 2);
        mound.position.y = 0.02;
        mound.receiveShadow = true;
        g.add(mound);
      }
    }
    return g;
  }

  /**
   * Doc 05 §2 rule 3: Path is built, not painted — sunken track with curb stones & path detail props.
   */
  public buildStyledPath(
    spline: THREE.CatmullRomCurve3,
    halfWidth: number,
    style: PathVisualStyle,
    palette: MapLayout['palette']
  ): THREE.Group {
    const g = new THREE.Group();
    const segments = 110;
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

      positions.push(
        pt.x - side.x * halfWidth,
        0.04,
        pt.z - side.z * halfWidth,
        pt.x + side.x * halfWidth,
        0.04,
        pt.z + side.z * halfWidth
      );
      normals.push(0, 1, 0, 0, 1, 0);

      edgePositions.push(
        pt.x - side.x * (halfWidth + 0.2),
        0.02,
        pt.z - side.z * (halfWidth + 0.2),
        pt.x + side.x * (halfWidth + 0.2),
        0.02,
        pt.z + side.z * (halfWidth + 0.2)
      );
      edgeNormals.push(0, 1, 0, 0, 1, 0);

      if (i < segments) {
        const b = i * 2;
        indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        edgeIndices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    const pathMat = makeMat(palette.path, { roughness: 0.88 });
    const baseRibbon = new THREE.Mesh(geo, pathMat);
    baseRibbon.receiveShadow = true;

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
    edgeGeo.setAttribute('normal', new THREE.Float32BufferAttribute(edgeNormals, 3));
    edgeGeo.setIndex(edgeIndices);
    const edgeMat = makeMat(palette.soil, {
      roughness: 0.82,
      emissive: style === 'iron_grates' || style === 'mossy_slabs' ? palette.accent : 0x000000,
      emissiveIntensity: style === 'iron_grates' || style === 'mossy_slabs' ? 0.28 : 0,
    });
    const edgeRibbon = new THREE.Mesh(edgeGeo, edgeMat);
    edgeRibbon.receiveShadow = true;
    g.add(edgeRibbon, baseRibbon);

    // Instanced stepping stones / planks / iron bars along the spline (1 draw call!)
    const tileCount = 46;
    const tileColor =
      style === 'stepping_stones'
        ? 0xe7e5e4
        : style === 'mossy_slabs'
          ? 0x475569
          : style === 'iron_grates'
            ? 0x1e293b
            : style === 'snowy_track'
              ? 0xf1f5f9
              : 0x92400e;
    const tileGeo =
      style === 'stepping_stones'
        ? new THREE.CylinderGeometry(0.65, 0.72, 0.08, 7)
        : new THREE.BoxGeometry(halfWidth * 1.65, 0.07, 0.55);
    const tileMat = makeMat(tileColor, { roughness: 0.78 });
    const inst = new THREE.InstancedMesh(tileGeo, tileMat, tileCount);
    inst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < tileCount; i++) {
      const t = (i + 0.5) / tileCount;
      const pt = spline.getPointAt(t);
      spline.getTangentAt(t, tangent);
      const jitterSide = style === 'stepping_stones' ? (i % 2 === 0 ? -0.32 : 0.32) : 0;
      side.crossVectors(up, tangent).normalize();
      dummy.position.set(pt.x + side.x * jitterSide, 0.06, pt.z + side.z * jitterSide);
      dummy.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
      dummy.scale.setScalar(style === 'stepping_stones' ? 0.9 + (i % 3) * 0.12 : 1.0);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    g.add(inst);

    return g;
  }

  public buildLandmark(style: LandmarkStyle, x: number, z: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    if (style === 'red_shed') {
      const walls = new THREE.Mesh(SHARED_GEO.box, makeMat(0xb91c1c, { roughness: 0.75 }));
      walls.scale.set(3.8, 2.6, 3.2);
      walls.position.y = 1.3;
      walls.castShadow = true;
      const roofL = new THREE.Mesh(SHARED_GEO.box, makeMat(0x78350f));
      roofL.scale.set(4.3, 0.25, 2.1);
      roofL.position.set(0, 2.95, -0.82);
      roofL.rotation.x = 0.42;
      const roofR = new THREE.Mesh(SHARED_GEO.box, makeMat(0x78350f));
      roofR.scale.set(4.3, 0.25, 2.1);
      roofR.position.set(0, 2.95, 0.82);
      roofR.rotation.x = -0.42;
      const doorFrame = new THREE.Mesh(SHARED_GEO.box, makeMat(0xf8fafc));
      doorFrame.scale.set(1.2, 1.9, 0.15);
      doorFrame.position.set(0, 0.95, 1.62);
      const interior = new THREE.Mesh(SHARED_GEO.box, makeMat(0x1e293b));
      interior.scale.set(0.95, 1.75, 0.18);
      interior.position.set(0, 0.9, 1.64);
      g.add(walls, roofL, roofR, doorFrame, interior);
    } else if (style === 'giant_mushroom_tree') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.05, 4.4, 10), makeMat(0xe2e8f0));
      trunk.position.y = 2.2;
      trunk.castShadow = true;
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(2.8, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
        makeMat(0x7c3aed, { emissive: 0x22d3ee, emissiveIntensity: 0.35 })
      );
      cap.position.y = 4.2;
      cap.castShadow = true;
      g.add(trunk, cap);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spot = new THREE.Mesh(SHARED_GEO.sphere, makeMat(0x67e8f9, { emissive: 0x38bdf8, emissiveIntensity: 0.4 }));
        spot.scale.setScalar(0.5);
        spot.position.set(Math.cos(a) * 1.85, 5.1, Math.sin(a) * 1.85);
        g.add(spot);
      }
    } else if (style === 'glass_volcano_dome') {
      const baseRing = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.35, 8, 20), makeMat(0x1c1917));
      baseRing.rotation.x = Math.PI / 2;
      baseRing.position.y = 0.25;
      const glass = new THREE.Mesh(
        new THREE.SphereGeometry(2.5, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
        makeMat(0x2dd4bf, { transparent: true, opacity: 0.35, emissive: 0xf97316, emissiveIntensity: 0.3 })
      );
      const lavaCore = new THREE.Mesh(SHARED_GEO.cone, makeMat(0xf97316, { emissive: 0xea580c, emissiveIntensity: 0.4 }));
      lavaCore.scale.set(1.6, 1.8, 1.6);
      lavaCore.position.y = 0.9;
      g.add(baseRing, glass, lavaCore);
    } else if (style === 'snowman_greenhouse') {
      const gh = new THREE.Mesh(SHARED_GEO.box, makeMat(0xbae6fd, { transparent: true, opacity: 0.48 }));
      gh.scale.set(3.4, 2.2, 2.8);
      gh.position.set(-1.4, 1.1, 0);
      const snowMat = makeMat(0xf8fafc);
      const s1 = new THREE.Mesh(SHARED_GEO.sphere, snowMat);
      s1.scale.setScalar(1.3);
      s1.position.set(1.6, 0.65, 0.4);
      const s2 = new THREE.Mesh(SHARED_GEO.sphere, snowMat);
      s2.scale.setScalar(0.95);
      s2.position.set(1.6, 1.5, 0.4);
      const hat = new THREE.Mesh(SHARED_GEO.cylinder, makeMat(0x1e293b));
      hat.scale.set(0.6, 0.55, 0.6);
      hat.position.set(1.6, 2.15, 0.4);
      g.add(gh, s1, s2, hat);
    } else if (style === 'red_pagoda') {
      const pillarMat = makeMat(0xdc2626, { roughness: 0.65 });
      const roofMat = makeMat(0x1e293b, { roughness: 0.55 });
      for (let tier = 0; tier < 2; tier++) {
        const body = new THREE.Mesh(SHARED_GEO.box, pillarMat);
        body.scale.set(2.8 - tier * 0.8, 1.5, 2.8 - tier * 0.8);
        body.position.y = 0.75 + tier * 1.8;
        body.castShadow = true;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6 - tier * 0.6, 0.9, 4), roofMat);
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 1.8 + tier * 1.8;
        g.add(body, roof);
      }
      const bell = new THREE.Mesh(SHARED_GEO.cylinder, makeMat(0xfacc15, { metalness: 0.8, roughness: 0.2 }));
      bell.scale.set(0.45, 0.6, 0.45);
      bell.position.y = 0.95;
      bell.name = 'pagoda_bell';
      g.add(bell);
    } else {
      // willow_tree
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 3.8, 10), makeMat(0x573b26));
      trunk.position.y = 1.9;
      trunk.castShadow = true;
      const crown = new THREE.Mesh(SHARED_GEO.sphere, makeMat(0x16a34a, { roughness: 0.85 }));
      crown.scale.set(4.2, 2.4, 4.2);
      crown.position.y = 4.2;
      crown.castShadow = true;
      g.add(trunk, crown);
      const frondMat = makeMat(0x4ade80, { roughness: 0.8 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const frond = new THREE.Mesh(SHARED_GEO.cylinder, frondMat);
        frond.scale.set(0.14, 2.5, 0.14);
        frond.position.set(Math.cos(a) * 1.8, 2.4, Math.sin(a) * 1.8);
        g.add(frond);
      }
    }

    return g;
  }

  public buildSpawnMarker(style: SpawnMarkerStyle, x: number, z: number, lookAtPt: THREE.Vector3): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    if (style === 'molehill') {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.95, 12), makeMat(0x573b26, { roughness: 0.95 }));
      cone.position.y = 0.45;
      g.add(cone);
    } else if (style === 'hollow_log') {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 2.1, 10), makeMat(0x451a03));
      log.rotation.z = Math.PI / 2;
      log.position.y = 0.75;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.14, 8, 16), makeMat(0x7c3aed, { emissive: 0x7c3aed, emissiveIntensity: 0.4 }));
      ring.position.set(0.65, 0.85, 0);
      ring.rotation.y = Math.PI / 2;
      g.add(log, ring);
    } else if (style === 'lava_crack') {
      const crack = new THREE.Mesh(new THREE.CircleGeometry(1.3, 12), makeMat(0xf97316, { emissive: 0xea580c, emissiveIntensity: 0.4 }));
      crack.rotation.x = -Math.PI / 2;
      crack.position.y = 0.06;
      g.add(crack);
    } else if (style === 'snowdrift') {
      const drift = new THREE.Mesh(SHARED_GEO.sphere, makeMat(0xf8fafc));
      drift.scale.set(2.4, 0.9, 2.2);
      drift.position.y = 0.25;
      g.add(drift);
    } else if (style === 'torii_gate') {
      const redMat = makeMat(0xdc2626);
      const p1 = new THREE.Mesh(SHARED_GEO.cylinder, redMat);
      p1.scale.set(0.24, 2.6, 0.24);
      p1.position.set(-1.1, 1.3, 0);
      const p2 = new THREE.Mesh(SHARED_GEO.cylinder, redMat);
      p2.scale.set(0.24, 2.6, 0.24);
      p2.position.set(1.1, 1.3, 0);
      const beam = new THREE.Mesh(SHARED_GEO.box, redMat);
      beam.scale.set(3.2, 0.28, 0.34);
      beam.position.y = 2.55;
      g.add(p1, p2, beam);
    } else {
      const whirl = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.2, 6, 20), makeMat(0x38bdf8, { emissive: 0x0ea5e9, emissiveIntensity: 0.4 }));
      whirl.rotation.x = Math.PI / 2;
      whirl.position.y = 0.1;
      g.add(whirl);
    }

    g.lookAt(lookAtPt.x, 0, lookAtPt.z);
    return g;
  }

  public buildBaseStructure(style: BaseStructureStyle, x: number, z: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.05, 0.42, 10), makeMat(0xe2e8f0, { roughness: 0.7 }));
    base.position.y = 0.21;
    base.receiveShadow = true;
    g.add(base);

    const coreColor =
      style === 'vegetable_patch'
        ? 0xf97316
        : style === 'seed_shrine'
          ? 0x22c55e
          : style === 'seed_vault'
            ? 0xf59e0b
            : style === 'root_cellar'
              ? 0x38bdf8
              : style === 'bonsai_altar'
                ? 0xf472b6
                : 0xec4899;

    const core = new THREE.Mesh(
      SHARED_GEO.octa,
      makeMat(coreColor, { emissive: coreColor, emissiveIntensity: 0.38 })
    );
    core.scale.set(0.95, 1.25, 0.95);
    core.position.y = 1.35;
    core.name = 'base_core';
    g.add(core);

    // 3 guardian pumpkins / lotus pods that reflect base health visually (Doc 05 §2 rule 7)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const pod = new THREE.Mesh(SHARED_GEO.sphere, makeMat(coreColor, { roughness: 0.6 }));
      pod.scale.set(0.65, 0.52, 0.65);
      pod.position.set(Math.cos(a) * 1.15, 0.56, Math.sin(a) * 1.15);
      pod.name = `base_pod_${i}`;
      g.add(pod);
    }

    return g;
  }

  public buildClusterProps(cluster: MapCluster, wobbleProps: THREE.Object3D[], pollenFlowers: THREE.Mesh[]): THREE.Group {
    const group = new THREE.Group();
    const rng = seededRandom(hashCoords(cluster.at[0], cluster.at[1]) + (cluster.seedOffset ?? 0));

    for (let i = 0; i < cluster.count; i++) {
      const kind: PropKind = cluster.kit[i % cluster.kit.length];
      const ang = (i / Math.max(1, cluster.count)) * Math.PI * 2 + rng() * 0.5;
      const dist = i === 0 ? 0.3 : 1.0 + rng() * 1.7;
      const px = cluster.at[0] + Math.cos(ang) * dist;
      const pz = cluster.at[1] + Math.sin(ang) * dist;

      const mesh = this.buildSingleProp(kind, px, pz, rng, pollenFlowers);
      group.add(mesh);
      wobbleProps.push(mesh);
    }
    return group;
  }

  private buildSingleProp(
    kind: PropKind,
    x: number,
    z: number,
    rng: () => number,
    pollenFlowers: THREE.Mesh[]
  ): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rng() * Math.PI * 2;

    if (kind === 'boulder' || kind === 'obsidian_shard') {
      const m = new THREE.Mesh(
        SHARED_GEO.dodeca,
        makeMat(kind === 'obsidian_shard' ? 0x1e1b1e : 0x64748b, { roughness: 0.85 })
      );
      m.scale.set(0.8 + rng() * 0.5, 0.65 + rng() * 0.6, 0.8 + rng() * 0.5);
      m.position.y = 0.4;
      m.castShadow = true;
      g.add(m);
    } else if (kind === 'bush' || kind === 'snow_pile') {
      const m = new THREE.Mesh(
        SHARED_GEO.sphere,
        makeMat(kind === 'snow_pile' ? 0xf1f5f9 : 0x15803d, { roughness: 0.88 })
      );
      m.scale.set(1.3 + rng() * 0.6, 0.8 + rng() * 0.3, 1.3 + rng() * 0.6);
      m.position.y = 0.4;
      m.castShadow = true;
      g.add(m);
    } else if (kind === 'flower_bed') {
      const colors = [0xfacc15, 0xf43f5e, 0x38bdf8, 0xe879f9];
      const base = new THREE.Mesh(SHARED_GEO.cylinder, makeMat(0x16a34a));
      base.scale.set(1.2, 0.25, 1.2);
      base.position.y = 0.12;
      g.add(base);
      for (let f = 0; f < 4; f++) {
        const fl = new THREE.Mesh(SHARED_GEO.sphere, makeMat(colors[f], { emissive: colors[f], emissiveIntensity: 0.25 }));
        fl.scale.setScalar(0.32);
        fl.position.set(Math.cos(f * 1.57) * 0.4, 0.34, Math.sin(f * 1.57) * 0.4);
        g.add(fl);
        pollenFlowers.push(fl);
      }
    } else if (kind === 'tree' || kind === 'bamboo') {
      const trunk = new THREE.Mesh(
        SHARED_GEO.cylinder,
        makeMat(kind === 'bamboo' ? 0x65a30d : 0x78350f)
      );
      trunk.scale.set(0.28, 2.2, 0.28);
      trunk.position.y = 1.1;
      trunk.castShadow = true;
      const top = new THREE.Mesh(SHARED_GEO.cone, makeMat(kind === 'bamboo' ? 0x84cc16 : 0x16a34a));
      top.scale.set(1.5, 1.8, 1.5);
      top.position.y = 2.4;
      top.castShadow = true;
      g.add(trunk, top);
    } else if (kind === 'glow_mushroom') {
      const st = new THREE.Mesh(SHARED_GEO.cylinder, makeMat(0xe2e8f0));
      st.scale.set(0.2, 0.7, 0.2);
      st.position.y = 0.35;
      const cap = new THREE.Mesh(SHARED_GEO.sphere, makeMat(0x22d3ee, { emissive: 0x06b6d4, emissiveIntensity: 0.38 }));
      cap.scale.set(0.7, 0.35, 0.7);
      cap.position.y = 0.75;
      g.add(st, cap);
    } else if (kind === 'lantern') {
      const post = new THREE.Mesh(SHARED_GEO.cylinder, makeMat(0x64748b));
      post.scale.set(0.22, 1.1, 0.22);
      post.position.y = 0.55;
      const lamp = new THREE.Mesh(SHARED_GEO.box, makeMat(0xfbbf24, { emissive: 0xf59e0b, emissiveIntensity: 0.4 }));
      lamp.scale.set(0.45, 0.42, 0.45);
      lamp.position.y = 1.25;
      g.add(post, lamp);
    } else if (kind === 'lily_pad') {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.06, 10), makeMat(0x22c55e));
      pad.position.y = 0.06;
      const lotus = new THREE.Mesh(SHARED_GEO.sphere, makeMat(0xf472b6));
      lotus.scale.setScalar(0.28);
      lotus.position.y = 0.18;
      g.add(pad, lotus);
    } else if (kind === 'reeds') {
      const mat = makeMat(0x65a30d);
      for (let r = 0; r < 3; r++) {
        const stalk = new THREE.Mesh(SHARED_GEO.cylinder, mat);
        stalk.scale.set(0.06, 1.1 + r * 0.2, 0.06);
        stalk.position.set((r - 1) * 0.16, 0.55, 0);
        g.add(stalk);
      }
    } else {
      // fence / bench / wheelbarrow / garden_bed fallback neat wood box
      const wood = new THREE.Mesh(SHARED_GEO.box, makeMat(kind === 'fence' ? 0xf8fafc : 0x854d0e));
      wood.scale.set(1.2, 0.55, 0.6);
      wood.position.y = 0.28;
      wood.castShadow = true;
      g.add(wood);
    }

    return g;
  }

  /**
   * Doc 06 §4.1 Procedural Gardener Avatar (straw hat, overalls, watering can).
   */
  public buildGardenerAvatar(): THREE.Group {
    const g = new THREE.Group();
    const overalls = new THREE.Mesh(SHARED_GEO.cylinder, makeMat(0x2563eb));
    overalls.scale.set(0.65, 0.9, 0.55);
    overalls.position.y = 0.45;
    overalls.castShadow = true;
    const head = new THREE.Mesh(SHARED_GEO.sphere, makeMat(0xfed7aa));
    head.scale.setScalar(0.56);
    head.position.y = 1.15;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 12), makeMat(0xfacc15));
    brim.position.y = 1.38;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.28, 10), makeMat(0xeab308));
    crown.position.y = 1.54;
    const can = new THREE.Mesh(SHARED_GEO.cylinder, makeMat(0x38bdf8, { metalness: 0.5 }));
    can.scale.set(0.32, 0.36, 0.32);
    can.position.set(0.48, 0.55, 0.25);
    g.add(overalls, head, brim, crown, can);
    return g;
  }

  /**
   * Doc 06 §1 Gnome Barracks Marching Soldier (with optional Lv.5 helmet).
   */
  public buildGnomeSoldier(helmet: boolean): THREE.Group {
    const g = new THREE.Group();
    const tunic = new THREE.Mesh(SHARED_GEO.cylinder, makeMat(0x2563eb));
    tunic.scale.set(0.45, 0.65, 0.45);
    tunic.position.y = 0.32;
    const hat = new THREE.Mesh(SHARED_GEO.cone, makeMat(helmet ? 0x94a3b8 : 0xdc2626));
    hat.scale.set(0.55, 0.7, 0.55);
    hat.position.y = 0.92;
    g.add(tunic, hat);
    return g;
  }
}

export const PropKit = new PropKitImpl();
