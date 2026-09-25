import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Maximize, Minimize, Minus, Plus, RotateCcw } from "lucide-react";
import { resolveWikiImage, responsiveSceneSrcSet, sceneOffset } from "@/lib/game";
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
const DRAG_YAW = 0.0048;
const DRAG_PITCH = 0.0034;

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
  });
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
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
      img.style.transform = `translate(${next.x}px, ${next.y}px) scale(${zoom})`;
    };

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = sim.current;
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
      sim.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
      s.yaw -= (e.clientX - s.lx) * DRAG_YAW;
      s.pitch -= (e.clientY - s.ly) * DRAG_PITCH;
      s.lx = e.clientX;
      s.ly = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
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
            "relative pointer-events-none h-full w-full min-h-full min-w-full origin-center select-none",
            shown === "contain" ? "object-contain" : "object-cover",
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
        <p className="scene-hint pointer-events-none absolute inset-x-0 bottom-20 z-10 text-center text-[11px] text-fg/90">
          Scroll or pinch to zoom · drag to explore
        </p>
      )}
    </div>
  );
}
