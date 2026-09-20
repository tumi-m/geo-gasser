import { enabledLocations, ROUND4_LOCATIONS } from "./locations.ts";
import type { GeoLocation } from "./types.ts";

export type AtlasPreset = "sa-nl" | "za" | "nl" | "world" | "mix" | "custom";

export interface AtlasSpec {
  preset: AtlasPreset;
  /** ISO 3166-1 alpha-2. Always filled; custom is the only preset you edit by hand. */
  nations: string[];
  /** Optional cities within the selected nations. */
  cities?: string[];
}

export const DEFAULT_ATLAS: AtlasSpec = { preset: "sa-nl", nations: ["NL", "ZA"] };

const PRESETS: AtlasPreset[] = ["sa-nl", "za", "nl", "world", "mix", "custom"];

export const NATION_LABEL: Record<string, string> = {
  ZA: "South Africa",
  NL: "Netherlands",
  AR: "Argentina",
  AU: "Australia",
  BR: "Brazil",
  CA: "Canada",
  CH: "Switzerland",
  CL: "Chile",
  CN: "China",
  CZ: "Czechia",
  DE: "Germany",
  EG: "Egypt",
  ES: "Spain",
  FI: "Finland",
  FR: "France",
  GB: "United Kingdom",
  GR: "Greece",
  HK: "Hong Kong",
  HR: "Croatia",
  HU: "Hungary",
  ID: "Indonesia",
  IE: "Ireland",
  IN: "India",
  IS: "Iceland",
  IT: "Italy",
  JO: "Jordan",
  JP: "Japan",
  KH: "Cambodia",
  KR: "South Korea",
  MA: "Morocco",
  MX: "Mexico",
  NO: "Norway",
  NZ: "New Zealand",
  PE: "Peru",
  PT: "Portugal",
  SE: "Sweden",
  SG: "Singapore",
  TH: "Thailand",
  TR: "Türkiye",
  TZ: "Tanzania",
  US: "United States",
  VN: "Vietnam",
  ZM: "Zambia",
};

export const REGION_NATIONS: Record<string, { label: string; nations: string[] }> = {
  southern: { label: "Home turf", nations: ["ZA", "NL"] },
  europe: {
    label: "Europe",
    nations: ["CH", "CZ", "DE", "ES", "FI", "FR", "GB", "GR", "HR", "HU", "IE", "IS", "IT", "NL", "NO", "PT", "SE", "TR"],
  },
  americas: { label: "Americas", nations: ["AR", "BR", "CA", "CL", "MX", "PE", "US"] },
  asia: { label: "Asia", nations: ["CN", "HK", "ID", "IN", "JO", "JP", "KH", "KR", "SG", "TH", "VN"] },
  africa: { label: "Africa", nations: ["EG", "MA", "TZ", "ZA", "ZM"] },
  oceania: { label: "Oceania", nations: ["AU", "NZ"] },
};

export const ATLAS_PRESETS: Array<{ id: AtlasPreset; label: string; hint: string }> = [
  { id: "sa-nl", label: "SA × NL", hint: "The classic duel" },
  { id: "za", label: "South Africa", hint: "Highveld to Cape" },
  { id: "nl", label: "Netherlands", hint: "Polders and cities" },
  { id: "world", label: "World", hint: "No SA, no NL" },
  { id: "mix", label: "Mix", hint: "SA, NL and the world" },
  { id: "custom", label: "Countries", hint: "Build your own map" },
];

export function nationOf(loc: Pick<GeoLocation, "country" | "nation">): string {
  if (loc.country === "WORLD") return (loc.nation ?? "UN").toUpperCase();
  return loc.country;
}

export function nationLabel(code: string): string {
  return NATION_LABEL[code] ?? code;
}

function uniqueSorted(codes: Iterable<string>): string[] {
  return [...new Set(codes)].sort();
}

export function worldNations(): string[] {
  return uniqueSorted(
    enabledLocations()
      .filter((l) => l.country === "WORLD" && l.nation)
      .map((l) => l.nation!.toUpperCase()),
  );
}

export function allNations(): string[] {
  return uniqueSorted(["NL", "ZA", ...worldNations()]);
}

export function presetNations(preset: AtlasPreset, custom: string[] = []): string[] {
  switch (preset) {
    case "za":
      return ["ZA"];
    case "nl":
      return ["NL"];
    case "sa-nl":
      return ["NL", "ZA"];
    case "world":
      return worldNations();
    case "mix":
      return allNations();
    case "custom":
      return uniqueSorted(custom.filter((c) => allNations().includes(c)));
  }
}

export function isAtlasPreset(v: unknown): v is AtlasPreset {
  return typeof v === "string" && PRESETS.includes(v as AtlasPreset);
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

export function inferPreset(nations: string[]): AtlasPreset {
  const n = uniqueSorted(nations);
  if (sameSet(n, ["ZA"])) return "za";
  if (sameSet(n, ["NL"])) return "nl";
  if (sameSet(n, ["NL", "ZA"])) return "sa-nl";
  if (n.length && sameSet(n, worldNations())) return "world";
  if (n.length && sameSet(n, allNations())) return "mix";
  return "custom";
}

export function sanitizeAtlas(raw: unknown): AtlasSpec {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ATLAS };
  const rec = raw as { preset?: unknown; nations?: unknown; cities?: unknown };
  const cities = Array.isArray(rec.cities) ? [...new Set(rec.cities.filter((v): v is string => typeof v === "string" && v.length < 100))] : [];
  const custom = Array.isArray(rec.nations)
    ? rec.nations.filter((n): n is string => typeof n === "string").map((n) => n.toUpperCase())
    : [];
  const preset = isAtlasPreset(rec.preset) ? rec.preset : inferPreset(custom);
  if (preset === "custom") {
    const nations = uniqueSorted(custom.filter((c) => allNations().includes(c)));
    if (!nations.length) return { ...DEFAULT_ATLAS };
    return { preset: "custom", nations, ...(cities.length ? {cities} : {}) };
  }
  return { preset, nations: presetNations(preset), ...(cities.length ? {cities} : {}) };
}

export function nationsFor(spec: AtlasSpec): Set<string> {
  return new Set(sanitizeAtlas(spec).nations);
}

export function atlasIncludes(spec: AtlasSpec, code: string): boolean {
  return nationsFor(spec).has(code);
}

export function atlasFocus(spec: AtlasSpec): "ZA" | "NL" | "world" {
  const n = nationsFor(spec);
  if (n.size === 1 && n.has("ZA")) return "ZA";
  if (n.size === 1 && n.has("NL")) return "NL";
  return "world";
}

export function filterByAtlas(list: GeoLocation[], spec: AtlasSpec): GeoLocation[] {
  const n = nationsFor(spec);
  const cities = sanitizeAtlas(spec).cities;
  return list.filter((l) => n.has(nationOf(l)) && (!cities?.length || !!l.city && cities.includes(l.city)));
}

export function atlasPoolSize(spec: AtlasSpec): number {
  const reserved = new Set(ROUND4_LOCATIONS.map((l) => l.id));
  const photos = filterByAtlas(
    enabledLocations().filter((l) => !reserved.has(l.id)),
    spec,
  ).length;
  const r4 = filterByAtlas(ROUND4_LOCATIONS, spec).length;
  return photos + r4;
}

export function atlasLabel(spec: AtlasSpec): string {
  const s = sanitizeAtlas(spec);
  switch (s.preset) {
    case "sa-nl":
      return "South Africa × Netherlands";
    case "za":
      return "South Africa";
    case "nl":
      return "Netherlands";
    case "world":
      return "World";
    case "mix":
      return "Mix";
    case "custom":
      if (s.nations.length <= 3) return s.nations.map(nationLabel).join(" · ");
      return `${s.nations.length} countries`;
  }
}

export function toggleNation(spec: AtlasSpec, code: string): AtlasSpec {
  const set = nationsFor(spec);
  const key = code.toUpperCase();
  if (set.has(key)) set.delete(key);
  else set.add(key);
  if (!set.size) return { ...DEFAULT_ATLAS };
  return { preset: "custom", nations: uniqueSorted(set) };
}

export function applyRegion(spec: AtlasSpec, regionId: string, on: boolean): AtlasSpec {
  const region = REGION_NATIONS[regionId];
  if (!region) return sanitizeAtlas(spec);
  const set = nationsFor(spec);
  const available = new Set(allNations());
  for (const code of region.nations) {
    if (!available.has(code)) continue;
    if (on) set.add(code);
    else set.delete(code);
  }
  if (!set.size) return { ...DEFAULT_ATLAS };
  return { preset: "custom", nations: uniqueSorted(set) };
}

export function regionFullyOn(spec: AtlasSpec, regionId: string): boolean {
  const region = REGION_NATIONS[regionId];
  if (!region) return false;
  const set = nationsFor(spec);
  const available = new Set(allNations());
  return region.nations.filter((c) => available.has(c)).every((c) => set.has(c));
}

export function nationCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const loc of enabledLocations()) {
    const n = nationOf(loc);
    counts[n] = (counts[n] ?? 0) + 1;
  }
  return counts;
}
