#!/usr/bin/env node
/**
 * Build the guess-map detail bundle from Natural Earth (public domain).
 *
 * The base world (110m) ships in src/data/world.json. This adds what a
 * player actually zooms into: ZA + NL and their neighbours at 50m, and
 * every ZA / NL province at 10m, all rounded to 4 decimals (~11 m) so the
 * bundle stays small. Output: src/data/detail.json.
 *
 *   node scripts/build-map-data.mjs
 *
 * Re-run only when upgrading Natural Earth; the JSON is committed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "src", "data", "detail.json");
const RAW = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";

/** Countries redrawn at 50m (replaces their 110m outline on the map). */
const DETAIL_COUNTRIES = new Set(["ZAF", "NLD", "LSO", "SWZ", "NAM", "BWA", "ZWE", "MOZ", "BEL", "DEU", "LUX"]);
/** Provinces we draw and label. */
const PROVINCE_COUNTRIES = new Set(["ZAF", "NLD"]);
/** Caribbean NL — outside the play area. */
const DROP_PROVINCES = new Set(["Bonaire", "St. Eustatius", "Saba"]);
/** Short labels that fit on a phone at zoom 5–6. */
const PROVINCE_SHORT = {
  "Northern Cape": "N. Cape",
  "Western Cape": "W. Cape",
  "Eastern Cape": "E. Cape",
  "North West": "North West",
  "Free State": "Free State",
  Gauteng: "Gauteng",
  Mpumalanga: "Mpumalanga",
  Limpopo: "Limpopo",
  "KwaZulu-Natal": "KZN",
  "Noord-Holland": "N-Holland",
  "Zuid-Holland": "Z-Holland",
  "Noord-Brabant": "N-Brabant",
};

const round = (n) => Math.round(n * 1e4) / 1e4;
function roundCoords(c) {
  return typeof c[0] === "number" ? [round(c[0]), round(c[1])] : c.map(roundCoords);
}

/** Bounding box of a (Multi)Polygon: [west, south, east, north]. */
function bbox(geom) {
  let w = 180, s = 90, e = -180, n = -90;
  const walk = (c) => {
    if (typeof c[0] === "number") {
      if (c[0] < w) w = c[0];
      if (c[0] > e) e = c[0];
      if (c[1] < s) s = c[1];
      if (c[1] > n) n = c[1];
    } else c.forEach(walk);
  };
  walk(geom.coordinates);
  return [round(w), round(s), round(e), round(n)];
}

/** Largest ring's centroid — a decent label anchor for provinces. */
function labelPoint(geom) {
  const rings = geom.type === "Polygon" ? [geom.coordinates[0]] : geom.coordinates.map((p) => p[0]);
  let best = null;
  let bestArea = -1;
  for (const ring of rings) {
    let area = 0, cx = 0, cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[i + 1];
      const f = x0 * y1 - x1 * y0;
      area += f;
      cx += (x0 + x1) * f;
      cy += (y0 + y1) * f;
    }
    area /= 2;
    if (Math.abs(area) > bestArea) {
      bestArea = Math.abs(area);
      best = [round(cx / (6 * area)), round(cy / (6 * area))];
    }
  }
  return best;
}

async function fetchJson(name) {
  const res = await fetch(`${RAW}/${name}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
}

const [adm0, adm1] = await Promise.all([
  fetchJson("ne_50m_admin_0_countries.geojson"),
  fetchJson("ne_10m_admin_1_states_provinces.geojson"),
]);

const countries = adm0.features
  .filter((f) => DETAIL_COUNTRIES.has(f.properties.ADM0_A3))
  .map((f) => ({
    type: "Feature",
    properties: { n: f.properties.NAME, c: f.properties.ISO_A2 === "-99" ? f.properties.ADM0_A3.slice(0, 2) : f.properties.ISO_A2 },
    geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) },
  }));

const provinces = adm1.features
  .filter((f) => PROVINCE_COUNTRIES.has(f.properties.adm0_a3) && !DROP_PROVINCES.has(f.properties.name))
  .map((f) => {
    const geometry = { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) };
    return {
      type: "Feature",
      properties: {
        n: f.properties.name,
        s: PROVINCE_SHORT[f.properties.name] ?? f.properties.name,
        c: f.properties.adm0_a3 === "ZAF" ? "ZA" : "NL",
        lp: labelPoint(geometry),
        bb: bbox(geometry),
      },
      geometry,
    };
  })
  .sort((a, b) => a.properties.n.localeCompare(b.properties.n));

const out = {
  attribution: "Natural Earth (public domain) — 50m admin-0, 10m admin-1",
  countries: { type: "FeatureCollection", features: countries },
  provinces: { type: "FeatureCollection", features: provinces },
};

mkdirSync(dirname(OUT), { recursive: true });
const json = JSON.stringify(out);
writeFileSync(OUT, json);
console.log(
  `wrote ${OUT}: ${countries.length} countries, ${provinces.length} provinces, ${(json.length / 1024).toFixed(0)} KB`,
);
console.log(provinces.map((p) => `${p.properties.c} ${p.properties.n} @ ${p.properties.lp.join(",")}`).join("\n"));