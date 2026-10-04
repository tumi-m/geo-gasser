import { useEffect, useRef, useState } from "react";
import type { CosmosLook } from "@/lib/game/cosmos";
import { cn } from "@/lib/utils";
import { rgba, rng } from "./cosmos-paint";
import { buildPainter, needsLand, type Painter } from "./cosmos-painters";
import { loadGlobeDots } from "./globe-dots-data";

/**
 * The cosmos round's scene: a place in our universe drawn live. Stars drift
 * with depth, the view warps in when a question opens, and you can drag to
 * turn the world (or galaxy) and scroll or pinch to zoom. Reduced motion
 * draws one settled frame and redraws only when you move it.
 */
export function CosmosScene({
  look,
  clue,
  reducedMotion,
  interactive = true,
  className,
}: {
  look: CosmosLook;
  clue?: string;
  reducedMotion?: boolean;
  interactive?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ spin: 0, vel: 0, zoom: 1 });
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const [hint, setHint] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setHint(false), 5200);
    return () => window.clearTimeout(id);
  }, [look.seed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    view.current = { spin: 0, vel: 0, zoom: 1 };
    let painter: Painter | null = null;
    let alive = true;
    let frame = 0;
    let visible = true;
    let size = { w: 0, h: 0, dpr: 1 };
    const start = performance.now();
    let last = start;

    // The sky: depth-sorted stars with their own colour and twinkle.
    const r = rng(look.seed * 31 + 7);
    const dense = look.kind === "galaxy" || look.kind === "blackhole" || look.kind === "nebula" ? 1.6 : 1;
    const warm = look.kind === "blackhole";
    const stars = Array.from({ length: Math.round(520 * dense) }, () => ({
      x: r(),
      y: r(),
      z: 0.15 + r() * 0.85,
      tw: r() * Math.PI * 2,
      c: warm ? (r() < 0.6 ? "#ffd6a8" : "#ffffff") : r() < 0.15 ? "#bcd4ff" : r() < 0.25 ? "#ffe2b8" : "#ffffff",
    }));
    const tint = look.palette[Math.min(1, look.palette.length - 1)];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };

    const draw = (now: number) => {
      const still = Boolean(reducedRef.current);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const v = view.current;
      if (!still) {
        v.spin += v.vel * dt;
        v.vel *= Math.exp(-dt * 2.2);
      }
      const t = still ? 8 : Math.max(0, (now - start) / 1000);
      const { w, h, dpr } = size;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = ctx.createRadialGradient(w * 0.55, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
      bg.addColorStop(0, "#0d1422");
      bg.addColorStop(0.55, "#070b14");
      bg.addColorStop(1, "#03050a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      // A faint wash of the target's colour, like light scattered in the lens.
      const wash = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.6);
      wash.addColorStop(0, rgba(tint, 0.07));
      wash.addColorStop(1, rgba(tint, 0));
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);

      // Arrival: for the first second the stars streak past, then settle.
      const intro = still ? 1 : Math.min(1, t / 1.15);
      const warp = (1 - intro) ** 2;
      const ease = 1 - (1 - intro) ** 3;
      const drift = t * 6;
      const cx = w / 2;
      const cy = h / 2;
      for (const s of stars) {
        let x = (s.x * w + drift * s.z + v.spin * 40 * s.z) % w;
        if (x < 0) x += w;
        const y = s.y * h;
        const tw = still ? 0.8 : 0.65 + 0.35 * Math.sin(t * (1 + s.z * 2) + s.tw);
        ctx.fillStyle = s.c;
        ctx.globalAlpha = (0.25 + 0.75 * s.z) * tw;
        if (warp > 0.01) {
          const dx = x - cx;
          const dy = y - cy;
          const k = warp * 0.45 * s.z;
          ctx.strokeStyle = s.c;
          ctx.lineWidth = s.z * 1.4;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - dx * k, y - dy * k);
          ctx.stroke();
        } else {
          const sz = s.z > 0.85 ? 1.8 : s.z > 0.5 ? 1.2 : 0.8;
          ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        }
      }
      ctx.globalAlpha = 1;

      if (painter) {
        const unit = Math.min(w, h * 1.25) * v.zoom * (0.78 + 0.22 * ease);
        ctx.globalAlpha = Math.min(1, intro * 1.6);
        painter.draw(ctx, { w, h, cx, cy, unit, t, spin: v.spin, dpr });
        ctx.globalAlpha = 1;
      }
      if (!still && visible && alive) frame = requestAnimationFrame(draw);
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
    canvas.addEventListener("cosmos-redraw", kick);

    // Textures take a few milliseconds; paint the sky first, then the target.
    const ready = needsLand(look) ? loadGlobeDots() : Promise.resolve(null);
    void ready
      .catch(() => null)
      .then((land) => {
        if (!alive) return;
        painter = buildPainter(look, land);
        kick();
      });
    kick();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("cosmos-redraw", kick);
    };
    // The look is fixed for a question; its seed identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look.seed, look.kind]);

  // Dragging turns, scrolling and pinching zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let lastX = 0;
    let lastT = 0;
    const redraw = () => canvas.dispatchEvent(new Event("cosmos-redraw"));
    const down = (e: PointerEvent) => {
      if (!interactiveRef.current) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      lastX = e.clientX;
      lastT = performance.now();
      view.current.vel = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
      setHint(false);
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const v = view.current;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) v.zoom = Math.max(0.6, Math.min(2.6, v.zoom * (d / pinch)));
        pinch = d;
      } else {
        const dx = e.clientX - lastX;
        const now = performance.now();
        const unit = Math.max(120, Math.min(canvas.clientWidth, canvas.clientHeight) * 0.35);
        v.spin += dx / unit;
        v.vel = (dx / unit / Math.max(8, now - lastT)) * 1000 * 0.6;
        lastX = e.clientX;
        lastT = now;
      }
      if (reducedRef.current) redraw();
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (reducedRef.current) view.current.vel = 0;
    };
    const wheel = (e: WheelEvent) => {
      if (!interactiveRef.current) return;
      e.preventDefault();
      const v = view.current;
      v.zoom = Math.max(0.6, Math.min(2.6, v.zoom * Math.exp(-e.deltaY * 0.0015)));
      setHint(false);
      if (reducedRef.current) redraw();
    };
    const dbl = () => {
      view.current.zoom = 1;
      if (reducedRef.current) redraw();
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("dblclick", dbl);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("dblclick", dbl);
    };
  }, []);

  useEffect(() => {
    canvasRef.current?.dispatchEvent(new Event("cosmos-redraw"));
  }, [reducedMotion]);

  const onKey = (e: React.KeyboardEvent) => {
    const v = view.current;
    if (e.key === "ArrowLeft") v.spin -= 0.25;
    else if (e.key === "ArrowRight") v.spin += 0.25;
    else if (e.key === "+" || e.key === "=") v.zoom = Math.min(2.6, v.zoom * 1.15);
    else if (e.key === "-") v.zoom = Math.max(0.6, v.zoom / 1.15);
    else return;
    e.preventDefault();
    canvasRef.current?.dispatchEvent(new Event("cosmos-redraw"));
  };

  return (
    <div className={cn("cosmos-scene absolute inset-0 overflow-hidden bg-[#03050a]", className)}>
      <canvas
        ref={canvasRef}
        className={cn("absolute inset-0 h-full w-full touch-none", interactive && "cursor-grab active:cursor-grabbing")}
        role="img"
        aria-label="A place in our universe to identify. Drag to turn it, scroll or pinch to zoom."
        tabIndex={interactive ? 0 : -1}
        onKeyDown={onKey}
      />
      {clue && (
        <figure className="cosmos-clue">
          <figcaption>Field notes</figcaption>
          <p>{clue}</p>
        </figure>
      )}
      {interactive && (
        <p className={cn("cosmos-hint", !hint && "is-gone")} aria-hidden>
          Drag to turn · scroll to zoom
        </p>
      )}
    </div>
  );
}
