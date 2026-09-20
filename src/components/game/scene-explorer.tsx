import { useEffect, useRef, useState } from "react";
import { resolveWikiImage } from "@/lib/game";
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
const ZOOM_MIN = 1.08;
const ZOOM_MAX = 3.6;
const ZOOM_START = 1.42;
const DRAG_YAW = 0.0048;
const DRAG_PITCH = 0.0034;

function typingTarget(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || node.isContentEditable;
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
  interactive?: boolean;
  onReady?: () => void;
  onError?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const sim = useRef({
    yaw: 0,
    pitch: 0,
    zoom: reducedMotion ? 1.18 : ZOOM_START,
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
  const [hint, setHint] = useState(true);
  const [current, setCurrent] = useState(src);
  const queue = useRef<string[]>([]);
  const wikiTried = useRef(false);

  useEffect(() => {
    const s = sim.current;
    s.yaw = 0;
    s.pitch = 0;
    s.zoom = reducedMotion ? 1.18 : ZOOM_START;
    s.keys.clear();
    s.steer = 0;
    s.dragging = false;
    s.pointers.clear();
    setFailed(false);
    setHint(true);
    wikiTried.current = false;
    const seen = new Set<string>();
    const chain: string[] = [];
    for (const url of [src, ...(fallbacks ?? [])]) {
      if (url && !seen.has(url)) {
        seen.add(url);
        chain.push(url);
      }
    }
    queue.current = chain.slice(1);
    setCurrent(chain[0] ?? src);
    const hide = window.setTimeout(() => setHint(false), 4200);
    return () => window.clearTimeout(hide);
  }, [src, reducedMotion, fallbacks?.join("|"), sourceUrl, title]);

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
      const maxX = box.clientWidth * (0.22 + (zoom - 1) * 0.48);
      const maxY = box.clientHeight * (0.16 + (zoom - 1) * 0.38);
      const x = Math.max(-maxX, Math.min(maxX, yaw * box.clientWidth * 0.55));
      const y = Math.max(-maxY, Math.min(maxY, pitch * box.clientHeight * 0.48));
      img.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
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
        s.pitch = Math.max(-0.7, Math.min(0.7, s.pitch));
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
      if (!s.pointers.has(e.pointerId)) return;
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
        className="absolute inset-0 cursor-grab touch-none overflow-hidden"
        aria-label="Look around the location. Drag to look, WASD to inspect, scroll to zoom."
      >
        <img
          ref={imgRef}
          src={current}
          alt={alt}
          draggable={false}
          referrerPolicy="no-referrer"
          decoding="async"
          className={cn(
            "pointer-events-none h-full w-full origin-center object-cover select-none will-change-transform",
            failed ? "opacity-0" : "opacity-100",
          )}
          onLoad={() => {
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
          <p className="px-6 text-center text-sm text-muted">Scene unavailable — use the map</p>
        </div>
      )}
      {hint && interactive && !failed && (
        <p className="pointer-events-none absolute inset-x-0 top-[28%] z-10 text-center text-[11px] uppercase tracking-[0.18em] text-fg/90">
          Drag to look · WASD inspect · scroll zoom
        </p>
      )}
    </div>
  );
}
