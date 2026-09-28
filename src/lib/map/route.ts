// Geometry for the results screen's expedition map: a flat projection framed
// on the places a match visited, the land inside that frame as one SVG path,
// and gently curved hops from stop to stop. Pure, so it is testable and the
// server and client draw the same thing.

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface RouteFrame {
  width: number;
  height: number;
  /** Degrees of the frame: west, south, east, north. */
  bounds: [number, number, number, number];
  project: (lng: number, lat: number) => [number, number];
}

interface LandFeature {
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The box shape that suits a route: wide for an east–west trip, closer to
 * square for a north–south one (SA ↔ NL), within `[min, max]` width/height.
 */
export function routeAspect(points: readonly GeoPoint[], min = 1.2, max = 2.2): number {
  if (points.length < 2) return max;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const latSpan = Math.max(1, Math.max(...lats) - Math.min(...lats));
  const lngSpan = Math.max(1, Math.max(...lngs) - Math.min(...lngs));
  const midLat = (Math.max(...lats) + Math.min(...lats)) / 2;
  const k = Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  return clamp((lngSpan * k) / latSpan, min, max);
}

/**
 * Frame `points` in a `width` × `height` box: padded, never tighter than
 * `minSpanDeg`, stretched to the box's aspect (longitude shrinks by the
 * cosine of the middle latitude, so shapes keep their proportions).
 */
export function routeFrame(
  points: readonly GeoPoint[],
  width: number,
  height: number,
  minSpanDeg = 14,
): RouteFrame {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  let south = lats.length ? Math.min(...lats) : -50;
  let north = lats.length ? Math.max(...lats) : 70;
  let west = lngs.length ? Math.min(...lngs) : -170;
  let east = lngs.length ? Math.max(...lngs) : 170;

  const midLat = (south + north) / 2;
  const k = Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  // Pad by a fifth each side, then widen whichever axis is short of the box.
  let latSpan = Math.max(minSpanDeg, (north - south) * 1.4);
  let lngSpan = Math.max(minSpanDeg, (east - west) * 1.4);
  const aspect = width / height;
  if ((lngSpan * k) / latSpan < aspect) lngSpan = (latSpan * aspect) / k;
  else latSpan = (lngSpan * k) / aspect;
  latSpan = Math.min(latSpan, 170);
  lngSpan = Math.min(lngSpan, 360);

  const cLat = clamp((south + north) / 2, -85 + latSpan / 2, 85 - latSpan / 2);
  const cLng = (west + east) / 2;
  south = cLat - latSpan / 2;
  north = cLat + latSpan / 2;
  west = cLng - lngSpan / 2;
  east = cLng + lngSpan / 2;

  const project = (lng: number, lat: number): [number, number] => [
    ((lng - west) / (east - west)) * width,
    ((north - lat) / (north - south)) * height,
  ];
  return { width, height, bounds: [west, south, east, north], project };
}

/** Land inside the frame as a single path. Rings that wrap the date line break instead of streaking across. */
export function landPath(features: readonly LandFeature[], frame: RouteFrame): string {
  const [west, south, east, north] = frame.bounds;
  const out: string[] = [];
  const ring = (coords: number[][]) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of coords) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (maxX < west || minX > east || maxY < south || minY > north) return;
    let d = "";
    let prev: number | null = null;
    for (const [lng, lat] of coords) {
      const [x, y] = frame.project(lng, lat);
      const jump = prev !== null && Math.abs(lng - prev) > 180;
      d += `${d === "" || jump ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      prev = lng;
    }
    out.push(`${d}Z`);
  };
  for (const f of features) {
    const g = f.geometry;
    if (g.type === "Polygon") g.coordinates.forEach(ring);
    else g.coordinates.forEach((poly) => poly.forEach(ring));
  }
  return out.join("");
}

/** A hop between two projected stops, bowed to one side like a flight path. */
export function hopPath(a: [number, number], b: [number, number], bow = 0.18): string {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  // Perpendicular, always bowing "up" the screen so the route reads as arcs.
  const sign = dx >= 0 ? 1 : -1;
  const cx = mx + sign * dy * bow;
  const cy = my - sign * dx * bow;
  const f = (n: number) => n.toFixed(1);
  return `M${f(a[0])} ${f(a[1])}Q${f(cx)} ${f(cy)} ${f(b[0])} ${f(b[1])}`;
}
