import type { LatLng } from "@/lib/game";
import type { Place } from "./places";
import { splitAtDateLine } from "./dateline";
import { COUNTRY_NAMES, labelPoint, type RegionCollection } from "./lookup";

type Leaflet = typeof import("leaflet");
type LMap = import("leaflet").Map;

export const MAP_COLORS = {
  water: "#243044",
  land: "#8b93a3",
  neighbour: "#9aa3b3",
  za: "#3f9a70",
  nl: "#d96a32",
  border: "#10141c",
  province: "rgba(9, 9, 11, 0.5)",
  graticule: "rgba(244, 244, 240, 0.07)",
  city: "#f4f4f0",
  arc: "#f4f4f0",
  arcOpp: "#d96a32",
} as const;

/** Leaflet order: [lat, lng]. */
export const BOTH_BOUNDS: [[number, number], [number, number]] = [
  [-35.0, 3.2],
  [53.6, 32.9],
];
export const ZA_BOUNDS: [[number, number], [number, number]] = [
  [-34.85, 16.5],
  [-22.1, 32.9],
];
export const NL_BOUNDS: [[number, number], [number, number]] = [
  [50.75, 3.32],
  [53.55, 7.23],
];
// The lived-in band, centred near 10°N in Mercator. The old 56°S–72°N box
// centred near 19°N, so where the minimum zoom stops the fit (narrow phones)
// South Africa dropped off the bottom of the map.
export const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-50, -160],
  [62, 170],
];

/** A marker that is only on the map inside a zoom window. */
export interface GatedMarker {
  marker: import("leaflet").Layer;
  minZoom: number;
  maxZoom: number;
  /** Where it sits; set it to keep it off the map while out of view. */
  at?: [number, number];
}

export class ZoomGate {
  private items: GatedMarker[] = [];
  private shown = new Set<import("leaflet").Layer>();
  constructor(private map: LMap) {}
  add(item: GatedMarker) {
    this.items.push(item);
  }
  update(zoom = this.map.getZoom()) {
    // Thousands of towns: only those in (or near) view go on the map.
    const view = this.map.getBounds().pad(0.35);
    for (const item of this.items) {
      const wanted =
        zoom >= item.minZoom && zoom < item.maxZoom && (!item.at || view.contains(item.at));
      const on = this.shown.has(item.marker);
      if (wanted && !on) {
        item.marker.addTo(this.map);
        this.shown.add(item.marker);
      } else if (!wanted && on) {
        item.marker.remove();
        this.shown.delete(item.marker);
      }
    }
  }
  clear() {
    for (const m of this.shown) m.remove();
    this.shown.clear();
    this.items = [];
  }
}

export function textMarker(
  L: Leaflet,
  at: [number, number],
  text: string,
  className: string,
  pane = "markerPane",
) {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  return L.marker(at, {
    icon: L.divIcon({ className: "atlas-label-icon", html: el, iconSize: [0, 0] }),
    interactive: false,
    keyboard: false,
    pane,
  });
}

/** Base world at 110m, minus the countries we redraw in detail. */
export function worldLayer(L: Leaflet, world: RegionCollection, skip: Set<string>) {
  const trimmed: RegionCollection = {
    type: "FeatureCollection",
    features: world.features.filter((f) => !skip.has(f.properties.c)).map(unwrapFeature),
  };
  return L.geoJSON(trimmed, {
    interactive: false,
    style: () => ({ color: MAP_COLORS.border, weight: 0.6, fillColor: MAP_COLORS.land, fillOpacity: 1 }),
  });
}

function unwrapFeature<F extends RegionCollection["features"][number]>(f: F): F {
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  if (!polys.some((p) => p.some((r) => r.some((pt, i) => i > 0 && Math.abs(pt[0] - r[i - 1][0]) > 180)))) return f;
  // Each half becomes its own polygon (holes do not cross the line here).
  const pieces = polys.flatMap((p) => splitAtDateLine(p[0]).map((outer) => [outer, ...p.slice(1)]));
  return { ...f, geometry: { type: "MultiPolygon", coordinates: pieces } } as F;
}

/** ZA / NL and neighbours at 50m. */
export function detailCountryLayer(L: Leaflet, countries: RegionCollection) {
  return L.geoJSON(countries, {
    interactive: false,
    style: (feature) => {
      const c = (feature?.properties as { c?: string } | undefined)?.c;
      if (c === "ZA") return { color: "#0b1a14", weight: 1.4, fillColor: MAP_COLORS.za, fillOpacity: 1 };
      if (c === "NL") return { color: "#241008", weight: 1.4, fillColor: MAP_COLORS.nl, fillOpacity: 1 };
      return { color: MAP_COLORS.border, weight: 0.7, fillColor: MAP_COLORS.neighbour, fillOpacity: 1 };
    },
  });
}

/** Province borders. Dashed and subtle so they read as internal lines. */
export function provinceLayer(L: Leaflet, provinces: RegionCollection) {
  return L.geoJSON(provinces, {
    interactive: false,
    style: () => ({ color: MAP_COLORS.province, weight: 0.9, dashArray: "3 3", fill: false }),
  });
}

/** 5° graticule for orientation. Cheap: ~70 polylines. */
export function graticuleLayer(L: Leaflet) {
  const group = L.layerGroup();
  const style = { color: MAP_COLORS.graticule, weight: 1, interactive: false, pane: "tilePane" } as const;
  // The grid runs three worlds wide. On a panel wider than the world at its
  // zoom (a wide reveal on desktop), the sides past the date line read as
  // open ocean instead of blank panel. Land is drawn once; clicks unchanged.
  for (let lng = -540; lng <= 540; lng += 5) {
    L.polyline([[-85, lng], [85, lng]], style).addTo(group);
  }
  for (let lat = -80; lat <= 80; lat += 5) {
    L.polyline([[lat, -540], [lat, 540]], style).addTo(group);
  }
  return group;
}

/**
 * Towns and cities, revealed by size as you zoom (tier 0 = megacities and
 * capitals … 5 = small towns), so every country shows many dots at every
 * zoom and none of them stands for an answer. Dots paint on one canvas;
 * labels are culled to the view.
 */
const DOT_ZOOM = [1.5, 3, 4.25, 5, 7.75, 8.75];
const LABEL_ZOOM = [3.75, 5, 6, 7.75, 8.75, 9.75];

export function cityLayers(L: Leaflet, map: LMap, gate: ZoomGate, places: readonly Place[]) {
  // Dots get their own pane above the land (the canvas would otherwise sit
  // under the SVG countries and only show at sea) and below the pins.
  // Towns are for context at the reveal only: while you guess, a country with
  // one or two dots would invite you to pin the dot (styles.css hides both
  // panes until the map is revealing).
  if (!map.getPane("atlas-dots")) {
    const pane = map.createPane("atlas-dots");
    pane.style.zIndex = "450";
    pane.style.pointerEvents = "none";
  }
  if (!map.getPane("atlas-towns")) {
    const pane = map.createPane("atlas-towns");
    pane.style.zIndex = "550";
    pane.style.pointerEvents = "none";
  }
  const renderer = L.canvas({ pane: "atlas-dots", padding: 0.35 });
  const labels: CityLabel[] = [];
  for (const place of places) {
    const at: [number, number] = [place.latitude, place.longitude];
    const t = Math.min(5, Math.max(0, place.tier));
    gate.add({
      marker: L.circleMarker(at, {
        pane: "atlas-dots",
        renderer,
        radius: t <= 1 ? 3.2 : t <= 3 ? 2.6 : 2.1,
        color: "#09090b",
        weight: 1,
        fillColor: MAP_COLORS.city,
        fillOpacity: 1,
        interactive: false,
      }),
      minZoom: DOT_ZOOM[t],
      maxZoom: 99,
      at,
    });
    const major = t <= 1;
    labels.push({
      marker: textMarker(L, at, place.name, `atlas-city-label ${major ? "atlas-city-major" : ""}`, "atlas-towns"),
      at,
      tier: t,
      minZoom: LABEL_ZOOM[t],
      // Rough text box to the right of the dot (labels sit at +6px).
      width: place.name.length * (major ? 6.6 : 5.6) + 10,
      shown: false,
    });
  }
  // Bigger places first; a label that would overlap one already placed waits
  // for the next zoom level instead of piling on top of it.
  labels.sort((a, b) => a.tier - b.tier);
  const layout = () => {
    const zoom = map.getZoom();
    const view = map.getBounds().pad(0.1);
    const taken: [number, number, number, number][] = [];
    for (const label of labels) {
      let want = zoom >= label.minZoom && view.contains(label.at);
      if (want) {
        const p = map.latLngToContainerPoint(label.at);
        const box: [number, number, number, number] = [p.x + 2, p.y - 8, p.x + label.width, p.y + 8];
        want = !taken.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
        if (want) taken.push(box);
      }
      if (want && !label.shown) label.marker.addTo(map);
      else if (!want && label.shown) label.marker.remove();
      label.shown = want;
    }
  };
  map.on("zoomend moveend", layout);
  layout();
}

interface CityLabel {
  marker: import("leaflet").Marker;
  at: [number, number];
  tier: number;
  minZoom: number;
  width: number;
  shown: boolean;
}

/** Country + province labels, gated so they hand over as you zoom in. */
// Small neighbours wait for a closer zoom: at the zoom a far reveal settles
// on, "BELGIUM", "GERMANY" and "LUXEMBOURG" stacked on the answer pin.
const NEIGHBOUR_LABEL_ZOOM: Record<string, number> = { DE: 4.25, BE: 5, LU: 6.5, LS: 5.25, SZ: 5.75 };

export function regionLabels(L: Leaflet, gate: ZoomGate, countries: RegionCollection, provinces: RegionCollection) {
  for (const f of countries.features) {
    const code = f.properties.c;
    const [lng, lat] = labelPoint(f);
    const name = (COUNTRY_NAMES[code] ?? f.properties.n).toUpperCase();
    if (code === "ZA" || code === "NL") {
      const at: [number, number] = code === "ZA" ? [-29.6, 24.6] : [52.25, 5.3];
      gate.add({ marker: textMarker(L, at, name, "atlas-country-label atlas-country-focus"), minZoom: 0, maxZoom: 4.75 });
    } else {
      gate.add({
        marker: textMarker(L, [lat, lng], name, "atlas-country-label"),
        minZoom: NEIGHBOUR_LABEL_ZOOM[code] ?? 3.25,
        maxZoom: 8,
      });
    }
  }
  for (const f of provinces.features) {
    const [lng, lat] = labelPoint(f);
    const short = f.properties.s ?? f.properties.n;
    // Small provinces (Gauteng, most of NL) would sit on top of their city
    // labels at the country-fit zoom; hold them back until you zoom closer.
    const bb = f.properties.bb;
    const small = bb ? (bb[2] - bb[0]) * (bb[3] - bb[1]) < 6 : false;
    const shortMin = small ? 6 : 4.75;
    gate.add({ marker: textMarker(L, [lat, lng], short, "atlas-province-label"), minZoom: shortMin, maxZoom: 6.75 });
    gate.add({ marker: textMarker(L, [lat, lng], f.properties.n, "atlas-province-label"), minZoom: 6.75, maxZoom: 99 });
  }
}

export function toLatLngs(points: LatLng[]): [number, number][] {
  return points.map((p) => [p.latitude, p.longitude] as [number, number]);
}