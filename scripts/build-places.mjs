#!/usr/bin/env node
/**
 * Build the map's towns and cities (dots, labels and city search) from
 * GeoNames (CC BY 4.0), via the `all-the-cities` package:
 *
 *   npm i --no-save all-the-cities@3.1.0
 *   node scripts/build-places.mjs
 *
 * Writes src/lib/map/places-data.ts. Every coordinate is a GeoNames town
 * centre, never an answer location: the old hand-made list reused answer
 * coordinates (Agra sat on the Taj Mahal, Petra on the Treasury), so a
 * country with one location showed one dot, on the answer. Landmark
 * nicknames ("taj mahal", "golden gate") are deliberately not aliases.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let cities;
try {
  cities = require("all-the-cities");
} catch {
  console.error("Install the source first: npm i --no-save all-the-cities@3.1.0");
  process.exit(1);
}

const OUT = "src/lib/map/places-data.ts";
const detail = JSON.parse(readFileSync("src/data/detail.json", "utf8"));

// ── Province lookup for ZA/NL (same polygons the map draws) ─────────────────
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inFeature(f, x, y) {
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.some((p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)));
}
function provinceOf(lon, lat, cc) {
  for (const f of detail.provinces.features) {
    if (f.properties.c !== cc) continue;
    const bb = f.properties.bb;
    if (bb && (lon < bb[0] || lon > bb[2] || lat < bb[1] || lat > bb[3])) continue;
    if (inFeature(f, lon, lat)) return f.properties.n;
  }
  return null;
}

// ── Names ───────────────────────────────────────────────────────────────────
const regionName = new Intl.DisplayNames(["en"], { type: "region" });
const RENAME = {
  "ZA:Port Elizabeth": "Gqeberha",
  "ZA:Nelspruit": "Mbombela",
  "ZA:Witbank": "eMalahleni",
  "ZA:Grahamstown": "Makhanda",
  "NL:'s-Hertogenbosch": "Den Bosch",
  "US:New York City": "New York",
};
/** City nicknames and other names only. Never a landmark. */
const ALIASES = {
  "ZA:Cape Town": ["kaapstad", "ct"],
  "ZA:Johannesburg": ["joburg", "jozi", "jhb", "egoli"],
  "ZA:Pretoria": ["tshwane"],
  "ZA:Durban": ["ethekwini"],
  "ZA:Gqeberha": ["port elizabeth", "pe"],
  "ZA:Bloemfontein": ["mangaung"],
  "ZA:East London": ["buffalo city"],
  "ZA:Polokwane": ["pietersburg"],
  "ZA:Mbombela": ["nelspruit"],
  "ZA:eMalahleni": ["witbank"],
  "ZA:Pietermaritzburg": ["pmb"],
  "ZA:Plettenberg Bay": ["plet"],
  "ZA:Mahikeng": ["mafikeng", "mmabatho"],
  "ZA:Makhanda": ["grahamstown"],
  "NL:Amsterdam": ["ams"],
  "NL:The Hague": ["den haag", "s-gravenhage", "hague"],
  "NL:Den Bosch": ["s-hertogenbosch", "'s-hertogenbosch"],
  "NL:Vlissingen": ["flushing"],
  "NL:Zaandam": ["zaanstad"],
  "US:New York": ["nyc", "new york city"],
  "MA:Marrakesh": ["marrakech"],
  "IN:Mumbai": ["bombay"],
  "IN:Kolkata": ["calcutta"],
  "IN:Chennai": ["madras"],
  "MM:Yangon": ["rangoon"],
  "VN:Ho Chi Minh City": ["saigon"],
  "CN:Beijing": ["peking"],
  "UA:Kyiv": ["kiev"],
  "IT:Rome": ["roma"],
  "IT:Venice": ["venezia"],
  "IT:Florence": ["firenze"],
  "IT:Naples": ["napoli"],
  "DE:Munich": ["munchen"],
  "DE:Cologne": ["koln"],
  "AT:Vienna": ["wien"],
  "CZ:Prague": ["praha"],
  "PL:Warsaw": ["warszawa"],
  "PT:Lisbon": ["lisboa"],
  "DK:Copenhagen": ["kobenhavn"],
  "BE:Brussels": ["bruxelles", "brussel"],
  "BE:Antwerp": ["antwerpen"],
  "GR:Athens": ["athina"],
  "EG:Cairo": ["al qahirah"],
};
/** Small towns worth finding by name in world maps (largest match by name). */
const SMALL_TOWNS = [
  ["CH", "Zermatt"],
  ["CH", "Interlaken"],
  ["CA", "Banff"],
  ["CA", "Jasper"],
  ["JO", "Petra"],
  ["TR", "Göreme"],
  ["ID", "Ubud"],
  ["NZ", "Te Anau"],
  ["NZ", "Queenstown"],
  ["CL", "Puerto Natales"],
  ["MX", "Tulum"],
  ["AU", "Alice Springs"],
  ["AT", "Hallstatt"],
  ["FR", "Chamonix-Mont-Blanc"],
  ["IS", "Vík"],
  ["NO", "Flåm"],
  ["PE", "Ollantaytambo"],
  ["GR", "Kalambaka"],
  ["HR", "Split"],
  ["ZW", "Victoria Falls"],
  ["BW", "Kasane"],
  ["NA", "Swakopmund"],
  ["TZ", "Arusha"],
  ["KE", "Narok"],
];

// ── Selection ───────────────────────────────────────────────────────────────
const DROP_CODES = new Set(["PPLH", "PPLQ", "PPLW", "PPLCH", "PPLR", "STLMT", "PPLF"]);
const smallKeys = new Set(SMALL_TOWNS.map(([cc, n]) => `${cc}:${n}`));
function keep(c) {
  if (DROP_CODES.has(c.featureCode)) return false;
  const pop = c.population;
  if (c.country === "ZA" || c.country === "NL") {
    // ZA has wide, thinly settled regions (the Northern Cape): small towns
    // there keep any one dot from standing alone.
    if (c.featureCode === "PPLX") return pop >= 30000;
    // Municipal seats count even where GeoNames has no population for them.
    if (c.featureCode === "PPLA2" || c.featureCode === "PPLA3") return true;
    return pop >= (c.country === "ZA" ? 2500 : 5000);
  }
  if (smallKeys.has(`${c.country}:${c.name}`)) return true;
  if (c.featureCode === "PPLX") return false;
  return pop >= 200000 || c.featureCode === "PPLC" || (c.featureCode === "PPLA" && pop >= 50000);
}

function tier(c) {
  const pop = c.population;
  if (pop >= 3_000_000 || (c.featureCode === "PPLC" && pop >= 500_000)) return 0;
  if (pop >= 1_000_000 || (c.featureCode === "PPLC" && pop >= 100_000)) return 1;
  if (pop >= 300_000) return 2;
  if (pop >= 100_000 || c.featureCode === "PPLC") return 3;
  if (pop >= 30_000) return 4;
  return 5;
}

// Small countries would otherwise get one or two dots (Iceland: Reykjavík),
// which points straight at any answer there: every country keeps at least
// its eight largest towns.
const MIN_PER_COUNTRY = 8;
const topByCountry = new Map();
for (const c of cities) {
  if (DROP_CODES.has(c.featureCode) || c.featureCode === "PPLX") continue;
  const list = topByCountry.get(c.country) ?? [];
  list.push(c);
  topByCountry.set(c.country, list);
}
const floor = new Set();
for (const list of topByCountry.values()) {
  list.sort((a, b) => b.population - a.population);
  for (const c of list.slice(0, MIN_PER_COUNTRY)) floor.add(c);
}

const best = new Map();
for (const c of cities) {
  if (!keep(c) && !floor.has(c)) continue;
  const name = RENAME[`${c.country}:${c.name}`] ?? c.name;
  const key = `${c.country}:${name}`;
  const prev = best.get(key);
  if (!prev || c.population > prev.population) best.set(key, { ...c, name });
}

const regions = [];
const regionIndex = new Map();
const idx = (r) => {
  if (!regionIndex.has(r)) {
    regionIndex.set(r, regions.length);
    regions.push(r);
  }
  return regionIndex.get(r);
};

const rows = [];
for (const c of best.values()) {
  const [lon, lat] = c.loc.coordinates;
  let region;
  if (c.country === "ZA" || c.country === "NL") {
    region = provinceOf(lon, lat, c.country);
    if (!region) continue; // offshore or across a border: not ours to draw
  } else {
    region = regionName.of(c.country) ?? c.country;
  }
  const aliases = ALIASES[`${c.country}:${c.name}`] ?? [];
  rows.push([
    c.name,
    +lat.toFixed(4),
    +lon.toFixed(4),
    c.country,
    tier(c),
    idx(region),
    aliases.join("|"),
  ]);
}
rows.sort((a, b) => a[4] - b[4] || a[0].localeCompare(b[0]));

const counts = rows.reduce((m, r) => ((m[r[3]] = (m[r[3]] ?? 0) + 1), m), {});
const body = rows.map((r) => JSON.stringify(r[6] ? r : r.slice(0, 6))).join(",\n  ");
writeFileSync(
  OUT,
  `// Generated by scripts/build-places.mjs from GeoNames (CC BY 4.0, geonames.org)
// via all-the-cities. Do not edit by hand; re-run the script.
// ${rows.length} places · ZA ${counts.ZA ?? 0} · NL ${counts.NL ?? 0} · world ${rows.length - (counts.ZA ?? 0) - (counts.NL ?? 0)}

/** Region names: ZA/NL provinces, otherwise the country. */
export const PLACE_REGIONS: string[] = ${JSON.stringify(regions)};

/** [name, latitude, longitude, ISO country, tier 0 (largest)–5, region index, aliases "a|b"?] */
export type PlaceRow = [string, number, number, string, number, number, string?];

export const PLACE_ROWS: PlaceRow[] = [
  ${body},
];
`,
);
console.log(
  `${OUT}: ${rows.length} places (ZA ${counts.ZA}, NL ${counts.NL}, IN ${counts.IN}, JO ${counts.JO})`,
);
