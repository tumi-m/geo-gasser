import type { CosmosLook } from "@/lib/game/cosmos";

/**
 * Procedural paint for the cosmos round. Planets and moons are textured
 * spheres rendered per pixel through a lookup table (one texture fetch per
 * pixel per frame); stars, nebulae, galaxies, the black hole, the comet, the
 * probe and the Oort cloud are particle drawings. Everything is generated
 * from the look's seed, so every player sees the same sky.
 */

type RGB = [number, number, number];

export function hexRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

const mixc = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function ramp(pal: RGB[], t: number): RGB {
  const x = Math.max(0, Math.min(0.9999, t)) * (pal.length - 1);
  const i = Math.floor(x);
  return mixc(pal[i], pal[i + 1] ?? pal[i], x - i);
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Noise ────────────────────────────────────────────────────────────────────
function hash3(x: number, y: number, z: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, z: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, s);
  const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * u;
  const x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * u;
  const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * u;
  const x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

function fbm(x: number, y: number, z: number, s: number, oct = 4): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += amp * vnoise(x * f, y * f, z * f, s + o * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

// ── Textures (equirectangular, RGBA) ─────────────────────────────────────────
export interface Tex {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

const TW = 512;
const TH = 256;

function randomUnit(r: () => number): [number, number, number] {
  const z = r() * 2 - 1;
  const t = r() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return [s * Math.sin(t), z, s * Math.cos(t)];
}

function unitAt(lat: number, lon: number): [number, number, number] {
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
}

/** Surface colour for a body, from its look (and, for Earth, the land dots). */
export function makeSurface(look: CosmosLook, land?: Float32Array | null): Tex {
  const data = new Uint8ClampedArray(TW * TH * 4);
  const pal = look.palette.map(hexRgb);
  const r = rng(look.seed * 7919);
  const s = look.seed;
  const craters = Array.from({ length: look.craters ?? 0 }, () => {
    const big = r() < 0.12;
    return { c: randomUnit(r), rad: (big ? 0.12 + r() * 0.16 : 0.025 + r() ** 2 * 0.08), depth: 0.6 + r() * 0.4 };
  });
  const lines =
    look.marks === "lineae"
      ? Array.from({ length: 46 }, () => ({ n: randomUnit(r), c: randomUnit(r), span: 0.3 + r() * 0.6, w: 0.004 + r() * 0.01 }))
      : [];
  const vents =
    look.marks === "volcanoes"
      ? Array.from({ length: 34 }, () => ({ c: randomUnit(r), rad: 0.03 + r() * 0.07 }))
      : [];
  const spots =
    look.marks === "bright-spots" ? [unitAt(0.35, 0.6), unitAt(0.33, 0.66), unitAt(0.37, 0.63)] : [];
  // Land mask for Earth: splat every land dot onto a coarse grid.
  let landMask: Float32Array | null = null;
  if (look.kind === "earth" && land) {
    landMask = new Float32Array(TW * TH);
    const rad = 3;
    for (let i = 0; i < land.length; i += 2) {
      const cx = ((land[i + 1] / (Math.PI * 2) + 0.5) * TW) | 0;
      const cy = ((0.5 - land[i] / Math.PI) * TH) | 0;
      for (let dy = -rad; dy <= rad; dy++)
        for (let dx = -rad * 2; dx <= rad * 2; dx++) {
          const y = cy + dy;
          if (y < 0 || y >= TH) continue;
          const x = (((cx + dx) % TW) + TW) % TW;
          const d = Math.hypot(dx / 2, dy) / rad;
          if (d < 1) landMask[y * TW + x] = Math.max(landMask[y * TW + x], 1 - d * d);
        }
    }
  }
  const spot = look.spot;
  const caps = look.caps ? hexRgb(look.caps) : null;

  for (let j = 0; j < TH; j++) {
    const lat = (0.5 - (j + 0.5) / TH) * Math.PI;
    const latDeg = (lat * 180) / Math.PI;
    for (let i = 0; i < TW; i++) {
      const lon = ((i + 0.5) / TW - 0.5) * Math.PI * 2;
      const [x, y, z] = unitAt(lat, lon);
      let col: RGB;
      if (look.kind === "gas" || look.kind === "ringed") {
        const bands = look.bands ?? 8;
        const warp = (fbm(x * 2.5, y * 2.5, z * 2.5, s) - 0.5) * (look.swirl ?? 0.3) * 2.4;
        const f = (lat / Math.PI + 0.5) * bands + warp + Math.sin(lon * 3 + lat * 9) * 0.04 * (look.swirl ?? 0);
        const band = Math.floor(f);
        const fr = f - band;
        const a = pal[((band % pal.length) + pal.length) % pal.length];
        const b = pal[(((band + 1) % pal.length) + pal.length) % pal.length];
        col = mixc(a, b, smooth(0.65, 1, fr));
        const fine = 0.92 + 0.16 * fbm(x * 9, y * 22, z * 9, s + 3, 3);
        col = [col[0] * fine, col[1] * fine, col[2] * fine];
        if (spot) {
          const dl = ((lon * 180) / Math.PI - spot.lon + 540) % 360 - 180;
          const e = (dl / spot.w) ** 2 + ((latDeg - spot.lat) / spot.h) ** 2;
          if (e < 1.3) {
            const sp = hexRgb(spot.color);
            const ring = smooth(1.3, 0.7, e);
            const swirl = 0.85 + 0.3 * vnoise(dl * 0.4, latDeg * 0.6, e * 4, s);
            col = mixc(col, [sp[0] * swirl, sp[1] * swirl, sp[2] * swirl], ring * 0.9);
          }
        }
        if (look.haze) col = mixc(col, pal[2], look.haze * 0.6);
      } else if (look.kind === "earth") {
        const m = landMask ? landMask[j * TW + i] : 0;
        const coast = m + (fbm(x * 6, y * 6, z * 6, s) - 0.5) * 0.7;
        const lat01 = Math.abs(latDeg) / 90;
        if (coast > 0.35) {
          const dry = smooth(0.1, 0.35, 1 - Math.abs(Math.abs(latDeg) - 24) / 30) * fbm(x * 4, y * 4, z * 4, s + 9);
          const green: RGB = mixc([44, 92, 42], [86, 112, 58], fbm(x * 8, y * 8, z * 8, s + 4));
          col = mixc(green, pal[3], Math.min(1, dry * 1.6));
        } else {
          const deep = fbm(x * 3, y * 3, z * 3, s + 2);
          col = mixc(pal[0], pal[1], smooth(0.2, 0.36, coast) * 0.7 + deep * 0.3);
        }
        if (caps && lat01 > 0.78 + (fbm(x * 5, y * 5, z * 5, s + 6) - 0.5) * 0.1) col = caps;
      } else {
        // Rocky worlds, icy moons, stars.
        const n = fbm(x * 2.2, y * 2.2, z * 2.2, s);
        const detail = fbm(x * 9, y * 9, z * 9, s + 5, 3);
        let t = n * 0.75 + detail * 0.35 - 0.05;
        if (look.kind === "star") {
          const cells = fbm(x * (look.size && look.size > 0.35 ? 3 : 14), y * 14, z * 14, s + 1, 3);
          t = 0.55 + cells * 0.5 + (n - 0.5) * 0.3;
        }
        if (look.marks === "maria") {
          const m = fbm(x * 1.6, y * 1.6, z * 1.6, s + 11);
          if (m > 0.55 && z > -0.2) t -= smooth(0.55, 0.62, m) * 0.45;
        }
        if (look.marks === "cantaloupe") t += (vnoise(x * 30, y * 30, z * 30, s + 2) - 0.5) * 0.35;
        col = ramp(pal, t);
        for (const c of craters) {
          const d = Math.acos(Math.max(-1, Math.min(1, x * c.c[0] + y * c.c[1] + z * c.c[2])));
          if (d > c.rad * 1.4) continue;
          const q = d / c.rad;
          const k = q < 0.82 ? 0.78 + 0.1 * q : q < 1 ? 1.18 : 1 + 0.06 * (1.4 - q);
          const f = 1 + (k - 1) * c.depth;
          col = [col[0] * f, col[1] * f, col[2] * f];
        }
        for (const l of lines) {
          const off = Math.abs(x * l.n[0] + y * l.n[1] + z * l.n[2]);
          if (off < l.w && x * l.c[0] + y * l.c[1] + z * l.c[2] > 1 - l.span) col = mixc(col, [138, 74, 42], 0.65 * (1 - off / l.w));
        }
        for (const v of vents) {
          const d = Math.acos(Math.max(-1, Math.min(1, x * v.c[0] + y * v.c[1] + z * v.c[2])));
          if (d < v.rad * 0.25) col = mixc(col, [40, 22, 12], 0.85);
          else if (d < v.rad) col = mixc(col, [214, 98, 38], 0.55 * (1 - d / v.rad));
          else if (d < v.rad * 1.8) col = mixc(col, [244, 236, 200], 0.35 * (1 - (d - v.rad) / (v.rad * 0.8)));
        }
        for (const sp of spots) {
          const d = Math.acos(Math.max(-1, Math.min(1, x * sp[0] + y * sp[1] + z * sp[2])));
          if (d < 0.035) col = mixc(col, [250, 252, 255], 1 - d / 0.035);
        }
        if (look.marks === "heart") {
          // A heart-shaped plain centred at 15°N, facing longitude 0.
          const u = Math.atan2(x, z) / 0.4;
          const v = (lat - 0.2) / 0.4 + 0.2;
          const hh = (u * u + v * v - 1) ** 3 - u * u * v * v * v;
          const grain = 0.9 + 0.1 * vnoise(x * 40, y * 40, z * 40, s + 8);
          if (hh < 0.02) col = mixc(col, [242 * grain, 232 * grain, 214 * grain], smooth(0.02, -0.08, hh));
        }
        if (look.marks === "stripes" && latDeg < -55) {
          const stripe = Math.abs(Math.sin(lon * 2 + latDeg * 0.25));
          if (stripe < 0.06) col = mixc(col, [92, 168, 206], 0.75);
        }
        if (caps) {
          const edge = 72 + (fbm(x * 5, y * 5, z * 5, s + 6) - 0.5) * 14;
          if (Math.abs(latDeg) > edge) col = mixc(col, caps, smooth(edge, edge + 4, Math.abs(latDeg)));
        }
      }
      const o = (j * TW + i) * 4;
      data[o] = col[0];
      data[o + 1] = col[1];
      data[o + 2] = col[2];
      data[o + 3] = 255;
    }
  }
  return { w: TW, h: TH, data };
}

/** Earth's weather: white cloud alpha. */
export function makeClouds(seed: number): Tex {
  const data = new Uint8ClampedArray(TW * TH * 4);
  for (let j = 0; j < TH; j++) {
    const lat = (0.5 - (j + 0.5) / TH) * Math.PI;
    const belt = 0.55 + 0.45 * Math.abs(Math.cos(lat * 3));
    for (let i = 0; i < TW; i++) {
      const lon = ((i + 0.5) / TW - 0.5) * Math.PI * 2;
      const [x, y, z] = unitAt(lat, lon);
      const n = fbm(x * 3 + Math.sin(y * 4) * 0.4, y * 6, z * 3, seed, 5);
      const a = smooth(0.5, 0.72, n * belt + 0.12);
      const o = (j * TW + i) * 4;
      data[o] = data[o + 1] = data[o + 2] = 255;
      data[o + 3] = a * 235;
    }
  }
  return { w: TW, h: TH, data };
}

// ── Sphere renderer ──────────────────────────────────────────────────────────
const LIGHT = (() => {
  const v = [-0.62, 0.38, 0.69];
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

export interface Sphere {
  canvas: HTMLCanvasElement;
  draw(rot: number, cloudRot?: number): void;
}

/**
 * A lit, textured sphere `size` px across. `rot` turns it (radians);
 * `tiltDeg` rolls the axis on screen; `pitch` shows a little of the north.
 */
export function makeSphere(
  tex: Tex,
  size: number,
  opts: { tiltDeg?: number; pitch?: number; emissive?: boolean; clouds?: Tex | null; haze?: string; hazeAmount?: number } = {},
): Sphere {
  const D = Math.max(16, Math.round(size));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = D;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(D, D);
  const n = D * D;
  const pix = new Int32Array(n);
  const row = new Int32Array(n);
  const lonA = new Float32Array(n);
  const shade = new Float32Array(n);
  const alpha = new Uint8ClampedArray(n);
  let count = 0;
  const roll = ((opts.tiltDeg ?? 0) * Math.PI) / 180;
  const pitch = opts.pitch ?? 0.2;
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  for (let py = 0; py < D; py++)
    for (let px = 0; px < D; px++) {
      const nx = ((px + 0.5) / D) * 2 - 1;
      const ny = -(((py + 0.5) / D) * 2 - 1);
      const r2 = nx * nx + ny * ny;
      if (r2 >= 1) continue;
      const nz = Math.sqrt(1 - r2);
      const x1 = nx * cr + ny * sr;
      const y1 = -nx * sr + ny * cr;
      const by = y1 * cp + nz * sp;
      const bz = -y1 * sp + nz * cp;
      const lat = Math.asin(Math.max(-1, Math.min(1, by)));
      const lon = Math.atan2(x1, bz);
      pix[count] = py * D + px;
      row[count] = Math.min(tex.h - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * tex.h)));
      lonA[count] = (lon / (Math.PI * 2) + 0.5) * tex.w;
      // A one-pixel soft edge instead of a jagged rim.
      alpha[count] = Math.min(1, (1 - Math.sqrt(r2)) * D * 0.5) * 255;
      if (opts.emissive) {
        shade[count] = 0.42 + 0.68 * nz ** 0.55;
      } else {
        const d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        const s = smooth(-0.1, 0.32, d);
        shade[count] = 0.03 + s * (0.32 + 0.78 * Math.max(d, 0)) * (0.8 + 0.2 * nz);
      }
      count++;
    }
  const out = img.data;
  const src = tex.data;
  const cl = opts.clouds?.data;
  const W = tex.w;
  const haze = opts.haze ? hexRgb(opts.haze) : null;
  const hz = opts.hazeAmount ?? 0;
  return {
    canvas,
    draw(rot, cloudRot = rot) {
      const off = (rot / (Math.PI * 2)) * W;
      const coff = (cloudRot / (Math.PI * 2)) * W;
      for (let k = 0; k < count; k++) {
        let c = (lonA[k] + off) % W;
        if (c < 0) c += W;
        const t = (row[k] * W + (c | 0)) * 4;
        let r = src[t];
        let g = src[t + 1];
        let b = src[t + 2];
        if (cl) {
          let cc = (lonA[k] + coff) % W;
          if (cc < 0) cc += W;
          const a = cl[(row[k] * W + (cc | 0)) * 4 + 3] / 255;
          r += (255 - r) * a;
          g += (255 - g) * a;
          b += (255 - b) * a;
        }
        if (haze) {
          r += (haze[0] - r) * hz;
          g += (haze[1] - g) * hz;
          b += (haze[2] - b) * hz;
        }
        const s = shade[k];
        const o = pix[k] * 4;
        out[o] = r * s;
        out[o + 1] = g * s;
        out[o + 2] = b * s;
        out[o + 3] = alpha[k];
      }
      ctx.putImageData(img, 0, 0);
    },
  };
}

// ── Soft sprites ─────────────────────────────────────────────────────────────
const sprites = new Map<string, HTMLCanvasElement>();
/** A soft round glow in one colour, 64 px; draw it scaled. */
export function glow(color: string): HTMLCanvasElement {
  const hit = sprites.get(color);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, rgba(color, 1));
  grad.addColorStop(0.25, rgba(color, 0.55));
  grad.addColorStop(0.6, rgba(color, 0.14));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  sprites.set(color, c);
  return c;
}

export function drawGlow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, a = 1) {
  if (r <= 0 || a <= 0) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(glow(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/** A bright point with four diffraction spikes. */
export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, spikes = true) {
  drawGlow(ctx, color, x, y, r * 4, 0.9);
  drawGlow(ctx, "#ffffff", x, y, r * 1.2, 1);
  if (!spikes) return;
  // Spikes taper out instead of ending in a hard line.
  const len = r * 6;
  for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
    const g = ctx.createLinearGradient(x - dx * len, y - dy * len, x + dx * len, y + dy * len);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.5, rgba(color, 0.6));
    g.addColorStop(1, rgba(color, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(0.6, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(x - dx * len, y - dy * len);
    ctx.lineTo(x + dx * len, y + dy * len);
    ctx.stroke();
  }
}
