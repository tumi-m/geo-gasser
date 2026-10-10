import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { loadGlobeDots } from "./globe-dots-data";

/**
 * A dotted Earth on a 2D canvas: ~2,400 land dots in orthographic projection,
 * an atmosphere rim, glowing places that pulse, and arcs that fly between
 * them with a comet at the tip. No WebGL and no texture: it costs one small
 * data chunk (loaded on demand) and stops drawing when off screen.
 *
 * It never knows an answer: callers point it at an atlas (South Africa ×
 * Netherlands, the world), never at a question.
 */

export interface GlobePlace {
  lat: number;
  lon: number;
  color: string;
  /** Dots within this many degrees take the colour too. */
  halo?: number;
}

const DEG = Math.PI / 180;

function angleDiff(a: number, b: number) {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** Great-circle interpolation between two lat/lon points (degrees). */
function slerp(a: GlobePlace, b: GlobePlace, t: number): [number, number] {
  const [la1, lo1, la2, lo2] = [a.lat * DEG, a.lon * DEG, b.lat * DEG, b.lon * DEG];
  const p1 = [Math.cos(la1) * Math.cos(lo1), Math.cos(la1) * Math.sin(lo1), Math.sin(la1)];
  const p2 = [Math.cos(la2) * Math.cos(lo2), Math.cos(la2) * Math.sin(lo2), Math.sin(la2)];
  const dot = Math.min(1, Math.max(-1, p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2]));
  const w = Math.acos(dot);
  if (w < 1e-6) return [a.lat, a.lon];
  const s1 = Math.sin((1 - t) * w) / Math.sin(w);
  const s2 = Math.sin(t * w) / Math.sin(w);
  const x = s1 * p1[0] + s2 * p2[0];
  const y = s1 * p1[1] + s2 * p2[1];
  const z = s1 * p1[2] + s2 * p2[2];
  return [Math.atan2(z, Math.hypot(x, y)) / DEG, Math.atan2(y, x) / DEG];
}

export function DotGlobe({
  className,
  focus,
  places = [],
  arcs = [],
  spin = 7,
  tilt = 18,
  reducedMotion,
}: {
  className?: string;
  /** Turn to face this point; without it the globe keeps spinning. */
  focus?: { lat: number; lon: number };
  places?: GlobePlace[];
  /** Pairs of indexes into `places` to fly between, in turn. */
  arcs?: [number, number][];
  /** Degrees per second while spinning. */
  spin?: number;
  tilt?: number;
  reducedMotion?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ focus, places, arcs, spin, tilt, reducedMotion });
  propsRef.current = { focus, places, arcs, spin, tilt, reducedMotion };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let dots: Float32Array | null = null;
    let frame = 0;
    let visible = true;
    let size = { w: 0, h: 0, dpr: 1 };
    // View: centre longitude / latitude, eased toward the focus.
    const view = {
      lon: propsRef.current.focus?.lon ?? 10,
      lat: propsRef.current.focus?.lat ?? propsRef.current.tilt,
    };
    let last = performance.now();
    const start = last;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = { w: r.width, h: r.height, dpr };
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
    };

    const draw = (now: number) => {
      const p = propsRef.current;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const still = Boolean(p.reducedMotion);
      if (p.focus) {
        const k = still ? 1 : 1 - Math.exp(-dt * 2.4);
        view.lon += angleDiff(view.lon, p.focus.lon) * k;
        view.lat += (p.focus.lat * 0.6 - view.lat) * k;
      } else if (!still) {
        view.lon += p.spin * dt;
        view.lat += (p.tilt - view.lat) * (1 - Math.exp(-dt * 2));
      }
      const { w, h, dpr } = size;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.44;
      const cx = w / 2;
      const cy = h / 2;
      const l0 = view.lon * DEG;
      const p0 = view.lat * DEG;
      const sinP0 = Math.sin(p0);
      const cosP0 = Math.cos(p0);
      const project = (lat: number, lon: number, lift = 0): [number, number, number] => {
        const cl = Math.cos(lat);
        const dl = lon - l0;
        const x = cl * Math.sin(dl);
        const y = cosP0 * Math.sin(lat) - sinP0 * cl * Math.cos(dl);
        const z = sinP0 * Math.sin(lat) + cosP0 * cl * Math.cos(dl);
        const r = R * (1 + lift);
        return [cx + r * x, cy - r * y, z];
      };

      // A technical drawing, not a planet: the outline is a hairline, the land
      // is dots of ink, and the places in play are the one accent. Colours
      // come from the page's own tokens (black on the white documents).
      const css = getComputedStyle(canvas);
      const ink = css.getPropertyValue("--color-fg").trim() || "#000";
      const accent = css.getPropertyValue("--color-accent").trim() || "#ff5500";
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // Land.
      if (dots) {
        const halos = p.places
          .filter((pl) => pl.halo)
          .map((pl) => ({
            lat: pl.lat * DEG,
            lon: pl.lon * DEG,
            r: Math.cos((pl.halo ?? 0) * DEG),
          }));
        const dotR = Math.max(0.9, R / 150);
        for (let i = 0; i < dots.length; i += 2) {
          const lat = dots[i];
          const lon = dots[i + 1];
          const [x, y, z] = project(lat, lon);
          if (z <= 0.02) continue;
          let color = ink;
          for (const hl of halos) {
            const c =
              Math.sin(lat) * Math.sin(hl.lat) +
              Math.cos(lat) * Math.cos(hl.lat) * Math.cos(lon - hl.lon);
            if (c > hl.r) color = accent;
          }
          ctx.globalAlpha = 0.12 + 0.68 * z;
          ctx.fillStyle = color;
          const d = dotR * (0.55 + 0.45 * z) * 1.6;
          ctx.fillRect(x - d / 2, y - d / 2, d, d);
        }
        ctx.globalAlpha = 1;
      }

      // rAF stamps can trail the performance.now() we started from.
      const t = Math.max(0, (now - start) / 1000);
      // Arcs: one at a time, rising off the surface, a comet at the tip.
      if (p.arcs.length && !still) {
        const per = 2.6;
        const n = Math.floor(t / per);
        const k = (t % per) / per;
        const [ai, bi] = p.arcs[n % p.arcs.length];
        const a = p.places[ai];
        const b = p.places[bi];
        if (a && b) {
          const grow = Math.min(1, k / 0.6);
          const fade = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
          ctx.lineWidth = Math.max(1.2, R / 110);
          ctx.globalAlpha = fade;
          ctx.strokeStyle = accent;
          ctx.beginPath();
          let head: [number, number, number] | null = null;
          const steps = 48;
          for (let s = 0; s <= steps * grow; s++) {
            const u = s / steps;
            const [la, lo] = slerp(a, b, u);
            const pt = project(la * DEG, lo * DEG, 0.16 * Math.sin(Math.PI * u));
            if (s === 0) ctx.moveTo(pt[0], pt[1]);
            else ctx.lineTo(pt[0], pt[1]);
            head = pt;
          }
          ctx.stroke();
          if (head && grow < 1) {
            const q = Math.max(4, R / 40);
            ctx.fillStyle = accent;
            ctx.fillRect(head[0] - q / 2, head[1] - q / 2, q, q);
          }
          ctx.globalAlpha = 1;
        }
      }

      // Places: a square marker in a hairline frame.
      for (const pl of p.places) {
        const [x, y, z] = project(pl.lat * DEG, pl.lon * DEG);
        if (z <= 0.05) continue;
        const q = Math.max(4, R / 30);
        ctx.globalAlpha = z;
        ctx.fillStyle = accent;
        ctx.fillRect(x - q / 2, y - q / 2, q, q);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - q, y - q, q * 2, q * 2);
      }
      ctx.globalAlpha = 1;

      if (!still && visible) frame = requestAnimationFrame(draw);
    };

    const kick = () => {
      cancelAnimationFrame(frame);
      last = performance.now();
      frame = requestAnimationFrame(draw);
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      kick();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting) && !document.hidden;
      if (visible) kick();
    });
    io.observe(canvas);
    const onVis = () => {
      visible = !document.hidden;
      if (visible) kick();
    };
    document.addEventListener("visibilitychange", onVis);
    canvas.addEventListener("globe-redraw", kick);
    let alive = true;
    void loadGlobeDots().then((d) => {
      if (!alive) return;
      dots = d;
      kick();
    });
    kick();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("globe-redraw", kick);
    };
  }, []);

  // Redraw once when a still globe's inputs change.
  useEffect(() => {
    if (!reducedMotion) return;
    canvasRef.current?.dispatchEvent(new Event("globe-redraw"));
  }, [reducedMotion, focus?.lat, focus?.lon]);

  return <canvas ref={canvasRef} className={cn("dot-globe", className)} aria-hidden />;
}
