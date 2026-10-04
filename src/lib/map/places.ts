import { PLACE_REGIONS, PLACE_ROWS } from "./places-data.ts";

/**
 * Towns and cities for the map's dots, labels and search. Every coordinate is
 * a GeoNames town centre, independent of the answer locations, and there are
 * many per country, so no dot ever singles out an answer.
 */
export type Place = {
  name: string;
  aliases: string[];
  country: "ZA" | "NL" | "WORLD";
  /** ISO 3166 alpha-2. */
  nation: string;
  /** Province for ZA/NL, otherwise the country name. */
  region: string;
  latitude: number;
  longitude: number;
  /** 0 = largest (megacities, capitals) … 5 = small towns. */
  tier: number;
  /** Zoom to land on when picked from search. */
  zoom: number;
  major: boolean;
};

const SEARCH_ZOOM = [9, 9.5, 10, 10.5, 11, 11.5];

export const PLACES: Place[] = PLACE_ROWS.map(
  ([name, latitude, longitude, nation, tier, region, aliases]) => ({
    name,
    aliases: aliases ? aliases.split("|") : [],
    country: nation === "ZA" ? "ZA" : nation === "NL" ? "NL" : "WORLD",
    nation,
    region: PLACE_REGIONS[region] ?? nation,
    latitude,
    longitude,
    tier,
    zoom: SEARCH_ZOOM[tier] ?? 11,
    major: tier <= 1,
  }),
);

/** Letters NFD does not take apart (ø, æ, ß…) folded by hand. */
const FOLD: Record<string, string> = {
  ø: "o",
  æ: "ae",
  œ: "oe",
  ß: "ss",
  đ: "d",
  ð: "d",
  ł: "l",
  ı: "i",
  þ: "th",
};

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[øæœßđðłıþ]/g, (c) => FOLD[c] ?? c)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const INDEX = PLACES.map((place) => ({
  place,
  name: normalize(place.name),
  rest: [place.region, ...place.aliases].map(normalize),
}));

/**
 * Town search, best first: exact name, exact alias, prefix, then substring;
 * bigger places win ties, and the game's own countries get a nudge.
 */
export function searchPlaces(query: string, limit = 8): Place[] {
  const q = normalize(query);
  if (q.length < 1) return [];
  const out: { place: Place; score: number }[] = [];
  for (const { place, name, rest } of INDEX) {
    let score = 0;
    if (name === q) score = 100;
    else if (rest.some((f) => f === q)) score = 98;
    else if (name.startsWith(q)) score = 80;
    else if (rest.some((f) => f.startsWith(q))) score = 60;
    else if (q.length >= 3 && name.includes(q)) score = 50;
    if (!score) continue;
    score += (5 - place.tier) * 1.5 + (place.country === "WORLD" ? 0 : 2);
    out.push({ place, score });
  }
  return out
    .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name))
    .slice(0, limit)
    .map((row) => row.place);
}
