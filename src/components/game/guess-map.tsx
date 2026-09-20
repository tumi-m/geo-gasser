import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { LatLng } from "@/lib/game";
import { cityDots, geodesicPoints, searchPlaces, type Place } from "@/lib/game";
import { cn } from "@/lib/utils";
import worldData from "@/data/world.json";
import type { GeoJSONSource, Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";

/**
 * World polygons are inlined so the map never depends on /maps/world.json
 * (that fetch 404s/fails on some mobile Vercel sessions, leaving a black canvas).
 */
const CITIES = cityDots();
const WORLD = worldData;

const WATER = "#243044";
const LAND = "#8b93a3";
const ZA_FILL = "#3f9a70";
const NL_FILL = "#d96a32";

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    world: { type: "geojson" as const, data: WORLD, attribution: "Natural Earth" },
    cities: { type: "geojson" as const, data: CITIES },
  },
  layers: [
    { id: "bg", type: "background" as const, paint: { "background-color": WATER } },
    {
      id: "land",
      type: "fill" as const,
      source: "world",
      paint: {
        "fill-color": ["match", ["get", "c"], "ZA", ZA_FILL, "NL", NL_FILL, LAND],
        "fill-opacity": 1,
        "fill-antialias": true,
      },
    },
    {
      id: "borders",
      type: "line" as const,
      source: "world",
      paint: { "line-color": "#1b1c22", "line-width": 1.15, "line-opacity": 0.85 },
    },
    {
      id: "cities",
      type: "circle" as const,
      source: "cities",
      minzoom: 1.5,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 2.2, 6, 4, 9, 5],
        "circle-color": "#f4f4f0",
        "circle-stroke-width": 1.2,
        "circle-stroke-color": "#09090b",
      },
    },
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
  const [query, setQuery] = useState("");
  const [activeHit, setActiveHit] = useState(0);
  const hits = useMemo(() => searchPlaces(query, expanded ? 8 : 5), [query, expanded]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let map: MapLibreMap | undefined;
    let ro: ResizeObserver | undefined;
    let watchdog = 0;
    const onViewport = () => map?.resize();

    (async () => {
      try {
        const ml = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !hostRef.current) return;
        map = new ml.Map({
          container: hostRef.current,
          style: MAP_STYLE as StyleSpecification,
          center: [14, 10],
          zoom: 2.05,
          minZoom: 1,
          maxZoom: 10,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          renderWorldCopies: false,
        });
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
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        const kickResize = () => {
          map?.resize();
          applyPending();
        };
        requestAnimationFrame(() => {
          markReady();
          kickResize();
        });
        map.on("load", () => {
          markReady();
          kickResize();
          if (guessRef.current) void placePin("you", guessRef.current, "you");
          [50, 200, 500, 1000].forEach((ms) => window.setTimeout(kickResize, ms));
        });
        map.on("idle", markReady);
        map.on("sourcedata", (e) => {
          if (e.sourceId === "world" && e.isSourceLoaded) markReady();
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
        window.visualViewport?.addEventListener("resize", onViewport);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      window.visualViewport?.removeEventListener("resize", onViewport);
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

  function goToPlace(place: Place) {
    const map = mapRef.current;
    setQuery(place.name);
    setActiveHit(0);
    if (!map) return;
    map.flyTo({
      center: [place.longitude, place.latitude],
      zoom: Math.min(place.zoom, 10),
      duration: reducedRef.current ? 0 : 800,
      essential: true,
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
      const frame = () => {
        map.resize();
        map.fitBounds(b, {
          padding: expanded ? 72 : 36,
          maxZoom: pts.length > 1 ? 6.2 : 5.4,
          duration: reducedMotion ? 0 : 700,
        });
      };
      frame();
      window.setTimeout(frame, 80);
      window.setTimeout(frame, 360);
    })();
  }, [reveal, truth, guess, opponent, reducedMotion, expanded]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative overflow-hidden border border-border bg-[#243044] shadow-[var(--shadow-panel)] transition-[width,height,inset,border-radius] duration-300",
        expanded
          ? "fixed inset-3 z-30 rounded-[var(--radius-xl)]"
          : reveal
            ? "absolute inset-x-3 bottom-3 z-30 h-[min(46vh,440px)] rounded-[var(--radius-xl)]"
            : "absolute right-3 bottom-3 z-20 h-[32vh] w-[min(100%-1.5rem,400px)] rounded-[var(--radius-lg)] max-sm:inset-x-3 max-sm:w-auto",
      )}
    >
      <div ref={hostRef} className="absolute inset-0" role="application" aria-label="Guessing map" />
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
      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-4.5rem)] flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
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
        {!reveal && (
          <div className="relative w-[min(100%,280px)]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              placeholder="Search a city"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Search a city in South Africa or the Netherlands"
              aria-autocomplete="list"
              className="h-11 w-full rounded-[var(--radius-sm)] border border-border bg-bg/90 pl-9 pr-3 text-sm text-fg outline-none placeholder:text-subtle"
              onFocus={() => {
                if (!expanded) onToggleExpand();
              }}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveHit(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveHit((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveHit((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && hits[activeHit]) {
                  e.preventDefault();
                  goToPlace(hits[activeHit]);
                } else if (e.key === "Escape") {
                  setQuery("");
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
            {query && hits.length > 0 && (
              <ul
                role="listbox"
                className="absolute top-[calc(100%+4px)] z-20 max-h-64 w-full overflow-auto rounded-[var(--radius-sm)] border border-border bg-bg py-1 shadow-[var(--shadow-panel)]"
              >
                {hits.map((place, i) => (
                  <li key={`${place.country}-${place.name}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === activeHit}
                      className={cn(
                        "flex w-full flex-col items-start px-3 py-2 text-left text-sm",
                        i === activeHit ? "bg-bg-subtle" : "hover:bg-bg-subtle",
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => goToPlace(place)}
                    >
                      <span className="font-medium">{place.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted">
                        {place.region} · {place.country === "ZA" ? "South Africa" : "Netherlands"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim() && hits.length === 0 && (
              <p className="absolute top-[calc(100%+4px)] z-20 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2 text-xs text-muted">
                No match in SA or NL
              </p>
            )}
          </div>
        )}
      </div>
      {onLock && !reveal && (
        <button
          type="button"
          disabled={!canLock}
          onClick={onLock}
          className={cn(
            "absolute bottom-3 left-3 z-10 h-11 rounded-[var(--radius-md)] bg-accent px-4 text-sm font-medium text-accent-fg disabled:hidden sm:disabled:inline-flex sm:disabled:opacity-40",
            canLock && "atlas-lock-ready",
          )}
        >
          Lock guess
        </button>
      )}
    </div>
  );
}
