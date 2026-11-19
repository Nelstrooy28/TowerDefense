import * as THREE from 'three';
import { getUnitById, type UnitDef } from '../data/UnitRegistry';
import { RARITIES } from '../data/RarityConfig';

export type DecalType = 'tomato' | 'scorch' | 'frost' | 'slime' | 'crater' | 'vine' | 'puddle' | 'poison' | 'lava' | 'crack';

class ProceduralTexturesImpl {
  private contactShadowTex: THREE.CanvasTexture | null = null;
  private noiseTex: THREE.Texture | null = null;
  private runeStripTex: THREE.Texture | null = null;
  private softCircleTex: THREE.CanvasTexture | null = null;
  private statusSheetTex: THREE.CanvasTexture | null = null;
  private toonRampTex: THREE.DataTexture | null = null;
  private pitcherStripesTex: THREE.CanvasTexture | null = null;
  private stumpTopTex: THREE.CanvasTexture | null = null;
  private stumpCrackTex: THREE.CanvasTexture | null = null;
  private snailShellTex: THREE.CanvasTexture | null = null;
  private decalTextures = new Map<DecalType, THREE.CanvasTexture>();
  private portraitUrls = new Map<string, string>();

  /**
   * Doc 01 §2: 3-step toon ramp texture (shadow 0.45, mid 0.80, light 1.0).
   */
  public getToonRampTexture(): THREE.DataTexture {
    if (this.toonRampTex) return this.toonRampTex;
    const data = new Uint8Array([
      115, 115, 115, 255, // 0.45 shadow
      204, 204, 204, 255, // 0.80 mid
      255, 255, 255, 255, // 1.00 light
    ]);
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    this.toonRampTex = tex;
    return tex;
  }

  public getPitcherStripesTexture(): THREE.CanvasTexture | null {
    if (this.pitcherStripesTex) return this.pitcherStripesTex;
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#bbc34a';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#7b3fa0';
    for (let i = 0; i < 5; i++) {
      const x = i * (256 / 5) + 8;
      ctx.fillRect(x, 0, 14, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    this.pitcherStripesTex = tex;
    return tex;
  }

  public getStumpTopTexture(): THREE.CanvasTexture | null {
    if (this.stumpTopTex) return this.stumpTopTex;
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#7ca33a';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#c89b6c';
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8d5b32';
    ctx.lineWidth = 2.5;
    for (const r of [14, 26, 38, 48]) {
      ctx.beginPath();
      ctx.arc(64, 64, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.stumpTopTex = new THREE.CanvasTexture(canvas);
    return this.stumpTopTex;
  }

  public getStumpSapCrackTexture(): THREE.CanvasTexture | null {
    if (this.stumpCrackTex) return this.stumpCrackTex;
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#ffa726';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x = 22 + i * 50;
      ctx.beginPath();
      ctx.moveTo(x, 122);
      ctx.lineTo(x - 8, 78);
      ctx.lineTo(x + 7, 46);
      ctx.lineTo(x - 3, 18);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    this.stumpCrackTex = tex;
    return tex;
  }

  public getSnailShellTexture(): THREE.CanvasTexture | null {
    if (this.snailShellTex) return this.snailShellTex;
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#a8ddb5';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#daf7e1';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(i * 22, 0, 7, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    this.snailShellTex = tex;
    return tex;
  }

  public getContactShadowTexture(): THREE.CanvasTexture {
    if (this.contactShadowTex) return this.contactShadowTex;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(8, 18, 12, 0.58)');
    grad.addColorStop(0.6, 'rgba(8, 18, 12, 0.25)');
    grad.addColorStop(1, 'rgba(8, 18, 12, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    this.contactShadowTex = new THREE.CanvasTexture(canvas);
    this.contactShadowTex.needsUpdate = true;
    return this.contactShadowTex;
  }

  public getSoftCircleTexture(): THREE.CanvasTexture {
    if (this.softCircleTex) return this.softCircleTex;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    this.softCircleTex = new THREE.CanvasTexture(canvas);
    return this.softCircleTex;
  }

  /**
   * Fix F2 (§2): Shared sprite-sheet texture for 3D billboard status icons.
   * Tiles 0..7: burn, chill, freeze, bleed, stun, wet, poison, shield
   */
  public getStatusIconSpriteSheet(): THREE.CanvasTexture {
    if (this.statusSheetTex) return this.statusSheetTex;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 64);

    const drawTile = (idx: number, bg: string, glyph: string) => {
      const cx = idx * 64 + 32;
      ctx.fillStyle = bg;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, 32, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, cx, 34);
    };

    drawTile(0, '#ea580c', '🔥'); // burn
    drawTile(1, '#38bdf8', '❄'); // chill
    drawTile(2, '#0284c7', '🧊'); // freeze
    drawTile(3, '#e11d48', '🩸'); // bleed
    drawTile(4, '#eab308', '💫'); // stun
    drawTile(5, '#06b6d4', '💧'); // wet
    drawTile(6, '#84cc16', '☠'); // poison
    drawTile(7, '#64748b', '🛡'); // shield

    this.statusSheetTex = new THREE.CanvasTexture(canvas);
    this.statusSheetTex.minFilter = THREE.LinearFilter;
    this.statusSheetTex.magFilter = THREE.LinearFilter;
    this.statusSheetTex.needsUpdate = true;
    return this.statusSheetTex;
  }

  /** Returns a minimal repeating DataTexture when running outside a DOM (e.g. Node unit tests). */
  private createHeadlessFallbackTexture(): THREE.DataTexture {
    const tex = new THREE.DataTexture(new Uint8Array(16).fill(200), 2, 2, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  public getNoiseTexture(): THREE.Texture {
    if (this.noiseTex) return this.noiseTex;
    if (typeof document === 'undefined') {
      this.noiseTex = this.createHeadlessFallbackTexture();
      return this.noiseTex;
    }
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const grid = 16;
    const vals: number[] = [];
    for (let i = 0; i < grid * grid; i++) vals.push(Math.random());
    const sampleGrid = (gx: number, gy: number) => {
      const wx = ((gx % grid) + grid) % grid;
      const wy = ((gy % grid) + grid) % grid;
      return vals[wy * grid + wx];
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * grid;
        const fy = (y / size) * grid;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = fx - ix;
        const ty = fy - iy;
        const u = tx * tx * (3 - 2 * tx);
        const v = ty * ty * (3 - 2 * ty);
        const a = sampleGrid(ix, iy);
        const b = sampleGrid(ix + 1, iy);
        const c = sampleGrid(ix, iy + 1);
        const d = sampleGrid(ix + 1, iy + 1);
        const n1 = a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
        const n2 = sampleGrid(ix * 2, iy * 2) * 0.25;
        const val = Math.min(255, Math.max(0, Math.round((n1 * 0.8 + n2 * 0.2) * 255)));
        const idx = (y * size + x) * 4;
        img.data[idx] = val;
        img.data[idx + 1] = val;
        img.data[idx + 2] = val;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.noiseTex = new THREE.CanvasTexture(canvas);
    this.noiseTex.wrapS = THREE.RepeatWrapping;
    this.noiseTex.wrapT = THREE.RepeatWrapping;
    return this.noiseTex;
  }

  public getRuneStripTexture(): THREE.Texture {
    if (this.runeStripTex) return this.runeStripTex;
    if (typeof document === 'undefined') {
      this.runeStripTex = this.createHeadlessFallbackTexture();
      return this.runeStripTex;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 64);
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(512, 8);
    ctx.moveTo(0, 56);
    ctx.lineTo(512, 56);
    ctx.stroke();

    for (let i = 0; i < 16; i++) {
      const cx = i * 32 + 16;
      ctx.save();
      ctx.translate(cx, 32);
      ctx.beginPath();
      if (i % 3 === 0) {
        ctx.moveTo(0, -14);
        ctx.lineTo(10, 0);
        ctx.lineTo(0, 14);
        ctx.lineTo(-10, 0);
        ctx.closePath();
        ctx.stroke();
      } else if (i % 3 === 1) {
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(-8, -12);
        ctx.lineTo(8, 0);
        ctx.lineTo(-8, 12);
        ctx.moveTo(0, -12);
        ctx.lineTo(0, 12);
        ctx.stroke();
      }
      ctx.restore();
    }
    this.runeStripTex = new THREE.CanvasTexture(canvas);
    this.runeStripTex.wrapS = THREE.RepeatWrapping;
    this.runeStripTex.wrapT = THREE.ClampToEdgeWrapping;
    return this.runeStripTex;
  }

  public getDecalTexture(type: DecalType): THREE.CanvasTexture {
    const existing = this.decalTextures.get(type);
    if (existing) return existing;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);

    const cx = 64;
    const cy = 64;

    if (type === 'tomato') {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.85)';
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const r = 34 + (i % 2 === 0 ? 14 : -4);
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(254, 240, 138, 0.8)';
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18, 4, 2, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'scorch' || type === 'crater' || type === 'crack') {
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 56);
      grad.addColorStop(0, type === 'crack' ? 'rgba(69, 26, 3, 0.7)' : type === 'crater' ? 'rgba(20, 14, 12, 0.92)' : 'rgba(24, 20, 18, 0.85)');
      grad.addColorStop(0.45, 'rgba(55, 35, 24, 0.58)');
      grad.addColorStop(1, 'rgba(20, 14, 12, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      if (type === 'crater' || type === 'crack') {
        ctx.strokeStyle = type === 'crack' ? 'rgba(91, 58, 26, 0.85)' : 'rgba(251, 146, 60, 0.7)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10);
          ctx.lineTo(cx + Math.cos(a + 0.1) * 46, cy + Math.sin(a + 0.1) * 46);
          ctx.stroke();
        }
      }
    } else if (type === 'frost') {
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 56);
      grad.addColorStop(0, 'rgba(224, 242, 254, 0.85)');
      grad.addColorStop(0.55, 'rgba(125, 211, 252, 0.55)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 44, cy + Math.sin(a) * 44);
        ctx.stroke();
      }
    } else if (type === 'poison') {
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 56);
      grad.addColorStop(0, 'rgba(132, 204, 22, 0.78)');
      grad.addColorStop(0.55, 'rgba(168, 85, 247, 0.45)');
      grad.addColorStop(1, 'rgba(132, 204, 22, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 56, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'lava') {
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 54);
      grad.addColorStop(0, 'rgba(253, 224, 71, 0.9)');
      grad.addColorStop(0.4, 'rgba(249, 115, 22, 0.75)');
      grad.addColorStop(1, 'rgba(153, 27, 27, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 54, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'slime' || type === 'puddle') {
      const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, 54);
      if (type === 'slime') {
        grad.addColorStop(0, 'rgba(34, 211, 238, 0.72)');
        grad.addColorStop(0.7, 'rgba(14, 165, 233, 0.42)');
        grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
      } else {
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.42)');
        grad.addColorStop(0.75, 'rgba(186, 230, 253, 0.25)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 52, 42, 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'vine') {
      ctx.strokeStyle = 'rgba(22, 163, 74, 0.9)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(
          cx + Math.cos(a + 0.4) * 28,
          cy + Math.sin(a + 0.4) * 28,
          cx + Math.cos(a) * 52,
          cy + Math.sin(a) * 52
        );
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    this.decalTextures.set(type, tex);
    return tex;
  }

  public getUnitPortraitUrl(unitId: string): string {
    const cached = this.portraitUrls.get(unitId);
    if (cached) return cached;

    const unit: UnitDef = getUnitById(unitId);
    const rarityHex = RARITIES[unit.rarity].hex;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Glossy gradient backdrop
    const bg = ctx.createLinearGradient(0, 0, 128, 128);
    bg.addColorStop(0, '#1e293b');
    bg.addColorStop(1, rarityHex);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(64, 58, 44, 0, Math.PI * 2);
    ctx.fill();

    const primary = '#' + unit.primaryColor.toString(16).padStart(6, '0');
    const secondary = '#' + unit.secondaryColor.toString(16).padStart(6, '0');
    const accent = '#' + unit.accentColor.toString(16).padStart(6, '0');

    const skipDefaultSoil =
      unit.id === 'tomato_tosser' || unit.id === 'ice_buds' || unit.id === 'walnut_wall';

    if (!skipDefaultSoil) {
      // Natural Grassy Turf Hillock & Ground Roots
      ctx.fillStyle = '#573b26';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(64, 108, 42, 16, 0, Math.PI, 0, false);
      ctx.lineTo(106, 120);
      ctx.lineTo(22, 120);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#6b4423';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(64, 90);
      ctx.quadraticCurveTo(46, 98, 34, 112);
      ctx.moveTo(64, 90);
      ctx.quadraticCurveTo(82, 98, 94, 112);
      ctx.moveTo(64, 92);
      ctx.lineTo(64, 112);
      ctx.stroke();

      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(64 + dir * 20, 92, 14, 6, dir * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      if (unit.id !== 'pineapple_cannon' && unit.id !== 'cactus_striker' && unit.id !== 'money_tree') {
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(64, 96);
        ctx.lineTo(64, 58);
        ctx.stroke();
      }
    }

    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#0f172a';

    if (unit.id === 'tomato_tosser') {
      // Terracotta pot + curly green stem + cream-mouth trumpet shooter
      ctx.fillStyle = '#c8643b';
      ctx.beginPath();
      ctx.moveTo(40, 82);
      ctx.lineTo(88, 82);
      ctx.lineTo(80, 114);
      ctx.lineTo(48, 114);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#a84d2a';
      ctx.fillRect(36, 76, 56, 9);
      ctx.strokeRect(36, 76, 56, 9);

      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(64, 78);
      ctx.bezierCurveTo(44, 64, 80, 52, 62, 38);
      ctx.stroke();

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.moveTo(50, 44);
      ctx.lineTo(84, 24);
      ctx.lineTo(84, 54);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f5e9c8';
      ctx.beginPath();
      ctx.ellipse(86, 39, 7, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (unit.id === 'cactus_striker') {
      // Round ribbed teal barrel + 8-petal magenta flower scope + white spines
      ctx.fillStyle = '#1b5e20';
      ctx.beginPath();
      ctx.ellipse(64, 66, 26, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#2e7d32';
      ctx.lineWidth = 3;
      for (const ox of [-10, 0, 10]) {
        ctx.beginPath();
        ctx.moveTo(64 + ox, 40);
        ctx.lineTo(64 + ox, 92);
        ctx.stroke();
      }
      ctx.strokeStyle = '#fafafa';
      ctx.lineWidth = 2.5;
      for (const py of [52, 66, 78]) {
        ctx.beginPath();
        ctx.moveTo(38, py);
        ctx.lineTo(31, py - 3);
        ctx.moveTo(90, py);
        ctx.lineTo(97, py - 3);
        ctx.stroke();
      }
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.fillStyle = '#e91e8c';
      for (const ox of [-14, 0, 14]) {
        ctx.beginPath();
        ctx.ellipse(64 + ox, 34, 10, 7, ox * 0.03, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(64, 34, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (unit.id === 'pineapple_cannon') {
      // Swollen chartreuse/violet striped nectar pitcher with hinged lid
      ctx.fillStyle = '#bbc34a';
      ctx.beginPath();
      ctx.ellipse(64, 66, 25, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#7b3fa0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(52, 46);
      ctx.lineTo(52, 86);
      ctx.moveTo(76, 46);
      ctx.lineTo(76, 86);
      ctx.stroke();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.fillStyle = '#7b3fa0';
      ctx.beginPath();
      ctx.ellipse(68, 38, 17, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#bbc34a';
      ctx.beginPath();
      ctx.ellipse(62, 24, 15, 7, -0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (unit.id === 'money_tree') {
      // Curved green stem + tilted warm gold flower + glowing amber center
      ctx.strokeStyle = '#558b2f';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(64, 92);
      ctx.quadraticCurveTo(56, 68, 64, 48);
      ctx.stroke();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.fillStyle = '#ffb300';
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(64 + Math.cos(a) * 20, 44 + Math.sin(a) * 16, 9, 5, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#ff6f00';
      ctx.beginPath();
      ctx.arc(64, 44, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (unit.id === 'ghost_pepper') {
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.moveTo(64, 18);
      ctx.quadraticCurveTo(92, 40, 74, 72);
      ctx.quadraticCurveTo(64, 62, 54, 72);
      ctx.quadraticCurveTo(36, 40, 64, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(57, 45, 4, 0, Math.PI * 2);
      ctx.arc(71, 45, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (unit.id === 'sonic_bloom') {
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(64, 46, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.arc(64, 46, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.arc(64, 46, 7, 0, Math.PI * 2);
      ctx.stroke();
    } else if (unit.id === 'ice_buds') {
      // Water disc + mint notched lily pad + ice cyan crystal lotus
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.beginPath();
      ctx.ellipse(64, 92, 46, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5ec9a8';
      ctx.beginPath();
      ctx.ellipse(64, 86, 36, 13, 0, 0.2, Math.PI * 1.9);
      ctx.lineTo(64, 86);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9be7f5';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(64 + i * 11, 36 + Math.abs(i) * 8);
        ctx.lineTo(72 + i * 11, 66);
        ctx.lineTo(64 + i * 11, 80);
        ctx.lineTo(56 + i * 11, 66);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (unit.id === 'speed_sprinkler') {
      ctx.fillStyle = primary;
      ctx.fillRect(58, 36, 12, 34);
      ctx.strokeRect(58, 36, 12, 34);
      ctx.fillStyle = accent;
      ctx.fillRect(30, 32, 68, 10);
      ctx.strokeRect(30, 32, 68, 10);
    } else if (unit.id === 'laser_plant') {
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.arc(64, 46, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(64, 46, 11, 0, Math.PI * 2);
      ctx.fill();
    } else if (unit.id === 'venus_flytrap') {
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(64, 46, 22, Math.PI * 0.15, Math.PI * 0.9, true);
      ctx.lineTo(64, 46);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(64, 48, 22, Math.PI * 0.1, Math.PI * 0.95);
      ctx.lineTo(64, 48);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (unit.id === 'ancient_moss_golem') {
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.roundRect(38, 24, 52, 46, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = primary;
      ctx.fillRect(38, 24, 52, 14);
      ctx.fillStyle = accent;
      ctx.fillRect(48, 42, 10, 6);
      ctx.fillRect(70, 42, 10, 6);
    } else if (unit.id === 'bamboo_archer') {
      ctx.fillStyle = primary;
      ctx.fillRect(57, 16, 14, 62);
      ctx.strokeRect(57, 16, 14, 62);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(42, 26);
      ctx.quadraticCurveTo(84, 44, 42, 66);
      ctx.stroke();
    } else if (unit.id === 'puffball_mushroom') {
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(64, 48, 26, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.arc(54, 38, 5, 0, Math.PI * 2);
      ctx.arc(72, 34, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (unit.id === 'sunflower_beacon' || unit.id === 'sunflower_producer') {
      ctx.fillStyle = primary;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(64 + Math.cos(a) * 18, 44 + Math.sin(a) * 18, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.arc(64, 44, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (unit.id === 'bramble_snare') {
      ctx.strokeStyle = primary;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(64, 52, 20, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = accent;
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(44 + i * 11, 34, 6, 16);
      }
    } else if (unit.id === 'garden_roller') {
      ctx.fillStyle = secondary;
      ctx.fillRect(36, 36, 56, 26);
      ctx.strokeRect(36, 36, 56, 26);
      ctx.fillStyle = accent;
      ctx.fillRect(58, 36, 12, 26);
    } else if (unit.id === 'gnome_barracks') {
      ctx.fillStyle = secondary;
      ctx.fillRect(42, 42, 44, 30);
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.moveTo(36, 44);
      ctx.lineTo(64, 18);
      ctx.lineTo(92, 44);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (unit.id === 'walnut_wall') {
      // Dark walnut gnarled trunk + moss rim + amber glowing sap crack veins
      ctx.fillStyle = '#5a3a22';
      ctx.beginPath();
      ctx.moveTo(38, 44);
      ctx.lineTo(90, 44);
      ctx.lineTo(100, 108);
      ctx.lineTo(28, 108);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#7ca33a';
      ctx.beginPath();
      ctx.ellipse(64, 44, 28, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#c89b6c';
      ctx.beginPath();
      ctx.ellipse(64, 42, 20, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffa726';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(52, 58);
      ctx.lineTo(58, 82);
      ctx.lineTo(50, 102);
      ctx.moveTo(76, 62);
      ctx.lineTo(72, 92);
      ctx.stroke();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3.5;
    } else {
      // Chrono-Bloom
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(64, 44, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(64, 44, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = secondary;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(64, 44);
      ctx.lineTo(64, 33);
      ctx.moveTo(64, 44);
      ctx.lineTo(74, 48);
      ctx.stroke();
    }

    const url = canvas.toDataURL();
    this.portraitUrls.set(unitId, url);
    return url;
  }
}

export const ProceduralTextures = new ProceduralTexturesImpl();
