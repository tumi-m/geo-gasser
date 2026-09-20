import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

/**
 * Point-in-polygon lookup over bundled GeoJSON. Used for the "pin is in
 * Gauteng · South Africa" readout and label anchors. Pure, so the same
 * code runs in node tests and in the browser.
 */

export type RegionProps = {
  /** Display name. */
  n: string;
  /** ISO-ish country code (ZA, NL, LS, ...). */
  c: string;
  /** Optional short label for small screens. */
  s?: string;
  /** Optional precomputed label point [lng, lat]. */
  lp?: [number, number];
  /** Optional bbox [west, south, east, north] for a fast reject. */
  bb?: [number, number, number, number];
};

export type RegionFeature = Feature<Polygon | MultiPolygon, RegionProps>;
export type RegionCollection = FeatureCollection<Polygon | MultiPolygon, RegionProps>;

type Ring = number[][];

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function inPolygon(x: number, y: number, rings: Ring[]): boolean {
  if (rings.length === 0 || !inRing(x, y, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (inRing(x, y, rings[i])) return false; // inside a hole
  }
  return true;
}

export function featureContains(feature: RegionFeature, lng: number, lat: number): boolean {
  const bb = feature.properties.bb;
  if (bb && (lng < bb[0] || lng > bb[2] || lat < bb[1] || lat > bb[3])) return false;
  const g = feature.geometry;
  if (g.type === "Polygon") return inPolygon(lng, lat, g.coordinates);
  return g.coordinates.some((poly) => inPolygon(lng, lat, poly));
}

export function findContaining(collection: RegionCollection, lng: number, lat: number): RegionFeature | null {
  for (const f of collection.features) {
    if (featureContains(f, lng, lat)) return f;
  }
  return null;
}

/** Centroid of the largest outer ring — a usable label anchor. Returns [lng, lat]. */
export function labelPoint(feature: RegionFeature): [number, number] {
  if (feature.properties.lp) return feature.properties.lp;
  const g = feature.geometry;
  const rings: Ring[] = g.type === "Polygon" ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]);
  let best: [number, number] = [0, 0];
  let bestArea = -1;
  for (const ring of rings) {
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const x0 = ring[i][0];
      const y0 = ring[i][1];
      const x1 = ring[i + 1][0];
      const y1 = ring[i + 1][1];
      const f = x0 * y1 - x1 * y0;
      area += f;
      cx += (x0 + x1) * f;
      cy += (y0 + y1) * f;
    }
    area /= 2;
    if (Math.abs(area) > bestArea && area !== 0) {
      bestArea = Math.abs(area);
      best = [cx / (6 * area), cy / (6 * area)];
    }
  }
  return best;
}

export const COUNTRY_NAMES: Record<string, string> = {
  ZA: "South Africa",
  NL: "Netherlands",
  LS: "Lesotho",
  SZ: "Eswatini",
  NA: "Namibia",
  BW: "Botswana",
  ZW: "Zimbabwe",
  MZ: "Mozambique",
  BE: "Belgium",
  DE: "Germany",
  LU: "Luxembourg",
};

/**
 * Human readout for a pin: "Gauteng · South Africa", "Botswana", or
 * "Open water". Provinces first, then detailed countries, then the world.
 */
export function describePoint(
  point: { latitude: number; longitude: number },
  provinces: RegionCollection,
  countries: RegionCollection,
  world: RegionCollection,
): { primary: string; secondary?: string; country?: string } {
  const { latitude: lat, longitude: lng } = point;
  const prov = findContaining(provinces, lng, lat);
  if (prov) {
    return { primary: prov.properties.n, secondary: COUNTRY_NAMES[prov.properties.c] ?? prov.properties.c, country: prov.properties.c };
  }
  const country = findContaining(countries, lng, lat) ?? findContaining(world, lng, lat);
  if (country) {
    const code = country.properties.c;
    return { primary: COUNTRY_NAMES[code] ?? country.properties.n, country: code || undefined };
  }
  return { primary: "Open water" };
}