import { Lock, Minus, Plus, Telescope } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampCosmos,
  COSMOS_MAX,
  COSMOS_MIN,
  COSMOS_ZONES,
  cosmosZone,
  formatCosmicDistance,
  LY_AU,
  type LatLng,
} from "@/lib/game";
import { rng } from "@/components/motion/cosmos-paint";
import { cn } from "@/lib/utils";

/**
 * The cosmos round's map: one line out from the Sun, on a log scale, from
 * inside Mercury's orbit to past Andromeda. Orbits, belts, the Oort cloud,
 * nearby stars and other galaxies drift along it, unlabelled; only the
 * neighbourhoods are named. Tap to place your guess, drag your pin to adjust,
 * scroll or pinch (or use + and −) to zoom in for a finer read.
 */

const FULL = { lo: COSMOS_MIN, hi: COSMOS_MAX };
const MIN_SPAN = 0.5;
const PLANETS = [0.387, 0.723, 1, 1.524, 5.2, 9.58, 19.19, 30.07].map(Math.log10);
const lg = Math.log10;

const TICKS: { v: number; label: string }[] = [
  { v: 0, label: "1 AU" },
  { v: 1, label: "10 AU" },
  { v: 2, label: "100 AU" },
  { v: 3, label: "1,000 AU" },
  { v: 4, label: "10,000 AU" },
  { v: lg(LY_AU), label: "1 light-year" },
  { v: lg(10 * LY_AU), label: "10 ly" },
  { v: lg(100 * LY_AU), label: "100 ly" },
  { v: lg(1_000 * LY_AU), label: "1,000 ly" },
  { v: lg(10_000 * LY_AU), label: "10,000 ly" },
  { v: lg(100_000 * LY_AU), label: "100,000 ly" },
  { v: lg(1e6 * LY_AU), label: "1 million ly" },
  { v: lg(1e7 * LY_AU), label: "10 million ly" },
];

type View = { lo: number; hi: number };

function readout(v: number) {
  return { primary: `${formatCosmicDistance(10 ** v)} from the Sun`, secondary: cosmosZone(v) };
}

export function CosmicRuler({
  guess,
  onGuess,
  disabled,
  truth,
  truthLabel,
  opponent,
  reveal,
  selfName = "You",
  reducedMotion,
  urgent,
  onLock,
  canLock,
}: {
  guess?: LatLng;
  onGuess: (g: LatLng) => void;
  disabled?: boolean;
  truth?: LatLng;
  truthLabel?: string;
  opponent?: { guess: LatLng; name: string } | null;
  reveal?: boolean;
  selfName?: string;
  reducedMotion?: boolean;
  urgent?: boolean;
  onLock?: () => void;
  canLock?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>(FULL);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [width, setWidth] = useState(0);
  const g = guess?.latitude;
  const gRef = useRef(g);
  gRef.current = g;

  const setClamped = useCallback((lo: number, hi: number) => {
    let span = Math.max(MIN_SPAN, Math.min(FULL.hi - FULL.lo, hi - lo));
    let a = lo;
    if (hi - lo !== span) a = (lo + hi) / 2 - span / 2;
    a = Math.max(FULL.lo, Math.min(FULL.hi - span, a));
    span = Math.min(span, FULL.hi - a);
    setView({ lo: a, hi: a + span });
  }, []);

  const zoomAt = useCallback(
    (center: number, factor: number) => {
      const { lo, hi } = viewRef.current;
      const span = (hi - lo) * factor;
      const k = (center - lo) / (hi - lo);
      setClamped(center - span * k, center - span * k + span);
    },
    [setClamped],
  );

  const xOf = useCallback((v: number) => ((v - view.lo) / (view.hi - view.lo)) * width, [view, width]);

  // Reveal: frame the answer and every guess, then let the motion settle.
  const truthV = truth?.latitude;
  const oppV = opponent?.guess.latitude;
  useEffect(() => {
    if (!reveal || truthV == null) {
      if (!reveal) setView(FULL);
      return;
    }
    const pts = [truthV, g, oppV].filter((v): v is number => v != null);
    const lo = Math.min(...pts);
    const hi = Math.max(...pts);
    const pad = Math.max(0.35, (hi - lo) * 0.28);
    const target = { lo: lo - pad, hi: hi + pad };
    if (reducedMotion) {
      setClamped(target.lo, target.hi);
      return;
    }
    const from = viewRef.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      const e = 1 - (1 - k) ** 3;
      setClamped(from.lo + (target.lo - from.lo) * e, from.hi + (target.hi - from.hi) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, truthV, oppV]);

  // The living ruler: orbits with their planets, glittering belts, the haze
  // of the Oort cloud, nearby stars, the Milky Way and galaxies beyond.
  const scenery = useMemo(() => {
    const r = rng(4242);
    const belt = (from: number, to: number, n: number) =>
      Array.from({ length: n }, () => ({ v: lg(from) + r() * (lg(to) - lg(from)), y: r(), ph: r() * 6.3, s: 0.6 + r() }));
    return {
      asteroids: belt(2.1, 3.3, 140),
      kuiper: belt(30, 55, 160),
      oort: belt(2_000, 100_000, 160),
      stars: Array.from({ length: 26 }, () => ({ v: lg((3.5 + r() ** 1.6 * 900) * LY_AU), y: 0.15 + r() * 0.7, s: 0.8 + r() * 1.6, ph: r() * 6.3 })),
      galaxies: Array.from({ length: 16 }, () => ({ v: 9.75 + r() * 1.9, y: 0.2 + r() * 0.6, s: 2 + r() * 4, rot: r() * 3 })),
      milky: belt(80 * LY_AU, 90_000 * LY_AU, 380),
    };
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    const canvas = canvasRef.current;
    if (!track || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let visible = true;
    const start = performance.now();
    const draw = (now: number) => {
      const w = track.clientWidth;
      const h = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const t = reducedMotion ? 4 : (now - start) / 1000;
      const { lo, hi } = viewRef.current;
      const X = (v: number) => ((v - lo) / (hi - lo)) * w;
      const ppd = w / (hi - lo); // px per decade
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const mid = h / 2;

      // The Sun's light, fading out along the line.
      const sunX = X(COSMOS_MIN - 0.5);
      const sun = ctx.createRadialGradient(sunX, mid, 0, sunX, mid, Math.max(40, ppd * 1.4));
      sun.addColorStop(0, "rgba(255,214,140,0.9)");
      sun.addColorStop(0.35, "rgba(255,170,80,0.25)");
      sun.addColorStop(1, "rgba(255,170,80,0)");
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, w, h);

      // Milky Way and the Oort cloud as soft bands.
      const band = (from: number, to: number, color: string, a: number) => {
        const x1 = X(from);
        const x2 = X(to);
        if (x2 < 0 || x1 > w) return;
        const gr = ctx.createLinearGradient(x1, 0, x2, 0);
        gr.addColorStop(0, `rgba(${color},0)`);
        gr.addColorStop(0.3, `rgba(${color},${a})`);
        gr.addColorStop(0.7, `rgba(${color},${a})`);
        gr.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = gr;
        ctx.fillRect(Math.max(0, x1), mid - h * 0.32, Math.min(w, x2) - Math.max(0, x1), h * 0.64);
      };
      band(lg(1_500), lg(150_000), "140,190,255", 0.09);
      band(lg(60 * LY_AU), lg(100_000 * LY_AU), "220,200,255", 0.11);

      ctx.globalCompositeOperation = "lighter";
      const dots = (list: { v: number; y: number; ph: number; s: number }[], color: string, amp: number) => {
        ctx.fillStyle = color;
        for (const d of list) {
          const x = X(d.v);
          if (x < -2 || x > w + 2) continue;
          const y = mid + (d.y - 0.5) * h * amp + Math.sin(t * 0.8 + d.ph) * 1.5;
          ctx.globalAlpha = 0.45 + 0.4 * Math.sin(t * 1.6 + d.ph * 2);
          ctx.fillRect(x - d.s / 2, y - d.s / 2, d.s, d.s);
        }
        ctx.globalAlpha = 1;
      };
      dots(scenery.asteroids, "#d9c7a8", 0.5);
      dots(scenery.kuiper, "#a9c8e8", 0.6);
      dots(scenery.oort, "#cfe2ff", 0.85);
      dots(scenery.milky, "#e8dcff", 0.55);

      // Orbits: gentle arcs (as if centred on the Sun far to the left), each
      // with its planet sliding along it.
      PLANETS.forEach((v, i) => {
        const x = X(v);
        if (x < -4 || x > w + 4) return;
        const R = 900;
        ctx.strokeStyle = "rgba(216,243,106,0.28)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const half = Math.asin(Math.min(1, (h * 0.44) / R));
        ctx.arc(x - R, mid, R, -half, half);
        ctx.stroke();
        const period = 6 * (10 ** v) ** 0.5;
        const a = Math.sin((t / period) * 6.283 + i * 1.3) * half * 0.92;
        const px = x - R + Math.cos(a) * R;
        const py = mid + Math.sin(a) * R;
        ctx.fillStyle = "#f3f7dc";
        ctx.beginPath();
        ctx.arc(px, py, i < 4 ? 1.6 : 2.4, 0, 6.283);
        ctx.fill();
      });

      for (const s of scenery.stars) {
        const x = X(s.v);
        if (x < -6 || x > w + 6) continue;
        const y = mid + (s.y - 0.5) * h * 0.8;
        const tw = 0.6 + 0.4 * Math.sin(t * 2 + s.ph);
        const gl = ctx.createRadialGradient(x, y, 0, x, y, s.s * 3);
        gl.addColorStop(0, `rgba(255,250,235,${0.9 * tw})`);
        gl.addColorStop(1, "rgba(255,250,235,0)");
        ctx.fillStyle = gl;
        ctx.fillRect(x - s.s * 3, y - s.s * 3, s.s * 6, s.s * 6);
      }
      for (const gx of scenery.galaxies) {
        const x = X(gx.v);
        if (x < -10 || x > w + 10) continue;
        const y = mid + (gx.y - 0.5) * h * 0.7;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(gx.rot + t * 0.05);
        ctx.scale(1, 0.45);
        const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, gx.s * 2);
        gl.addColorStop(0, "rgba(255,236,210,0.8)");
        gl.addColorStop(1, "rgba(180,190,255,0)");
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.arc(0, 0, gx.s * 2, 0, 6.283);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation = "source-over";

      // The line itself.
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();

      if (!reducedMotion && visible) raf = requestAnimationFrame(draw);
    };
    const kick = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    const ro = new ResizeObserver(() => {
      setWidth(track.clientWidth);
      kick();
    });
    ro.observe(track);
    const io = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
      if (visible) kick();
    });
    io.observe(track);
    track.addEventListener("ruler-redraw", kick);
    setWidth(track.clientWidth);
    kick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      track.removeEventListener("ruler-redraw", kick);
    };
  }, [reducedMotion, scenery]);

  useEffect(() => {
    if (reducedMotion) trackRef.current?.dispatchEvent(new Event("ruler-redraw"));
  }, [view, reducedMotion]);

  // Pointer: tap places, dragging the pin moves it, dragging elsewhere pans.
  const drag = useRef<{ id: number; x: number; lo: number; hi: number; mode: "pin" | "pan" | "tap" } | null>(null);
  const pinch = useRef<{ d: number; ids: number[] } | null>(null);
  const pointers = useRef(new Map<number, number>());
  const valueAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const { lo, hi } = viewRef.current;
    return clampCosmos(lo + ((clientX - rect.left) / rect.width) * (hi - lo));
  };
  const place = (v: number) => {
    if (disabled || reveal) return;
    onGuess({ latitude: Math.round(v * 1000) / 1000, longitude: 0 });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, e.clientX);
    if (pointers.current.size === 2) {
      const xs = [...pointers.current.values()];
      pinch.current = { d: Math.abs(xs[0] - xs[1]), ids: [...pointers.current.keys()] };
      drag.current = null;
      return;
    }
    const rect = el.getBoundingClientRect();
    const near = gRef.current != null && Math.abs(xOf(gRef.current) - (e.clientX - rect.left)) < 22;
    drag.current = { id: e.pointerId, x: e.clientX, lo: view.lo, hi: view.hi, mode: near && !disabled && !reveal ? "pin" : "tap" };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, e.clientX);
    const p = pinch.current;
    if (p && pointers.current.size === 2) {
      const xs = p.ids.map((id) => pointers.current.get(id) ?? 0);
      const d = Math.abs(xs[0] - xs[1]);
      if (p.d > 8 && d > 8) zoomAt(valueAt((xs[0] + xs[1]) / 2), p.d / d);
      p.d = d;
      return;
    }
    const dr = drag.current;
    if (!dr || dr.id !== e.pointerId) return;
    if (dr.mode === "pin") {
      place(valueAt(e.clientX));
      return;
    }
    if (dr.mode === "tap" && Math.abs(e.clientX - dr.x) > 6) dr.mode = "pan";
    if (dr.mode === "pan") {
      const span = dr.hi - dr.lo;
      const dv = ((e.clientX - dr.x) / Math.max(1, width)) * span;
      setClamped(dr.lo - dv, dr.hi - dv);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const dr = drag.current;
    if (dr && dr.id === e.pointerId && dr.mode === "tap") place(valueAt(e.clientX));
    if (dr?.id === e.pointerId) drag.current = null;
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(valueAt(e.clientX), Math.exp(e.deltaY * 0.0016));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoomAt]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || reveal) return;
    const step = e.shiftKey ? 0.2 : 0.02;
    const cur = g ?? (view.lo + view.hi) / 2;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") place(clampCosmos(cur + step));
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") place(clampCosmos(cur - step));
    else if (e.key === "Home") place(COSMOS_MIN);
    else if (e.key === "End") place(COSMOS_MAX);
    else if (e.key === "+" || e.key === "=" || e.key === "PageUp") zoomAt(cur, 0.6);
    else if (e.key === "-" || e.key === "PageDown") zoomAt(cur, 1 / 0.6);
    else if ((e.key === "Enter" || e.key === " ") && g == null) place(cur);
    else return;
    e.preventDefault();
    if (e.key === "Enter" && g == null) e.stopPropagation();
  };

  const zoomed = view.hi - view.lo < FULL.hi - FULL.lo - 0.01;
  const span = view.hi - view.lo;
  const ticks = useMemo(() => {
    const out = TICKS.filter((t) => t.v >= view.lo - 0.01 && t.v <= view.hi + 0.01);
    if (span < 3) {
      for (let d = Math.floor(view.lo); d <= Math.ceil(view.hi); d++)
        for (const m of [2, 5]) {
          const v = d + lg(m);
          if (v > view.lo && v < view.hi) out.push({ v, label: formatCosmicDistance(10 ** v).replace(" light-years", " ly") });
        }
    }
    // Keep labels from colliding: drop any that would touch the last one.
    let lastX = -Infinity;
    return out
      .sort((a, b) => a.v - b.v)
      .filter((t) => {
        const x = ((t.v - view.lo) / span) * width;
        if (x - lastX < t.label.length * 5.4 + 14) return false;
        lastX = x;
        return true;
      });
  }, [view.lo, view.hi, span, width]);
  const zones = COSMOS_ZONES.map((z) => {
    const a = Math.max(view.lo, z.from);
    const b = Math.min(view.hi, z.to);
    // Too narrow to name on this screen: the ticks still say where it is.
    if (xOf(b) - xOf(a) < 34) return null;
    // Keep the label on the ruler: names near an edge slide inward.
    const zw = xOf(b) - xOf(a) - 6;
    const half = Math.min(zw, z.name.length * 6.4) / 2;
    const x = Math.max(half + 4, Math.min(width - half - 4, xOf((a + b) / 2)));
    return { name: z.name, x, w: zw + 6 };
  }).filter((z): z is { name: string; x: number; w: number } => Boolean(z));

  const pin = (v: number, kind: "self" | "opp" | "truth", label: string) => {
    const x = xOf(v);
    if (x < -30 || x > width + 30) return null;
    return (
      <div key={kind} className={cn("ruler-pin", `is-${kind}`, reveal && "is-reveal")} style={{ left: x }}>
        <span className="ruler-pin-label">{label}</span>
      </div>
    );
  };

  const missLo = reveal && truthV != null && g != null ? Math.min(truthV, g) : null;
  const missHi = reveal && truthV != null && g != null ? Math.max(truthV, g) : null;
  const read = g != null ? readout(g) : null;

  return (
    <div
      className={cn(
        "cosmos-dock absolute inset-x-3 bottom-3 z-20 flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border shadow-[var(--shadow-panel)] max-sm:bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
        reveal ? "is-reveal z-30 h-[var(--atlas-map-reveal-h)]" : "h-[var(--atlas-map-h)]",
        urgent && !reveal && "atlas-map-urgent",
      )}
    >
      <div className="map-dock-bar is-top">
        <Telescope className="ml-1.5 size-4 shrink-0 text-accent" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-xs font-medium uppercase tracking-wider text-muted">
          {reveal ? "From the Sun" : "Where in the universe?"}
        </p>
        <button
          type="button"
          className="map-tool hit-44"
          aria-label="Zoom out"
          title="Zoom out ( − )"
          disabled={!zoomed}
          onClick={() => zoomAt(g ?? (view.lo + view.hi) / 2, 1 / 0.55)}
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          className="map-tool hit-44"
          aria-label="Zoom in"
          title="Zoom in ( + )"
          disabled={span <= MIN_SPAN + 0.01}
          onClick={() => zoomAt(g ?? (view.lo + view.hi) / 2, 0.55)}
        >
          <Plus className="size-4" />
        </button>
        {zoomed && (
          <button
            type="button"
            className="ruler-fit hit-44"
            aria-label="Show the whole universe"
            title="Show the whole universe"
            onClick={() => setView(FULL)}
          >
            All
          </button>
        )}
      </div>

      <div className="ruler-body relative min-h-0 flex-1">
        <div className="ruler-zones" aria-hidden>
          {zones.map((z) => (
            <span key={z.name} style={{ left: z.x, maxWidth: z.w - 6 }}>
              {z.name}
            </span>
          ))}
        </div>
        <div
          ref={trackRef}
          className={cn("ruler-track", !disabled && !reveal && "is-live")}
          role="slider"
          tabIndex={0}
          aria-label="Distance from the Sun. Arrow keys move your guess, shift for bigger steps, plus and minus zoom, Enter locks."
          aria-valuemin={COSMOS_MIN}
          aria-valuemax={COSMOS_MAX}
          aria-valuenow={g ?? undefined}
          aria-valuetext={read ? `${read.primary}, ${read.secondary}` : "No guess yet"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
          {missLo != null && missHi != null && (
            <i className="ruler-miss" style={{ left: xOf(missLo), width: Math.max(2, xOf(missHi) - xOf(missLo)) }} aria-hidden />
          )}
          {reveal && truthV != null && pin(truthV, "truth", truthLabel ?? "Answer")}
          {reveal && oppV != null && pin(oppV, "opp", opponent?.name ?? "Opponent")}
          {g != null && pin(g, "self", reveal ? selfName : "Your guess")}
        </div>
        <div className="ruler-ticks" aria-hidden>
          {ticks.map((t) => (
            <span key={t.label + t.v} style={{ left: xOf(t.v) }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {!reveal && onLock && (
        <div className={cn("map-dock-bar is-bottom", canLock && "is-armed")}>
          <div className="flex min-w-0 flex-1 items-center gap-2" aria-live="polite">
            {read ? (
              <span className="min-w-0 text-xs leading-tight">
                <span className="map-readout block truncate font-medium text-fg">≈ {read.primary}</span>
                <span className="block truncate text-[10px] uppercase tracking-wider text-muted">{read.secondary}</span>
              </span>
            ) : (
              <span className="truncate text-xs text-muted">Tap the line to guess</span>
            )}
          </div>
          <button
            type="button"
            disabled={!canLock}
            onClick={onLock}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-4 text-sm font-semibold text-accent-fg transition-[opacity,transform] active:scale-[.97] disabled:opacity-35",
              canLock && "atlas-lock-ready",
            )}
          >
            <Lock className="size-4" />
            Lock guess
          </button>
        </div>
      )}
    </div>
  );
}
