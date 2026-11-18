import * as THREE from 'three';
import { getUnitById, type UnitDef } from '../data/UnitRegistry';
import { RARITIES } from '../data/RarityConfig';

export type DecalType = 'tomato' | 'scorch' | 'frost' | 'slime' | 'crater' | 'vine' | 'puddle';

class ProceduralTexturesImpl {
  private contactShadowTex: THREE.CanvasTexture | null = null;
  private noiseTex: THREE.CanvasTexture | null = null;
  private runeStripTex: THREE.CanvasTexture | null = null;
  private softCircleTex: THREE.CanvasTexture | null = null;
  private decalTextures = new Map<DecalType, THREE.CanvasTexture>();
  private portraitUrls = new Map<string, string>();

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

  public getNoiseTexture(): THREE.CanvasTexture {
    if (this.noiseTex) return this.noiseTex;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    // Tileable value noise
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

  public getRuneStripTexture(): THREE.CanvasTexture {
    if (this.runeStripTex) return this.runeStripTex;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 64);
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 3;
    // Outer arcs and arcane glyphs
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
    } else if (type === 'scorch' || type === 'crater') {
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 56);
      grad.addColorStop(0, type === 'crater' ? 'rgba(20, 14, 12, 0.92)' : 'rgba(24, 20, 18, 0.85)');
      grad.addColorStop(0.45, 'rgba(55, 35, 24, 0.58)');
      grad.addColorStop(1, 'rgba(20, 14, 12, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      if (type === 'crater') {
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.7)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
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

    // Subtle starburst
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(64, 58, 44, 0, Math.PI * 2);
    ctx.fill();

    // Terracotta pot base
    ctx.fillStyle = '#c26a3d';
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(40, 84);
    ctx.lineTo(88, 84);
    ctx.lineTo(82, 114);
    ctx.lineTo(46, 114);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#d97742';
    ctx.fillRect(36, 78, 56, 10);
    ctx.strokeRect(36, 78, 56, 10);

    const primary = '#' + unit.primaryColor.toString(16).padStart(6, '0');
    const secondary = '#' + unit.secondaryColor.toString(16).padStart(6, '0');
    const accent = '#' + unit.accentColor.toString(16).padStart(6, '0');

    // Stem
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(64, 78);
    ctx.lineTo(64, 56);
    ctx.stroke();

    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#0f172a';

    // Distinct silhouette per unit
    if (unit.id === 'tomato_tosser') {
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(64, 46, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.ellipse(64, 26, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (unit.id === 'cactus_striker') {
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.roundRect(50, 22, 28, 54, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      for (let i = 0; i < 6; i++) {
        const y = 30 + i * 8;
        ctx.fillRect(43, y, 7, 3);
        ctx.fillRect(78, y, 7, 3);
      }
    } else if (unit.id === 'pineapple_cannon') {
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.moveTo(48, 30);
      ctx.lineTo(64, 12);
      ctx.lineTo(80, 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.ellipse(64, 52, 20, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#334155';
      ctx.fillRect(62, 42, 28, 12);
      ctx.strokeRect(62, 42, 28, 12);
    } else if (unit.id === 'money_tree') {
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(50, 44, 18, 0, Math.PI * 2);
      ctx.arc(78, 44, 18, 0, Math.PI * 2);
      ctx.arc(64, 30, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 64, 52);
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
      ctx.fillStyle = secondary;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(64 + i * 16, 18 + Math.abs(i) * 8);
        ctx.lineTo(74 + i * 16, 48);
        ctx.lineTo(64 + i * 16, 68);
        ctx.lineTo(54 + i * 16, 48);
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
