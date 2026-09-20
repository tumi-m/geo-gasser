import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * GeoGuessr-style scene inspection for the photo rounds: drag to look,
 * wheel/pinch/double-tap to zoom, keyboard arrows too. The image is
 * scaled up into a pannable surface; edges are clamped so the frame is
 * always filled. The map sheet sits above this and still owns pin drops.
 */

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const STEP = 0.5;

export function SceneViewer({
  src,
  alt,
  reducedMotion,
  onReady,
  onError,
  className,
}: {
  src?: string;
  alt: string;
  reducedMotion?: boolean;
  onReady?: () => void;
  onError?: () => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.15);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const lastTap = useRef(0);
  /** Where the current single-pointer gesture started + how far it has moved. */
  const gesture = useRef<{ x: number; y: number; moved: number } | null>(null);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  /** Clamp panning so the scaled image always covers the viewport. */
  const clamp = useCallback((next: { x: number; y: number }, nextZoom: number) => {
    const host = hostRef.current;
    if (!host) return next;
    const w = host.clientWidth;
    const h = host.clientHeight;
    const maxX = Math.max(0, (w * (nextZoom - 1)) / 2);
    const maxY = Math.max(0, (h * (nextZoom - 1)) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  }, []);

  const applyZoom = useCallback(
    (next: number, focus?: { x: number; y: number }) => {
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
      const prev = zoomRef.current;
      let nextOffset = offsetRef.current;
      const host = hostRef.current;
      // Keep the point under the cursor stable while zooming.
      if (focus && host) {
        const cx = host.clientWidth / 2;
        const cy = host.clientHeight / 2;
        const fx = focus.x - cx;
        const fy = focus.y - cy;
        const ratio = clamped / prev;
        nextOffset = { x: fx - (fx - nextOffset.x) * ratio, y: fy - (fy - nextOffset.y) * ratio };
      }
      nextOffset = clamp(nextOffset, clamped);
      zoomRef.current = clamped;
      offsetRef.current = nextOffset;
      setZoom(clamped);
      setOffset(nextOffset);
    },
    [clamp],
  );

  const reset = useCallback(() => {
    setZoom(1.15);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    reset();
    setTouched(false);
  }, [src, reset]);

  // Rotation / window resize changes the clamp window; re-clamp so the
  // frame never shows past the image edge.
  useEffect(() => {
    const onResize = () => {
      const next = clamp(offsetRef.current, zoomRef.current);
      offsetRef.current = next;
      setOffset(next);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [clamp]);

  const onPointerDown = (e: React.PointerEvent) => {
    const host = hostRef.current;
    if (!host) return;
    if (pointers.current.size === 0) {
      host.setPointerCapture(e.pointerId);
      gesture.current = { x: e.clientX, y: e.clientY, moved: 0 };
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: zoomRef.current };
      gesture.current = null;
    }
    setDragging(true);
    setTouched(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      applyZoom((pinchStart.current.zoom * dist) / Math.max(1, pinchStart.current.dist));
      return;
    }
    if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (gesture.current) gesture.current.moved += Math.hypot(dx, dy);
      setOffset((o) => clamp({ x: o.x + dx, y: o.y + dy }, zoomRef.current));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      setDragging(false);
      // Double-tap alternates zoom levels — but only for TAPS, never after
      // a drag: two quick pans must not zoom the scene.
      const moved = gesture.current?.moved ?? Number.POSITIVE_INFINITY;
      const now = performance.now();
      if (moved < 8 && now - lastTap.current < 300) {
        const host = hostRef.current;
        if (host) {
          const rect = host.getBoundingClientRect();
          const focus = { x: e.clientX - rect.x, y: e.clientY - rect.y };
          applyZoom(zoomRef.current > 1.3 ? 1.15 : 2.4, focus);
        }
        lastTap.current = 0; // consume so a third tap cannot re-trigger
      } else {
        lastTap.current = moved < 8 ? now : 0;
      }
      gesture.current = null;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    // No preventDefault: React root wheel listeners are passive. The game
    // shell is overflow-hidden, so the page cannot scroll underneath.
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const focus = { x: e.clientX - rect.x, y: e.clientY - rect.y };
    applyZoom(zoomRef.current * (e.deltaY > 0 ? 0.88 : 1.14), focus);
    setTouched(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 60;
    if (e.key === "ArrowLeft") setOffset((o) => clamp({ x: o.x + step, y: o.y }, zoomRef.current));
    else if (e.key === "ArrowRight") setOffset((o) => clamp({ x: o.x - step, y: o.y }, zoomRef.current));
    else if (e.key === "ArrowUp") setOffset((o) => clamp({ x: o.x, y: o.y + step }, zoomRef.current));
    else if (e.key === "ArrowDown") setOffset((o) => clamp({ x: o.x, y: o.y - step }, zoomRef.current));
    else if (e.key === "+" || e.key === "=") applyZoom(zoomRef.current + STEP);
    else if (e.key === "-" || e.key === "_") applyZoom(zoomRef.current - STEP);
    else if (e.key === "0") reset();
    else return;
    e.preventDefault();
    setTouched(true);
  };

  const fade = reducedMotion ? "" : "transition-transform duration-150 ease-out";

  return (
    <div
      ref={hostRef}
      className={cn("relative h-full w-full touch-none overflow-hidden outline-none", className)}
      tabIndex={0}
      role="img"
      aria-label={`${alt}. Drag to look around, pinch or scroll to zoom.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={onReady}
        onError={onError}
        className={cn("h-full w-full origin-center object-cover select-none", fade)}
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
          cursor: dragging ? "grabbing" : "grab",
        }}
      />

      {!touched && (
        <p className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full border border-border bg-bg/80 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted backdrop-blur-sm bottom-[calc(var(--atlas-map-h)+0.75rem)] sm:bottom-3">
          Drag to look · pinch to zoom
        </p>
      )}

      {/* Controls stay clear of the map sheet: above it on phones, opposite
          corner on desktop where the sheet docks bottom-right. */}
      <div className="absolute right-3 flex items-center gap-1.5 bottom-[calc(var(--atlas-map-h)+0.75rem)] sm:left-3 sm:right-auto sm:bottom-3">
        <button
          type="button"
          className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border border-border bg-bg/80 text-fg backdrop-blur-sm active:scale-95"
          aria-label="Zoom out"
          onClick={() => applyZoom(zoom - STEP)}
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          className="pointer-events-auto inline-flex h-9 min-w-14 items-center justify-center rounded-full border border-border bg-bg/80 px-2.5 text-[11px] font-medium tabular text-fg backdrop-blur-sm"
          aria-label="Reset view"
          onClick={reset}
        >
          {zoom <= 1.16 ? <RotateCcw className="size-3.5" /> : `${zoom.toFixed(1)}×`}
        </button>
        <button
          type="button"
          className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border border-border bg-bg/80 text-fg backdrop-blur-sm active:scale-95"
          aria-label="Zoom in"
          onClick={() => applyZoom(zoom + STEP)}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}