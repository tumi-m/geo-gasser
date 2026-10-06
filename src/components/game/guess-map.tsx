import { useEffect, useMemo, useRef, useState } from "react";
import { Globe, LocateFixed, Lock, MapPin, Maximize2, Minimize2, Search, X } from "lucide-react";
import type { LatLng } from "@/lib/game";
import { atlasFocus, atlasIncludes, formatDistance, geodesicPoints, haversineKm, type AtlasSpec } from "@/lib/game";
import type { Place } from "@/lib/map/places";
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
  /** Re-fits the reveal (answer, pins, arcs) after the map changes size. */
  const revealFrameRef = useRef<(() => void) | null>(null);
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
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [region, setRegion] = useState<"ZA" | "NL" | "world" | null>(atlas ? atlasFocus(atlas) : "world");
  const [activeHit, setActiveHit] = useState(0);
  // Towns load with the map (thousands of them; not in the page bundle).
  const [places, setPlaces] = useState<typeof import("@/lib/map/places") | null>(null);
  const hits = useMemo(
    () => (places ? places.searchPlaces(query, expanded ? 8 : 6) : []),
    [places, query, expanded],
  );
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
    // The tool strip and lock bar sit outside the map; the reveal overlays
    // only its expand button.
    const top = revealRef.current ? 64 : 16;
    const bottom = revealRef.current ? 36 : 16;
    // At the reveal pin labels ("Answer", names) sit to the right of their
    // pins; leave room so a pin in the corner keeps its label on screen.
    const right = revealRef.current ? 72 : 20;
    // Desktop keeps the 32vh corner sheet; that whole map is short.
    if (typeof window !== "undefined" && !window.matchMedia("(max-width: 640px)").matches) {
      return {
        paddingTopLeft: [12, Math.min(top, 84)],
        paddingBottomRight: [Math.max(12, right), Math.min(bottom, 48)],
      };
    }
    return { paddingTopLeft: [20, top], paddingBottomRight: [right, bottom] };
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
        const [leaflet, placeModule] = await Promise.all([import("leaflet"), import("@/lib/map/places")]);
        LRef.current = leaflet;
        if (!cancelled) setPlaces(placeModule);
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
        // The furthest zoom-out shows the world once across the panel's
        // width: a fixed 1.5 kept short panels (the desktop corner sheet)
        // from ever fitting the Netherlands and South Africa together, and
        // a wide expanded map from zooming out into empty sea.
        const fitMinZoom = () => {
          const width = map?.getSize().x ?? 0;
          if (width > 0) map?.setMinZoom(Math.max(1, Math.floor(Math.log2(width / 256) * 4) / 4));
        };
        fitMinZoom();
        map.on("resize", fitMinZoom);

        graticuleLayer(L).addTo(map);
        worldLayer(L, WORLD, DETAIL_CODES).addTo(map);
        detailCountryLayer(L, DETAIL.countries).addTo(map);
        provinceLayer(L, DETAIL.provinces).addTo(map);
        const gate = new ZoomGate(map);
        cityLayers(L, map, gate, placeModule.PLACES);
        regionLabels(L, gate, DETAIL.countries, DETAIL.provinces);
        gate.update();
        map.on("zoomend moveend", () => gate.update());

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
          ro.observe(host);
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
    setRegion(which);
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
    setSearching(false);
    setRegion(null);
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

  // "/" opens the city search from anywhere in a round (not while typing).
  useEffect(() => {
    if (reveal || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      setSearching(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reveal, disabled]);

  // The search field opens focused, and closes for the reveal.
  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);
  useEffect(() => {
    if (reveal) setSearching(false);
  }, [reveal]);

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
      setRegion(which);
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
    const id = window.setTimeout(() => {
      map.invalidateSize({ animate: false, pan: false });
      if (reveal) revealFrameRef.current?.();
    }, 320);
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
      comet?: "you" | "opp",
    ) => {
      const line = L.polyline(reduced ? pts : [], { ...opts, interactive: false }).addTo(map);
      revealLayers.current.push(line);
      if (reduced || durationMs <= 0) {
        onDone?.();
        return;
      }
      // A glowing head leads the line from the pin to the answer, and lands
      // with a burst.
      const head = comet
        ? L.marker(pts[0], {
            icon: L.divIcon({ className: `atlas-comet is-${comet}`, html: "<i></i>", iconSize: [0, 0] }),
            interactive: false,
            keyboard: false,
            zIndexOffset: 900,
          }).addTo(map)
        : null;
      if (head) revealLayers.current.push(head);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        const n = Math.max(2, Math.round(eased * pts.length));
        line.setLatLngs(pts.slice(0, n));
        head?.setLatLng(pts[n - 1]);
        if (t < 1) revealRafs.current.push(requestAnimationFrame(step));
        else {
          head?.remove();
          if (comet === "you" && mapRef.current) {
            const burst = L.marker(pts[pts.length - 1], {
              icon: L.divIcon({ className: "atlas-impact", html: "<i></i><i></i>", iconSize: [0, 0] }),
              interactive: false,
              keyboard: false,
            }).addTo(map);
            revealLayers.current.push(burst);
          }
          onDone?.();
        }
      };
      revealRafs.current.push(requestAnimationFrame(step));
    };

    if (guessKey && currentGuess) {
      const pts = toLatLngs(geodesicPoints(currentGuess, currentTruth, 64));
      const mid = pts[Math.floor(pts.length / 2)];
      animateArc(pts, { color: MAP_COLORS.arc, weight: 2.25, opacity: 0.9 }, 1100, () => {
        if (!mapRef.current) return;
        const label = textMarker(L, mid, formatDistance(haversineKm(currentGuess, currentTruth)), "atlas-distance-label");
        label.addTo(map);
        revealLayers.current.push(label);
      }, "you");
    }
    if (opponentKey && currentOpponent) {
      const pts = toLatLngs(geodesicPoints(currentOpponent.guess, currentTruth, 64));
      animateArc(
        pts,
        { color: MAP_COLORS.arcOpp, weight: 1.75, opacity: 0.8, dashArray: "6 6" },
        1100,
        undefined,
        "opp",
      );
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
    const frame = (animate: boolean) => {
      const m = mapRef.current;
      if (!m) return;
      m.invalidateSize({ animate: false, pan: false });
      const pad = framePad();
      if (framePts.length === 1) {
        m.setView([currentTruth.latitude, currentTruth.longitude], 4.5, { animate });
      } else if (!animate) {
        m.fitBounds(b, { ...pad, maxZoom: 6, animate: false });
      } else {
        m.flyToBounds(b, { ...pad, maxZoom: 6, duration: 1.1 });
      }
    };
    revealFrameRef.current = () => frame(false);
    revealRafs.current.push(
      requestAnimationFrame(() => {
        revealRafs.current.push(requestAnimationFrame(() => frame(!reduced)));
      }),
    );
    // On desktop the dock widens from the corner into the reveal strip over
    // 300ms; framing only at the start fitted the small corner map and left
    // the reveal at world zoom. Frame again once the size has settled.
    const settle = window.setTimeout(() => {
      const m = mapRef.current;
      if (!m) return;
      const size = m.getSize();
      m.invalidateSize({ animate: false, pan: false });
      const now = m.getSize();
      if (now.x !== size.x || now.y !== size.y || !m.getBounds().contains(b)) frame(!reduced);
    }, 360);
    return () => {
      window.clearTimeout(settle);
      revealFrameRef.current = null;
    };
  }, [reveal, truthKey, guessKey, opponentKey, reducedMotion]);

  const regionButtons: { id: "ZA" | "NL" | "world"; label: string; name: string }[] = [
    ...((!atlas || atlasIncludes(atlas, "ZA"))
      ? [{ id: "ZA" as const, label: "SA", name: "South Africa" }]
      : []),
    ...((!atlas || atlasIncludes(atlas, "NL"))
      ? [{ id: "NL" as const, label: "NL", name: "the Netherlands" }]
      : []),
    { id: "world", label: "World", name: "the whole world" },
  ];
  const closeSearch = () => {
    setSearching(false);
    setQuery("");
    setActiveHit(0);
  };

  return (
    <div
      ref={wrapRef}
      className={cn(
        "map-dock overflow-hidden border border-border bg-[#243044] shadow-[var(--shadow-panel)] transition-[width,height,inset,border-radius,box-shadow,opacity] duration-300",
        urgent && !reveal && "atlas-map-urgent",
        reveal && "is-reveal",
        expanded
          ? "is-expanded fixed inset-3 z-30 rounded-[var(--radius-xl)]"
          : reveal
            ? "absolute inset-x-3 bottom-3 z-30 h-[var(--atlas-map-reveal-h)] rounded-[var(--radius-xl)] max-sm:bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
            : "is-docked absolute right-3 bottom-3 z-20 h-[var(--atlas-map-h)] w-[var(--atlas-map-w)] rounded-[var(--radius-lg)] max-sm:inset-x-3 max-sm:w-auto max-sm:bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      {/* Tools live in a strip above the map, never on top of it. */}
      {!reveal && (
        <div className="map-dock-bar is-top">
          {searching ? (
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder="Search a city or town"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                aria-label="Search a city to drop a pin"
                aria-autocomplete="list"
                className="h-10 w-full rounded-full border border-border bg-bg pl-9 pr-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-accent/60"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveHit(0);
                }}
                onBlur={() => {
                  if (!query.trim()) setSearching(false);
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
                    e.stopPropagation();
                    closeSearch();
                  }
                }}
              />
              {query && hits.length > 0 && (
                <ul
                  role="listbox"
                  className="map-search-list absolute top-[calc(100%+6px)] z-20 max-h-64 w-full overflow-auto rounded-[var(--radius-md)] border border-border bg-bg py-1 shadow-[var(--shadow-panel)]"
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
                          {place.country === "ZA" ? "SA" : place.country === "NL" ? "NL" : place.nation}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim() && hits.length === 0 && (
                <p className="absolute top-[calc(100%+6px)] z-20 w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-xs text-muted">
                  No matching city
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="map-regions" role="group" aria-label="Jump the map to">
                {regionButtons.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={cn("hit-44", region === r.id && "is-on")}
                    aria-pressed={region === r.id}
                    aria-label={`Show ${r.name}`}
                    onClick={() => focusCountry(r.id)}
                  >
                    {r.id === "world" ? (
                      <Globe className="size-3.5" />
                    ) : (
                      <i className={r.id === "ZA" ? "bg-za" : "bg-nl"} aria-hidden />
                    )}
                    <span className={r.id === "world" ? "map-region-label" : undefined}>{r.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              {guess && (
                <button type="button" className="map-tool hit-44" onClick={focusPin} aria-label="Zoom to my pin" title="Zoom to my pin">
                  <LocateFixed className="size-4" />
                </button>
              )}
              <button
                type="button"
                className="map-tool hit-44"
                aria-label="Search a city"
                title="Search a city ( / )"
                onClick={() => {
                  setSearching(true);
                  if (!expanded && window.matchMedia("(min-width: 641px)").matches) onToggleExpand();
                }}
              >
                <Search className="size-4" />
              </button>
            </>
          )}
          {searching ? (
            <button type="button" className="map-tool hit-44" onClick={closeSearch} aria-label="Close search" title="Close search">
              <X className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              className="map-tool hit-44"
              onClick={onToggleExpand}
              aria-label={expanded ? "Shrink map" : "Expand map"}
              title={expanded ? "Shrink map" : "Expand map"}
            >
              {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          )}
        </div>
      )}

      <div className="relative z-0 min-h-0 flex-1">
        <div
          ref={hostRef}
          className="absolute inset-0"
          role="application"
          aria-label="Guessing map"
          aria-describedby="map-keys-help"
          onKeyDown={(e) => {
            // Keyboard play: arrows pan and +/- zoom (Leaflet); Enter or Space
            // drops the pin under the crosshair at the centre.
            if ((e.key === "Enter" || e.key === " ") && !disabled && !reveal && mapRef.current) {
              const c = mapRef.current.getCenter();
              const g = guessRef.current;
              // Enter on a pin already at the crosshair falls through and locks.
              const placed = g && Math.abs(g.latitude - c.lat) < 1e-6 && Math.abs(g.longitude - c.lng) < 1e-6;
              if (placed && e.key === "Enter") return;
              e.preventDefault();
              e.stopPropagation();
              buzz(12);
              onGuess({ latitude: c.lat, longitude: c.lng });
            }
          }}
        />
        <p id="map-keys-help" className="sr-only">
          Arrow keys move the map, plus and minus zoom, Enter drops your pin at the centre and Enter again locks
          it. Press slash to search a city.
        </p>
        {!reveal && <span className="map-crosshair" aria-hidden />}

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

        {reveal && (
          <div className="absolute right-3 top-3 z-[800]">
            <button
              type="button"
              className="map-tool hit-44 border border-border bg-bg/85 backdrop-blur-sm"
              onClick={onToggleExpand}
              aria-label={expanded ? "Shrink map" : "Expand map"}
              title={expanded ? "Shrink map" : "Expand map"}
            >
              {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        )}
      </div>

      {/* One action bar: where your pin is, and the button that commits it. */}
      {!reveal && (onLock || readout) && (
        <div className={cn("map-dock-bar is-bottom", canLock && onLock && "is-armed")}>
          <div className="flex min-w-0 flex-1 items-center gap-2" aria-live="polite">
            {readout ? (
              <>
                <span
                  className={cn(
                    "map-readout-dot size-2 shrink-0 rounded-full",
                    readout.country === "ZA" ? "bg-za" : readout.country === "NL" ? "bg-nl" : "bg-subtle",
                  )}
                  key={guessKey}
                />
                <span className="min-w-0 text-xs leading-tight" key={`t-${guessKey}`}>
                  <span className="map-readout block truncate font-medium text-fg">{readout.primary}</span>
                  {readout.secondary && (
                    <span className="block truncate text-[10px] uppercase tracking-wider text-muted">{readout.secondary}</span>
                  )}
                </span>
              </>
            ) : (
              <>
                <MapPin className="size-4 shrink-0 text-accent" aria-hidden />
                <span className="truncate text-xs text-muted">Tap the map to guess</span>
              </>
            )}
          </div>
          {onLock && (
            <button
              type="button"
              disabled={!canLock}
              onClick={() => {
                buzz([18, 30, 18]);
                onLock();
              }}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-4 text-sm font-semibold text-accent-fg transition-[opacity,transform] active:scale-[.97] disabled:opacity-35",
                canLock && "atlas-lock-ready",
              )}
            >
              <Lock className="size-4" />
              Lock guess
            </button>
          )}
        </div>
      )}
    </div>
  );
}