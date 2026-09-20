import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/game";
import { geodesicPoints } from "@/lib/game";
import { cn } from "@/lib/utils";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";

/**
 * OpenFreeMap vector tiles currently return HTTP 200 with an empty body
 * (`x-ofm-debug: empty tile`, cached for years) so the map looks blank.
 * CARTO dark_all watermarks without a key. Esri Canvas Dark Gray raster
 * always paints land and labels, no API key.
 */
const MAP_STYLE = {
  version: 8 as const,
  sources: {
    esri: {
      type: "raster" as const,
      tiles: ["/api/tiles/esri/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 16,
      attribution: "Tiles © Esri",
    },
    labels: {
      type: "raster" as const,
      tiles: ["/api/tiles/labels/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 16,
    },
  },
  layers: [
    { id: "esri", type: "raster" as const, source: "esri" },
    { id: "labels", type: "raster" as const, source: "labels" },
  ],
};

const BOTH_COUNTRIES: [[number, number], [number, number]] = [
  [3.2, -35.0],
  [32.9, 53.6],
];
const ZA_BOUNDS: [[number, number], [number, number]] = [
  [16.5, -34.85],
  [32.9, -22.1],
];
const NL_BOUNDS: [[number, number], [number, number]] = [
  [3.32, 50.75],
  [7.23, 53.55],
];

type MarkerHandle = { el: HTMLDivElement; marker: Marker };
type PinKind = "you" | "truth" | "opp";
type MapStatus = "loading" | "ready" | "error";

function makePin(kind: PinKind, label?: string) {
  const el = document.createElement("div");
  el.className = "atlas-pin";
  const dot = document.createElement("span");
  dot.className = `atlas-pin-dot atlas-pin-${kind}`;
  el.appendChild(dot);
  if (label) {
    const tag = document.createElement("span");
    tag.className = "atlas-pin-label";
    tag.textContent = label;
    el.appendChild(tag);
  }
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
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const pendingFocus = useRef<"ZA" | "NL" | "both" | null>("both");
  const [status, setStatus] = useState<MapStatus>("loading");
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let map: MapLibreMap | undefined;
    let ro: ResizeObserver | undefined;
    let watchdog = 0;

    (async () => {
      try {
        const ml = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !hostRef.current) return;
        map = new ml.Map({
          container: hostRef.current,
          style: MAP_STYLE,
          center: [14, 10],
          zoom: 2.05,
          minZoom: 1,
          maxZoom: 18,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
          renderWorldCopies: false,
        });
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        mapRef.current = map;

        const applyPending = () => {
          if (!map) return;
          const canvas = map.getCanvas();
          if (canvas.clientWidth < 40 || canvas.clientHeight < 40) return;
          const next = pendingFocus.current;
          if (!next) return;
          pendingFocus.current = null;
          const duration = reducedRef.current ? 0 : next === "both" ? 0 : 750;
          if (next === "both") map.fitBounds(BOTH_COUNTRIES, { padding: 16, duration, maxZoom: 2.8 });
          else if (next === "ZA") map.fitBounds(ZA_BOUNDS, { padding: 28, duration, maxZoom: 5.1 });
          else map.fitBounds(NL_BOUNDS, { padding: 28, duration, maxZoom: 7.1 });
        };

        map.on("click", (e) => {
          if (disabledRef.current) return;
          onGuessRef.current({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
        });
        const markReady = () => {
          if (cancelled) return;
          setStatus("ready");
          window.clearTimeout(watchdog);
        };
        map.on("load", () => {
          markReady();
          applyPending();
          if (guessRef.current) void placePin("you", guessRef.current, "you");
          map?.resize();
          applyPending();
        });
        map.on("idle", markReady);
        map.on("sourcedata", (e) => {
          if (e.sourceId === "esri" && e.isSourceLoaded) markReady();
        });
        watchdog = window.setTimeout(() => {
          if (cancelled || !map) return;
          if (map.isStyleLoaded()) markReady();
          else setStatus("error");
        }, 5000);
        const wrap = wrapRef.current;
        if (wrap) {
          ro = new ResizeObserver(() => {
            map?.resize();
            applyPending();
          });
          ro.observe(wrap);
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      ro?.disconnect();
      map?.remove();
      mapRef.current = null;
      pins.current = {};
    };
  }, [epoch]);

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

  function focusCountry(which: "ZA" | "NL") {
    const map = mapRef.current;
    const bounds = which === "ZA" ? ZA_BOUNDS : NL_BOUNDS;
    if (!map) {
      pendingFocus.current = which;
      return;
    }
    map.fitBounds(bounds, {
      padding: expanded ? 48 : 28,
      maxZoom: which === "ZA" ? 5.1 : 7.1,
      duration: reducedRef.current ? 0 : 750,
    });
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
    if (!guess) {
      pendingFocus.current = "both";
      if (map?.isStyleLoaded()) {
        map.fitBounds(BOTH_COUNTRIES, { padding: 16, duration: 0, maxZoom: 2.8 });
        pendingFocus.current = null;
      }
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
          if (!map.getStyle()) return;
          if (map.getSource("arc")) {
            (map.getSource("arc") as GeoJSONSource).setData(data);
          } else {
            map.addSource("arc", { type: "geojson", data });
            if (!map.getLayer("arc")) {
              map.addLayer({
                id: "arc",
                type: "line",
                source: "arc",
                paint: { "line-color": "#d5d8de", "line-width": 2, "line-opacity": 0.85 },
              });
            }
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
      {status !== "ready" && (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-bg-elevated/80">
          {status === "loading" ? (
            <p className="text-xs uppercase tracking-wider text-muted">Loading map</p>
          ) : (
            <button
              type="button"
              className="pointer-events-auto h-11 rounded-[var(--radius-sm)] border border-border bg-bg px-4 text-xs font-medium uppercase tracking-wider"
              onClick={() => {
                setStatus("loading");
                pendingFocus.current = "both";
                setEpoch((n) => n + 1);
              }}
            >
              Retry map
            </button>
          )}
        </div>
      )}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="h-11 rounded-[var(--radius-sm)] border border-border bg-bg/80 px-3 text-xs font-medium uppercase tracking-wider"
          onClick={onToggleExpand}
        >
          {expanded ? "Shrink map" : "Expand map"}
        </button>
        {!reveal && (
          <>
            <button
              type="button"
              className="h-11 min-w-11 rounded-[var(--radius-sm)] bg-za px-3 text-xs font-medium uppercase tracking-wider text-fg"
              onClick={() => focusCountry("ZA")}
              aria-label="Focus map on South Africa"
            >
              SA
            </button>
            <button
              type="button"
              className="h-11 min-w-11 rounded-[var(--radius-sm)] bg-nl px-3 text-xs font-medium uppercase tracking-wider text-fg"
              onClick={() => focusCountry("NL")}
              aria-label="Focus map on the Netherlands"
            >
              NL
            </button>
          </>
        )}
      </div>
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
