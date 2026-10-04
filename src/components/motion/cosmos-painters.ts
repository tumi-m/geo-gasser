import type { CosmosLook } from "@/lib/game/cosmos";
import {
  drawGlow,
  drawStar,
  makeClouds,
  makeSphere,
  makeSurface,
  rgba,
  rng,
  type Sphere,
  type Tex,
} from "./cosmos-paint";

/** What every painter gets each frame. Sizes are CSS px. */
export interface Frame {
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** Short side of the scene, times the zoom. */
  unit: number;
  /** Seconds since the scene opened (frozen for reduced motion). */
  t: number;
  /** Turn from dragging, radians. */
  spin: number;
  dpr: number;
}

export interface Painter {
  draw(ctx: CanvasRenderingContext2D, f: Frame): void;
}

const TAU = Math.PI * 2;

/** A sphere that rebuilds its lookup table only when its size changes a lot. */
function sizedSphere(tex: Tex, opts: Parameters<typeof makeSphere>[2], cap = 460) {
  let sphere: Sphere | null = null;
  let size = 0;
  return (px: number) => {
    const want = Math.max(48, Math.min(cap, Math.round(px)));
    if (!sphere || Math.abs(want - size) / size > 0.18) {
      sphere = makeSphere(tex, want, opts);
      size = want;
    }
    return sphere;
  };
}

function drawRings(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  rings: NonNullable<CosmosLook["rings"]>,
  tiltDeg: number,
  half: "back" | "front",
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-tiltDeg * Math.PI) / 180);
  ctx.scale(1, Math.max(0.04, rings.open));
  ctx.beginPath();
  const big = R * rings.outer * 1.2;
  if (half === "back") ctx.rect(-big, -big, big * 2, big);
  else ctx.rect(-big, 0, big * 2, big);
  ctx.clip();
  const grad = ctx.createRadialGradient(0, 0, R * rings.inner, 0, 0, R * rings.outer);
  rings.colors.forEach((c, i) => {
    const a = i === 0 || i === rings.colors.length - 1 ? 0.35 : 0.85;
    grad.addColorStop(i / (rings.colors.length - 1), rgba(c, a * (half === "back" ? 0.8 : 1)));
  });
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, R * rings.outer, 0, TAU);
  ctx.arc(0, 0, R * rings.inner, 0, TAU, true);
  ctx.fill("evenodd");
  ctx.restore();
}

function atmosphere(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, color: string, strength = 1) {
  const g = ctx.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.13);
  g.addColorStop(0, rgba(color, 0.5 * strength));
  g.addColorStop(0.3, rgba(color, 0.22 * strength));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.14, 0, TAU);
  ctx.fill();
}

// ── Planets, moons, stars ────────────────────────────────────────────────────
function bodyPainter(look: CosmosLook, land: Float32Array | null): Painter {
  const tex = makeSurface(look, land);
  const clouds = look.clouds ? makeClouds(look.seed + 1) : null;
  const star = look.kind === "star";
  const tilt = look.tilt ?? 0;
  const pitch = look.rings ? Math.asin(Math.min(0.95, look.rings.open)) : 0.22;
  const sphere = sizedSphere(tex, {
    tiltDeg: tilt,
    pitch,
    emissive: star,
    clouds,
    haze: look.haze ? look.glow : undefined,
    hazeAmount: look.haze ? look.haze * 0.35 : 0,
  });
  const b = look.backdrop;
  const backTex = b
    ? makeSurface(
        {
          kind: b.kind === "earth" ? "earth" : "gas",
          palette: b.palette,
          seed: look.seed + 100,
          bands: b.bands,
          swirl: 0.45,
          caps: b.kind === "earth" ? "#f2f6f8" : undefined,
          spot: b.spot ? { lat: -22, lon: 20, w: 26, h: 11, color: "#c2603a" } : undefined,
        },
        land,
      )
    : null;
  const backClouds = b?.kind === "earth" ? makeClouds(look.seed + 7) : null;
  const backRings = b?.rings
    ? { inner: 1.25, outer: 2.3, colors: ["#6f6450", "#cbb995", "#e6d8b4", "#3a352c", "#bfae88", "#8c7f66"], open: 0.18 }
    : null;
  const backSphere = backTex
    ? sizedSphere(backTex, { tiltDeg: backRings ? -12 : 8, pitch: backRings ? Math.asin(0.18) : 0.15, clouds: backClouds }, 320)
    : null;
  // Flares (red dwarfs): a loop of plasma off the limb every few seconds.
  const flareR = rng(look.seed + 3);
  const flares = Array.from({ length: 6 }, () => ({ at: flareR() * TAU, span: 0.18 + flareR() * 0.25, h: 0.25 + flareR() * 0.35 }));

  return {
    draw(ctx, f) {
      const R = f.unit * (look.size ?? 0.3);
      const turn = look.turn ?? 60;
      const rot = (f.t / turn) * TAU + f.spin;

      if (b && backSphere) {
        const earth = b.kind === "earth";
        // Earth hangs small and far; giants loom, a ringed one further off.
        const BR = f.unit * (earth ? 0.2 : backRings ? 0.4 : 0.66);
        const off = f.unit * (earth ? 0.62 : backRings ? 0.74 : 0.8);
        const bx = b.side === "left" ? f.cx - off : f.cx + off;
        const by = f.cy - f.unit * (earth ? 0.08 : backRings ? 0.2 : 0.12);
        const s = backSphere(BR * 2 * Math.min(f.dpr, 1.5));
        s.draw(rot * 0.12 + 1.2, rot * 0.14 + 1.2);
        if (backRings) drawRings(ctx, bx, by, BR, backRings, -12, "back");
        ctx.globalAlpha = 0.92;
        ctx.drawImage(s.canvas, bx - BR, by - BR, BR * 2, BR * 2);
        ctx.globalAlpha = 1;
        if (backRings) drawRings(ctx, bx, by, BR, backRings, -12, "front");
        if (b.glow) atmosphere(ctx, bx, by, BR, b.glow, 0.8);
      }

      if (star) {
        // Corona and slow rays.
        ctx.globalCompositeOperation = "lighter";
        drawGlow(ctx, look.glow ?? look.palette[2], f.cx, f.cy, R * 3.2, 0.55);
        drawGlow(ctx, look.palette[3], f.cx, f.cy, R * 1.7, 0.7);
        const rays = 14;
        for (let i = 0; i < rays; i++) {
          const a = (i / rays) * TAU + f.t * 0.03 + Math.sin(i * 7.3) * 0.2;
          const len = R * (1.5 + 0.5 * Math.sin(f.t * 0.6 + i * 1.7));
          const g = ctx.createLinearGradient(f.cx, f.cy, f.cx + Math.cos(a) * len, f.cy + Math.sin(a) * len);
          g.addColorStop(0, rgba(look.palette[3], 0.22));
          g.addColorStop(1, rgba(look.palette[3], 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(f.cx + Math.cos(a - 0.05) * R * 0.9, f.cy + Math.sin(a - 0.05) * R * 0.9);
          ctx.lineTo(f.cx + Math.cos(a) * len, f.cy + Math.sin(a) * len);
          ctx.lineTo(f.cx + Math.cos(a + 0.05) * R * 0.9, f.cy + Math.sin(a + 0.05) * R * 0.9);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      }

      if (look.rings) drawRings(ctx, f.cx, f.cy, R, look.rings, tilt, "back");
      const breathe = star && (look.size ?? 0) > 0.35 ? 1 + 0.025 * Math.sin(f.t * 0.45) : 1;
      const RR = R * breathe;
      const s = sphere(RR * 2 * Math.min(f.dpr, 1.6));
      s.draw(rot, rot * 1.18 + 0.4);
      ctx.drawImage(s.canvas, f.cx - RR, f.cy - RR, RR * 2, RR * 2);
      if (look.rings) drawRings(ctx, f.cx, f.cy, R, look.rings, tilt, "front");
      if (look.glow && !star) atmosphere(ctx, f.cx, f.cy, RR, look.glow, look.haze ? 1.4 : 1);

      if (star) {
        ctx.globalCompositeOperation = "lighter";
        drawGlow(ctx, look.palette[3], f.cx - RR * 0.1, f.cy - RR * 0.1, RR * 1.15, 0.35);
        if (look.flares) {
          const period = 3.2;
          const k = Math.floor(f.t / period);
          const life = (f.t % period) / period;
          const fl = flares[k % flares.length];
          const a1 = fl.at - fl.span / 2;
          const a2 = fl.at + fl.span / 2;
          const p1 = [f.cx + Math.cos(a1) * RR * 0.98, f.cy + Math.sin(a1) * RR * 0.98];
          const p2 = [f.cx + Math.cos(a2) * RR * 0.98, f.cy + Math.sin(a2) * RR * 0.98];
          const top = RR * (1 + fl.h * Math.sin(Math.min(1, life * 1.6) * Math.PI * 0.5));
          const fade = life < 0.7 ? 1 : 1 - (life - 0.7) / 0.3;
          ctx.strokeStyle = rgba(look.glow ?? "#ff7a3a", 0.75 * fade);
          ctx.lineWidth = Math.max(1.2, RR * 0.035);
          ctx.beginPath();
          ctx.moveTo(p1[0], p1[1]);
          ctx.quadraticCurveTo(f.cx + Math.cos(fl.at) * top * 1.25, f.cy + Math.sin(fl.at) * top * 1.25, p2[0], p2[1]);
          ctx.stroke();
          drawGlow(ctx, look.palette[3], f.cx + Math.cos(fl.at) * RR, f.cy + Math.sin(fl.at) * RR, RR * 0.35 * fade, 0.8 * fade);
        }
        if (look.companion) {
          if (look.flares) {
            // Two bright suns far away: the rest of the family.
            drawStar(ctx, f.cx + f.unit * 0.62, f.cy - f.unit * 0.34, Math.max(1.4, f.unit * 0.006), "#fff2d6");
            drawStar(ctx, f.cx + f.unit * 0.645, f.cy - f.unit * 0.325, Math.max(1, f.unit * 0.0045), "#ffd9a0");
          } else {
            const a = f.t * 0.35;
            const x = f.cx + Math.cos(a) * RR * 2.6;
            const y = f.cy + Math.sin(a) * RR * 0.9;
            drawStar(ctx, x, y, Math.max(1.2, RR * 0.05), look.companion, false);
          }
        }
        ctx.globalCompositeOperation = "source-over";
      }
    },
  };
}

// ── Nebula ───────────────────────────────────────────────────────────────────
function nebulaPainter(look: CosmosLook): Painter {
  const r = rng(look.seed);
  const gauss = () => (r() + r() + r() - 1.5) / 1.5;
  const puffs = Array.from({ length: 240 }, () => {
    const core = r() < 0.3;
    const x = gauss() * (core ? 0.3 : 0.8);
    const y = gauss() * (core ? 0.25 : 0.65) + x * 0.25;
    const d = Math.hypot(x, y);
    const color = core ? (r() < 0.5 ? look.palette[2] : look.palette[3]) : d > 0.6 ? look.palette[0] : look.palette[r() < 0.6 ? 0 : 1];
    return { x, y, rad: 0.08 + r() * (core ? 0.16 : 0.3), a: (core ? 0.016 : 0.03) + r() * (core ? 0.028 : 0.05), color, z: 0.3 + r() * 0.7, ph: r() * TAU };
  });
  const dust = Array.from({ length: 46 }, () => {
    const u = r() * 2 - 1;
    return { x: u * 0.9, y: 0.35 + u * 0.35 + gauss() * 0.12, rad: 0.06 + r() * 0.16, a: 0.25 + r() * 0.3 };
  });
  const stars = Array.from({ length: 50 }, () => ({ x: gauss() * 0.7, y: gauss() * 0.6, s: 0.4 + r() * 1.2 }));
  const trapezium = [
    [-0.03, -0.02],
    [0.03, -0.035],
    [0.012, 0.03],
    [-0.035, 0.035],
  ];
  return {
    draw(ctx, f) {
      const S = f.unit * (look.size ?? 0.46) * (1 + 0.04 * Math.sin(f.t * 0.07));
      const c = Math.cos(f.spin * 0.6);
      const sn = Math.sin(f.spin * 0.6);
      const at = (x: number, y: number, z = 1) => {
        const dx = x + Math.sin(f.t * 0.05 * z) * 0.02 * z;
        return [f.cx + (dx * c - y * sn) * S * 1.6, f.cy + (dx * sn + y * c) * S * 1.6] as const;
      };
      ctx.globalCompositeOperation = "lighter";
      for (const p of puffs) {
        const [x, y] = at(p.x, p.y, p.z);
        drawGlow(ctx, p.color, x, y, p.rad * S * 1.9, p.a * (0.85 + 0.15 * Math.sin(f.t * 0.3 + p.ph)));
      }
      ctx.globalCompositeOperation = "source-over";
      for (const d of dust) {
        const [x, y] = at(d.x, d.y, 0.5);
        drawGlow(ctx, "#05060a", x, y, d.rad * S * 1.9, d.a);
      }
      ctx.globalCompositeOperation = "lighter";
      for (const s of stars) {
        const [x, y] = at(s.x, s.y, 0.8);
        drawGlow(ctx, "#ffffff", x, y, s.s * 2.2, 0.7);
      }
      for (const [tx, ty] of trapezium) {
        const [x, y] = at(tx, ty, 1);
        drawStar(ctx, x, y, Math.max(1.3, S * 0.012), "#dfe9ff");
      }
      ctx.globalCompositeOperation = "source-over";
    },
  };
}

// ── Supernova remnant ────────────────────────────────────────────────────────
function remnantPainter(look: CosmosLook): Painter {
  const r = rng(look.seed);
  let layer: HTMLCanvasElement | null = null;
  let layerSize = 0;
  const build = (size: number) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    g.globalCompositeOperation = "lighter";
    const half = size / 2;
    for (let i = 0; i < 170; i++) {
      const a = r() * TAU;
      const reach = 0.45 + r() * 0.55;
      let x = Math.cos(a) * 0.12;
      let y = Math.sin(a) * 0.12;
      let dir = a;
      g.strokeStyle = rgba(look.palette[r() < 0.6 ? 0 : 1], 0.32 + r() * 0.3);
      g.lineWidth = Math.max(1, size * 0.0035 * (0.5 + r()));
      g.beginPath();
      g.moveTo(half + x * half, half + y * half * 0.74);
      for (let k = 0; k < 16; k++) {
        dir += (r() - 0.5) * 0.7;
        x += (Math.cos(dir) * reach) / 16;
        y += (Math.sin(dir) * reach) / 16;
        if (Math.hypot(x, y / 0.74) > 0.96) break;
        g.lineTo(half + x * half, half + y * half * 0.74);
      }
      g.stroke();
    }
    return c;
  };
  return {
    draw(ctx, f) {
      const S = f.unit * (look.size ?? 0.4);
      const want = Math.min(900, Math.round(S * 2.4 * Math.min(f.dpr, 1.5)));
      if (!layer || Math.abs(want - layerSize) / layerSize > 0.25) {
        layer = build(want);
        layerSize = want;
      }
      ctx.globalCompositeOperation = "lighter";
      drawGlow(ctx, look.palette[2], f.cx, f.cy, S * 1.25, 0.55);
      drawGlow(ctx, look.palette[3], f.cx, f.cy, S * 0.45, 0.35);
      const grow = 1 + ((f.t % 30) / 30) * 0.04;
      ctx.save();
      ctx.translate(f.cx, f.cy);
      ctx.rotate(0.5 + f.spin);
      ctx.scale(grow, grow);
      ctx.drawImage(layer, -S * 1.2, -S * 1.2, S * 2.4, S * 2.4);
      ctx.restore();
      // The pulsar at the heart, and the wisps it drives outward.
      const pulse = Math.max(0, Math.sin(f.t * TAU * 1.1)) ** 14;
      drawGlow(ctx, "#ffffff", f.cx, f.cy, S * (0.05 + pulse * 0.1), 0.6 + pulse * 0.4);
      for (let k = 0; k < 3; k++) {
        const ph = ((f.t * 0.4 + k / 3) % 1);
        ctx.strokeStyle = rgba(look.palette[3], 0.35 * (1 - ph));
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(f.cx, f.cy, S * 0.08 + ph * S * 0.35, (S * 0.08 + ph * S * 0.35) * 0.55, 0.5 + f.spin, 0, TAU);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    },
  };
}

// ── Star cluster ─────────────────────────────────────────────────────────────
function clusterPainter(look: CosmosLook): Painter {
  const r = rng(look.seed);
  const bright: [number, number, number][] = [
    [0, 0, 1.3],
    [-0.36, 0.03, 1.05],
    [-0.38, -0.07, 0.6],
    [0.1, 0.22, 0.95],
    [0.38, 0.12, 1.0],
    [0.42, -0.04, 0.7],
    [0.3, -0.28, 0.85],
    [0.19, -0.17, 0.9],
    [0.27, -0.4, 0.55],
  ];
  const wisps = Array.from({ length: 90 }, () => {
    const host = bright[Math.floor(r() * bright.length)];
    return { x: host[0] + (r() - 0.5) * 0.4, y: host[1] + (r() - 0.5) * 0.3, len: 0.1 + r() * 0.3, a: 0.05 + r() * 0.09, rot: -0.5 + (r() - 0.5) * 0.3 };
  });
  const faint = Array.from({ length: 70 }, () => ({ x: (r() - 0.5) * 1.6, y: (r() - 0.5) * 1.2, s: 0.5 + r() }));
  return {
    draw(ctx, f) {
      const S = f.unit * (look.size ?? 0.42) * 1.5;
      const c = Math.cos(f.spin * 0.5);
      const sn = Math.sin(f.spin * 0.5);
      const at = (x: number, y: number) => [f.cx + (x * c - y * sn) * S, f.cy + (x * sn + y * c) * S] as const;
      ctx.globalCompositeOperation = "lighter";
      for (const w of wisps) {
        const [x, y] = at(w.x, w.y);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(w.rot + f.spin * 0.5 + Math.sin(f.t * 0.05) * 0.03);
        ctx.scale(2.6, 0.55);
        drawGlow(ctx, look.palette[0], 0, 0, w.len * S * 0.6, w.a);
        ctx.restore();
      }
      for (const s of faint) {
        const [x, y] = at(s.x, s.y);
        drawGlow(ctx, look.palette[2], x, y, s.s * 2, 0.6);
      }
      bright.forEach(([bx, by, m], i) => {
        const [x, y] = at(bx, by);
        const tw = 1 + 0.12 * Math.sin(f.t * 1.7 + i * 2.1);
        drawStar(ctx, x, y, Math.max(1.4, S * 0.016 * m * tw), look.palette[1]);
      });
      ctx.globalCompositeOperation = "source-over";
    },
  };
}

// ── Galaxies ─────────────────────────────────────────────────────────────────
function galaxyPainter(look: CosmosLook): Painter {
  const r = rng(look.seed);
  const gauss = () => (r() + r() + r() + r() - 2) / 2;
  const N = look.irregular ? 4200 : 6500;
  const rad = new Float32Array(N);
  const th = new Float32Array(N);
  const size = new Float32Array(N);
  const group = new Uint8Array(N); // 0 bulge, 1 arm, 2 nebula, 3 dust
  const arms = look.arms ?? 2;
  for (let i = 0; i < N; i++) {
    const u = r();
    if (look.irregular) {
      // Flat x/y in the galaxy's plane (rad = x, th = y): a bright bar,
      // star-forming knots (one of them the big pink nebula) and a loose halo.
      if (u < 0.45) {
        rad[i] = gauss() * 0.6;
        th[i] = gauss() * 0.16 + rad[i] * 0.1;
        group[i] = 0;
      } else if (u < 0.58) {
        const knot = Math.floor(r() * 5);
        const a = 1.1 + knot * 1.1;
        rad[i] = Math.cos(a) * (0.4 + knot * 0.06) + gauss() * 0.07;
        th[i] = Math.sin(a) * (0.32 + knot * 0.05) + gauss() * 0.07;
        group[i] = knot === 0 ? 2 : 1;
      } else {
        const a = r() * TAU;
        const d = Math.abs(gauss()) * 0.95;
        rad[i] = Math.cos(a) * d;
        th[i] = Math.sin(a) * d * 0.8;
        group[i] = u > 0.94 ? 3 : 1;
      }
    } else if (u < 0.2) {
      rad[i] = Math.abs(gauss()) * 0.18;
      th[i] = r() * TAU;
      group[i] = 0;
    } else if (u < 0.45) {
      // The smooth disk between the arms.
      rad[i] = 0.08 + Math.min(1.2, -Math.log(1 - r() * 0.95) * 0.34);
      th[i] = r() * TAU;
      group[i] = r() < 0.5 ? 0 : 1;
    } else {
      const k = Math.floor(r() * arms);
      const rr = 0.12 + Math.min(1.15, -Math.log(1 - r() * 0.96) * 0.36);
      rad[i] = rr;
      th[i] = (k / arms) * TAU + Math.log(rr * 4 + 1) * 1.7 + gauss() * 0.42;
      group[i] = u > 0.95 ? 2 : u > 0.84 ? 3 : 1;
      if (group[i] === 3) th[i] -= 0.1;
    }
    size[i] = 0.6 + r() * (group[i] === 2 ? 1.8 : 1.1);
  }
  const colors = [rgba(look.palette[0], 0.38), rgba(look.palette[1], 0.34), rgba(look.palette[2], 0.7), "rgba(14,8,6,0.5)"];
  const incl = ((look.inclination ?? 60) * Math.PI) / 180;
  const pa = look.irregular ? -0.3 : -0.62;
  return {
    draw(ctx, f) {
      const S = f.unit * (look.size ?? 0.46);
      const ci = Math.cos(incl);
      const ang = pa + f.spin;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const dot = Math.max(0.9, S / 260);
      const spinC = Math.cos(f.t * 0.012);
      const spinS = Math.sin(f.t * 0.012);
      ctx.globalCompositeOperation = "lighter";
      drawGlow(ctx, look.palette[1], f.cx, f.cy, S * 1.3, 0.12);
      for (let g = 0; g < 4; g++) {
        if (g === 3) ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = colors[g];
        for (let i = 0; i < N; i++) {
          if (group[i] !== g) continue;
          let xx: number;
          let yy: number;
          if (look.irregular) {
            xx = rad[i] * spinC - th[i] * spinS;
            yy = (rad[i] * spinS + th[i] * spinC) * ci;
          } else {
            const rr = rad[i];
            const a = th[i] + (f.t * 0.05) / (0.25 + rr);
            xx = rr * Math.cos(a);
            yy = rr * Math.sin(a) * ci;
          }
          const x = f.cx + (xx * ca - yy * sa) * S;
          const y = f.cy + (xx * sa + yy * ca) * S;
          const s = size[i] * dot;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
        if (g === 3) ctx.globalCompositeOperation = "lighter";
      }
      drawGlow(ctx, look.palette[0], f.cx, f.cy, S * (look.irregular ? 0.3 : 0.36), 0.6);
      drawGlow(ctx, "#ffffff", f.cx, f.cy, S * 0.08, 0.85);
      if (!look.irregular) {
        // Two small companions.
        drawGlow(ctx, look.palette[0], f.cx + (0.32 * ca - 0.12 * sa) * S, f.cy + (0.32 * sa + 0.12 * ca) * S, S * 0.07, 0.8);
        ctx.save();
        ctx.translate(f.cx + (-0.5 * ca + 0.52 * sa) * S, f.cy + (-0.5 * sa - 0.52 * ca) * S);
        ctx.rotate(0.9);
        ctx.scale(1.8, 1);
        drawGlow(ctx, look.palette[0], 0, 0, S * 0.07, 0.55);
        ctx.restore();
      }
      ctx.globalCompositeOperation = "source-over";
    },
  };
}

// ── Black hole ───────────────────────────────────────────────────────────────
function blackHolePainter(look: CosmosLook): Painter {
  const r = rng(look.seed);
  const N = 2600;
  const rad = new Float32Array(N);
  const th = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    rad[i] = 1.6 + (r() ** 1.8) * 2.8;
    th[i] = r() * TAU;
  }
  const stars = Array.from({ length: 8 }, () => ({
    a: 2.6 + r() * 2.2,
    e: 0.3 + r() * 0.55,
    w: r() * TAU,
    tilt: 0.3 + r() * 0.6,
    period: 7 + r() * 9,
    ph: r(),
  }));
  const kepler = (M: number, e: number) => {
    let E = M;
    for (let k = 0; k < 5; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return E;
  };
  const disk = (ctx: CanvasRenderingContext2D, f: Frame, rs: number, side: "back" | "front" | "lens") => {
    const flat = 0.2;
    const tilt = -0.12 + f.spin * 0.3;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const dot = Math.max(1, rs / 55);
    for (let i = 0; i < N; i++) {
      const rr = rad[i];
      const a = th[i] + f.t * 1.4 * rr ** -1.5;
      const sa = Math.sin(a);
      const far = sa < 0;
      if ((side === "front" && far) || (side !== "front" && !far)) continue;
      const doppler = 1 + 0.75 * Math.cos(a);
      const heat = 1 - (rr - 1.6) / 2.8;
      let x: number;
      let y: number;
      if (side === "lens") {
        // The far side of the disk, bent up over the top of the shadow.
        const lr = 1.18 + (rr - 1.6) * 0.32;
        x = Math.cos(a) * lr;
        y = -Math.abs(Math.sin(a)) * lr * 0.95 - 0.05;
      } else {
        x = Math.cos(a) * rr;
        y = sa * rr * flat;
      }
      const X = f.cx + (x * ct - y * st) * rs;
      const Y = f.cy + (x * st + y * ct) * rs;
      const alpha = Math.min(1, 0.18 * doppler * (0.4 + heat) * (side === "lens" ? 0.8 : 1));
      ctx.fillStyle = heat > 0.66 ? rgba(look.palette[2], alpha) : heat > 0.33 ? rgba(look.palette[1], alpha) : rgba(look.palette[0], alpha);
      const s = dot * (0.8 + heat);
      ctx.fillRect(X - s / 2, Y - s / 2, s, s);
    }
  };
  return {
    draw(ctx, f) {
      const rs = f.unit * (look.size ?? 0.18);
      // Stars on tight, fast orbits.
      ctx.globalCompositeOperation = "lighter";
      for (const s of stars) {
        const M = (((f.t / s.period + s.ph) % 1) * TAU);
        const E = kepler(M, s.e);
        const px = s.a * (Math.cos(E) - s.e);
        const py = s.a * Math.sqrt(1 - s.e * s.e) * Math.sin(E) * s.tilt;
        const cw = Math.cos(s.w);
        const sw = Math.sin(s.w);
        ctx.strokeStyle = "rgba(255,220,180,0.07)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(f.cx - s.a * s.e * cw * rs, f.cy - s.a * s.e * sw * rs, s.a * rs, s.a * Math.sqrt(1 - s.e * s.e) * s.tilt * rs, s.w, 0, TAU);
        ctx.stroke();
        drawStar(ctx, f.cx + (px * cw - py * sw) * rs, f.cy + (px * sw + py * cw) * rs, Math.max(1, rs * 0.025), "#ffe6c4", false);
      }
      drawGlow(ctx, look.palette[0], f.cx, f.cy, rs * 4.6, 0.25);
      disk(ctx, f, rs, "lens");
      disk(ctx, f, rs, "back");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(f.cx, f.cy, rs, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = rgba(look.palette[2], 0.85);
      ctx.lineWidth = Math.max(1, rs * 0.035);
      ctx.beginPath();
      ctx.arc(f.cx, f.cy, rs * 1.04, 0, TAU);
      ctx.stroke();
      disk(ctx, f, rs, "front");
      ctx.globalCompositeOperation = "source-over";
    },
  };
}

// ── Comet ────────────────────────────────────────────────────────────────────
function cometPainter(look: CosmosLook): Painter {
  const r = rng(look.seed);
  const dust = Array.from({ length: 900 }, () => ({ life: 3 + r() * 5, ph: r(), v: 0.06 + r() * 0.14, side: (r() - 0.5) * 0.06, curl: 0.004 + r() * 0.014, s: 1 + r() * 2.2 }));
  const ions = Array.from({ length: 46 }, () => ({ ang: (r() - 0.5) * 0.06, len: 0.6 + r() * 0.7, ph: r() * TAU, w: 0.6 + r() * 1.2 }));
  const shape = Array.from({ length: 14 }, () => 0.75 + r() * 0.5);
  return {
    draw(ctx, f) {
      const d = [0.84, 0.54];
      // Dust lags the comet's path and bends away from the straight ion tail.
      const p = [d[1], -d[0]];
      const nx = f.cx - f.unit * 0.3;
      const ny = f.cy - f.unit * 0.06;
      const L = f.unit;
      ctx.globalCompositeOperation = "lighter";
      for (const ion of ions) {
        const ca = Math.cos(ion.ang);
        const sa = Math.sin(ion.ang);
        const dx = d[0] * ca - d[1] * sa;
        const dy = d[0] * sa + d[1] * ca;
        const len = ion.len * L * (0.92 + 0.08 * Math.sin(f.t * 2 + ion.ph));
        const g = ctx.createLinearGradient(nx, ny, nx + dx * len, ny + dy * len);
        g.addColorStop(0, rgba(look.palette[2], 0.32));
        g.addColorStop(1, rgba(look.palette[2], 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = ion.w;
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(nx + dx * len, ny + dy * len);
        ctx.stroke();
      }
      ctx.fillStyle = rgba(look.palette[3], 0.6);
      for (const q of dust) {
        const age = (f.t / q.life + q.ph) % 1;
        const A = age * q.life;
        const along = q.v * A;
        const across = q.side * A + q.curl * A * A * 2.2;
        const x = nx + (d[0] * along + p[0] * across) * L;
        const y = ny + (d[1] * along + p[1] * across) * L;
        const s = q.s * (1 - age * 0.5);
        ctx.globalAlpha = 1 - age;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      drawGlow(ctx, "#9ff2d8", nx, ny, L * 0.16, 0.55);
      drawGlow(ctx, "#ffffff", nx, ny, L * 0.035, 0.9);
      ctx.globalCompositeOperation = "source-over";
      // The nucleus: a dark, lumpy rock lit from the sunward side.
      const R = L * (look.size ?? 0.05) * 0.35;
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate(f.t * 0.2 + f.spin);
      ctx.beginPath();
      shape.forEach((k, i) => {
        const a = (i / shape.length) * TAU;
        const x = Math.cos(a) * R * k * 1.3;
        const y = Math.sin(a) * R * k;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
      const g = ctx.createRadialGradient(-R * 0.5, -R * 0.5, 0, 0, 0, R * 1.4);
      g.addColorStop(0, look.palette[1]);
      g.addColorStop(1, look.palette[0]);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    },
  };
}

// ── Probe ────────────────────────────────────────────────────────────────────
function probePainter(look: CosmosLook): Painter {
  return {
    draw(ctx, f) {
      const S = f.unit * (look.size ?? 0.3);
      // The Sun: only a bright star now.
      ctx.globalCompositeOperation = "lighter";
      drawStar(ctx, f.cx - f.unit * 0.62, f.cy - f.unit * 0.38, Math.max(1.6, f.unit * 0.006), "#fff1c8");
      // Radio pulses home, toward the lower left.
      for (let k = 0; k < 3; k++) {
        const ph = (f.t * 0.25 + k / 3) % 1;
        ctx.strokeStyle = rgba("#9fd0ff", 0.28 * (1 - ph));
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(f.cx, f.cy, S * (0.9 + ph * 2.4), Math.PI * 0.62, Math.PI * 0.88);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.translate(f.cx + Math.sin(f.t * 0.13) * S * 0.08, f.cy + Math.cos(f.t * 0.11) * S * 0.06);
      ctx.rotate(Math.sin(f.t * 0.09) * 0.12 + f.spin);
      const line = (x1: number, y1: number, x2: number, y2: number, w: number, c: string) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x1 * S, y1 * S);
        ctx.lineTo(x2 * S, y2 * S);
        ctx.stroke();
      };
      const thin = Math.max(1, S * 0.012);
      // Long antennas and booms.
      line(0.05, 0.35, -2.4, 1.45, thin * 0.6, "rgba(200,206,212,0.55)");
      line(-0.05, 0.35, 1.7, 2.1, thin * 0.6, "rgba(200,206,212,0.45)");
      line(0, 0.3, -2.7, 0.75, thin, look.palette[1]);
      for (let k = 1; k <= 8; k++) line(-0.33 * k, 0.3 + 0.056 * k, -0.33 * k - 0.04, 0.3 + 0.056 * k - 0.05, thin * 0.8, look.palette[1]);
      line(0.1, 0.35, 1.45, 0.8, thin * 1.4, look.palette[1]);
      for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.translate((1.05 + k * 0.17) * S, (0.67 + k * 0.057) * S);
        ctx.rotate(0.32);
        ctx.fillStyle = "#3d4247";
        ctx.fillRect(-0.075 * S, -0.06 * S, 0.15 * S, 0.12 * S);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(-0.075 * S, -0.06 * S, 0.15 * S, 0.025 * S);
        ctx.restore();
      }
      line(-0.1, 0.35, -0.85, -0.95, thin * 1.4, look.palette[1]);
      ctx.fillStyle = "#6c7276";
      ctx.fillRect(-1.0 * S, -1.12 * S, 0.3 * S, 0.22 * S);
      ctx.fillStyle = "#1c2024";
      ctx.beginPath();
      ctx.arc(-0.92 * S, -1.0 * S, 0.05 * S, 0, TAU);
      ctx.fill();
      // The bus: ten sides of gold foil, and the record.
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        const x = Math.cos(a) * 0.34 * S;
        const y = 0.33 * S + Math.sin(a) * 0.17 * S;
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      const bus = ctx.createLinearGradient(-0.34 * S, 0, 0.34 * S, 0);
      bus.addColorStop(0, "#f2d07a");
      bus.addColorStop(1, "#6e5420");
      ctx.fillStyle = bus;
      ctx.fill();
      ctx.fillStyle = "#e0b34e";
      ctx.beginPath();
      ctx.ellipse(-0.06 * S, 0.37 * S, 0.1 * S, 0.06 * S, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(90,60,10,0.6)";
      ctx.lineWidth = 0.6;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(-0.06 * S, 0.37 * S, 0.025 * k * S, 0.015 * k * S, 0, 0, TAU);
        ctx.stroke();
      }
      // The dish.
      const dish = ctx.createRadialGradient(-0.3 * S, -0.2 * S, 0, 0, 0, S);
      dish.addColorStop(0, "#ffffff");
      dish.addColorStop(0.6, look.palette[0]);
      dish.addColorStop(1, "#5d6368");
      ctx.fillStyle = dish;
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.95 * S, 0.3 * S, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = thin;
      ctx.stroke();
      line(-0.5, -0.05, 0, -0.5, thin * 0.7, "rgba(220,224,228,0.8)");
      line(0.5, -0.05, 0, -0.5, thin * 0.7, "rgba(220,224,228,0.8)");
      line(0, 0.15, 0, -0.5, thin * 0.7, "rgba(220,224,228,0.8)");
      ctx.fillStyle = "#c8ccd0";
      ctx.fillRect(-0.05 * S, -0.58 * S, 0.1 * S, 0.1 * S);
      ctx.restore();
    },
  };
}

// ── Oort cloud ───────────────────────────────────────────────────────────────
function cloudPainter(look: CosmosLook): Painter {
  const r = rng(look.seed);
  const N = 3200;
  const pts = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const z = r() * 2 - 1;
    const t = r() * TAU;
    const s = Math.sqrt(1 - z * z);
    const inner = r() < 0.25;
    const rr = inner ? 0.18 + r() * 0.3 : 0.5 + 0.5 * r() ** 0.7;
    pts[i * 3] = s * Math.cos(t) * rr;
    pts[i * 3 + 1] = z * rr * (inner ? 0.35 : 1);
    pts[i * 3 + 2] = s * Math.sin(t) * rr;
  }
  return {
    draw(ctx, f) {
      const S = f.unit * (look.size ?? 0.46);
      const a = f.t * 0.035 + f.spin;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const tilt = 0.38;
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      const dot = Math.max(0.8, S / 300);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < N; i++) {
        const x = pts[i * 3];
        const y = pts[i * 3 + 1];
        const z = pts[i * 3 + 2];
        const x1 = x * ca + z * sa;
        const z1 = -x * sa + z * ca;
        const y1 = y * ct - z1 * st;
        const z2 = y * st + z1 * ct;
        const k = 1 / (1.6 - z2 * 0.35);
        ctx.fillStyle = i % 3 ? rgba(look.palette[0], 0.35 + 0.45 * (z2 + 1) / 2) : rgba(look.palette[1], 0.55 + 0.35 * (z2 + 1) / 2);
        const s = dot * (0.6 + (z2 + 1) * 0.5);
        ctx.fillRect(f.cx + x1 * S * k * 1.6 - s / 2, f.cy + y1 * S * k * 1.6 - s / 2, s, s);
      }
      // The Sun, a bright star in the middle, its planets a speck around it.
      drawStar(ctx, f.cx, f.cy, Math.max(1.6, S * 0.012), look.palette[3]);
      ctx.strokeStyle = "rgba(255,231,176,0.25)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.ellipse(f.cx, f.cy, S * 0.035, S * 0.035 * ct, 0, 0, TAU);
      ctx.stroke();
      // A long-period comet falling in toward the Sun.
      const ph = (f.t * 0.06) % 1;
      const ex = f.cx + Math.cos(2.4) * S * 1.2 * (1 - ph);
      const ey = f.cy + Math.sin(2.4) * S * 0.7 * (1 - ph);
      drawGlow(ctx, "#bfe8ff", ex, ey, S * 0.03, 0.8);
      ctx.strokeStyle = "rgba(191,232,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + (ex - f.cx) * 0.12 * ph, ey + (ey - f.cy) * 0.12 * ph);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    },
  };
}

// ── Contact binary ───────────────────────────────────────────────────────────
function binaryPainter(look: CosmosLook): Painter {
  const big = sizedSphere(makeSurface({ ...look, kind: "rocky", craters: 14 }), { pitch: 0.1 }, 300);
  const small = sizedSphere(makeSurface({ ...look, kind: "rocky", seed: look.seed + 1, craters: 10 }), { pitch: 0.1 }, 260);
  return {
    draw(ctx, f) {
      const R = f.unit * (look.size ?? 0.2);
      const phi = f.t * 0.16 + f.spin;
      const lobes = [
        { s: big, r: R, off: -0.62, rot: f.t * 0.16 },
        { s: small, r: R * 0.78, off: 0.78, rot: f.t * 0.16 + 2 },
      ].map((l) => ({ ...l, x: f.cx + Math.cos(phi) * l.off * R, depth: Math.sin(phi) * l.off }));
      lobes.sort((a, b) => a.depth - b.depth);
      for (const l of lobes) {
        const sp = l.s(l.r * 2 * Math.min(f.dpr, 1.5));
        sp.draw(l.rot);
        ctx.save();
        ctx.translate(l.x, f.cy);
        ctx.scale(1, 0.72);
        ctx.drawImage(sp.canvas, -l.r, -l.r, l.r * 2, l.r * 2);
        ctx.restore();
      }
    },
  };
}

export function buildPainter(look: CosmosLook, land: Float32Array | null): Painter {
  switch (look.kind) {
    case "nebula":
      return nebulaPainter(look);
    case "remnant":
      return remnantPainter(look);
    case "cluster":
      return clusterPainter(look);
    case "galaxy":
      return galaxyPainter(look);
    case "blackhole":
      return blackHolePainter(look);
    case "comet":
      return cometPainter(look);
    case "probe":
      return probePainter(look);
    case "cloud":
      return cloudPainter(look);
    case "binary-body":
      return binaryPainter(look);
    default:
      return bodyPainter(look, land);
  }
}

/** Painters that need the Earth's land dots before they can draw. */
export function needsLand(look: CosmosLook): boolean {
  return look.kind === "earth" || look.backdrop?.kind === "earth";
}
