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
  CountryCode,
  { south: number; north: number; west: number; east: number }
> = {
  ZA: { south: -34.84, north: -22.12, west: 16.45, east: 32.89 },
  NL: { south: 50.75, north: 53.56, west: 3.31, east: 7.23 },
};

export function isInsideCountry(p: LatLng, country: CountryCode): boolean {
  const b = COUNTRY_BOUNDS[country];
  return p.latitude >= b.south && p.latitude <= b.north && p.longitude >= b.west && p.longitude <= b.east;
}

export function detectCountry(p: LatLng): CountryCode | null {
  if (isInsideCountry(p, "ZA")) return "ZA";
  if (isInsideCountry(p, "NL")) return "NL";
  return null;
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
