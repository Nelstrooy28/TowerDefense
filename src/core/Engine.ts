import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CameraRig } from './CameraRig';
import { QualityManager } from './QualityManager';
import { InputActions } from './InputActions';
import { EventBus } from './EventBus';
import { PostFXController } from '../rendering/PostFX';
import { ProceduralTextures } from '../rendering/ProceduralTextures';
import { GlobalShaderUniforms } from '../rendering/ShaderLib';
import type { SeasonId } from '../data/WeatherConfig';

export interface DebugMetrics {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  particles: number;
  enemies: number;
}

export class Engine {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public cameraRig: CameraRig;
  public composer: EffectComposer;
  public bloomPass: UnrealBloomPass;
  public postFx: PostFXController;

  public hemiLight: THREE.HemisphereLight;
  public dirLight: THREE.DirectionalLight;

  // Pooled Fake Contact Shadows (§3.1)
  public contactShadows: THREE.InstancedMesh;
  private readonly maxContactShadows = 300;
  private contactShadowCount = 0;
  private readonly _dummy = new THREE.Object3D();

  // Debug Overlay (F3)
  private debugEl: HTMLElement | null;
  private debugVisible = false;
  private fpsSamples = 0;
  private fpsAccum = 0;
  private currentFps = 60;
  private currentFrameMs = 16.6;

  private baseSkyColor = new THREE.Color(0x87ceeb);
  private duskColor = new THREE.Color(0x581c87);
  private sunsetColor = new THREE.Color(0xfb923c);
  private _tempSky = new THREE.Color();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // supports F2 Photo Mode PNG export (§16)
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.info.autoReset = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

    const w = window.innerWidth;
    const h = window.innerHeight;
    this.cameraRig = new CameraRig(w / h, canvas);

    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3a6b35, 0.75);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff4d6, 1.6);
    this.dirLight.position.set(18, 28, 16);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.near = 2;
    this.dirLight.shadow.camera.far = 90;
    const d = 26;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // Post-processing stack (§3.1)
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.cameraRig.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.4, 0.78);
    this.composer.addPass(this.bloomPass);

    this.postFx = new PostFXController();
    this.composer.addPass(this.postFx.pass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    // Fake Contact Shadows pool (§3.1)
    const shadowGeo = new THREE.PlaneGeometry(1.4, 1.4);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: ProceduralTextures.getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    });
    this.contactShadows = new THREE.InstancedMesh(shadowGeo, shadowMat, this.maxContactShadows);
    this.contactShadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.contactShadows.frustumCulled = false;
    this.contactShadows.count = 0;
    this.scene.add(this.contactShadows);

    this.debugEl = document.getElementById('debug-overlay');
    this.applyQualityPreset();
    this.resize();

    window.addEventListener('resize', () => this.resize());
    InputActions.onDown('debug_overlay', (_m, e) => {
      e?.preventDefault();
      this.debugVisible = !this.debugVisible;
      if (this.debugEl) {
        this.debugEl.classList.toggle('hidden', !this.debugVisible);
      }
      return true;
    });

    EventBus.on('quality:changed', () => this.applyQualityPreset());
    EventBus.on('camera:trauma', ({ amount }) => this.cameraRig.addTrauma(amount));
    EventBus.on('camera:fov_kick', ({ degrees, duration }) =>
      this.cameraRig.triggerFovKick(degrees, duration)
    );
    EventBus.on('camera:zoom_punch', ({ factor, duration }) =>
      this.cameraRig.triggerZoomPunch(factor, duration)
    );
    EventBus.on('camera:focus_nudge', ({ x, z }) => this.cameraRig.triggerFocusNudge(x, z));
    EventBus.on('camera:boss_pan', ({ x, y, z, duration }) =>
      this.cameraRig.startBossCinematic(x, y, z, duration)
    );
    EventBus.on('vfx:chromatic_pulse', ({ strength, duration }) =>
      this.postFx.triggerChromaticPulse(strength, duration)
    );
    EventBus.on('vfx:radial_blur', ({ strength, duration }) =>
      this.postFx.triggerRadialBlur(strength, duration)
    );
    EventBus.on('vfx:base_hit_vignette', ({ lowHp }) => {
      this.postFx.triggerRedPulse(0.4);
      this.postFx.setLowHpDesaturate(lowHp);
    });
  }

  public warmUpShaders(): void {
    try {
      this.renderer.compile(this.scene, this.cameraRig.camera);
    } catch {
      // Ignore WebGL headless errors cleanly
    }
  }

  public captureScreenshot(): void {
    this.composer.render();
    const url = this.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `garden-bastion-${Date.now()}.png`;
    a.click();
  }

  public applyQualityPreset(): void {
    const preset = QualityManager.preset;
    const dpr =
      preset.pixelRatio === 0
        ? window.devicePixelRatio
        : Math.min(window.devicePixelRatio, preset.pixelRatio);
    this.renderer.setPixelRatio(dpr);

    const shadowsOn = preset.shadowMapSize > 0;
    this.renderer.shadowMap.enabled = shadowsOn;
    this.dirLight.castShadow = shadowsOn;
    if (shadowsOn && this.dirLight.shadow.mapSize.x !== preset.shadowMapSize) {
      this.dirLight.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
      this.dirLight.shadow.map?.dispose();
      this.dirLight.shadow.map = null;
    }

    this.bloomPass.enabled = preset.bloomMode !== 'off';
    this.postFx.setEnabled(preset.postFx);
    this.resize();
  }

  public resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.cameraRig.camera.aspect = w / h;
    this.cameraRig.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    const bloomScale = QualityManager.preset.bloomMode === 'half' ? 0.5 : 1.0;
    this.bloomPass.setSize(Math.floor(w * bloomScale), Math.floor(h * bloomScale));
  }

  public setMapAtmosphere(skyHex: number, ambientSky: number, ambientGround: number): void {
    this.baseSkyColor.setHex(skyHex);
    (this.scene.background as THREE.Color).setHex(skyHex);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(skyHex);
    }
    this.hemiLight.color.setHex(ambientSky);
    this.hemiLight.groundColor.setHex(ambientGround);
    GlobalShaderUniforms.uRimColor.value.setHex(ambientSky);
  }

  public applyLobbySeasonTint(season: SeasonId): void {
    if (season === 'autumn') {
      this.dirLight.color.setHex(0xfdba74);
    } else if (season === 'winter') {
      this.dirLight.color.setHex(0xe0f2fe);
    } else if (season === 'spring') {
      this.dirLight.color.setHex(0xfef9c3);
    } else {
      this.dirLight.color.setHex(0xfff4d6);
    }
  }

  public updateDayNight(waveProgress: number, isBossWave: boolean, isNightFog = false): void {
    const p = THREE.MathUtils.clamp(waveProgress, 0, 1);
    const angle = 0.4 + p * 0.9;
    this.dirLight.position.set(Math.cos(angle) * 24, 24 - p * 8, Math.sin(angle) * 20);

    this._tempSky.copy(this.baseSkyColor);
    if (p > 0.65 && !isBossWave) {
      this._tempSky.lerp(this.sunsetColor, (p - 0.65) * 1.1);
    }
    if (isBossWave) {
      this._tempSky.lerp(this.duskColor, 0.72);
    } else if (isNightFog) {
      this._tempSky.lerp(new THREE.Color(0x1e293b), 0.58);
    }

    (this.scene.background as THREE.Color).copy(this._tempSky);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this._tempSky);
      this.scene.fog.density = isNightFog ? 0.022 : 0.008;
    }
  }

  public beginContactShadows(): void {
    this.contactShadowCount = 0;
  }

  public pushContactShadow(x: number, y: number, z: number, radius: number): void {
    if (this.contactShadowCount >= this.maxContactShadows) return;
    this._dummy.position.set(x, y + 0.025, z);
    this._dummy.rotation.set(0, 0, 0);
    this._dummy.scale.set(radius, 1, radius);
    this._dummy.updateMatrix();
    this.contactShadows.setMatrixAt(this.contactShadowCount, this._dummy.matrix);
    this.contactShadowCount++;
  }

  public commitContactShadows(): void {
    this.contactShadows.count = this.contactShadowCount;
    this.contactShadows.instanceMatrix.needsUpdate = true;
  }

  public render(uiDt: number, shaderDt: number, particleCount: number, enemyCount: number): void {
    GlobalShaderUniforms.uTime.value += shaderDt;
    this.cameraRig.update(uiDt);
    this.postFx.update(uiDt, QualityManager.settings.reducedMotion);

    const t0 = performance.now();
    this.renderer.info.reset();
    this.composer.render();
    const renderMs = performance.now() - t0;

    this.fpsAccum += uiDt;
    this.fpsSamples++;
    if (this.fpsAccum >= 0.4) {
      this.currentFps = Math.round(this.fpsSamples / this.fpsAccum);
      this.currentFrameMs = Number(((this.fpsAccum / this.fpsSamples) * 1000).toFixed(1));
      this.fpsAccum = 0;
      this.fpsSamples = 0;
    }

    QualityManager.recordFrameTime(Math.max(uiDt * 1000, renderMs), uiDt);

    if (this.debugVisible && this.debugEl) {
      const info = this.renderer.info;
      this.debugEl.innerHTML = `
        <div><strong>Garden Bastion Debug (F3)</strong></div>
        <div>FPS: ${this.currentFps} (${this.currentFrameMs} ms)</div>
        <div>Quality: ${QualityManager.settings.tier}</div>
        <div>Draw Calls: ${info.render.calls} | Tris: ${info.render.triangles}</div>
        <div>Particles: ${particleCount} | Enemies: ${enemyCount}</div>
      `;
    }
  }
}
