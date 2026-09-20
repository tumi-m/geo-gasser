import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { LatLng } from "@/lib/game";
import { geodesicPoints, PLACES, searchPlaces, type Place } from "@/lib/game";
import { cn } from "@/lib/utils";
import worldJson from "@/data/world.json";
import type { FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";

/**
 * Bundled Natural Earth 110m countries, rendered by Leaflet as SVG.
 * No WebGL, no tile CDN, no network fetch — the map paints on first try,
 * even offline, on Android Chrome where MapLibre fills came up black.
 */

const worldData = worldJson as unknown as FeatureCollection;

const COLORS = {
  water: "#243044",
  land: "#8b93a3",
  za: "#3f9a70",
  nl: "#d96a32",
  border: "#10141c",
  city: "#f4f4f0",
};

/** Leaflet order: [lat, lng] — GeoJSON is [lng, lat], do not mix them up. */
const BOTH_BOUNDS: [[number, number], [number, number]] = [
  [-35.0, 3.2],
  [53.6, 32.9],
];
const ZA_BOUNDS: [[number, number], [number, number]] = [
  [-34.85, 16.5],
  [-22.1, 32.9],
];
const NL_BOUNDS: [[number, number], [number, number]] = [
  [50.75, 3.32],
  [53.55, 7.23],
];

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
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const pins = useRef<Record<string, import("leaflet").Marker>>({});
  const arcRef = useRef<import("leaflet").Polyline | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const viewportKickRef = useRef<(() => void) | null>(null);
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
    let map: import("leaflet").Map | null = null;
    let ro: ResizeObserver | undefined;
    const watchdog = 0;
    let waitTimer = 0;
    let L: typeof import("leaflet");

    const boot = async () => {
      try {
        L = await import("leaflet");
        LRef.current = L;
        // Guard from the contract: never init into a zero-height box.
        // vh-based first layout on Android Chrome can measure ~0.
        const waitForBox = () =>
          new Promise<void>((resolve) => {
            const check = () => {
              const r = host.getBoundingClientRect();
              if (r.height >= 80 && r.width >= 80) {
                resolve();
                return;
              }
              waitTimer = window.setTimeout(check, 60);
            };
            check();
          });
        await waitForBox();
        if (cancelled || !hostRef.current) return;

        map = L.map(hostRef.current, {
          center: [10, 14],
          zoom: 2,
          minZoom: 1,
          maxZoom: 12,
          zoomControl: false,
          attributionControl: false,
          zoomSnap: 0.5,
          zoomDelta: 0.5,
          worldCopyJump: false,
          maxBounds: [[-85, -180], [85, 180]],
          maxBoundsViscosity: 0.8,
          preferCanvas: false,
        });
        mapRef.current = map;

        L.geoJSON(worldData, {
          style: (feature) => {
            const c = (feature?.properties as { c?: string } | undefined)?.c;
            if (c === "ZA") return { color: COLORS.border, weight: 0.8, fillColor: COLORS.za, fillOpacity: 1 };
            if (c === "NL") return { color: COLORS.border, weight: 0.8, fillColor: COLORS.nl, fillOpacity: 1 };
            return { color: COLORS.border, weight: 0.6, fillColor: COLORS.land, fillOpacity: 1 };
          },
        }).addTo(map);

        // City dots: circle markers over the polygons.
        const dotLayer = L.layerGroup().addTo(map);
        for (const place of PLACES) {
          if (!place.major) continue;
          L.circleMarker([place.latitude, place.longitude], {
            radius: 3.2,
            color: "#09090b",
            weight: 1,
            fillColor: COLORS.city,
            fillOpacity: 1,
          })
            .bindTooltip(place.name, { direction: "top", offset: [0, -6] })
            .addTo(dotLayer);
        }
        map.on("zoomend", () => {
          const z = map!.getZoom();
          dotLayer.getLayers().forEach((layer) => {
            const cm = layer as import("leaflet").CircleMarker;
            cm.setStyle({ fillOpacity: z >= 3 ? 1 : 0.55, opacity: z >= 3 ? 1 : 0.55 });
          });
        });

        // Country labels as HTML markers — readable even without glyphs/tiles.
        const mkLabel = (text: string, at: [number, number]) => {
          const el = document.createElement("span");
          el.className = "atlas-country-label";
          el.textContent = text;
          L.marker(at, {
            icon: L.divIcon({ className: "atlas-label-icon", html: el, iconSize: [0, 0] }),
            interactive: false,
            keyboard: false,
          }).addTo(map!);
        };
        mkLabel("SOUTH AFRICA", [-29.5, 24.8]);
        mkLabel("NETHERLANDS", [52.2, 5.3]);

        const applyPending = () => {
          if (!map) return;
          const next = pendingFocus.current;
          if (!next) return;
          const box = map.getSize();
          if (box.x < 80 || box.y < 80) return;
          pendingFocus.current = null;
          const duration = reducedRef.current ? 0 : next === "both" ? 0 : 750;
          if (next === "both") map.fitBounds(BOTH_BOUNDS, { padding: [16, 16], animate: false, maxZoom: 2.8 });
          else if (next === "ZA") map.fitBounds(ZA_BOUNDS, { padding: [28, 28], animate: duration > 0, duration, maxZoom: 5.1 });
          else map.fitBounds(NL_BOUNDS, { padding: [28, 28], animate: duration > 0, duration, maxZoom: 7.1 });
        };

        map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
          if (disabledRef.current) return;
          onGuessRef.current({ latitude: e.latlng.lat, longitude: e.latlng.lng });
        });

        const kickSize = () => {
          if (cancelled || !map) return;
          // Two rAFs = layout + paint settled, then Leaflet recomputes.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (cancelled || !map) return;
              map.invalidateSize({ animate: false, pan: false });
              applyPending();
            });
          });
        };
        map.whenReady(() => {
          if (cancelled) return;
          setStatus("ready");
          window.clearTimeout(watchdog);
          kickSize();
          if (guessRef.current) placePin("you", guessRef.current);
        });

        L.control.zoom({ position: "bottomright" }).addTo(map);

        const wrap = wrapRef.current;
        if (wrap) {
          ro = new ResizeObserver(kickSize);
          ro.observe(wrap);
        }
        const onViewport = () => kickSize();
        window.visualViewport?.addEventListener("resize", onViewport);
        viewportKickRef.current = onViewport;
        kickSize();
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    void boot();

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      window.clearTimeout(waitTimer);
      if (viewportKickRef.current) {
        window.visualViewport?.removeEventListener("resize", viewportKickRef.current);
        viewportKickRef.current = null;
      }
      ro?.disconnect();
      map?.remove();
      mapRef.current = null;
      pins.current = {};
    };
     
  }, [epoch]);

  function placePin(key: string, point: LatLng, kind: PinKind = "you", label?: string) {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    const existing = pins.current[key];
    if (existing) {
      existing.setLatLng([point.latitude, point.longitude]);
      const el = existing.getElement();
      if (el) {
        const tag = el.querySelector(".atlas-pin-label");
        if (label && !tag) {
          const t = document.createElement("span");
          t.className = "atlas-pin-label";
          t.textContent = label;
          el.appendChild(t);
        } else if (label && tag && tag.textContent !== label) {
          tag.textContent = label;
        }
      }
      return;
    }
    const el = makePin(kind, label);
    const icon = L.divIcon({
      className: "atlas-pin-icon",
      html: el,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    const marker = L.marker([point.latitude, point.longitude], {
      icon,
      draggable: key === "you" && !disabledRef.current,
      keyboard: false,
      zIndexOffset: kind === "truth" ? 500 : 0,
    }).addTo(map);
    if (key === "you") {
      marker.on("dragend", () => {
        if (disabledRef.current) return;
        const ll = marker.getLatLng();
        onGuessRef.current({ latitude: ll.lat, longitude: ll.lng });
      });
    }
    pins.current[key] = marker;
  }

  function focusCountry(which: "ZA" | "NL") {
    const map = mapRef.current;
    const bounds = which === "ZA" ? ZA_BOUNDS : NL_BOUNDS;
    if (!map) {
      pendingFocus.current = which;
      return;
    }
    map.fitBounds(bounds, {
      padding: [expanded ? 48 : 28, expanded ? 48 : 28],
      maxZoom: which === "ZA" ? 5.1 : 7.1,
      animate: !reducedRef.current,
      duration: reducedRef.current ? 0 : 750,
    });
  }

  function goToPlace(place: Place) {
    const map = mapRef.current;
    setQuery(place.name);
    setActiveHit(0);
    if (!map) return;
    map.flyTo([place.latitude, place.longitude], Math.min(place.zoom, 12), {
      duration: reducedRef.current ? 0 : 800,
    });
  }

  useEffect(() => {
    if (!guess) return;
    placePin("you", guess, "you", reveal ? "YOU" : undefined);
  }, [guess, reveal]);

  useEffect(() => {
    if (reveal) return;
    const map = mapRef.current;
    for (const key of ["truth", "opp", "arc"] as const) {
      if (key === "arc") {
        arcRef.current?.remove();
        arcRef.current = null;
        continue;
      }
      pins.current[key]?.remove();
      delete pins.current[key];
    }
    if (!guess && pins.current.you) {
      pins.current.you.remove();
      delete pins.current.you;
    }
    if (!guess) {
      pendingFocus.current = "both";
      if (map) {
        map.fitBounds(BOTH_BOUNDS, { padding: [16, 16], animate: false, maxZoom: 2.8 });
        pendingFocus.current = null;
      }
    }
  }, [reveal, guess]);

  useEffect(() => {
    const you = pins.current.you;
    if (!you) return;
    if (disabled) you.dragging?.disable();
    else you.dragging?.enable();
  }, [disabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = window.setTimeout(() => map.invalidateSize({ animate: false, pan: false }), 320);
    return () => window.clearTimeout(id);
  }, [expanded, reveal]);

  useEffect(() => {
    if (!reveal || !truth) return;
    const map = mapRef.current;
    if (!map) return;
    void (async () => {
      const L = LRef.current ?? (await import("leaflet"));
      LRef.current = L;
      // YOU first so bounds include it, then truth + opponent.
      if (guess) placePin("you", guess, "you", "YOU");
      placePin("truth", truth, "truth", "TRUE");
      if (opponent) placePin("opp", opponent.guess, "opp", opponent.name);
      if (guess) {
        const line = geodesicPoints(guess, truth, 48).map((p) => [p.latitude, p.longitude]) as [number, number][];
        arcRef.current?.remove();
        arcRef.current = L.polyline(line, { color: "#d5d8de", weight: 2, opacity: 0.85, interactive: false }).addTo(map);
      }
      const pts = [truth, guess, opponent?.guess].filter(Boolean) as LatLng[];
      const b = L.latLngBounds(pts.map((p) => [p.latitude, p.longitude] as [number, number]));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!mapRef.current) return;
          mapRef.current.invalidateSize({ animate: false, pan: false });
          mapRef.current.fitBounds(b, {
            padding: [48, 48],
            maxZoom: 5.5,
            animate: !reducedMotion,
            duration: reducedMotion ? 0 : 900,
          });
        });
      });
    })();
  }, [reveal, truth, guess, opponent, reducedMotion]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative overflow-hidden border border-border bg-[#14141c] shadow-[var(--shadow-panel)] transition-[width,height,inset,border-radius] duration-300",
        expanded
          ? "fixed inset-3 z-30 rounded-[var(--radius-xl)]"
          : reveal
            ? "absolute inset-x-3 bottom-3 z-30 h-[var(--atlas-map-reveal-h)] rounded-[var(--radius-xl)] max-sm:bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
            : "absolute right-3 bottom-3 z-20 h-[var(--atlas-map-h)] w-[min(100%-1.5rem,400px)] rounded-[var(--radius-lg)] max-sm:inset-x-3 max-sm:w-auto max-sm:bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div ref={hostRef} className="absolute inset-0 z-0" role="application" aria-label="Guessing map" />
      {status !== "ready" && (
        <div className="pointer-events-none absolute inset-0 z-[701] flex items-center justify-center bg-bg-elevated/80">
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
      <div className="absolute left-3 top-3 z-[800] flex max-w-[calc(100%-4.5rem)] flex-col gap-2">
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
                // Desktop keeps the corner-sheet behaviour; phones are
                // already split-screen, so expanding would shrink the map.
                if (!expanded && window.matchMedia("(min-width: 641px)").matches) onToggleExpand();
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
            "absolute bottom-3 left-3 z-[800] h-11 rounded-[var(--radius-md)] bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-40",
            canLock && "atlas-lock-ready",
          )}
        >
          Lock guess
        </button>
      )}
    </div>
  );
}