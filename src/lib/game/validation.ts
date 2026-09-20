import { haversineKm, isInsideCountry, isInsideNation } from "./geo.ts";
import { enabledLocations, LAUNCH_LOCATIONS, ROUND4_LOCATIONS } from "./locations.ts";
import type { GeoLocation } from "./types.ts";

export interface ValidationIssue {
  id?: string;
  message: string;
}

const DUP_KM = 0.5;
const STALE_MS = 1000 * 60 * 60 * 24 * 400;

export const POOL_TARGET = { total: 149, ZA: 50, NL: 50, WORLD: 49 } as const;

export function validateLocation(loc: GeoLocation, now = Date.now()): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!/^loc_\d{2,3}$/.test(loc.id)) issues.push({ id: loc.id, message: "id must match loc_NN or loc_NNN" });
  if (loc.country !== "ZA" && loc.country !== "NL" && loc.country !== "WORLD") {
    issues.push({ id: loc.id, message: "country must be ZA, NL, or WORLD" });
  }
  if (loc.country === "WORLD" && !/^[A-Z]{2}$/.test(loc.nation ?? "")) {
    issues.push({ id: loc.id, message: "WORLD sites need a 2-letter nation code" });
  }
  if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) {
    issues.push({ id: loc.id, message: "coordinates must be finite" });
  } else if (loc.country === "ZA" || loc.country === "NL") {
    if (!isInsideCountry({ latitude: loc.latitude, longitude: loc.longitude }, loc.country)) {
      issues.push({ id: loc.id, message: `coordinates fall outside ${loc.country} bounds` });
    }
  } else if (loc.country === "WORLD" && loc.nation) {
    const pin = { latitude: loc.latitude, longitude: loc.longitude };
    if (!isInsideNation(pin, loc.nation)) {
      issues.push({ id: loc.id, message: `coordinates fall outside ${loc.nation} bounds` });
    }
  }
  if (!loc.title?.trim()) issues.push({ id: loc.id, message: "missing title" });
  if (!loc.attribution?.trim()) issues.push({ id: loc.id, message: "missing attribution" });
  if (!loc.verifiedAt) issues.push({ id: loc.id, message: "missing verifiedAt" });
  else {
    const t = Date.parse(loc.verifiedAt);
    if (Number.isNaN(t)) issues.push({ id: loc.id, message: "verifiedAt is not a date" });
    else if (now - t > STALE_MS) issues.push({ id: loc.id, message: "verification metadata is stale" });
  }
  if (![1, 2, 3, 4, 5].includes(loc.difficulty)) {
    issues.push({ id: loc.id, message: "difficulty must be 1–5" });
  }
  if (!loc.sceneUrl) issues.push({ id: loc.id, message: "missing sceneUrl" });
  return issues;
}

function dupes(pool: GeoLocation[], issues: ValidationIssue[]) {
  const ids = new Set<string>();
  for (const loc of pool) {
    if (ids.has(loc.id)) issues.push({ id: loc.id, message: "duplicate id" });
    ids.add(loc.id);
    issues.push(...validateLocation(loc));
  }
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const d = haversineKm(pool[i], pool[j]);
      if (d < DUP_KM) {
        issues.push({
          id: pool[i].id,
          message: `near-duplicate of ${pool[j].id} (${d.toFixed(3)} km)`,
        });
      }
    }
  }
}

export function validateLaunchPool(pool: GeoLocation[] = LAUNCH_LOCATIONS): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  dupes(pool, issues);
  const za = pool.filter((l) => l.country === "ZA" && l.enabled).length;
  const nl = pool.filter((l) => l.country === "NL" && l.enabled).length;
  if (pool.length !== 60) issues.push({ message: `expected 60 launch locations, got ${pool.length}` });
  if (za !== 30 || nl !== 30) issues.push({ message: `expected 30/30 country split, got ZA ${za} NL ${nl}` });
  return issues;
}

export function validateRound4Pool(pool: GeoLocation[] = ROUND4_LOCATIONS): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const loc of pool) {
    if (ids.has(loc.id)) issues.push({ id: loc.id, message: "duplicate id" });
    ids.add(loc.id);
    issues.push(...validateLocation(loc));
    if (loc.sceneKind !== "generated-reconstruction") {
      issues.push({ id: loc.id, message: "round 4 location must be a labelled reconstruction" });
    }
  }
  const za = pool.filter((l) => l.country === "ZA").length;
  const nl = pool.filter((l) => l.country === "NL").length;
  if (pool.length !== 10) issues.push({ message: `expected 10 round-4 locations, got ${pool.length}` });
  if (za !== 5 || nl !== 5) issues.push({ message: `expected 5/5 round-4 split, got ZA ${za} NL ${nl}` });
  return issues;
}

export function validateFullPool(pool: GeoLocation[] = enabledLocations()): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  dupes(pool, issues);
  const za = pool.filter((l) => l.country === "ZA" && l.enabled).length;
  const nl = pool.filter((l) => l.country === "NL" && l.enabled).length;
  const world = pool.filter((l) => l.country === "WORLD" && l.enabled).length;
  if (pool.length !== POOL_TARGET.total) {
    issues.push({ message: `expected ${POOL_TARGET.total} locations, got ${pool.length}` });
  }
  if (za !== POOL_TARGET.ZA || nl !== POOL_TARGET.NL || world !== POOL_TARGET.WORLD) {
    issues.push({
      message: `expected ${POOL_TARGET.ZA}/${POOL_TARGET.NL}/${POOL_TARGET.WORLD} split, got ZA ${za} NL ${nl} WORLD ${world}`,
    });
  }
  return issues;
}
