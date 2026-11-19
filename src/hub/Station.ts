import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PropKit } from '../rendering/props/PropKit';

export type HubStationId =
  | 'play_pads'
  | 'greenhouse'
  | 'shed'
  | 'seed_shop'
  | 'mossbeard'
  | 'notice_board'
  | 'trophy_podium'
  | 'fountain';

export interface HubStationDef {
  id: HubStationId;
  label: string;
  screenHint: string;
  x: number;
  z: number;
  radius: number;
  camTarget: [number, number, number];
  camDist: number;
  camYaw: number;
  camPitchDeg: number;
  musicZone: 'plaza' | 'greenhouse' | 'pads';
}

export const HUB_STATION_DEFS: HubStationDef[] = [
  {
    id: 'play_pads',
    label: 'Play Pads',
    screenHint: 'Choose Mode & Play',
    x: 0,
    z: 10.5,
    radius: 3.3,
    camTarget: [0, 1.0, 10.2],
    camDist: 11.5,
    camYaw: 0,
    camPitchDeg: 38,
    musicZone: 'pads',
  },
  {
    id: 'greenhouse',
    label: 'Greenhouse Summon',
    screenHint: 'Open Seed Crates',
    x: 0,
    z: -11.0,
    radius: 3.3,
    camTarget: [0, 1.4, -10.5],
    camDist: 10.5,
    camYaw: 0,
    camPitchDeg: 32,
    musicZone: 'greenhouse',
  },
  {
    id: 'shed',
    label: 'Garden Shed (Units)',
    screenHint: 'Unit Collection & Deck',
    x: -11.0,
    z: -3.5,
    radius: 3.0,
    camTarget: [-10.2, 1.2, -3.5],
    camDist: 10.5,
    camYaw: -0.6,
    camPitchDeg: 34,
    musicZone: 'plaza',
  },
  {
    id: 'seed_shop',
    label: 'Seed Shop Stall',
    screenHint: 'Weekly Stock & Crates',
    x: 11.0,
    z: -3.5,
    radius: 3.0,
    camTarget: [10.2, 1.2, -3.5],
    camDist: 10.5,
    camYaw: 0.6,
    camPitchDeg: 34,
    musicZone: 'plaza',
  },
  {
    id: 'mossbeard',
    label: 'Old Mossbeard',
    screenHint: 'Quests & Rewards',
    x: 10.5,
    z: 4.8,
    radius: 2.9,
    camTarget: [9.8, 1.0, 4.8],
    camDist: 8.8,
    camYaw: 0.55,
    camPitchDeg: 30,
    musicZone: 'plaza',
  },
  {
    id: 'notice_board',
    label: 'Notice Board',
    screenHint: "What's New & Codes",
    x: -10.5,
    z: 4.8,
    radius: 2.9,
    camTarget: [-9.8, 1.2, 4.8],
    camDist: 9.2,
    camYaw: -0.55,
    camPitchDeg: 30,
    musicZone: 'plaza',
  },
  {
    id: 'trophy_podium',
    label: 'Trophy Podium',
    screenHint: 'Bestiary & Top Runs',
    x: -7.6,
    z: -9.8,
    radius: 2.8,
    camTarget: [-7.2, 1.1, -9.4],
    camDist: 9.4,
    camYaw: -0.35,
    camPitchDeg: 34,
    musicZone: 'plaza',
  },
  {
    id: 'fountain',
    label: 'Garden Fountain',
    screenHint: 'Settings & Controls',
    x: 0,
    z: 0,
    radius: 2.9,
    camTarget: [0, 1.1, 0],
    camDist: 9.8,
    camYaw: 0.25,
    camPitchDeg: 36,
    musicZone: 'plaza',
  },
];

const ST_GEO = {
  pad: new THREE.CylinderGeometry(0.95, 1.05, 0.22, 14),
  ring: new THREE.RingGeometry(0.75, 0.94, 18),
  box: new RoundedBoxGeometry(1, 1, 1, 2, 0.08),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cone: new THREE.ConeGeometry(0.7, 1, 8),
  sphere: new THREE.IcosahedronGeometry(0.55, 1),
  disc: new THREE.CylinderGeometry(1.55, 1.75, 0.35, 18),
};

function makeStMat(color: number, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.06, ...opts });
}

export class HubStation {
  public readonly def: HubStationDef;
  public readonly root = new THREE.Group();
  private floatingTarget: THREE.Object3D | null = null;
  private alertMarker: THREE.Object3D | null = null;
  private padMeshes: THREE.Mesh[] = [];
  private glowRing: THREE.Mesh;

  constructor(def: HubStationDef) {
    this.def = def;
    this.root.position.set(def.x, 0, def.z);
    this.root.userData.stationId = def.id;

    // Ground interact ring indicator
    this.glowRing = new THREE.Mesh(
      new THREE.RingGeometry(def.radius - 0.14, def.radius, 28),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      })
    );
    this.glowRing.rotation.x = -Math.PI / 2;
    this.glowRing.position.y = 0.03;
    this.root.add(this.glowRing);

    this.buildVisuals();

    // Tag all child meshes for one-click raycasting
    this.root.traverse((obj) => {
      obj.userData.stationId = def.id;
    });
  }

  private buildVisuals(): void {
    const id = this.def.id;
    if (id === 'play_pads') {
      const padColors = [0x4ade80, 0xc084fc, 0x38bdf8, 0xf43f5e, 0xfbbf24, 0x2dd4bf];
      for (let i = 0; i < 6; i++) {
        const ang = ((i - 2.5) / 5) * 2.1;
        const px = Math.sin(ang) * 3.1;
        const pz = -1.2 + Math.cos(ang) * 1.1;
        const stone = new THREE.Mesh(ST_GEO.pad, makeStMat(0x64748b));
        stone.position.set(px, 0.11, pz);
        stone.receiveShadow = true;

        const glow = new THREE.Mesh(
          ST_GEO.ring,
          new THREE.MeshStandardMaterial({
            color: padColors[i],
            emissive: padColors[i],
            emissiveIntensity: 0.35,
            roughness: 0.4,
            side: THREE.DoubleSide,
          })
        );
        glow.rotation.x = -Math.PI / 2;
        glow.position.set(px, 0.23, pz);
        this.padMeshes.push(glow);
        this.root.add(stone, glow);
      }
      // Arch signpost behind Play Pads
      const post = new THREE.Mesh(ST_GEO.box, makeStMat(0x854d0e));
      post.scale.set(0.24, 2.3, 0.24);
      post.position.set(0, 1.15, 0.95);
      const sign = new THREE.Mesh(ST_GEO.box, makeStMat(0xb45309));
      sign.scale.set(2.4, 0.65, 0.18);
      sign.position.set(0, 2.05, 0.95);
      this.root.add(post, sign);
      return;
    }

    if (id === 'greenhouse') {
      const base = new THREE.Mesh(ST_GEO.box, makeStMat(0x94a3b8));
      base.scale.set(4.2, 0.45, 3.2);
      base.position.y = 0.22;
      base.receiveShadow = true;

      const glassMat = new THREE.MeshStandardMaterial({
        color: 0xa5f3fc,
        transparent: true,
        opacity: 0.38,
        roughness: 0.18,
      });
      const frame = new THREE.Mesh(ST_GEO.box, glassMat);
      frame.scale.set(3.8, 2.3, 2.8);
      frame.position.y = 1.55;

      const roof = new THREE.Mesh(ST_GEO.cone, glassMat);
      roof.scale.set(2.8, 1.2, 2.2);
      roof.rotation.y = Math.PI * 0.25;
      roof.position.y = 3.25;

      const pedestal = new THREE.Mesh(ST_GEO.cyl, makeStMat(0x64748b));
      pedestal.scale.set(1.1, 0.85, 1.1);
      pedestal.position.y = 0.85;

      const bud = new THREE.Mesh(
        ST_GEO.sphere,
        new THREE.MeshStandardMaterial({
          color: 0xc084fc,
          emissive: 0x9333ea,
          emissiveIntensity: 0.38,
          roughness: 0.3,
        })
      );
      bud.position.y = 1.75;
      this.floatingTarget = bud;

      this.root.add(base, frame, roof, pedestal, bud);
      return;
    }

    if (id === 'shed') {
      const walls = new THREE.Mesh(ST_GEO.box, makeStMat(0x92400e));
      walls.scale.set(3.1, 2.2, 2.6);
      walls.position.y = 1.1;
      walls.castShadow = true;

      const roof = new THREE.Mesh(ST_GEO.cone, makeStMat(0x166534));
      roof.scale.set(2.8, 1.35, 2.4);
      roof.rotation.y = Math.PI * 0.25;
      roof.position.y = 2.85;

      const door = new THREE.Mesh(ST_GEO.box, makeStMat(0x451a03));
      door.scale.set(1.0, 1.55, 0.14);
      door.position.set(1.56, 0.82, 0);
      this.root.add(walls, roof, door);
      return;
    }

    if (id === 'seed_shop') {
      const counter = new THREE.Mesh(ST_GEO.box, makeStMat(0x854d0e));
      counter.scale.set(1.2, 0.95, 2.9);
      counter.position.set(0, 0.48, 0);
      counter.castShadow = true;

      const awning = new THREE.Mesh(ST_GEO.box, makeStMat(0xf43f5e));
      awning.scale.set(1.8, 0.24, 3.2);
      awning.position.set(-0.2, 2.25, 0);
      awning.rotation.z = 0.2;

      const trim = new THREE.Mesh(ST_GEO.box, makeStMat(0xfef08a));
      trim.scale.set(0.3, 0.26, 3.22);
      trim.position.set(-1.05, 2.08, 0);

      for (let i = 0; i < 2; i++) {
        const post = new THREE.Mesh(ST_GEO.cyl, makeStMat(0x78350f));
        post.scale.set(0.18, 2.1, 0.18);
        post.position.set(-0.6, 1.05, i === 0 ? -1.3 : 1.3);
        this.root.add(post);
      }

      const sack1 = new THREE.Mesh(ST_GEO.sphere, makeStMat(0xd97706));
      sack1.scale.set(0.45, 0.55, 0.45);
      sack1.position.set(-0.15, 1.1, -0.5);
      const sack2 = sack1.clone();
      sack2.position.set(0.1, 1.1, 0.55);
      this.root.add(counter, awning, trim, sack1, sack2);
      return;
    }

    if (id === 'mossbeard') {
      const gnome = PropKit.buildGnomeSoldier(false);
      gnome.scale.setScalar(1.45);
      gnome.rotation.y = -Math.PI * 0.55;

      const beard = new THREE.Mesh(ST_GEO.cone, makeStMat(0xf1f5f9));
      beard.scale.set(0.45, 0.7, 0.35);
      beard.rotation.x = Math.PI;
      beard.position.set(-0.15, 0.72, 0.05);

      const scroll = new THREE.Mesh(ST_GEO.cyl, makeStMat(0xfef3c7));
      scroll.scale.set(0.16, 0.65, 0.16);
      scroll.rotation.z = 1.25;
      scroll.position.set(-0.45, 0.78, 0.32);

      // Golden "!" floating badge above Mossbeard when quest reward ready
      const alertGroup = new THREE.Group();
      alertGroup.position.set(0, 2.25, 0);
      const exBar = new THREE.Mesh(
        ST_GEO.box,
        new THREE.MeshStandardMaterial({
          color: 0xfde047,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.38,
        })
      );
      exBar.scale.set(0.18, 0.52, 0.18);
      exBar.position.y = 0.24;
      const exDot = new THREE.Mesh(ST_GEO.sphere, exBar.material);
      exDot.scale.setScalar(0.2);
      exDot.position.y = -0.14;
      alertGroup.add(exBar, exDot);
      this.alertMarker = alertGroup;

      this.root.add(gnome, beard, scroll, alertGroup);
      return;
    }

    if (id === 'notice_board') {
      const postL = new THREE.Mesh(ST_GEO.cyl, makeStMat(0x78350f));
      postL.scale.set(0.2, 2.1, 0.2);
      postL.position.set(0, 1.05, -0.95);
      const postR = postL.clone();
      postR.position.set(0, 1.05, 0.95);

      const board = new THREE.Mesh(ST_GEO.box, makeStMat(0xd97706));
      board.scale.set(0.22, 1.35, 2.2);
      board.position.set(0, 1.5, 0);

      const noteColors = [0xfef08a, 0xbae6fd, 0xfbcfe8];
      for (let i = 0; i < 3; i++) {
        const note = new THREE.Mesh(ST_GEO.box, makeStMat(noteColors[i]));
        note.scale.set(0.26, 0.42, 0.46);
        note.position.set(0.02, 1.55 + (i === 1 ? -0.22 : 0.12), (i - 1) * 0.62);
        this.root.add(note);
      }

      this.root.add(postL, postR, board);
      return;
    }

    if (id === 'trophy_podium') {
      const heights = [0.6, 0.95, 0.45];
      const offsets = [-0.95, 0, 0.95];
      for (let i = 0; i < 3; i++) {
        const block = new THREE.Mesh(ST_GEO.box, makeStMat(0xcbd5e1));
        block.scale.set(0.88, heights[i], 0.88);
        block.position.set(offsets[i], heights[i] * 0.5, 0);
        block.castShadow = true;

        const cup = new THREE.Mesh(
          ST_GEO.cyl,
          makeStMat(i === 1 ? 0xfbbf24 : i === 0 ? 0xe2e8f0 : 0xd97706, {
            metalness: 0.65,
            roughness: 0.25,
          })
        );
        cup.scale.set(0.36, 0.42, 0.36);
        cup.position.set(offsets[i], heights[i] + 0.22, 0);
        if (i === 1) this.floatingTarget = cup;
        this.root.add(block, cup);
      }
      return;
    }

    // Center Fountain (Watering-can fountain -> Settings)
    const basin = new THREE.Mesh(ST_GEO.disc, makeStMat(0x94a3b8));
    basin.position.y = 0.2;
    basin.receiveShadow = true;
    const water = new THREE.Mesh(
      ST_GEO.disc,
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.24,
        roughness: 0.18,
      })
    );
    water.scale.set(0.88, 0.45, 0.88);
    water.position.y = 0.36;

    const spire = new THREE.Mesh(ST_GEO.cyl, makeStMat(0xcbd5e1));
    spire.scale.set(0.45, 1.15, 0.45);
    spire.position.y = 0.78;

    const topCan = new THREE.Mesh(
      ST_GEO.cyl,
      makeStMat(0x38bdf8, { metalness: 0.55, roughness: 0.28 })
    );
    topCan.scale.set(0.58, 0.55, 0.58);
    topCan.position.set(-0.08, 1.55, 0);
    topCan.rotation.z = -0.35;
    this.floatingTarget = topCan;

    this.root.add(basin, water, spire, topCan);
  }

  public setHighlighted(active: boolean): void {
    const mat = this.glowRing.material as THREE.MeshBasicMaterial;
    mat.opacity = active ? 0.85 : 0.2;
    mat.color.setHex(active ? 0x4ade80 : 0xfde047);
  }

  public update(dt: number, elapsed: number, alertVisible: boolean): void {
    if (this.floatingTarget) {
      this.floatingTarget.rotation.y += dt * 0.9;
      if (this.def.id === 'greenhouse') {
        this.floatingTarget.position.y = 1.75 + Math.sin(elapsed * 2.2) * 0.12;
      }
    }
    if (this.alertMarker) {
      this.alertMarker.visible = alertVisible;
      if (alertVisible) {
        this.alertMarker.position.y = 2.25 + Math.sin(elapsed * 3.8) * 0.14;
        this.alertMarker.rotation.y += dt * 1.4;
      }
    }
    for (let i = 0; i < this.padMeshes.length; i++) {
      const m = this.padMeshes[i].material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.25 + 0.14 * Math.sin(elapsed * 2.8 + i * 0.9);
    }
  }
}
