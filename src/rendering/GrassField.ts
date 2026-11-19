import * as THREE from 'three';
import { QualityManager } from '../core/QualityManager';
import { EventBus } from '../core/EventBus';
import { GlobalShaderUniforms } from './ShaderLib';
import type { MapDef } from '../data/MapRegistry';

interface GrassStamp {
  x: number;
  z: number;
  radius: number;
  type: 'flatten' | 'burn' | 'frost';
  age: number;
  duration: number;
}

export class GrassField {
  private mesh: THREE.InstancedMesh | null = null;
  private maxBlades = 20000;
  private bladePositions: Float32Array = new Float32Array(0);
  private mat: THREE.ShaderMaterial;
  private stamps: GrassStamp[] = [];
  private scene: THREE.Scene;

  private readonly uDisturbPos = { value: new THREE.Vector3(999, 0, 999) };
  private readonly uDisturbStrength = { value: 0 };
  private readonly uTintPos = { value: new THREE.Vector3(999, 0, 999) };
  private readonly uTintColor = { value: new THREE.Color(0x111111) };
  private readonly uTintAmount = { value: 0 };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: GlobalShaderUniforms.uTime,
        uWindStrength: GlobalShaderUniforms.uWindStrength,
        uDisturbPos: this.uDisturbPos,
        uDisturbStrength: this.uDisturbStrength,
        uTintPos: this.uTintPos,
        uTintColor: this.uTintColor,
        uTintAmount: this.uTintAmount,
      },
      side: THREE.DoubleSide,
      vertexShader: `
        uniform float uTime;
        uniform float uWindStrength;
        uniform vec3 uDisturbPos;
        uniform float uDisturbStrength;
        uniform vec3 uTintPos;
        uniform vec3 uTintColor;
        uniform float uTintAmount;

        varying vec3 vColor;
        varying float vTip;

        void main() {
          vec4 worldBase = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float h = position.y;
          vTip = clamp(h / 0.55, 0.0, 1.0);

          float sway = sin(uTime * 2.2 + worldBase.x * 0.45 + worldBase.z * 0.35) * 0.14 * uWindStrength;
          float gust = cos(uTime * 1.1 + worldBase.x * 0.2) * 0.08 * uWindStrength;

          vec3 pos = position;
          pos.x += (sway + gust) * vTip * vTip;
          pos.z += sway * 0.5 * vTip * vTip;

          // Bend/flatten away from disturbance (explosions or enemy feet)
          vec2 diff = worldBase.xz - uDisturbPos.xz;
          float dist = length(diff);
          if (dist < 3.5 && uDisturbStrength > 0.01) {
            float push = (1.0 - dist / 3.5) * uDisturbStrength;
            vec2 dir = dist > 0.01 ? normalize(diff) : vec2(1.0, 0.0);
            pos.x += dir.x * push * 0.45 * vTip;
            pos.z += dir.y * push * 0.45 * vTip;
            pos.y *= max(0.25, 1.0 - push * 0.65);
          }

          vec3 baseCol = vec3(0.22, 0.58, 0.24);
          #ifdef USE_INSTANCING_COLOR
            baseCol = instanceColor;
          #endif

          // Tint near fire or ice
          float tDist = length(worldBase.xz - uTintPos.xz);
          if (tDist < 3.2 && uTintAmount > 0.01) {
            float tf = (1.0 - tDist / 3.2) * uTintAmount;
            baseCol = mix(baseCol, uTintColor, clamp(tf, 0.0, 0.85));
          }

          vColor = mix(baseCol * 0.72, baseCol * 1.18, vTip);
          gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vTip;
        void main() {
          gl_FragColor = vec4(vColor, 1.0);
        }
      `,
    });

    EventBus.on('quality:changed', () => this.refreshCount());
  }

  public rebuildForMap(map: MapDef, splines: THREE.CatmullRomCurve3[]): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }

    // Tapered grass blade quad (5 vertices / 3 tris)
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      -0.06, 0, 0,
       0.06, 0, 0,
      -0.04, 0.3, 0,
       0.04, 0.3, 0,
       0.0,  0.55, 0.03,
    ]);
    const indices = [0, 1, 2, 1, 3, 2, 2, 3, 4];
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    this.maxBlades = 40000; // Ultra cap pre-allocated; draw count clamped by preset
    this.mesh = new THREE.InstancedMesh(geo, this.mat, this.maxBlades);
    this.mesh.frustumCulled = false;

    this.bladePositions = new Float32Array(this.maxBlades * 2);

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const baseHex = map.groundColor;
    const baseCol = new THREE.Color(baseHex);
    const half = map.boundsHalfSize - 0.8;

    // Sample spline points once to reject blades on the track
    const trackPts: THREE.Vector3[] = [];
    for (const sp of splines) {
      for (let i = 0; i <= 80; i++) {
        trackPts.push(sp.getPointAt(i / 80));
      }
    }
    const minTrackDistSq = (map.trackHalfWidth + 0.35) ** 2;

    let placed = 0;
    let attempts = 0;
    while (placed < this.maxBlades && attempts < this.maxBlades * 3) {
      attempts++;
      const x = (Math.random() * 2 - 1) * half;
      const z = (Math.random() * 2 - 1) * half;

      // Skip pond
      const pdx = (x - map.pond.x) / (map.pond.radiusX + 0.4);
      const pdz = (z - map.pond.z) / (map.pond.radiusZ + 0.4);
      if (pdx * pdx + pdz * pdz < 1) continue;

      // Skip track
      let onTrack = false;
      for (let k = 0; k < trackPts.length; k++) {
        const dx = x - trackPts[k].x;
        const dz = z - trackPts[k].z;
        if (dx * dx + dz * dz < minTrackDistSq) {
          onTrack = true;
          break;
        }
      }
      if (onTrack) continue;

      dummy.position.set(x, 0.01, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      const s = 0.7 + Math.random() * 0.7;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(placed, dummy.matrix);

      col.copy(baseCol).offsetHSL((Math.random() - 0.5) * 0.04, 0.05, (Math.random() - 0.5) * 0.08);
      this.mesh.setColorAt(placed, col);
      this.bladePositions[placed * 2] = x;
      this.bladePositions[placed * 2 + 1] = z;
      placed++;
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.scene.add(this.mesh);
    this.refreshCount();
  }

  public refreshCount(): void {
    if (!this.mesh) return;
    const cap = QualityManager.preset.grassBlades;
    this.mesh.visible = cap > 0;
    this.mesh.count = Math.min(this.maxBlades, cap);
  }

  public addReaction(
    x: number,
    z: number,
    radius: number,
    type: 'flatten' | 'burn' | 'frost',
    duration = 1.6
  ): void {
    if (QualityManager.preset.grassBlades === 0) return;
    this.stamps.push({ x, z, radius, type, age: 0, duration });
    if (this.stamps.length > 8) this.stamps.shift();
  }

  public setVisible(visible: boolean): void {
    if (this.mesh) this.mesh.visible = visible;
  }

  public update(dt: number, leadEnemyX?: number, leadEnemyZ?: number): void {
    if (!this.mesh || !this.mesh.visible) return;

    let bestDisturbStrength = 0;
    let disturbX = 999;
    let disturbZ = 999;
    let tintAmount = 0;
    let tintX = 999;
    let tintZ = 999;
    let tintType: 'burn' | 'frost' = 'burn';

    for (let i = this.stamps.length - 1; i >= 0; i--) {
      const s = this.stamps[i];
      s.age += dt;
      if (s.age >= s.duration) {
        this.stamps.splice(i, 1);
        continue;
      }
      const strength = 1 - s.age / s.duration;
      if (s.type === 'flatten' && strength > bestDisturbStrength) {
        bestDisturbStrength = strength * 1.3;
        disturbX = s.x;
        disturbZ = s.z;
      } else if ((s.type === 'burn' || s.type === 'frost') && strength > tintAmount) {
        tintAmount = strength;
        tintX = s.x;
        tintZ = s.z;
        tintType = s.type;
      }
    }

    if (leadEnemyX !== undefined && leadEnemyZ !== undefined && bestDisturbStrength < 0.7) {
      disturbX = leadEnemyX;
      disturbZ = leadEnemyZ;
      bestDisturbStrength = Math.max(bestDisturbStrength, 0.8);
    }

    this.uDisturbPos.value.set(disturbX, 0, disturbZ);
    this.uDisturbStrength.value = bestDisturbStrength;
    this.uTintPos.value.set(tintX, 0, tintZ);
    this.uTintColor.value.setHex(tintType === 'burn' ? 0x1c1917 : 0xbae6fd);
    this.uTintAmount.value = tintAmount;
  }
}
