import * as THREE from 'three';
import { ProceduralTextures } from './ProceduralTextures';

export const GlobalShaderUniforms = {
  uTime: { value: 0 },
  uRimColor: { value: new THREE.Color(0x87ceeb) },
  uBeatPulse: { value: 0 },
  uWindStrength: { value: 1.0 },
};

export function applyToonRimShader(
  mat: THREE.MeshStandardMaterial,
  skyColorHex = 0x87ceeb,
  rimStrength = 0.35
): THREE.MeshStandardMaterial {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = GlobalShaderUniforms.uRimColor;
    shader.uniforms.uRimStrength = { value: rimStrength };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uRimColor;
         uniform float uRimStrength;`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 viewDirRim = normalize(vViewPosition);
         float rimTerm = pow(1.0 - clamp(dot(normal, viewDirRim), 0.0, 1.0), 3.0) * uRimStrength;
         gl_FragColor.rgb += uRimColor * rimTerm;
         #include <dithering_fragment>`
      );
  };
  GlobalShaderUniforms.uRimColor.value.setHex(skyColorHex);
  return mat;
}

export function createDissolveShaderMaterial(
  baseColor: number,
  edgeColor: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uNoiseTex: { value: ProceduralTextures.getNoiseTexture() },
      uBaseColor: { value: new THREE.Color(baseColor) },
      uEdgeColor: { value: new THREE.Color(edgeColor) },
      uThreshold: { value: 0 },
      uEdgeWidth: { value: 0.06 },
    },
    transparent: true,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uNoiseTex;
      uniform vec3 uBaseColor;
      uniform vec3 uEdgeColor;
      uniform float uThreshold;
      uniform float uEdgeWidth;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        float n = texture2D(uNoiseTex, vUv * 2.0).r;
        if (n < uThreshold) discard;
        float edge = 1.0 - smoothstep(uThreshold, uThreshold + uEdgeWidth, n);
        float light = 0.65 + 0.35 * max(dot(vNormal, vec3(0.4, 0.85, 0.3)), 0.0);
        vec3 col = mix(uBaseColor * light, uEdgeColor * 1.9, edge);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/**
 * Fix F1 (§2): Pooled 32 dissolve ShaderMaterials so zero new materials are allocated per enemy kill.
 */
class DissolveMaterialPoolImpl {
  private pool: Array<{ mat: THREE.ShaderMaterial; inUse: boolean }> = [];
  private readonly capacity = 32;

  private ensureInit(): void {
    if (this.pool.length > 0) return;
    for (let i = 0; i < this.capacity; i++) {
      this.pool.push({
        mat: createDissolveShaderMaterial(0x64748b, 0x4ade80),
        inUse: false,
      });
    }
  }

  public acquire(baseColor: number, edgeColor: number): THREE.ShaderMaterial | null {
    this.ensureInit();
    for (const item of this.pool) {
      if (!item.inUse) {
        item.inUse = true;
        item.mat.uniforms.uBaseColor.value.setHex(baseColor);
        item.mat.uniforms.uEdgeColor.value.setHex(edgeColor);
        item.mat.uniforms.uThreshold.value = 0;
        return item.mat;
      }
    }
    return null;
  }

  public release(mat: THREE.ShaderMaterial | null): void {
    if (!mat) return;
    for (const item of this.pool) {
      if (item.mat === mat) {
        item.inUse = false;
        item.mat.uniforms.uThreshold.value = 0;
        return;
      }
    }
  }
}

export const DissolveMaterialPool = new DissolveMaterialPoolImpl();

export function createShockwaveMaterial(colorHex: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uProgress: { value: 0 },
      uWidth: { value: 0.14 },
      uOpacity: { value: 1.0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uProgress;
      uniform float uWidth;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float r = length(vUv * 2.0 - 1.0);
        float u = clamp(uProgress, 0.0, 1.0);
        float alpha = smoothstep(u - uWidth, u, r) * (1.0 - smoothstep(u, u + 0.06, r)) * pow(1.0 - u, 2.0);
        alpha *= uOpacity;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uColor * 1.5, alpha);
      }
    `,
  });
}

export function createHologramGhostMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: GlobalShaderUniforms.uTime,
      uColor: { value: new THREE.Color(0x38bdf8) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vec4 mvPos = viewMatrix * worldPos;
        vViewPos = -mvPos.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying vec3 vWorldPos;
      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPos))), 2.2);
        float scan = 0.55 + 0.45 * sin(vWorldPos.y * 18.0 - uTime * 8.0);
        float alpha = clamp(0.22 + fresnel * 0.65, 0.2, 0.85) * scan;
        gl_FragColor = vec4(uColor * 1.25, alpha);
      }
    `,
  });
}

export function createRuneRingMaterial(colorHex: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: GlobalShaderUniforms.uTime,
      uRuneTex: { value: ProceduralTextures.getRuneStripTexture() },
      uColor: { value: new THREE.Color(colorHex) },
      uSpeed: { value: 0.4 },
      uPulse: { value: 1.0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uRuneTex;
      uniform vec3 uColor;
      uniform float uSpeed;
      uniform float uPulse;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r < 0.62 || r > 0.98) discard;
        float angle = atan(p.y, p.x) / 6.2831853 + 0.5;
        float band = (r - 0.62) / 0.36;
        vec2 runeUv = vec2(angle * 3.0 + uTime * uSpeed, band);
        float texA = texture2D(uRuneTex, runeUv).r;
        float edgeFade = smoothstep(0.0, 0.15, band) * (1.0 - smoothstep(0.85, 1.0, band));
        float pulse = 0.78 + 0.22 * sin(uTime * 3.5);
        float alpha = (texA * 0.85 + 0.15) * edgeFade * pulse * uPulse;
        gl_FragColor = vec4(uColor * 1.45, alpha);
      }
    `,
  });
}

export function createWaterShaderMaterial(deepColor: number, shallowColor: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: GlobalShaderUniforms.uTime,
      uNoiseTex: { value: ProceduralTextures.getNoiseTexture() },
      uDeepColor: { value: new THREE.Color(deepColor) },
      uShallowColor: { value: new THREE.Color(shallowColor) },
      uRipplePos: { value: new THREE.Vector2(0, 0) },
      uRippleAge: { value: 10.0 },
    },
    transparent: true,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec3 pos = position;
        pos.z += sin(pos.x * 2.2 + uTime * 2.0) * 0.03 + cos(pos.y * 2.5 - uTime * 1.6) * 0.03;
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uNoiseTex;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec2 uRipplePos;
      uniform float uRippleAge;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vec2 uv1 = vUv * 1.8 + vec2(uTime * 0.04, uTime * 0.03);
        vec2 uv2 = vUv * 2.4 - vec2(uTime * 0.03, uTime * 0.05);
        float n = (texture2D(uNoiseTex, uv1).r + texture2D(uNoiseTex, uv2).r) * 0.5;
        float distEdge = length(vUv * 2.0 - 1.0);
        float foam = smoothstep(0.84, 0.98, distEdge + (n - 0.5) * 0.14);
        float spec = smoothstep(0.68, 0.78, n) * 0.35;
        float dRip = length(vWorldPos.xz - uRipplePos);
        float ripRing = 0.0;
        if (uRippleAge < 1.6) {
          float rad = uRippleAge * 2.4;
          ripRing = (1.0 - smoothstep(0.0, 0.35, abs(dRip - rad))) * (1.0 - uRippleAge / 1.6) * 0.65;
        }
        vec3 col = mix(uDeepColor, uShallowColor, clamp(distEdge * 0.7 + n * 0.3, 0.0, 1.0));
        col += vec3(0.85, 0.96, 1.0) * (foam * 0.6 + spec + ripRing);
        gl_FragColor = vec4(col, 0.88);
      }
    `,
  });
}

export function createCelestialTraitShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: GlobalShaderUniforms.uTime,
      uNoiseTex: { value: ProceduralTextures.getNoiseTexture() },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uNoiseTex;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPos))), 2.2);
        vec2 starUv = (gl_FragCoord.xy * 0.008) + vec2(uTime * 0.02, -uTime * 0.015);
        float stars = smoothstep(0.78, 0.92, texture2D(uNoiseTex, starUv).r);
        vec3 col = mix(vec3(0.55, 0.3, 0.95), vec3(0.2, 0.9, 0.95), stars);
        gl_FragColor = vec4(col * (1.2 + stars * 1.4), rim * 0.85);
      }
    `,
  });
}
