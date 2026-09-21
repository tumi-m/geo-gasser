import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { mapillaryImageUrl } from "@/lib/game";
import { cn } from "@/lib/utils";

const MIN_FOV = 30;
const MAX_FOV = 100;
const LOOK_SPEED = 0.12;

/**
 * Equirectangular 360 viewer. Renders the plate on the inside of a sphere and
 * maps drag / wheel / pinch to yaw, pitch and field of view.
 *
 * Mapillary plates are resolved to a signed CDN URL on mount; any failure
 * falls back to the parent (which swaps in the flat still).
 */
export function PanoViewer({
  src,
  imageId,
  provider,
  heading,
  pitch,
  alt,
  reducedMotion,
  interactive = true,
  onReady,
  onError,
  className,
}: {
  src?: string;
  imageId?: string;
  provider?: string;
  heading?: number;
  pitch?: number;
  alt: string;
  reducedMotion: boolean;
  interactive?: boolean;
  onReady?: () => void;
  onError?: () => void;
  className?: string;
}) {
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const hostRef = useRef<HTMLDivElement | null>(null);
  const view = useRef({
    lon: heading ?? 0,
    lat: pitch ?? 0,
    fov: 75,
    dragging: false,
    px: 0,
    py: 0,
    pointers: new Map<number, { x: number; y: number }>(),
    pinchDistance: 0,
  });
  const [url, setUrl] = useState<string | null>(
    provider === "mapillary" && imageId ? null : (src ?? null),
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!(provider === "mapillary" && imageId)) {
      setUrl(src ?? null);
      return;
    }
    let cancelled = false;
    setUrl(null);
    void mapillaryImageUrl(imageId).then((resolved) => {
      if (cancelled) return;
      if (resolved) setUrl(resolved);
      else {
        setFailed(true);
        callbacks.current.onError?.();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [provider, imageId, src]);

  const markFailed = useCallback(() => {
    setFailed(true);
    callbacks.current.onError?.();
  }, []);

  useEffect(() => {
    if (!url || failed) return;
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      markFailed();
      return;
    }

    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(view.current.fov, width / height, 0.1, 1100);
    const geometry = new THREE.SphereGeometry(500, 64, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x14161c });
    scene.add(new THREE.Mesh(geometry, material));

    let disposed = false;
    let texture: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (loaded) => {
        if (disposed) {
          loaded.dispose();
          return;
        }
        texture = loaded;
        loaded.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        loaded.colorSpace = THREE.SRGBColorSpace;
        material.map = loaded;
        // MeshBasicMaterial multiplies the map by `color`; white shows it as-is.
        material.color.setHex(0xffffff);
        material.needsUpdate = true;
        callbacks.current.onReady?.();
      },
      undefined,
      () => {
        if (!disposed) markFailed();
      },
    );

    let raf = 0;
    const target = new THREE.Vector3();
    const render = () => {
      const v = view.current;
      v.lat = Math.max(-85, Math.min(85, v.lat));
      const phi = THREE.MathUtils.degToRad(90 - v.lat);
      const theta = THREE.MathUtils.degToRad(v.lon);
      camera.fov = reducedMotion ? v.fov : camera.fov + (v.fov - camera.fov) * 0.25;
      camera.updateProjectionMatrix();
      target.setFromSphericalCoords(1, phi, theta);
      camera.lookAt(target);
      renderer.render(scene, camera);
      if (import.meta.env.DEV)
        (window as unknown as { __panoTest?: unknown }).__panoTest = {
          lon: v.lon,
          lat: v.lat,
          fov: Math.round(camera.fov),
          url,
        };
      raf = requestAnimationFrame(render);
    };
    render();

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      geometry.dispose();
      texture?.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url, failed, reducedMotion, markFailed]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || (event.target as HTMLElement).closest("button")) return;
    const v = view.current;
    v.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (v.pointers.size === 1) {
      v.dragging = true;
      v.px = event.clientX;
      v.py = event.clientY;
    } else if (v.pointers.size === 2) {
      const [a, b] = [...v.pointers.values()];
      v.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      v.dragging = false;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const v = view.current;
    if (v.pointers.has(event.pointerId)) {
      v.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (v.pointers.size === 2) {
      const [a, b] = [...v.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (v.pinchDistance > 0) {
        v.fov = Math.max(MIN_FOV, Math.min(MAX_FOV, v.fov * (v.pinchDistance / distance)));
      }
      v.pinchDistance = distance;
      return;
    }
    if (!v.dragging) return;
    const dx = event.clientX - v.px;
    const dy = event.clientY - v.py;
    v.px = event.clientX;
    v.py = event.clientY;
    v.lon -= dx * LOOK_SPEED;
    v.lat += dy * LOOK_SPEED;
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const v = view.current;
    v.pointers.delete(event.pointerId);
    if (v.pointers.size === 0) v.dragging = false;
    if (v.pointers.size < 2) v.pinchDistance = 0;
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const v = view.current;
    v.fov = Math.max(MIN_FOV, Math.min(MAX_FOV, v.fov + event.deltaY * 0.05));
  };

  if (failed) return null;

  return (
    <div
      ref={hostRef}
      className={cn("relative h-full w-full touch-none overflow-hidden outline-none", className)}
      role="img"
      aria-label={`${alt}. Drag to look around, pinch or scroll to zoom.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
    >
      {interactive && (
        <div className="scene-controls" aria-label="Panorama controls">
          <button
            type="button"
            aria-label="Zoom in on panorama"
            onClick={() => {
              view.current.fov = Math.max(MIN_FOV, view.current.fov - 10);
            }}
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            aria-label="Zoom out of panorama"
            onClick={() => {
              view.current.fov = Math.min(MAX_FOV, view.current.fov + 10);
            }}
          >
            <Minus size={18} />
          </button>
          <button
            type="button"
            aria-label="Reset panorama view"
            onClick={() => {
              view.current.lon = heading ?? 0;
              view.current.lat = pitch ?? 0;
              view.current.fov = 75;
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      )}
      {!url && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bg-subtle">
          <p className="text-xs uppercase tracking-wider text-muted">Loading 360…</p>
        </div>
      )}
    </div>
  );
}
