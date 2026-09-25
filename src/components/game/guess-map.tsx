import { useEffect, useMemo, useRef, useState } from "react";
import { Globe, LocateFixed, Lock, Maximize2, Minimize2, Search } from "lucide-react";
import type { LatLng } from "@/lib/game";
import { atlasFocus, atlasIncludes, formatDistance, geodesicPoints, haversineKm, searchPlaces, type AtlasSpec, type Place } from "@/lib/game";
import { cn } from "@/lib/utils";
import worldJson from "@/data/world.json";
import detailJson from "@/data/detail.json";
import { describePoint, type RegionCollection } from "@/lib/map/lookup";
import {
  cityLayers,
  detailCountryLayer,
  graticuleLayer,
  MAP_COLORS,
  NL_BOUNDS,
  provinceLayer,
  regionLabels,
  textMarker,
  toLatLngs,
  worldLayer,
  WORLD_BOUNDS,
  ZA_BOUNDS,
  ZoomGate,
} from "@/lib/map/layers";
import "leaflet/dist/leaflet.css";

/**
 * Leaflet + bundled Natural Earth. SVG paint, no WebGL, no tiles, no keys:
 *  - 110m world for context, 50m ZA/NL + neighbours, 10m provinces
 *  - zoom-gated labels (countries → provinces → towns) so phones stay legible
 *  - tap drops a pin instantly (double-click zoom is off; pinch/wheel/buttons zoom)
 *  - pin readout tells you what you are standing on
 *  - reveal draws the geodesic, labels the distance, pulses TRUE, flies the camera
 */

const WORLD = worldJson as unknown as RegionCollection;
const DETAIL = detailJson as unknown as { countries: RegionCollection; provinces: RegionCollection };
const DETAIL_CODES = new Set(DETAIL.countries.features.map((f) => f.properties.c));

type PinKind = "you" | "truth" | "opp";
type MapStatus = "loading" | "ready" | "error";

function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* not supported */
    }
  }
}

function makePin(kind: PinKind, label?: string) {
  const el = document.createElement("div");
  el.className = `atlas-pin atlas-pin-kind-${kind}`;
  if (kind === "truth") {
    const ring = document.createElement("span");
    ring.className = "atlas-pin-ring";
    el.appendChild(ring);
  }
  const dot = document.createElement("span");
  dot.className = `atlas-pin-dot atlas-pin-${kind}`;
  el.appendChild(dot);
  if (label) {
    const tag = document.createElement("span");
    tag.className = "atlas-pin-label";
    tag.textContent = label;
    el.appendChild(tag);
  }
  return el;
}

/** A ring that spreads from your pin each time it lands somewhere new. */
function ripple(marker: import("leaflet").Marker | undefined) {
  const host = marker?.getElement()?.querySelector(".atlas-pin");
  if (!host || document.documentElement.classList.contains("reduce-motion")) return;
  const ring = document.createElement("span");
  ring.className = "atlas-pin-ripple";
  ring.addEventListener("animationend", () => ring.remove());
  host.appendChild(ring);
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
  urgent,
  atlas,
  selfName,
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
  urgent?: boolean;
  atlas?: AtlasSpec;
  /** The name this player gave; labels their pin at the reveal. */
  selfName?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const pins = useRef<Record<string, import("leaflet").Marker>>({});
  const revealLayers = useRef<import("leaflet").Layer[]>([]);
  const revealRafs = useRef<number[]>([]);
  const viewportKickRef = useRef<(() => void) | null>(null);
  const guessRef = useRef(guess);
  guessRef.current = guess;
  const onGuessRef = useRef(onGuess);
  onGuessRef.current = onGuess;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  const truthRef = useRef(truth);
  truthRef.current = truth;
  const opponentRef = useRef(opponent);
  opponentRef.current = opponent;
  const selfNameRef = useRef(selfName);
  selfNameRef.current = selfName;
  const atlasRef = useRef(atlas);
  atlasRef.current = atlas;
  const pendingFocus = useRef<"ZA" | "NL" | "world" | null>(atlas ? atlasFocus(atlas) : "world");
  const ignoreMapClickUntil = useRef(0);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [epoch, setEpoch] = useState(0);
  const [query, setQuery] = useState("");
  const [activeHit, setActiveHit] = useState(0);
  const hits = useMemo(() => searchPlaces(query, expanded ? 8 : 6), [query, expanded]);
  const readout = useMemo(
    () => (guess ? describePoint(guess, DETAIL.provinces, DETAIL.countries, WORLD) : null),
    [guess],
  );

  // Scalar identities: snapshots clone truth/guess objects every poll, and
  // object deps would restart the reveal choreography each time.
  const truthKey = truth ? `${truth.latitude},${truth.longitude}` : "";
  const guessKey = guess ? `${guess.latitude},${guess.longitude}` : "";
  const opponentKey = opponent ? `${opponent.guess.latitude},${opponent.guess.longitude},${opponent.name}` : "";

  /** Padding that keeps framed content clear of the toolbar / bottom bar. */
  function framePad(): { paddingTopLeft: [number, number]; paddingBottomRight: [number, number] } {
    // Reveal only shows the expand button; guessing adds chips + bottom bar.
    const top = revealRef.current ? 64 : 108;
    const bottom = revealRef.current ? 28 : 60;
    // Desktop keeps the 32vh corner sheet; that whole map is short.
    if (typeof window !== "undefined" && !window.matchMedia("(max-width: 640px)").matches) {
      return {
        paddingTopLeft: [12, Math.min(top, 84)],
        paddingBottomRight: [12, Math.min(bottom, 48)],
      };
    }
    return { paddingTopLeft: [20, top], paddingBottomRight: [20, bottom] };
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    let ro: ResizeObserver | undefined;
    let waitTimer = 0;
    const startedAt = performance.now();

    const waitForBox = (): Promise<void> =>
      new Promise((resolve) => {
        const check = () => {
          const r = host.getBoundingClientRect();
          if ((r.height >= 80 && r.width >= 80) || performance.now() - startedAt > 2000) resolve();
          else waitTimer = window.setTimeout(check, 50);
        };
        check();
      });

    void (async () => {
      try {
        const leaflet = await import("leaflet");
        LRef.current = leaflet;
        await waitForBox();
        if (cancelled || !hostRef.current) return;
        const L = leaflet;

        map = L.map(hostRef.current, {
          center: [10, 14],
          zoom: 2,
          minZoom: 1.5,
          maxZoom: 12,
          zoomControl: false,
          attributionControl: false,
          doubleClickZoom: false,
          zoomSnap: 0.25,
          zoomDelta: 0.5,
          wheelPxPerZoomLevel: 90,
          worldCopyJump: false,
          maxBounds: [
            [-85, -180],
            [85, 180],
          ],
          maxBoundsViscosity: 0.85,
          preferCanvas: false,
        });
        mapRef.current = map;

        graticuleLayer(L).addTo(map);
        worldLayer(L, WORLD, DETAIL_CODES).addTo(map);
        detailCountryLayer(L, DETAIL.countries).addTo(map);
        provinceLayer(L, DETAIL.provinces).addTo(map);
        const gate = new ZoomGate(map);
        cityLayers(L, map, gate);
        regionLabels(L, gate, DETAIL.countries, DETAIL.provinces);
        gate.update();
        map.on("zoomend", () => gate.update());

        L.control.scale({ imperial: false, maxWidth: 120, position: "bottomright" }).addTo(map);
        L.control.zoom({ position: "bottomright" }).addTo(map);

        map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
          if (disabledRef.current) return;
          if (performance.now() < ignoreMapClickUntil.current) return;
          buzz(12);
          onGuessRef.current({ latitude: e.latlng.lat, longitude: e.latlng.lng });
        });

        const applyPending = () => {
          if (!map) return;
          const next = pendingFocus.current;
          if (!next) return;
          const box = map.getSize();
          if (box.x < 80 || box.y < 80) return;
          pendingFocus.current = null;
          const pad = framePad();
          if (next === "world") map.fitBounds(WORLD_BOUNDS, { ...pad, animate: false, maxZoom: 2.2 });
          else if (next === "ZA") map.fitBounds(ZA_BOUNDS, { ...pad, animate: !reducedRef.current, maxZoom: 5.5 });
          else map.fitBounds(NL_BOUNDS, { ...pad, animate: !reducedRef.current, maxZoom: 7.5 });
        };

        const kickSize = () => {
          if (cancelled || !map) return;
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
          kickSize();
          if (guessRef.current) placePin("you", guessRef.current);
        });

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
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(waitTimer);
      if (viewportKickRef.current) {
        window.visualViewport?.removeEventListener("resize", viewportKickRef.current);
        viewportKickRef.current = null;
      }
      ro?.disconnect();
      for (const raf of revealRafs.current) cancelAnimationFrame(raf);
      revealRafs.current = [];
      revealLayers.current = [];
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
      const moved = !existing.getLatLng().equals([point.latitude, point.longitude]);
      existing.setLatLng([point.latitude, point.longitude]);
      if (key === "you" && moved && !revealRef.current) ripple(existing);
      const el = existing.getElement();
      if (el) {
        const tag = el.querySelector(".atlas-pin-label");
        if (label && !tag) {
          const t = document.createElement("span");
          t.className = "atlas-pin-label";
          t.textContent = label;
          el.querySelector(".atlas-pin")?.appendChild(t);
        } else if (tag && label && tag.textContent !== label) {
          tag.textContent = label;
        } else if (tag && !label) {
          tag.remove();
        }
      }
      return;
    }
    const icon = L.divIcon({
      className: "atlas-pin-icon",
      html: makePin(kind, label),
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    const marker = L.marker([point.latitude, point.longitude], {
      icon,
      draggable: key === "you" && !disabledRef.current,
      keyboard: false,
      zIndexOffset: kind === "truth" ? 600 : kind === "you" ? 400 : 200,
    }).addTo(map);
    if (key === "you" && !revealRef.current) ripple(marker);
    if (key === "you") {
      marker.on("dragstart", () => buzz(6));
      marker.on("dragend", () => {
        if (disabledRef.current) return;
        const ll = marker.getLatLng();
        buzz(12);
        onGuessRef.current({ latitude: ll.lat, longitude: ll.lng });
      });
    }
    pins.current[key] = marker;
  }

  function focusCountry(which: "ZA" | "NL" | "world") {
    const map = mapRef.current;
    if (!map) {
      pendingFocus.current = which;
      return;
    }
    const pad = framePad();
    const bounds = which === "ZA" ? ZA_BOUNDS : which === "NL" ? NL_BOUNDS : WORLD_BOUNDS;
    const maxZoom = which === "ZA" ? 5.5 : which === "NL" ? 7.5 : 2.2;
    if (reducedRef.current) map.fitBounds(bounds, { ...pad, animate: false, maxZoom });
    else map.flyToBounds(bounds, { ...pad, maxZoom, duration: 0.7 });
  }

  function focusPin() {
    const map = mapRef.current;
    const g = guessRef.current;
    if (!map || !g) return;
    const zoom = Math.max(map.getZoom(), 7);
    if (reducedRef.current) map.setView([g.latitude, g.longitude], zoom, { animate: false });
    else map.flyTo([g.latitude, g.longitude], zoom, { duration: 0.6 });
  }

  function goToPlace(place: Place) {
    const map = mapRef.current;
    setQuery("");
    setActiveHit(0);
    ignoreMapClickUntil.current = performance.now() + 500;
    if (!disabledRef.current && !revealRef.current) {
      buzz(12);
      onGuessRef.current({ latitude: place.latitude, longitude: place.longitude });
    }
    if (!map) return;
    const zoom = Math.min(place.zoom, 12);
    if (reducedRef.current) map.setView([place.latitude, place.longitude], zoom, { animate: false });
    else map.flyTo([place.latitude, place.longitude], zoom, { duration: 0.8 });
  }

  // Your pin follows the guess; its label explains its state.
  useEffect(() => {
    if (!guess) return;
    placePin("you", guess, "you", reveal ? selfName || "You" : disabled ? "LOCKED" : undefined);
  }, [guess, reveal, disabled, selfName]);

  // Round reset: clear reveal layers, drop stale pins, frame both countries.
  useEffect(() => {
    if (reveal) return;
    const map = mapRef.current;
    for (const raf of revealRafs.current) cancelAnimationFrame(raf);
    revealRafs.current = [];
    for (const layer of revealLayers.current) layer.remove();
    revealLayers.current = [];
    for (const key of ["truth", "opp"] as const) {
      pins.current[key]?.remove();
      delete pins.current[key];
    }
    if (!guess && pins.current.you) {
      pins.current.you.remove();
      delete pins.current.you;
    }
    if (!guess) {
      const which = atlasRef.current ? atlasFocus(atlasRef.current) : "world";
      const bounds = which === "ZA" ? ZA_BOUNDS : which === "NL" ? NL_BOUNDS : WORLD_BOUNDS;
      const maxZoom = which === "ZA" ? 5.5 : which === "NL" ? 7.5 : 2.2;
      pendingFocus.current = which;
      if (map) {
        map.fitBounds(bounds, { ...framePad(), animate: false, maxZoom });
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

  // Reveal choreography. Keys are scalars so cloned snapshot objects do not
  // restart the arcs, labels and camera fly-through on every poll.
  useEffect(() => {
    if (!reveal || !truthKey) return;
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    const currentTruth = truthRef.current;
    const currentGuess = guessRef.current;
    const currentOpponent = opponentRef.current;
    if (!currentTruth) return;
    const reduced = Boolean(reducedMotion);

    for (const raf of revealRafs.current) cancelAnimationFrame(raf);
    revealRafs.current = [];
    for (const layer of revealLayers.current) layer.remove();
    revealLayers.current = [];

    if (guessKey && currentGuess) placePin("you", currentGuess, "you", selfNameRef.current || "You");
    placePin("truth", currentTruth, "truth", "Answer");
    if (opponentKey && currentOpponent) placePin("opp", currentOpponent.guess, "opp", currentOpponent.name);

    const animateArc = (
      pts: [number, number][],
      opts: import("leaflet").PolylineOptions,
      durationMs: number,
      onDone?: () => void,
    ) => {
      const line = L.polyline(reduced ? pts : [], { ...opts, interactive: false }).addTo(map);
      revealLayers.current.push(line);
      if (reduced || durationMs <= 0) {
        onDone?.();
        return;
      }
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        const n = Math.max(2, Math.round(eased * pts.length));
        line.setLatLngs(pts.slice(0, n));
        if (t < 1) revealRafs.current.push(requestAnimationFrame(step));
        else onDone?.();
      };
      revealRafs.current.push(requestAnimationFrame(step));
    };

    if (guessKey && currentGuess) {
      const pts = toLatLngs(geodesicPoints(currentGuess, currentTruth, 64));
      const mid = pts[Math.floor(pts.length / 2)];
      animateArc(pts, { color: MAP_COLORS.arc, weight: 2.25, opacity: 0.9 }, 900, () => {
        if (!mapRef.current) return;
        const label = textMarker(L, mid, formatDistance(haversineKm(currentGuess, currentTruth)), "atlas-distance-label");
        label.addTo(map);
        revealLayers.current.push(label);
      });
    }
    if (opponentKey && currentOpponent) {
      const pts = toLatLngs(geodesicPoints(currentOpponent.guess, currentTruth, 64));
      animateArc(pts, { color: MAP_COLORS.arcOpp, weight: 1.75, opacity: 0.8, dashArray: "6 6" }, 900);
    }

    // Frame the arcs too, not just the endpoints: a ZA↔NL geodesic bows
    // hundreds of kilometres north of the straight-line box.
    const framePts: LatLng[] = [currentTruth];
    if (guessKey && currentGuess) framePts.push(currentGuess);
    if (opponentKey && currentOpponent) framePts.push(currentOpponent.guess);
    const b = L.latLngBounds(toLatLngs(framePts));
    if (guessKey && currentGuess) {
      const arc = toLatLngs(geodesicPoints(currentGuess, currentTruth, 64));
      // Sample the apex every 8 points; cheap and keeps the frame tight.
      for (let i = 4; i < arc.length - 4; i += 8) b.extend(arc[i]);
    }
    revealRafs.current.push(
      requestAnimationFrame(() => {
        revealRafs.current.push(
          requestAnimationFrame(() => {
            const m = mapRef.current;
            if (!m) return;
            m.invalidateSize({ animate: false, pan: false });
            const pad = framePad();
            if (framePts.length === 1) {
              m.setView([currentTruth.latitude, currentTruth.longitude], 4.5, { animate: !reduced });
            } else if (reduced) {
              m.fitBounds(b, { ...pad, maxZoom: 6, animate: false });
            } else {
              m.flyToBounds(b, { ...pad, maxZoom: 6, duration: 1.1 });
            }
          }),
        );
      }),
    );
  }, [reveal, truthKey, guessKey, opponentKey, reducedMotion]);

  const chip =
    "inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-bg/85 px-3 text-[11px] font-medium uppercase tracking-wider text-fg backdrop-blur-sm active:scale-95 transition-transform";

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative overflow-hidden border border-border bg-[#243044] shadow-[var(--shadow-panel)] transition-[width,height,inset,border-radius,box-shadow] duration-300",
        urgent && !reveal && "atlas-map-urgent",
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
                pendingFocus.current = "world";
                setEpoch((n) => n + 1);
              }}
            >
              Retry map
            </button>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[800] flex flex-col gap-2">
        <div className="flex items-start gap-2">
          {!reveal ? (
            <div className="pointer-events-auto relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                placeholder="Search a city to drop a pin"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                aria-label="Search a city to drop a pin"
                aria-autocomplete="list"
                className="h-11 w-full rounded-[var(--radius-sm)] border border-border bg-bg/90 pl-9 pr-3 text-sm text-fg outline-none backdrop-blur-sm placeholder:text-subtle"
                onFocus={() => {
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
                    (e.target as HTMLInputElement).blur();
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
                          "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm",
                          i === activeHit ? "bg-bg-subtle" : "hover:bg-bg-subtle",
                        )}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          goToPlace(place);
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{place.name}</span>
                          <span className="block text-[10px] uppercase tracking-wider text-muted">{place.region}</span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                            place.country === "ZA"
                              ? "bg-za text-fg"
                              : place.country === "NL"
                                ? "bg-nl text-fg"
                                : "border border-border bg-bg-subtle text-fg",
                          )}
                        >
                          {place.country === "ZA" ? "SA" : place.country === "NL" ? "NL" : "World"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim() && hits.length === 0 && (
                <p className="absolute top-[calc(100%+4px)] z-20 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2 text-xs text-muted">
                  No matching city
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <button
            type="button"
            className="pointer-events-auto inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-bg/85 text-fg backdrop-blur-sm"
            onClick={onToggleExpand}
            aria-label={expanded ? "Shrink map" : "Expand map"}
            title={expanded ? "Shrink map" : "Expand map"}
          >
            {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
        {!reveal && (
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
            {(!atlas || atlasIncludes(atlas, "ZA")) && (
              <button type="button" className={cn(chip, "border-transparent bg-za/90")} onClick={() => focusCountry("ZA")} aria-label="Focus map on South Africa">
                SA
              </button>
            )}
            {(!atlas || atlasIncludes(atlas, "NL")) && (
              <button type="button" className={cn(chip, "border-transparent bg-nl/90")} onClick={() => focusCountry("NL")} aria-label="Focus map on the Netherlands">
                NL
              </button>
            )}
            <button type="button" className={chip} onClick={() => focusCountry("world")} aria-label="Show the whole world">
              <Globe className="size-3.5" /> World
            </button>
            {guess && (
              <button type="button" className={chip} onClick={focusPin} aria-label="Zoom to my pin">
                <LocateFixed className="size-3.5" /> My pin
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar: lock + readout, clear of the zoom control on the right. */}
      {!reveal && (onLock || readout) && (
        <div className="pointer-events-none absolute bottom-3 left-3 right-[3.5rem] z-[800] flex items-center gap-2">
          {onLock && (
            <button
              type="button"
              disabled={!canLock}
              onClick={() => {
                buzz([18, 30, 18]);
                onLock();
              }}
              className={cn(
                "pointer-events-auto inline-flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-40",
                canLock && "atlas-lock-ready",
              )}
            >
              <Lock className="size-4" />
              Lock guess
            </button>
          )}
          {readout && (
            <div
              className="pointer-events-auto flex h-11 min-w-0 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-bg/85 px-3 backdrop-blur-sm"
              aria-live="polite"
            >
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  readout.country === "ZA" ? "bg-za" : readout.country === "NL" ? "bg-nl" : "bg-subtle",
                )}
              />
              <span className="min-w-0 truncate text-xs leading-tight">
                <span className="block truncate font-medium">{readout.primary}</span>
                {readout.secondary && (
                  <span className="block truncate text-[10px] uppercase tracking-wider text-muted">{readout.secondary}</span>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}