import type { LatLng } from "@/lib/game";
import { PLACES } from "@/lib/game";
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
export const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-56, -160],
  [72, 170],
];

/** A marker that is only on the map inside a zoom window. */
export interface GatedMarker {
  marker: import("leaflet").Layer;
  minZoom: number;
  maxZoom: number;
}

export class ZoomGate {
  private items: GatedMarker[] = [];
  private shown = new Set<import("leaflet").Layer>();
  constructor(private map: LMap) {}
  add(item: GatedMarker) {
    this.items.push(item);
  }
  update(zoom = this.map.getZoom()) {
    for (const item of this.items) {
      const wanted = zoom >= item.minZoom && zoom < item.maxZoom;
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

export function textMarker(L: Leaflet, at: [number, number], text: string, className: string) {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  return L.marker(at, {
    icon: L.divIcon({ className: "atlas-label-icon", html: el, iconSize: [0, 0] }),
    interactive: false,
    keyboard: false,
    pane: "markerPane",
  });
}

/** Base world at 110m, minus the countries we redraw in detail. */
export function worldLayer(L: Leaflet, world: RegionCollection, skip: Set<string>) {
  const trimmed: RegionCollection = {
    type: "FeatureCollection",
    features: world.features.filter((f) => !skip.has(f.properties.c)),
  };
  return L.geoJSON(trimmed, {
    interactive: false,
    style: () => ({ color: MAP_COLORS.border, weight: 0.6, fillColor: MAP_COLORS.land, fillOpacity: 1 }),
  });
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
  for (let lng = -180; lng <= 180; lng += 5) {
    L.polyline([[-85, lng], [85, lng]], style).addTo(group);
  }
  for (let lat = -80; lat <= 80; lat += 5) {
    L.polyline([[lat, -180], [lat, 180]], style).addTo(group);
  }
  return group;
}

/**
 * Cities: dots plus labels. Major cities show early; every gazetteer town
 * appears once you zoom in far enough that 110m coastlines stop mattering.
 */
export function cityLayers(L: Leaflet, map: LMap, gate: ZoomGate) {
  const dots = L.layerGroup();
  for (const place of PLACES) {
    const at: [number, number] = [place.latitude, place.longitude];
    const dot = L.circleMarker(at, {
      radius: place.major ? 3.4 : 2.6,
      color: "#09090b",
      weight: 1,
      fillColor: MAP_COLORS.city,
      fillOpacity: 1,
      interactive: false,
    });
    if (place.major) dot.addTo(dots);
    else gate.add({ marker: dot, minZoom: 6, maxZoom: 99 });
    gate.add({
      marker: textMarker(L, at, place.name, `atlas-city-label ${place.major ? "atlas-city-major" : ""}`),
      minZoom: place.major ? 4.5 : 6.75,
      maxZoom: 99,
    });
  }
  dots.addTo(map);
  return dots;
}

/** Country + province labels, gated so they hand over as you zoom in. */
export function regionLabels(L: Leaflet, gate: ZoomGate, countries: RegionCollection, provinces: RegionCollection) {
  for (const f of countries.features) {
    const code = f.properties.c;
    const [lng, lat] = labelPoint(f);
    const name = (COUNTRY_NAMES[code] ?? f.properties.n).toUpperCase();
    if (code === "ZA" || code === "NL") {
      const at: [number, number] = code === "ZA" ? [-29.6, 24.6] : [52.25, 5.3];
      gate.add({ marker: textMarker(L, at, name, "atlas-country-label atlas-country-focus"), minZoom: 0, maxZoom: 4.75 });
    } else {
      gate.add({ marker: textMarker(L, [lat, lng], name, "atlas-country-label"), minZoom: 3.25, maxZoom: 8 });
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