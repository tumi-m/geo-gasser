import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Maximize,
  Minimize,
  Minus,
  MoveHorizontal,
  MoveVertical,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  PITCH_SPAN,
  resolveWikiImage,
  responsiveSceneSrcSet,
  sceneOffset,
  sceneOverhang,
  fitScale,
  YAW_SPAN,
} from "@/lib/game";
import { cn } from "@/lib/utils";

type Probe = {
  getYaw: () => number;
  getSpeed: () => number;
  setKeys?: (codes: string[]) => void;
  setSteer?: (v: number) => void;
};

declare global {
  interface Window {
    __controlsTest?: Probe;
  }
}

const LOOK_RATE = 1.65;
const ZOOM_RATE = 0.85;
const ZOOM_MIN = 1.0;
const ZOOM_MAX = 2.8;
const ZOOM_START = 1.0;
/** The look-around sweep that shows a new plate reaches past the frame. */
const SWEEP_MS = 3400;
const SWEEP_AFTER_MS = 500;
/** A double tap zooms to this, centred where you tapped; again zooms out. */
const TAP_ZOOM = 2.2;
const TWEEN_MS = 280;

type Tween = { t0: number; from: [number, number, number]; to: [number, number, number] };

function typingTarget(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    node.isContentEditable ||
    !!node.closest(".leaflet-container, button, [role=dialog]")
  );
}

/** Crop (0–1) that filling the frame would cost; below this, fill. */
const FILL_WHEN_CROP_BELOW = 0.1;

function effectiveFit(
  fit: "cover" | "contain",
  natural: { w: number; h: number } | null,
  box: { w: number; h: number } | null,
): "cover" | "contain" {
  if (fit === "cover" || !natural || !box || !natural.h || !box.h) return fit;
  const photo = natural.w / natural.h;
  const frame = box.w / box.h;
  const crop = 1 - Math.min(photo, frame) / Math.max(photo, frame);
  return crop < FILL_WHEN_CROP_BELOW ? "cover" : "contain";
}

/**
 * GeoGuessr-style inspect for still plates: drag to look, WASD to pan/zoom,
 * wheel / pinch to close in on a clue. Not live Street View — the photo is
 * the scene, overscaled so you can actually look around it.
 */
export function SceneExplorer({
  src,
  alt,
  fallbacks,
  sourceUrl,
  title,
  reducedMotion,
  fit = "contain",
  showHints = true,
  onToggleFit,
  interactive = true,
  onReady,
  onError,
}: {
  src: string;
  alt: string;
  fallbacks?: string[];
  sourceUrl?: string;
  title?: string;
  reducedMotion?: boolean;
  fit?: "cover" | "contain";
  showHints?: boolean;
  onToggleFit?: () => void;
  interactive?: boolean;
  onReady?: () => void;
  onError?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const sim = useRef({
    yaw: 0,
    pitch: 0,
    zoom: ZOOM_START,
    keys: new Set<string>(),
    steer: 0,
    dragging: false,
    lx: 0,
    ly: 0,
    pointers: new Map<number, { x: number; y: number }>(),
    pinch0: 0,
    zoom0: ZOOM_START,
    /** When the load sweep started; null once it ends or the player takes over. */
    sweepStart: null as number | null,
    tween: null as Tween | null,
    downX: 0,
    downY: 0,
    moved: 0,
    tapT: 0,
    tapX: 0,
    tapY: 0,
  });
  const sizedRef = useRef("");
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [hint, setHint] = useState(true);
  const [current, setCurrent] = useState(src);
  // "contain" shows the whole photo; it only fills the frame when that would
  // crop almost nothing. Wide and portrait photos keep every edge and get a
  // blurred copy of themselves behind them instead of empty bars.
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  // The plate "develops" in when it has loaded, rather than popping in.
  const [ready, setReady] = useState(false);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const shown = effectiveFit(fit, natural, box);
  const fitRef = useRef(shown);
  fitRef.current = shown;
  // Which way the photo reaches past the frame, for the sweep and the hint.
  const overhang =
    natural && box
      ? sceneOverhang({
          naturalWidth: natural.w,
          naturalHeight: natural.h,
          boxWidth: box.w,
          boxHeight: box.h,
          fit: shown,
          zoom: 1,
        })
      : { maxX: 0, maxY: 0 };
  const reach = overhang.maxX >= overhang.maxY ? "wide" : "tall";
  const explorable = Math.max(overhang.maxX, overhang.maxY) > 24;
  // Once per plate: the photo usually loads during the round intro, so the
  // sweep waits until the player can actually look around.
  const sweptFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !explorable || reducedMotion || !interactive) return;
    if (sweptFor.current === current) return;
    sweptFor.current = current;
    const state = sim.current;
    state.sweepStart = performance.now() + SWEEP_AFTER_MS;
    return () => {
      state.sweepStart = null;
    };
  }, [ready, explorable, current, interactive, reducedMotion]);
  const queue = useRef<string[]>([]);
  const wikiTried = useRef(false);
  const fallbackKey = (fallbacks ?? []).join("|");

  useEffect(() => {
    const s = sim.current;
    s.yaw = 0;
    s.pitch = 0;
    s.zoom = ZOOM_START;
    s.keys.clear();
    s.steer = 0;
    s.dragging = false;
    s.pointers.clear();
    setFailed(false);
    setReady(false);
    sizedRef.current = "";
    setHint(true);
    wikiTried.current = false;
    const seen = new Set<string>();
    const chain: string[] = [];
    for (const url of [src, ...(fallbackKey ? fallbackKey.split("|") : [])]) {
      if (url && !seen.has(url)) {
        seen.add(url);
        chain.push(url);
      }
    }
    queue.current = chain.slice(1);
    setCurrent(chain[0] ?? src);
    const hide = window.setTimeout(() => setHint(false), 4200);
    return () => window.clearTimeout(hide);
  }, [src, reducedMotion, fallbackKey, sourceUrl, title, retry, fit]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const read = () => setBox({ w: host.clientWidth, h: host.clientHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setReady(true);
      setFailed(false);
      onReady?.();
    }
  }, [current, onReady]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let frame = 0;
    let last = performance.now();

    const apply = () => {
      const img = imgRef.current;
      const box = hostRef.current;
      if (!img || !box) return;
      const { yaw, pitch, zoom } = sim.current;
      const next = sceneOffset(
        {
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          boxWidth: box.clientWidth,
          boxHeight: box.clientHeight,
          fit: fitRef.current,
          zoom,
        },
        yaw,
        pitch,
      );
      sim.current.yaw = next.yaw;
      sim.current.pitch = next.pitch;
      // Draw the whole scaled plate, not a frame-sized box cropped by
      // object-fit: the pan bounds assume the overhang is really there, and a
      // cropped box slid off the edge and showed background instead.
      const scale = fitScale({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        boxWidth: box.clientWidth,
        boxHeight: box.clientHeight,
        fit: fitRef.current,
      });
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const size = `${w}x${h}@${box.clientWidth}x${box.clientHeight}`;
      if (w > 0 && h > 0 && sizedRef.current !== size) {
        sizedRef.current = size;
        img.style.width = `${w}px`;
        img.style.height = `${h}px`;
        img.style.left = `${(box.clientWidth - w) / 2}px`;
        img.style.top = `${(box.clientHeight - h) / 2}px`;
      }
      img.style.transform = `translate(${next.x}px, ${next.y}px) scale(${zoom})`;
    };

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = sim.current;
      if (s.tween) {
        const k = Math.min(1, (now - s.tween.t0) / TWEEN_MS);
        const e = 1 - Math.pow(1 - k, 3);
        [s.zoom, s.yaw, s.pitch] = s.tween.from.map((f, i) => f + (s.tween!.to[i] - f) * e) as [
          number,
          number,
          number,
        ];
        if (k >= 1) s.tween = null;
      } else if (s.sweepStart !== null && now >= s.sweepStart) {
        // Out to one edge, across to the other, back to centre: the photo is
        // wider (or taller) than the frame, and this is where the rest is.
        const img = imgRef.current;
        const box = hostRef.current;
        const p = Math.min(1, (now - s.sweepStart) / SWEEP_MS);
        if (img && box) {
          const { maxX, maxY } = sceneOverhang({
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            boxWidth: box.clientWidth,
            boxHeight: box.clientHeight,
            fit: fitRef.current,
            zoom: s.zoom,
          });
          const wave = Math.sin(p * Math.PI * 2) * Math.sin(p * Math.PI) ** 0.35;
          if (maxX >= maxY) s.yaw = (wave * maxX) / (box.clientWidth * YAW_SPAN || 1);
          else s.pitch = (wave * maxY) / (box.clientHeight * PITCH_SPAN || 1);
        }
        if (p >= 1) {
          s.sweepStart = null;
          s.yaw = 0;
          s.pitch = 0;
        }
      }
      if (interactiveRef.current) {
        const keys = s.keys;
        let look = s.steer;
        if (keys.has("KeyA") || keys.has("ArrowLeft")) look += 1;
        if (keys.has("KeyD") || keys.has("ArrowRight")) look -= 1;
        s.yaw += look * LOOK_RATE * dt;
        if (keys.has("KeyW") || keys.has("ArrowUp")) s.zoom += ZOOM_RATE * dt;
        if (keys.has("KeyS") || keys.has("ArrowDown")) s.zoom -= ZOOM_RATE * dt;
        s.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s.zoom));
        // No pitch cap here: `apply` bounds both axes by how far the plate
        // actually overhangs the frame, and renormalises so neither runs away.
        // A fixed cap put the top and bottom of a tall photo out of reach.
      }
      if (!interactiveRef.current) {
        s.keys.clear();
        s.steer = 0;
      }
      apply();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!interactiveRef.current || typingTarget(e.target)) return;
      const code = e.code;
      if (
        code === "KeyA" ||
        code === "KeyD" ||
        code === "KeyW" ||
        code === "KeyS" ||
        code === "ArrowLeft" ||
        code === "ArrowRight" ||
        code === "ArrowUp" ||
        code === "ArrowDown"
      ) {
        e.preventDefault();
        sim.current.sweepStart = null;
        sim.current.tween = null;
        sim.current.keys.add(code);
        setHint(false);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      sim.current.keys.delete(e.code);
    };
    const clearKeys = () => {
      sim.current.keys.clear();
      sim.current.steer = 0;
      sim.current.dragging = false;
    };

    const pinchDist = () => {
      const pts = [...sim.current.pointers.values()];
      if (pts.length < 2) return 0;
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      return Math.hypot(dx, dy);
    };

    const onDown = (e: PointerEvent) => {
      if (!interactiveRef.current) return;
      if ((e.target as HTMLElement | null)?.closest("button, input, [role='application']")) return;
      host.setPointerCapture(e.pointerId);
      sim.current.sweepStart = null;
      sim.current.tween = null;
      sim.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (sim.current.pointers.size === 1) {
        sim.current.downX = e.clientX;
        sim.current.downY = e.clientY;
        sim.current.moved = 0;
      }
      if (sim.current.pointers.size === 1) {
        sim.current.dragging = true;
        sim.current.lx = e.clientX;
        sim.current.ly = e.clientY;
        host.style.cursor = "grabbing";
      } else {
        sim.current.dragging = false;
        sim.current.pinch0 = pinchDist();
        sim.current.zoom0 = sim.current.zoom;
      }
      setHint(false);
    };
    const onMove = (e: PointerEvent) => {
      const s = sim.current;
      if (!interactiveRef.current || !s.pointers.has(e.pointerId)) return;
      s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (s.pointers.size >= 2 && s.pinch0 > 0) {
        const d = pinchDist();
        s.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s.zoom0 * (d / s.pinch0)));
        return;
      }
      if (!s.dragging) return;
      // The photo follows the finger, pixel for pixel.
      const dx = e.clientX - s.lx;
      const dy = e.clientY - s.ly;
      s.moved += Math.abs(dx) + Math.abs(dy);
      s.yaw += dx / (host.clientWidth * YAW_SPAN || 1);
      s.pitch += dy / (host.clientHeight * PITCH_SPAN || 1);
      s.lx = e.clientX;
      s.ly = e.clientY;
    };
    const zoomAt = (clientX: number, clientY: number) => {
      const s = sim.current;
      const img = imgRef.current;
      if (!img) return;
      const r = host.getBoundingClientRect();
      const W = host.clientWidth;
      const H = host.clientHeight;
      const frame = {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        boxWidth: W,
        boxHeight: H,
        fit: fitRef.current,
      };
      const z0 = s.zoom;
      const z1 = z0 > 1.3 ? ZOOM_START : TAP_ZOOM;
      const now = sceneOffset({ ...frame, zoom: z0 }, s.yaw, s.pitch);
      // Keep the tapped point under the finger as the zoom changes.
      const px = clientX - (r.left + W / 2);
      const py = clientY - (r.top + H / 2);
      const x1 = z1 === ZOOM_START ? 0 : px - (z1 * (px - now.x)) / z0;
      const y1 = z1 === ZOOM_START ? 0 : py - (z1 * (py - now.y)) / z0;
      const target: [number, number, number] = [
        z1,
        x1 / (W * YAW_SPAN || 1),
        y1 / (H * PITCH_SPAN || 1),
      ];
      s.tween = reducedRef.current
        ? null
        : { t0: performance.now(), from: [s.zoom, s.yaw, s.pitch], to: target };
      if (!s.tween) [s.zoom, s.yaw, s.pitch] = target;
    };
    const onUp = (e: PointerEvent) => {
      const s = sim.current;
      if (s.pointers.size === 1 && s.moved < 10 && interactiveRef.current) {
        const t = performance.now();
        if (t - s.tapT < 320 && Math.hypot(e.clientX - s.tapX, e.clientY - s.tapY) < 36) {
          s.tapT = 0;
          zoomAt(e.clientX, e.clientY);
        } else {
          s.tapT = t;
          s.tapX = e.clientX;
          s.tapY = e.clientY;
        }
      }
      sim.current.pointers.delete(e.pointerId);
      if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId);
      if (sim.current.pointers.size === 1) {
        const p = [...sim.current.pointers.values()][0];
        sim.current.lx = p.x;
        sim.current.ly = p.y;
        sim.current.dragging = true;
        sim.current.pinch0 = 0;
      }
      if (sim.current.pointers.size === 0) {
        sim.current.dragging = false;
        host.style.cursor = "grab";
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (!interactiveRef.current) return;
      e.preventDefault();
      sim.current.sweepStart = null;
      sim.current.tween = null;
      const next = sim.current.zoom * (e.deltaY > 0 ? 0.92 : 1.08);
      sim.current.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
      setHint(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", clearKeys);
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);
    host.addEventListener("wheel", onWheel, { passive: false });

    if (import.meta.env.DEV)
      window.__controlsTest = {
        getYaw: () => sim.current.yaw,
        getSpeed: () => sim.current.zoom - ZOOM_MIN,
        setKeys: (codes) => {
          sim.current.keys = new Set(codes);
        },
        setSteer: (v) => {
          sim.current.steer = Math.max(-1, Math.min(1, v));
        },
      };

    apply();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("visibilitychange", clearKeys);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      host.removeEventListener("wheel", onWheel);
      if (window.__controlsTest) delete window.__controlsTest;
    };
  }, [src]);

  return (
    <div className="absolute inset-0 bg-bg-subtle">
      <div
        ref={hostRef}
        className="absolute inset-0 cursor-grab touch-none overflow-hidden bg-[#0a1117]"
        aria-label="Look around the location. Drag to look, WASD to inspect, scroll to zoom."
      >
        {ready && !failed && <span key={current} className="scene-sheen" aria-hidden />}
        {shown === "contain" && !failed && (
          <img src={current} alt="" aria-hidden className="scene-backdrop" draggable={false} />
        )}
        <img
          key={retry}
          ref={imgRef}
          src={current}
          srcSet={responsiveSceneSrcSet(current)}
          sizes="100vw"
          alt={alt}
          draggable={false}
          referrerPolicy="no-referrer"
          decoding="async"
          fetchPriority="high"
          className={cn(
            // No will-change: it pins the photo's raster at its fitted size, so
            // zooming stretched that copy — measured ~3x softer at 2.8x.
            // Sized and placed in px by `apply` (the whole scaled plate).
            "absolute left-0 top-0 max-w-none pointer-events-none origin-center select-none",
            "transition-opacity duration-700 ease-out",
            failed || !ready ? "opacity-0" : "opacity-100",
          )}
          onLoad={(e) => {
            const loaded = e.currentTarget;
            setNatural({ w: loaded.naturalWidth, h: loaded.naturalHeight });
            setReady(true);
            setFailed(false);
            onReady?.();
          }}
          onError={() => {
            const next = queue.current.shift();
            if (next) {
              setCurrent(next);
              return;
            }
            if (wikiTried.current) {
              setFailed(true);
              onError?.();
              onReady?.();
              return;
            }
            wikiTried.current = true;
            void resolveWikiImage(sourceUrl, title).then((wiki) => {
              if (wiki) {
                setCurrent(wiki);
                return;
              }
              setFailed(true);
              onError?.();
              onReady?.();
            });
          }}
        />
      </div>
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-subtle">
          <p className="px-6 text-center text-sm text-muted">Photo unavailable</p>
        </div>
      )}
      {failed && (
        <button
          className="absolute top-[55%] left-1/2 -translate-x-1/2 z-10 rounded-lg bg-accent text-accent-fg px-5 py-3"
          onClick={() => {
            setFailed(false);
            setRetry((n) => n + 1);
          }}
        >
          Retry photo
        </button>
      )}
      {interactive && !failed && (
        <div className="scene-controls" aria-label="Photo controls">
          <button
            type="button"
            aria-label="Zoom in on photo"
            onClick={() => {
              sim.current.zoom = Math.min(ZOOM_MAX, sim.current.zoom + 0.3);
              setHint(false);
            }}
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            aria-label="Zoom out of photo"
            onClick={() => {
              sim.current.zoom = Math.max(ZOOM_MIN, sim.current.zoom - 0.3);
              setHint(false);
            }}
          >
            <Minus size={18} />
          </button>
          <button
            type="button"
            aria-label="Reset photo view"
            onClick={() => {
              sim.current.zoom = ZOOM_START;
              sim.current.yaw = 0;
              sim.current.pitch = 0;
            }}
          >
            <RotateCcw size={16} />
          </button>
          {onToggleFit && (
            <button
              type="button"
              aria-label={fit === "contain" ? "Fill screen with photo" : "Show full photograph"}
              title={fit === "contain" ? "Fill frame" : "Full photograph"}
              onClick={onToggleFit}
            >
              {fit === "contain" ? <Maximize size={16} /> : <Minimize size={16} />}
            </button>
          )}
        </div>
      )}
      {showHints && hint && interactive && !failed && (
        <p className="scene-hint pointer-events-none absolute inset-x-0 bottom-20 z-10 flex items-center justify-center gap-2 text-center text-[11px] text-fg/90">
          {explorable ? (
            <>
              <span className={cn("scene-hint-arrows", `is-${reach}`)} aria-hidden>
                {reach === "wide" ? <MoveHorizontal size={15} /> : <MoveVertical size={15} />}
              </span>
              Drag to look around · double-tap to zoom
            </>
          ) : (
            "Pinch or double-tap to zoom · drag to explore"
          )}
        </p>
      )}
    </div>
  );
}
