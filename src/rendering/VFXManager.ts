import * as THREE from 'three';
import { QualityManager } from '../core/QualityManager';
import { getRecipeCountForTier, VFX_RECIPES, type ParticleShape, type VFXRecipeId } from '../data/VFXRecipes';
import { createShockwaveMaterial } from './ShaderLib';
import { ProceduralTextures } from './ProceduralTextures';
import { easeOutCubic } from './Easing';
import type { EnemyEntity } from '../simulation/EnemyEntity';

interface ParticleEntry {
  active: boolean;
  shape: ParticleShape;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  drag: number;
  age: number;
  life: number;
  size: number;
  scaleUpTo: number;
  spinSpeed: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  spiralIn: boolean;
  spiralOut: boolean;
  anchorX: number;
  anchorZ: number;
  angle: number;
  color: number;
}

interface ShockwaveEntry {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  active: boolean;
  age: number;
  duration: number;
  maxRadius: number;
}

interface BeamEntry {
  group: THREE.Group;
  core: THREE.Mesh;
  shell: THREE.Mesh;
  coreMat: THREE.MeshBasicMaterial;
  shellMat: THREE.MeshBasicMaterial;
  active: boolean;
  age: number;
  duration: number;
}

interface ChainBoltEntry {
  line: THREE.Line;
  positions: Float32Array;
  mat: THREE.LineBasicMaterial;
  active: boolean;
  age: number;
  duration: number;
  jitterTimer: number;
  start: THREE.Vector3;
  end: THREE.Vector3;
}

interface TelegraphRingEntry {
  mesh: THREE.Mesh;
  fillMesh: THREE.Mesh;
  active: boolean;
  age: number;
  duration: number;
  radius: number;
}

interface CoinFlyItem {
  el: HTMLDivElement;
  active: boolean;
  age: number;
  duration: number;
  p0x: number;
  p0y: number;
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
  onArrive?: () => void;
}

const MAX_PER_SHAPE = 1500;

export class VFXManager {
  private scene: THREE.Scene;
  private instancedMeshes: Record<ParticleShape, THREE.InstancedMesh>;
  private particles: Record<ParticleShape, ParticleEntry[]>;
  private cursors: Record<ParticleShape, number> = {
    sphere: 0,
    diamond: 0,
    leaf: 0,
    spark: 0,
  };

  private shockwaves: ShockwaveEntry[] = [];
  private beams: BeamEntry[] = [];
  private bolts: ChainBoltEntry[] = [];
  private telegraphs: TelegraphRingEntry[] = [];

  // Sky light pillar for Lv.5 upgrade (§6.2)
  private pillarMesh: THREE.Mesh;
  private pillarTimer = 0;

  // Chrono Tsunami wave mesh (§8.2)
  private tsunamiMesh: THREE.Mesh;
  private tsunamiActive = false;
  private tsunamiTimer = 0;

  // Weather rain streaks pool
  private rainMesh: THREE.InstancedMesh;
  private rainPositions: Float32Array;
  private rainActive = false;

  // World-to-HUD Flying Coins (§8.7)
  private coinPool: CoinFlyItem[] = [];
  private coinLayer: HTMLElement;

  // 3D Billboard Status Icons (Fix F2 §2: 1 draw call InstancedMesh)
  private statusIconMesh: THREE.InstancedMesh;
  private statusTileArray: Float32Array;
  private statusTileAttr: THREE.InstancedBufferAttribute;
  private readonly _statusTiles = new Int8Array(4);
  private readonly _statusScales = new Float32Array(4);

  private readonly _dummy = new THREE.Object3D();
  private readonly _color = new THREE.Color();
  private readonly _proj = new THREE.Vector3();

  public activeParticleCount = 0;

  constructor(scene: THREE.Scene, coinLayer: HTMLElement) {
    this.scene = scene;
    this.coinLayer = coinLayer;

    const geos: Record<ParticleShape, THREE.BufferGeometry> = {
      sphere: new THREE.SphereGeometry(0.5, 6, 5),
      diamond: new THREE.OctahedronGeometry(0.5, 0),
      leaf: new THREE.BoxGeometry(0.8, 0.14, 0.45),
      spark: new THREE.BoxGeometry(0.18, 0.9, 0.18),
    };

    const mats: Record<ParticleShape, THREE.MeshBasicMaterial> = {
      sphere: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      diamond: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      leaf: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      spark: new THREE.MeshBasicMaterial({
        color: 0xffffff,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    };

    this.instancedMeshes = {
      sphere: new THREE.InstancedMesh(geos.sphere, mats.sphere, MAX_PER_SHAPE),
      diamond: new THREE.InstancedMesh(geos.diamond, mats.diamond, MAX_PER_SHAPE),
      leaf: new THREE.InstancedMesh(geos.leaf, mats.leaf, MAX_PER_SHAPE),
      spark: new THREE.InstancedMesh(geos.spark, mats.spark, MAX_PER_SHAPE),
    };

    this.particles = { sphere: [], diamond: [], leaf: [], spark: [] };

    for (const shape of ['sphere', 'diamond', 'leaf', 'spark'] as ParticleShape[]) {
      const im = this.instancedMeshes[shape];
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      im.count = 0;
      this.scene.add(im);

      for (let i = 0; i < MAX_PER_SHAPE; i++) {
        this.particles[shape].push({
          active: false,
          shape,
          x: 0,
          y: 0,
          z: 0,
          vx: 0,
          vy: 0,
          vz: 0,
          gravity: -9,
          drag: 0.5,
          age: 0,
          life: 1,
          size: 0.1,
          scaleUpTo: 0,
          spinSpeed: 0,
          rotX: 0,
          rotY: 0,
          rotZ: 0,
          spiralIn: false,
          spiralOut: false,
          anchorX: 0,
          anchorZ: 0,
          angle: 0,
          color: 0xffffff,
        });
      }
    }

    // Shockwave Ring Pool (24)
    const swGeo = new THREE.PlaneGeometry(2, 2);
    swGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 24; i++) {
      const mat = createShockwaveMaterial(0xffffff);
      const mesh = new THREE.Mesh(swGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shockwaves.push({
        mesh,
        mat,
        active: false,
        age: 0,
        duration: 0.5,
        maxRadius: 4,
      });
    }

    // Additive Dual-Cylinder Beam Pool (16) (§8.2)
    const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    unitCyl.translate(0, 0.5, 0);
    unitCyl.rotateX(Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const group = new THREE.Group();
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
      });
      const shellMat = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const core = new THREE.Mesh(unitCyl, coreMat);
      const shell = new THREE.Mesh(unitCyl, shellMat);
      group.add(shell, core);
      group.visible = false;
      this.scene.add(group);
      this.beams.push({
        group,
        core,
        shell,
        coreMat,
        shellMat,
        active: false,
        age: 0,
        duration: 0.12,
      });
    }

    // Chain Lightning Pool (20, 6 segments = 7 points) (§16)
    for (let i = 0; i < 20; i++) {
      const positions = new Float32Array(7 * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xa78bfa,
        transparent: true,
        opacity: 0.95,
      });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      line.frustumCulled = false;
      this.scene.add(line);
      this.bolts.push({
        line,
        positions,
        mat,
        active: false,
        age: 0,
        duration: 0.15,
        jitterTimer: 0,
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
      });
    }

    // Red Ground Telegraph Rings (16)
    const ringGeo = new THREE.RingGeometry(0.88, 1.0, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const fillGeo = new THREE.CircleGeometry(1.0, 24);
    fillGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
      );
      const fillMesh = new THREE.Mesh(
        fillGeo,
        new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.22, depthWrite: false })
      );
      fillMesh.position.y = 0.01;
      mesh.add(fillMesh);
      mesh.visible = false;
      this.scene.add(mesh);
      this.telegraphs.push({
        mesh,
        fillMesh,
        active: false,
        age: 0,
        duration: 1.2,
        radius: 1.5,
      });
    }

    // Lv.5 Light Pillar (§6.2)
    this.pillarMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.1, 24, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.pillarMesh.visible = false;
    this.scene.add(this.pillarMesh);

    // Chrono Tsunami Foamy Wave Mesh (§8.2)
    this.tsunamiMesh = new THREE.Mesh(
      new THREE.BoxGeometry(44, 3.2, 2.6),
      new THREE.MeshBasicMaterial({
        color: 0x2dd4bf,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.tsunamiMesh.visible = false;
    this.scene.add(this.tsunamiMesh);

    // Rain Weather Streaks (300 instanced lines)
    const rainGeo = new THREE.BoxGeometry(0.03, 1.1, 0.03);
    const rainMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.48,
    });
    this.rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, 300);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;
    this.rainPositions = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      this.rainPositions[i * 3] = (Math.random() * 2 - 1) * 22;
      this.rainPositions[i * 3 + 1] = Math.random() * 14 + 1;
      this.rainPositions[i * 3 + 2] = (Math.random() * 2 - 1) * 22;
    }
    this.scene.add(this.rainMesh);

    // HUD Flying Coins Pool (24) (§8.7)
    for (let i = 0; i < 24; i++) {
      const el = document.createElement('div');
      el.className = 'flying-coin';
      el.textContent = '$';
      el.style.display = 'none';
      this.coinLayer.appendChild(el);
      this.coinPool.push({
        el,
        active: false,
        age: 0,
        duration: 0.65,
        p0x: 0,
        p0y: 0,
        p1x: 0,
        p1y: 0,
        p2x: 0,
        p2y: 0,
      });
    }

    // 3D Billboard Status Icons Pool (Fix F2: 256 max icons, 1 draw call)
    const maxStatusIcons = 256;
    const statusGeo = new THREE.PlaneGeometry(0.42, 0.42);
    this.statusTileArray = new Float32Array(maxStatusIcons);
    this.statusTileAttr = new THREE.InstancedBufferAttribute(this.statusTileArray, 1);
    statusGeo.setAttribute('aTile', this.statusTileAttr);
    const statusSheet = ProceduralTextures.getStatusIconSpriteSheet();
    const statusMat = new THREE.ShaderMaterial({
      uniforms: {
        uSheet: { value: statusSheet },
      },
      vertexShader: `
        attribute float aTile;
        varying vec2 vUv;
        varying float vTile;
        void main() {
          vUv = uv;
          vTile = aTile;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uSheet;
        varying vec2 vUv;
        varying float vTile;
        void main() {
          vec2 tileUv = vec2((vUv.x + floor(vTile + 0.5)) / 8.0, vUv.y);
          vec4 tex = texture2D(uSheet, tileUv);
          if (tex.a < 0.08) discard;
          gl_FragColor = tex;
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    this.statusIconMesh = new THREE.InstancedMesh(statusGeo, statusMat, maxStatusIcons);
    this.statusIconMesh.count = 0;
    this.statusIconMesh.frustumCulled = false;
    this.statusIconMesh.renderOrder = 25;
    this.scene.add(this.statusIconMesh);
  }

  public spawnRecipe(
    recipeId: VFXRecipeId,
    x: number,
    y: number,
    z: number,
    overrideColor?: number
  ): void {
    const r = VFX_RECIPES[recipeId];
    if (r.respectsReducedMotion && QualityManager.settings.reducedMotion) return;

    const globalCap = QualityManager.preset.particleCap;
    const ratio = this.activeParticleCount / Math.max(1, globalCap);
    // VFX Budget Manager: shed lowest-priority particles first when approaching tier cap
    if (r.priority === 'ambient' && ratio >= 0.78) return;
    if (r.priority === 'normal' && ratio >= 0.92) return;
    if (this.activeParticleCount >= globalCap && r.priority !== 'critical') return;

    const count = getRecipeCountForTier(r, QualityManager.settings.tier);
    const hardCap = r.priority === 'critical' ? globalCap + 120 : globalCap;
    const toSpawn = Math.min(count, Math.max(0, hardCap - this.activeParticleCount));
    if (toSpawn <= 0) return;

    for (let i = 0; i < toSpawn; i++) {
      const shape = r.shapes[i % r.shapes.length];
      const pool = this.particles[shape];
      const idx = this.cursors[shape];
      this.cursors[shape] = (idx + 1) % MAX_PER_SHAPE;
      const p = pool[idx];

      p.active = true;
      p.age = 0;
      p.life = r.life * (0.85 + Math.random() * 0.3);
      p.gravity = r.gravity;
      p.drag = r.drag;
      p.scaleUpTo = r.scaleUpTo ?? 0;
      p.spinSpeed = THREE.MathUtils.degToRad(r.spinDegPerSec) * (Math.random() > 0.5 ? 1 : -1);
      p.size = r.sizeMin + Math.random() * (r.sizeMax - r.sizeMin);
      p.color = overrideColor ?? r.colors[i % r.colors.length];
      p.spiralIn = !!r.spiralIn;
      p.spiralOut = !!r.spiralOut;
      p.anchorX = x;
      p.anchorZ = z;
      p.angle = (i / Math.max(1, toSpawn)) * Math.PI * 2;
      p.rotX = Math.random() * Math.PI;
      p.rotY = Math.random() * Math.PI;
      p.rotZ = Math.random() * Math.PI;

      if (p.spiralIn || p.spiralOut) {
        const rad = p.spiralIn ? 1.2 : 0.2;
        p.x = x + Math.cos(p.angle) * rad;
        p.y = y + 0.2;
        p.z = z + Math.sin(p.angle) * rad;
        p.vx = 0;
        p.vy = 2.6;
        p.vz = 0;
      } else {
        const theta = Math.random() * Math.PI * 2;
        const upBias = r.gravity > 0 ? 0.85 : 0.35 + Math.random() * 0.65;
        const spd = r.speedMin + Math.random() * (r.speedMax - r.speedMin);
        p.x = x;
        p.y = y;
        p.z = z;
        p.vx = Math.cos(theta) * spd * (1 - upBias * 0.4);
        p.vy = spd * upBias;
        p.vz = Math.sin(theta) * spd * (1 - upBias * 0.4);
      }
    }
  }

  public spawnShockwave(
    x: number,
    y: number,
    z: number,
    maxRadius: number,
    colorHex: number,
    duration = 0.5,
    critical = false
  ): void {
    let activeSw = 0;
    for (const sw of this.shockwaves) if (sw.active) activeSw++;
    if (!critical && activeSw >= 20) return; // Reserve last 4 slots for critical telegraphs & bosses

    for (const sw of this.shockwaves) {
      if (!sw.active) {
        sw.active = true;
        sw.age = 0;
        sw.duration = duration;
        sw.maxRadius = maxRadius;
        sw.mat.uniforms.uColor.value.setHex(colorHex);
        sw.mat.uniforms.uProgress.value = 0;
        sw.mesh.position.set(x, y + 0.08, z);
        sw.mesh.scale.setScalar(maxRadius);
        sw.mesh.visible = true;
        return;
      }
    }
  }

  public spawnBeam(
    sx: number,
    sy: number,
    sz: number,
    ex: number,
    ey: number,
    ez: number,
    outerColor: number,
    thicknessScale = 1.0,
    duration = 0.14
  ): void {
    for (const b of this.beams) {
      if (!b.active) {
        b.active = true;
        b.age = 0;
        b.duration = duration;
        b.group.position.set(sx, sy, sz);
        this._proj.set(ex, ey, ez);
        b.group.lookAt(this._proj);
        const len = Math.hypot(ex - sx, ey - sy, ez - sz);
        b.core.scale.set(0.06 * thicknessScale, 0.06 * thicknessScale, len);
        b.shell.scale.set(0.22 * thicknessScale, 0.22 * thicknessScale, len);
        b.shellMat.color.setHex(outerColor);
        b.coreMat.opacity = 0.95;
        b.shellMat.opacity = 0.48;
        b.group.visible = true;
        return;
      }
    }
  }

  public spawnChainLightning(
    sx: number,
    sy: number,
    sz: number,
    ex: number,
    ey: number,
    ez: number,
    colorHex = 0xa78bfa
  ): void {
    for (const bolt of this.bolts) {
      if (!bolt.active) {
        bolt.active = true;
        bolt.age = 0;
        bolt.duration = 0.15;
        bolt.jitterTimer = 0;
        bolt.start.set(sx, sy, sz);
        bolt.end.set(ex, ey, ez);
        bolt.mat.color.setHex(colorHex);
        this.jitterBolt(bolt);
        bolt.line.visible = true;
        return;
      }
    }
  }

  private jitterBolt(bolt: ChainBoltEntry): void {
    const pos = bolt.positions;
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const jitter = i === 0 || i === 6 ? 0 : 0.42;
      pos[i * 3] = THREE.MathUtils.lerp(bolt.start.x, bolt.end.x, t) + (Math.random() - 0.5) * jitter;
      pos[i * 3 + 1] = THREE.MathUtils.lerp(bolt.start.y, bolt.end.y, t) + (Math.random() - 0.5) * jitter;
      pos[i * 3 + 2] = THREE.MathUtils.lerp(bolt.start.z, bolt.end.z, t) + (Math.random() - 0.5) * jitter;
    }
    bolt.line.geometry.attributes.position.needsUpdate = true;
  }

  public spawnTelegraph(x: number, z: number, radius: number, duration: number): void {
    for (const t of this.telegraphs) {
      if (!t.active) {
        t.active = true;
        t.age = 0;
        t.duration = duration;
        t.radius = radius;
        t.mesh.position.set(x, 0.08, z);
        t.mesh.scale.setScalar(radius);
        t.fillMesh.scale.setScalar(0.05);
        t.mesh.visible = true;
        return;
      }
    }
  }

  public spawnUpgradeLightPillar(x: number, z: number): void {
    this.pillarMesh.position.set(x, 12, z);
    this.pillarMesh.visible = true;
    this.pillarTimer = 0.8;
  }

  public triggerChronoTsunamiWave(): void {
    this.tsunamiActive = true;
    this.tsunamiTimer = 0;
    this.tsunamiMesh.position.set(22, 1.6, 0);
    this.tsunamiMesh.visible = true;
  }

  public setRainActive(active: boolean): void {
    this.rainActive = active && QualityManager.settings.tier !== 'Low';
    this.rainMesh.visible = this.rainActive;
  }

  public spawnCoinToHUD(
    worldX: number,
    worldY: number,
    worldZ: number,
    camera: THREE.Camera,
    targetX: number,
    targetY: number,
    onArrive?: () => void
  ): void {
    if (QualityManager.settings.reducedMotion) {
      onArrive?.();
      return;
    }
    this._proj.set(worldX, worldY + 0.6, worldZ).project(camera);
    if (this._proj.z > 1) {
      onArrive?.();
      return;
    }
    const sx = (this._proj.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-this._proj.y * 0.5 + 0.5) * window.innerHeight;

    // Merge if pool is busy (>20 active) (§7.1)
    let activeCount = 0;
    for (const c of this.coinPool) if (c.active) activeCount++;
    if (activeCount >= 20) {
      onArrive?.();
      return;
    }

    for (const c of this.coinPool) {
      if (!c.active) {
        c.active = true;
        c.age = 0;
        c.duration = 0.65;
        c.p0x = sx;
        c.p0y = sy;
        c.p1x = (sx + targetX) * 0.5 + (Math.random() - 0.5) * 120;
        c.p1y = Math.min(sy, targetY) - 110;
        c.p2x = targetX;
        c.p2y = targetY;
        c.onArrive = onArrive;
        c.el.style.display = 'flex';
        return;
      }
    }
    onArrive?.();
  }

  public update(dt: number): void {
    let totalLive = 0;

    // 1. Update Instanced Particles
    for (const shape of ['sphere', 'diamond', 'leaf', 'spark'] as ParticleShape[]) {
      const pool = this.particles[shape];
      const im = this.instancedMeshes[shape];
      let writeIdx = 0;

      for (let i = 0; i < MAX_PER_SHAPE; i++) {
        const p = pool[i];
        if (!p.active) continue;
        p.age += dt;
        if (p.age >= p.life) {
          p.active = false;
          continue;
        }
        const t = p.age / p.life;

        if (p.spiralIn) {
          p.angle += dt * 11;
          const rad = THREE.MathUtils.lerp(1.2, 0.2, t);
          p.x = p.anchorX + Math.cos(p.angle) * rad;
          p.z = p.anchorZ + Math.sin(p.angle) * rad;
          p.y += p.vy * dt;
        } else if (p.spiralOut) {
          p.angle += dt * 9;
          const rad = THREE.MathUtils.lerp(0.25, 1.5, t);
          p.x = p.anchorX + Math.cos(p.angle) * rad;
          p.z = p.anchorZ + Math.sin(p.angle) * rad;
          p.y += 1.4 * dt;
        } else {
          const damp = Math.max(0, 1 - p.drag * dt);
          p.vx *= damp;
          p.vz *= damp;
          p.vy += p.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (p.y < 0.05) {
            p.y = 0.05;
            p.vy *= -0.35;
          }
        }

        p.rotX += p.spinSpeed * dt;
        p.rotY += p.spinSpeed * 0.7 * dt;

        const scaleMult = p.scaleUpTo > 0 ? 1 + (p.scaleUpTo - 1) * t : 1 - t * 0.85;
        this._dummy.position.set(p.x, p.y, p.z);
        this._dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
        this._dummy.scale.setScalar(Math.max(0.01, p.size * scaleMult));
        this._dummy.updateMatrix();
        im.setMatrixAt(writeIdx, this._dummy.matrix);
        this._color.setHex(p.color);
        im.setColorAt(writeIdx, this._color);
        writeIdx++;
      }

      im.count = writeIdx;
      totalLive += writeIdx;
      if (writeIdx > 0) {
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
    }
    this.activeParticleCount = totalLive;

    // 2. Shockwaves
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      sw.age += dt;
      if (sw.age >= sw.duration) {
        sw.active = false;
        sw.mesh.visible = false;
      } else {
        sw.mat.uniforms.uProgress.value = easeOutCubic(sw.age / sw.duration);
      }
    }

    // 3. Beams
    for (const b of this.beams) {
      if (!b.active) continue;
      b.age += dt;
      if (b.age >= b.duration) {
        b.active = false;
        b.group.visible = false;
      } else {
        const fade = 1 - b.age / b.duration;
        b.coreMat.opacity = 0.95 * fade;
        b.shellMat.opacity = 0.45 * fade;
      }
    }

    // 4. Chain Lightning (re-jitter every 30 ms)
    for (const bolt of this.bolts) {
      if (!bolt.active) continue;
      bolt.age += dt;
      bolt.jitterTimer += dt;
      if (bolt.age >= bolt.duration) {
        bolt.active = false;
        bolt.line.visible = false;
      } else {
        if (bolt.jitterTimer >= 0.03) {
          bolt.jitterTimer = 0;
          this.jitterBolt(bolt);
        }
        bolt.mat.opacity = 1 - bolt.age / bolt.duration;
      }
    }

    // 5. Telegraphs
    for (const t of this.telegraphs) {
      if (!t.active) continue;
      t.age += dt;
      if (t.age >= t.duration) {
        t.active = false;
        t.mesh.visible = false;
      } else {
        t.fillMesh.scale.setScalar(Math.min(1, t.age / t.duration));
      }
    }

    // 6. Lv.5 Light Pillar
    if (this.pillarTimer > 0) {
      this.pillarTimer -= dt;
      if (this.pillarTimer <= 0) {
        this.pillarMesh.visible = false;
      } else {
        (this.pillarMesh.material as THREE.MeshBasicMaterial).opacity = (this.pillarTimer / 0.8) * 0.65;
        this.pillarMesh.rotation.y += dt * 3;
      }
    }

    // 7. Chrono Tsunami sweeping backward along track
    if (this.tsunamiActive) {
      this.tsunamiTimer += dt;
      const dur = 1.6;
      if (this.tsunamiTimer >= dur) {
        this.tsunamiActive = false;
        this.tsunamiMesh.visible = false;
      } else {
        const p = this.tsunamiTimer / dur;
        this.tsunamiMesh.position.x = THREE.MathUtils.lerp(22, -24, easeOutCubic(p));
        (this.tsunamiMesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(p * Math.PI) * 0.55;
      }
    }

    // 8. Rain Weather Streaks
    if (this.rainActive) {
      for (let i = 0; i < 300; i++) {
        this.rainPositions[i * 3 + 1] -= dt * 22;
        this.rainPositions[i * 3] -= dt * 2.5;
        if (this.rainPositions[i * 3 + 1] < 0) {
          this.rainPositions[i * 3] = (Math.random() * 2 - 1) * 22;
          this.rainPositions[i * 3 + 1] = 14 + Math.random() * 3;
          this.rainPositions[i * 3 + 2] = (Math.random() * 2 - 1) * 22;
        }
        this._dummy.position.set(
          this.rainPositions[i * 3],
          this.rainPositions[i * 3 + 1],
          this.rainPositions[i * 3 + 2]
        );
        this._dummy.rotation.set(0, 0, 0.12);
        this._dummy.scale.set(1, 1, 1);
        this._dummy.updateMatrix();
        this.rainMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.rainMesh.instanceMatrix.needsUpdate = true;
    }

    // 9. Flying Coins (UI space, always runs smoothly)
    for (const c of this.coinPool) {
      if (!c.active) continue;
      c.age += dt;
      if (c.age >= c.duration) {
        c.active = false;
        c.el.style.display = 'none';
        c.onArrive?.();
        c.onArrive = undefined;
      } else {
        const t = easeOutCubic(c.age / c.duration);
        const omt = 1 - t;
        const x = omt * omt * c.p0x + 2 * omt * t * c.p1x + t * t * c.p2x;
        const y = omt * omt * c.p0y + 2 * omt * t * c.p1y + t * t * c.p2y;
        c.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${1 - t * 0.25})`;
      }
    }
  }

  /** Fix F2 (§2): Update 3D billboard sprite-sheet status icons above damaged enemies (zero allocations). */
  public syncStatusIcons(enemies: readonly EnemyEntity[], camera: THREE.Camera): void {
    const maxInstances = this.statusTileArray.length;
    let instanceIdx = 0;

    for (let i = 0; i < enemies.length && instanceIdx < maxInstances; i++) {
      const e = enemies[i];
      if (e.isDead || e.hp <= 0 || e.isBurrowed) continue;

      let count = 0;
      const pushStatus = (tile: number, key: string) => {
        if (count >= 4) return;
        this._statusTiles[count] = tile;
        const pulse = e.statusPulseTimers[key] ?? 0;
        this._statusScales[count] =
          pulse > 0 ? 1.0 + 0.25 * Math.sin(((0.18 - pulse) / 0.18) * Math.PI) : 1.0;
        count++;
      };

      if (e.burnTimer > 0) pushStatus(0, 'burn');
      if (e.freezeTimer > 0) pushStatus(2, 'freeze');
      else if (e.chillTimer > 0) pushStatus(1, 'chill');
      if (e.bleedTimer > 0) pushStatus(3, 'bleed');
      if (e.staggerTimer > 0) pushStatus(4, 'stun');
      if (e.wetTimer > 0) pushStatus(5, 'wet');
      if (e.poisonTimer > 0) pushStatus(6, 'poison');
      if (e.armor > 0 && count < 4) pushStatus(7, 'shield');

      if (count === 0) continue;

      const spacing = 0.44;
      const startOffset = -((count - 1) * spacing) * 0.5;
      const baseY = e.position.y + 1.45 * e.def.scale + 0.45;

      for (let s = 0; s < count && instanceIdx < maxInstances; s++) {
        const rightOffset = startOffset + s * spacing;
        this._dummy.position.set(e.position.x, baseY, e.position.z);
        this._dummy.quaternion.copy(camera.quaternion);
        this._dummy.translateX(rightOffset);
        this._dummy.scale.setScalar(this._statusScales[s]);
        this._dummy.updateMatrix();
        this.statusIconMesh.setMatrixAt(instanceIdx, this._dummy.matrix);
        this.statusTileArray[instanceIdx] = this._statusTiles[s];
        instanceIdx++;
      }
    }

    this.statusIconMesh.count = instanceIdx;
    if (instanceIdx > 0) {
      this.statusIconMesh.instanceMatrix.needsUpdate = true;
      this.statusTileAttr.needsUpdate = true;
    }
  }

  public clearAll(): void {
    for (const shape of ['sphere', 'diamond', 'leaf', 'spark'] as ParticleShape[]) {
      for (const p of this.particles[shape]) p.active = false;
      this.instancedMeshes[shape].count = 0;
    }
    for (const sw of this.shockwaves) {
      sw.active = false;
      sw.mesh.visible = false;
    }
    for (const b of this.beams) {
      b.active = false;
      b.group.visible = false;
    }
    for (const bolt of this.bolts) {
      bolt.active = false;
      bolt.line.visible = false;
    }
    for (const t of this.telegraphs) {
      t.active = false;
      t.mesh.visible = false;
    }
    this.pillarMesh.visible = false;
    this.tsunamiMesh.visible = false;
    this.tsunamiActive = false;
    this.setRainActive(false);
    this.statusIconMesh.count = 0;
    this.activeParticleCount = 0;
  }
}
