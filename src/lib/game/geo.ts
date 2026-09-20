import type { CountryCode, LatLng } from "./types.ts";

/** WGS84 mean Earth radius in kilometres. */
export const EARTH_RADIUS_KM = 6371.0088;

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function clampLatLng(p: LatLng): LatLng {
  return {
    latitude: Math.max(-90, Math.min(90, p.latitude)),
    longitude: ((((p.longitude + 180) % 360) + 360) % 360) - 180,
  };
}

/** Great-circle distance in kilometres (haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δφ = toRad(b.latitude - a.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);
  const h = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Interpolate a geodesic, including anti-meridian-safe longitudes. */
export function geodesicPoints(a: LatLng, b: LatLng, n = 48): LatLng[] {
  const points: LatLng[] = [];
  const φ1 = toRad(a.latitude);
  const λ1 = toRad(a.longitude);
  const φ2 = toRad(b.latitude);
  const λ2 = toRad(b.longitude);
  const d = 2 * Math.asin(
    Math.min(
      1,
      Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
      ),
    ),
  );
  if (d < 1e-12) return [a, b];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    points.push({
      latitude: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
      longitude: toDeg(Math.atan2(y, x)),
    });
  }
  return points;
}

/** Conservative continental bounding boxes used for launch validation. */
export const COUNTRY_BOUNDS: Record<
  Exclude<CountryCode, "WORLD">,
  { south: number; north: number; west: number; east: number }
> = {
  ZA: { south: -34.84, north: -22.12, west: 16.45, east: 32.89 },
  NL: { south: 50.75, north: 53.56, west: 3.31, east: 7.23 },
};

type BBox = { south: number; north: number; west: number; east: number };

/** Loose nation boxes for WORLD country-correct scoring. */
export const NATION_BOUNDS: Record<string, BBox> = {
  AR: { south: -55.1, north: -21.8, west: -73.6, east: -53.6 },
  AT: { south: 46.4, north: 49.0, west: 9.5, east: 17.2 },
  AU: { south: -43.7, north: -10.6, west: 113.0, east: 153.7 },
  BR: { south: -33.8, north: 5.3, west: -74.0, east: -34.7 },
  CA: { south: 41.7, north: 83.1, west: -141.0, east: -52.6 },
  CH: { south: 45.8, north: 47.8, west: 5.9, east: 10.5 },
  CL: { south: -56.0, north: -17.5, west: -75.7, east: -66.3 },
  CN: { south: 18.1, north: 53.6, west: 73.5, east: 135.1 },
  CU: { south: 19.8, north: 23.3, west: -85.0, east: -74.1 },
  CZ: { south: 48.5, north: 51.1, west: 12.1, east: 18.9 },
  DE: { south: 47.3, north: 55.1, west: 5.9, east: 15.0 },
  EG: { south: 22.0, north: 31.7, west: 24.7, east: 36.9 },
  ES: { south: 36.0, north: 43.8, west: -9.3, east: 3.3 },
  FI: { south: 59.7, north: 70.1, west: 20.5, east: 31.6 },
  FR: { south: 41.3, north: 51.1, west: -5.2, east: 9.6 },
  GB: { south: 49.8, north: 58.7, west: -8.2, east: 1.8 },
  GR: { south: 34.8, north: 41.8, west: 19.4, east: 28.2 },
  HK: { south: 22.15, north: 22.56, west: 113.83, east: 114.44 },
  HR: { south: 42.4, north: 46.5, west: 13.5, east: 19.4 },
  HU: { south: 45.7, north: 48.6, west: 16.1, east: 22.9 },
  ID: { south: -11.0, north: 6.1, west: 95.0, east: 141.0 },
  IE: { south: 51.4, north: 55.4, west: -10.5, east: -6.0 },
  IN: { south: 8.0, north: 35.5, west: 68.1, east: 97.4 },
  IS: { south: 63.3, north: 66.6, west: -24.6, east: -13.5 },
  IT: { south: 36.6, north: 47.1, west: 6.6, east: 18.5 },
  JO: { south: 29.2, north: 33.4, west: 34.9, east: 39.3 },
  JP: { south: 30.9, north: 45.6, west: 129.3, east: 145.8 },
  KE: { south: -4.7, north: 5.0, west: 33.9, east: 42.0 },
  KH: { south: 10.3, north: 14.7, west: 102.3, east: 107.6 },
  KR: { south: 33.1, north: 38.6, west: 125.8, east: 129.6 },
  MA: { south: 27.7, north: 35.9, west: -13.2, east: -1.0 },
  MX: { south: 14.5, north: 32.7, west: -117.1, east: -86.7 },
  NO: { south: 57.9, north: 71.2, west: 4.5, east: 31.1 },
  NZ: { south: -47.3, north: -34.1, west: 166.3, east: 178.6 },
  PE: { south: -18.4, north: -0.04, west: -81.4, east: -68.7 },
  PT: { south: 36.9, north: 42.2, west: -9.5, east: -6.2 },
  SE: { south: 55.3, north: 69.1, west: 11.0, east: 24.2 },
  SG: { south: 1.21, north: 1.47, west: 103.6, east: 104.1 },
  TH: { south: 5.6, north: 20.5, west: 97.3, east: 105.6 },
  TR: { south: 35.8, north: 42.3, west: 26.0, east: 44.8 },
  TZ: { south: -11.8, north: -1.0, west: 29.3, east: 40.4 },
  US: { south: 24.5, north: 49.4, west: -125.0, east: -66.9 },
  VN: { south: 8.4, north: 23.4, west: 102.1, east: 109.5 },
  ZM: { south: -18.1, north: -8.2, west: 21.9, east: 33.7 },
  ZW: { south: -22.4, north: -15.6, west: 25.2, east: 33.1 },
};

function inBox(p: LatLng, b: BBox): boolean {
  if (p.latitude < b.south || p.latitude > b.north) return false;
  if (b.west <= b.east) return p.longitude >= b.west && p.longitude <= b.east;
  return p.longitude >= b.west || p.longitude <= b.east;
}

/** Neighbours that sit inside the ZA AABB so they must not count as South Africa. */
const ZA_EXCLAVES = [
  { south: -30.55, north: -28.82, west: 27.55, east: 29.3 },
  { south: -27.2, north: -25.82, west: 31.02, east: 32.05 },
] as const;

export function isInsideCountry(p: LatLng, country: CountryCode): boolean {
  if (country === "WORLD") return !isInsideCountry(p, "ZA") && !isInsideCountry(p, "NL");
  const b = COUNTRY_BOUNDS[country];
  if (!inBox(p, b)) return false;
  if (country === "ZA") {
    for (const hole of ZA_EXCLAVES) {
      if (inBox(p, hole)) return false;
    }
  }
  return true;
}

export function isInsideNation(p: LatLng, nation: string): boolean {
  if (nation === "ZA") return isInsideCountry(p, "ZA");
  if (nation === "NL") return isInsideCountry(p, "NL");
  const b = NATION_BOUNDS[nation];
  return b ? inBox(p, b) : false;
}

export function detectCountry(p: LatLng): CountryCode | null {
  if (isInsideCountry(p, "ZA")) return "ZA";
  if (isInsideCountry(p, "NL")) return "NL";
  return "WORLD";
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return "—";
  if (km < 0.1) return `${Math.round(km * 1000)} m`;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return String(s).padStart(2, "0");
}

/** Destination point at `distanceKm` along `bearingDeg` (0 = north). */
export function offsetKm(origin: LatLng, distanceKm: number, bearingDeg: number): LatLng {
  const δ = distanceKm / EARTH_RADIUS_KM;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(origin.latitude);
  const λ1 = toRad(origin.longitude);
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const φ2 = Math.asin(sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ));
  const λ2 =
    λ1 + Math.atan2(Math.sin(θ) * sinδ * cosφ1, cosδ - sinφ1 * Math.sin(φ2));
  return clampLatLng({ latitude: toDeg(φ2), longitude: toDeg(λ2) });
}
