import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/game";
import { geodesicPoints } from "@/lib/game";
import { cn } from "@/lib/utils";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";

/** OpenFreeMap — no API key. CARTO dark_all now watermarks without one. */
const OPENFREEMAP_DARK = "https://tiles.openfreemap.org/styles/dark";

/** Raster fallback if the vector style fails to load. Esri Canvas Dark Gray, no key. */
const RASTER_FALLBACK = {
  version: 8 as const,
  sources: {
    esri: {
      type: "raster" as const,
      tiles: [
        "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 16,
      attribution: "Tiles © Esri",
    },
    labels: {
      type: "raster" as const,
      tiles: [
        "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 16,
    },
  },
  layers: [
    { id: "esri", type: "raster" as const, source: "esri" },
    { id: "labels", type: "raster" as const, source: "labels" },
  ],
};

type MarkerHandle = { el: HTMLDivElement; marker: Marker };
type PinKind = "you" | "truth" | "opp";

function makePin(kind: PinKind, label?: string) {
  const el = document.createElement("div");
  el.className = "atlas-pin";
  el.innerHTML = `<span class="atlas-pin-dot atlas-pin-${kind}"></span>${
    label ? `<span class="atlas-pin-label">${label}</span>` : ""
  }`;
  el.style.position = "relative";
  return el;
}

export function GuessMap({
  guess,
  onGuess,
  disabled,
  expanded,
  onToggleExpand,
  truth,
  opponent,
  reveal,
  reducedMotion,
  onLock,
  canLock,
}: {
  guess?: LatLng;
  onGuess: (p: LatLng) => void;
  disabled?: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  truth?: LatLng;
  opponent?: { guess: LatLng; name: string } | null;
  reveal?: boolean;
  reducedMotion?: boolean;
  onLock?: () => void;
  canLock?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pins = useRef<Record<string, MarkerHandle>>({});
  const guessRef = useRef(guess);
  guessRef.current = guess;
  const onGuessRef = useRef(onGuess);
  onGuessRef.current = onGuess;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let map: MapLibreMap | undefined;
    let ro: ResizeObserver | undefined;
    let usedFallback = false;

    (async () => {
      const ml = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");
      if (cancelled || !hostRef.current) return;
      map = new ml.Map({
        container: hostRef.current,
        style: OPENFREEMAP_DARK,
        center: [20, 5],
        zoom: 2.15,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
      map.on("click", (e) => {
        if (disabledRef.current) return;
        onGuessRef.current({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
      });
      map.on("load", () => {
        if (guessRef.current) void placePin("you", guessRef.current, "you");
        map?.resize();
      });
      map.on("error", () => {
        if (usedFallback || cancelled || !map || map.isStyleLoaded()) return;
        usedFallback = true;
        map.setStyle(RASTER_FALLBACK);
      });
      const wrap = wrapRef.current;
      if (wrap) {
        ro = new ResizeObserver(() => map?.resize());
        ro.observe(wrap);
      }
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      map?.remove();
      mapRef.current = null;
      pins.current = {};
    };
  }, []);

  async function placePin(key: string, point: LatLng, kind: PinKind, label?: string) {
    const map = mapRef.current;
    if (!map) return;
    const existing = pins.current[key];
    if (existing) {
      existing.marker.setLngLat([point.longitude, point.latitude]);
      return;
    }
    const ml = await import("maplibre-gl");
    const el = makePin(kind, label);
    const marker = new ml.Marker({ element: el, draggable: key === "you" && !disabledRef.current })
      .setLngLat([point.longitude, point.latitude])
      .addTo(map);
    if (key === "you") {
      marker.on("dragend", () => {
        if (disabledRef.current) return;
        const ll = marker.getLngLat();
        onGuessRef.current({ latitude: ll.lat, longitude: ll.lng });
      });
    }
    pins.current[key] = { el, marker };
  }

  useEffect(() => {
    if (!guess) return;
    void placePin("you", guess, "you", reveal ? "YOU" : undefined);
  }, [guess, reveal]);

  useEffect(() => {
    if (reveal) return;
    const map = mapRef.current;
    for (const key of ["truth", "opp"] as const) {
      pins.current[key]?.marker.remove();
      delete pins.current[key];
    }
    if (map?.getLayer("arc")) map.removeLayer("arc");
    if (map?.getSource("arc")) map.removeSource("arc");
    if (!guess && pins.current.you) {
      pins.current.you.marker.remove();
      delete pins.current.you;
    }
  }, [reveal, guess]);

  useEffect(() => {
    const you = pins.current.you;
    if (you) you.marker.setDraggable(!disabled);
  }, [disabled]);

  useEffect(() => {
    const map = mapRef.current;
    const id = window.setTimeout(() => map?.resize(), 320);
    return () => window.clearTimeout(id);
  }, [expanded, reveal]);

  useEffect(() => {
    if (!reveal || !truth) return;
    const map = mapRef.current;
    if (!map) return;
    void (async () => {
      const ml = await import("maplibre-gl");
      await placePin("truth", truth, "truth", "TRUE");
      if (opponent) await placePin("opp", opponent.guess, "opp", opponent.name);
      if (guess && truth) {
        const line = geodesicPoints(guess, truth, 40).map((p) => [p.longitude, p.latitude]);
        const data = {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: line },
        };
        const paint = () => {
          if (map.getSource("arc")) {
            (map.getSource("arc") as GeoJSONSource).setData(data);
          } else {
            map.addSource("arc", { type: "geojson", data });
            map.addLayer({
              id: "arc",
              type: "line",
              source: "arc",
              paint: { "line-color": "#d5d8de", "line-width": 2, "line-opacity": 0.85 },
            });
          }
        };
        if (map.isStyleLoaded()) paint();
        else map.once("load", paint);
      }
      const b = new ml.LngLatBounds();
      const pts = [truth, guess, opponent?.guess].filter(Boolean) as LatLng[];
      for (const p of pts) b.extend([p.longitude, p.latitude]);
      map.resize();
      map.fitBounds(b, { padding: 72, maxZoom: 8, duration: reducedMotion ? 0 : 900 });
    })();
  }, [reveal, truth, guess, opponent, reducedMotion]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        "overflow-hidden border border-border bg-bg-elevated shadow-[var(--shadow-panel)] transition-[width,height,inset,border-radius] duration-300",
        expanded
          ? "fixed inset-3 z-30 rounded-[var(--radius-xl)]"
          : reveal
            ? "absolute inset-x-3 bottom-3 z-30 h-[min(46vh,440px)] rounded-[var(--radius-xl)]"
            : "absolute right-3 bottom-3 z-20 h-[32vh] w-[min(100%-1.5rem,400px)] rounded-[var(--radius-lg)] max-sm:inset-x-3 max-sm:w-auto",
      )}
    >
      <div ref={hostRef} className="h-full w-full" role="application" aria-label="Guessing map" />
      <button
        type="button"
        className="absolute left-3 top-3 z-10 h-11 rounded-[var(--radius-sm)] border border-border bg-bg/80 px-3 text-xs font-medium uppercase tracking-wider"
        onClick={onToggleExpand}
      >
        {expanded ? "Shrink map" : "Expand map"}
      </button>
      {onLock && !reveal && expanded && (
        <button
          type="button"
          disabled={!canLock}
          onClick={onLock}
          className={cn(
            "absolute bottom-3 left-3 z-10 h-11 rounded-[var(--radius-md)] bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-40",
            canLock && "atlas-lock-ready",
          )}
        >
          Lock guess
        </button>
      )}
    </div>
  );
}
