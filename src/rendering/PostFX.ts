import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GlobalShaderUniforms } from './ShaderLib';

export const CombinedPostFXShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: GlobalShaderUniforms.uTime,
    uVignetteStrength: { value: 0.22 },
    uVignetteColor: { value: new THREE.Color(0x050a08) },
    uRedPulse: { value: 0.0 },
    uDesaturate: { value: 0.0 },
    uChromaticStrength: { value: 0.0 },
    uRadialBlurStrength: { value: 0.0 },
    uHeatHazeStrength: { value: 0.0 },
    uTintColor: { value: new THREE.Color(0xffffff) },
    uTintStrength: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignetteStrength;
    uniform vec3 uVignetteColor;
    uniform float uRedPulse;
    uniform float uDesaturate;
    uniform float uChromaticStrength;
    uniform float uRadialBlurStrength;
    uniform float uHeatHazeStrength;
    uniform vec3 uTintColor;
    uniform float uTintStrength;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;

      // Optional Heat Haze
      if (uHeatHazeStrength > 0.001) {
        float h = sin(uv.y * 42.0 + uTime * 7.0) * cos(uv.x * 28.0 - uTime * 5.0);
        uv += vec2(h, h * 0.6) * (0.004 * uHeatHazeStrength);
      }

      vec3 col = texture2D(tDiffuse, uv).rgb;

      // Chromatic Aberration pulse
      if (uChromaticStrength > 0.001) {
        vec2 dir = (uv - 0.5) * uChromaticStrength * 0.018;
        col.r = texture2D(tDiffuse, uv + dir).r;
        col.b = texture2D(tDiffuse, uv - dir).b;
      }

      // Radial blur for ultimates
      if (uRadialBlurStrength > 0.001) {
        vec2 dir = (0.5 - uv) * uRadialBlurStrength * 0.04;
        vec3 sum = col;
        sum += texture2D(tDiffuse, uv + dir * 0.33).rgb;
        sum += texture2D(tDiffuse, uv + dir * 0.66).rgb;
        sum += texture2D(tDiffuse, uv + dir).rgb;
        col = sum * 0.25;
      }

      // Color tint / Chrono / Boss purple
      if (uTintStrength > 0.001) {
        col = mix(col, col * uTintColor, uTintStrength);
      }

      // Desaturation (Low HP edges or Chrono Time-Stop or Defeat)
      if (uDesaturate > 0.001) {
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        float edgeMask = smoothstep(0.15, 0.72, length(uv - 0.5)) * 0.8 + 0.2;
        col = mix(col, vec3(luma), clamp(uDesaturate * edgeMask, 0.0, 0.92));
      }

      // Vignette + Red Base Damage Pulse
      float dist = length(uv - 0.5);
      float vig = smoothstep(0.32, 0.78, dist);
      col = mix(col, uVignetteColor, vig * uVignetteStrength);
      if (uRedPulse > 0.001) {
        col = mix(col, vec3(0.95, 0.12, 0.14), vig * uRedPulse);
      }

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class PostFXController {
  public pass: ShaderPass;
  private chromaticTimer = 0;
  private chromaticDuration = 0.25;
  private chromaticPeak = 0;

  private radialTimer = 0;
  private radialDuration = 0.4;
  private radialPeak = 0;

  private redPulseTimer = 0;
  private redPulseDuration = 0.4;

  private baseTintColor = new THREE.Color(0xffffff);
  private baseTintStrength = 0;
  private overrideDesat = 0;
  private lowHpMode = false;
  private heatHazeBase = 0;

  constructor() {
    this.pass = new ShaderPass(CombinedPostFXShader);
  }

  public setEnabled(enabled: boolean): void {
    this.pass.enabled = enabled;
  }

  public triggerChromaticPulse(strength = 0.8, duration = 0.3): void {
    this.chromaticPeak = Math.max(this.chromaticPeak, strength);
    this.chromaticDuration = duration;
    this.chromaticTimer = duration;
  }

  public triggerRadialBlur(strength = 0.7, duration = 0.45): void {
    this.radialPeak = Math.max(this.radialPeak, strength);
    this.radialDuration = duration;
    this.radialTimer = duration;
  }

  public triggerRedPulse(duration = 0.4): void {
    this.redPulseDuration = duration;
    this.redPulseTimer = duration;
  }

  public setLowHpDesaturate(active: boolean): void {
    this.lowHpMode = active;
  }

  public setEnvironmentTint(hex: number, strength: number, desaturate = 0, heatHaze = 0): void {
    this.baseTintColor.setHex(hex);
    this.baseTintStrength = strength;
    this.overrideDesat = desaturate;
    this.heatHazeBase = heatHaze;
  }

  public update(dt: number, reducedMotion: boolean): void {
    const u = this.pass.uniforms;
    if (this.chromaticTimer > 0 && !reducedMotion) {
      this.chromaticTimer = Math.max(0, this.chromaticTimer - dt);
      u.uChromaticStrength.value = this.chromaticPeak * (this.chromaticTimer / this.chromaticDuration);
    } else {
      u.uChromaticStrength.value = 0;
    }

    if (this.radialTimer > 0 && !reducedMotion) {
      this.radialTimer = Math.max(0, this.radialTimer - dt);
      u.uRadialBlurStrength.value = this.radialPeak * (this.radialTimer / this.radialDuration);
    } else {
      u.uRadialBlurStrength.value = 0;
    }

    if (this.redPulseTimer > 0) {
      this.redPulseTimer = Math.max(0, this.redPulseTimer - dt);
      u.uRedPulse.value = 0.45 * (this.redPulseTimer / this.redPulseDuration);
    } else {
      u.uRedPulse.value = 0;
    }

    const targetDesat = Math.max(this.overrideDesat, this.lowHpMode ? 0.35 : 0);
    u.uDesaturate.value += (targetDesat - u.uDesaturate.value) * Math.min(1, dt * 6);
    u.uTintColor.value.copy(this.baseTintColor);
    u.uTintStrength.value += (this.baseTintStrength - u.uTintStrength.value) * Math.min(1, dt * 4);
    u.uHeatHazeStrength.value = this.heatHazeBase;
  }
}
