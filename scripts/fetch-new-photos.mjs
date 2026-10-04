#!/usr/bin/env node
/**
 * Photos for the places in src/lib/game/new-locations.ts, from Wikimedia
 * Commons. For each place it gathers candidates from the place's Commons
 * category, a Commons search and a geosearch around the coordinates, keeps
 * large landscape photos under free licences (CC BY, CC BY-SA, CC0, public
 * domain), prefers Featured/Quality images, and saves:
 *
 *   public/locations/<id>.jpg           1920 px, the plate a round opens on
 *   public/locations/hires/<id>.jpg     3840 px companion for zooming in
 *   public/locations/views/<id>-2.jpg   up to two more viewpoints (1920 px)
 *
 * then records author and licence in src/lib/game/photo-manifest.ts, which is
 * what switches a place on. Re-runs skip places already in the manifest.
 *
 *   node --experimental-strip-types scripts/fetch-new-photos.mjs [loc_150 …]
 *   node scripts/build-hires-manifest.mjs
 *
 * Review the photos before shipping: a script cannot tell a fine view from a
 * badly framed one, and a photo must not show the place's name.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const { NEW_LOCATIONS, NEW_LOCATION_SOURCES } = await import("../src/lib/game/new-locations.ts");

const API = "https://commons.wikimedia.org/w/api.php";
const UA = { "User-Agent": "AtlasDuel-photos/1.0 (https://github.com/tumi-m/geo-gasser)" };
const MANIFEST = "src/lib/game/photo-manifest.ts";
const BASE_W = 1920;
const HIRES_W = 3840;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EXCLUDE =
  /\b(map|plan|logo|diagram|interior|inside|night|aerial|drone|panorama|drawing|painting|sign|plaque|museum|ticket|menu|coat of arms|flag|postcard|engraving|lithograph|sketch|model|detail|closeup|close-up|selfie|portrait|people|wedding|black and white|monochrome|sepia|infrared|hdr)\b/i;
const FREE = /^(cc[ -]by(-sa)?([ -][\d.]+)?|cc0|public domain|pd)/i;

async function api(params) {
  const q = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt) await sleep(2000 * 2 ** attempt);
    try {
      const res = await fetch(`${API}?${q}`, { headers: UA });
      if (res.status === 429 || res.status >= 500) continue;
      const text = await res.text();
      if (text.startsWith("You are making")) continue;
      return JSON.parse(text);
    } catch {
      /* retry */
    }
  }
  throw new Error(`Commons API failed: ${q.get("generator") ?? q.get("list")}`);
}

const INFO = {
  prop: "imageinfo|categories|coordinates",
  iiprop: "url|size|mime|extmetadata",
  iiurlwidth: String(BASE_W),
  clcategories:
    "Category:Featured pictures on Wikimedia Commons|Category:Quality images|Category:Valued images",
  cllimit: "max",
  colimit: "max",
};

async function candidates(loc) {
  const category = NEW_LOCATION_SOURCES[loc.id];
  const queries = [
    {
      generator: "categorymembers",
      gcmtitle: `Category:${category}`,
      gcmtype: "file",
      gcmlimit: "200",
    },
    {
      generator: "search",
      gsrsearch: `${loc.title} ${loc.city ?? ""} filetype:bitmap`,
      gsrnamespace: "6",
      gsrlimit: "60",
    },
    {
      generator: "geosearch",
      ggscoord: `${loc.latitude}|${loc.longitude}`,
      ggsradius: "600",
      ggsnamespace: "6",
      ggslimit: "80",
    },
  ];
  const pages = new Map();
  for (const q of queries) {
    const data = await api({ action: "query", ...q, ...INFO });
    for (const page of data.query?.pages ?? []) pages.set(page.title, page);
    await sleep(400);
  }
  return [...pages.values()];
}

function plain(html = "") {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function km(a, b) {
  const R = 6371;
  const toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR;
  const dLon = (b.lon - a.lon) * toR;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function score(page, loc) {
  const info = page.imageinfo?.[0];
  if (!info || info.mime !== "image/jpeg") return null;
  const { width: w, height: h } = info;
  if (w < 2200 || h < 1200) return null;
  const aspect = w / h;
  if (aspect < 1.25 || aspect > 2.4) return null;
  if (EXCLUDE.test(page.title)) return null;
  const meta = info.extmetadata ?? {};
  const licence = plain(meta.LicenseShortName?.value);
  if (!FREE.test(licence) || /\b(nc|nd)\b/i.test(licence)) return null;
  const camera = page.coordinates?.[0];
  if (
    camera &&
    km({ lat: camera.lat, lon: camera.lon }, { lat: loc.latitude, lon: loc.longitude }) > 4
  )
    return null;
  const cats = (page.categories ?? []).map((c) => c.title);
  let s = Math.log2(w * h);
  if (cats.some((c) => c.includes("Featured"))) s += 4;
  if (cats.some((c) => c.includes("Quality"))) s += 2.5;
  if (cats.some((c) => c.includes("Valued"))) s += 1;
  s -= Math.abs(aspect - 16 / 9) * 2;
  return {
    s,
    page,
    info,
    camera,
    artist: plain(meta.Artist?.value) || "Unknown author",
    licence,
  };
}

async function download(url, path) {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await sleep(3000 * attempt);
    const res = await fetch(url, { headers: UA });
    if (res.ok) {
      writeFileSync(path, Buffer.from(await res.arrayBuffer()));
      return true;
    }
  }
  return false;
}

const thumbAt = (thumbUrl, width) => thumbUrl.replace(/\/\d+px-/, `/${width}px-`);

// ── Manifest in and out ──────────────────────────────────────────────────────
const manifestSrc = readFileSync(MANIFEST, "utf8");
const current = JSON.parse(
  manifestSrc.match(/NEW_PHOTOS: Record<string, PhotoCredit> = (\{[\s\S]*?\});/)?.[1] ?? "{}",
);

function writeManifest(entries) {
  const body = JSON.stringify(entries, null, 2);
  writeFileSync(
    MANIFEST,
    manifestSrc.replace(
      /NEW_PHOTOS: Record<string, PhotoCredit> = \{[\s\S]*?\};/,
      `NEW_PHOTOS: Record<string, PhotoCredit> = ${body};`,
    ),
  );
}

for (const dir of ["public/locations", "public/locations/hires", "public/locations/views"])
  mkdirSync(dir, { recursive: true });

const only = new Set(process.argv.slice(2));
const todo = NEW_LOCATIONS.filter((l) => (only.size ? only.has(l.id) : !current[l.id]));
console.log(`places to fetch: ${todo.length}`);

for (const loc of todo) {
  let picks;
  try {
    picks = (await candidates(loc))
      .map((p) => score(p, loc))
      .filter(Boolean)
      .sort((a, b) => b.s - a.s);
  } catch (e) {
    console.log(`${loc.id} ${loc.title}: ${e.message}`);
    continue;
  }
  if (!picks.length) {
    console.log(`${loc.id} ${loc.title}: no usable photo`);
    continue;
  }
  const [main, ...rest] = picks;
  // Extra viewpoints: other photographers, or the same one from elsewhere.
  const views = [];
  for (const p of rest) {
    if (views.length === 2) break;
    const far =
      main.camera && p.camera
        ? km(
            { lat: main.camera.lat, lon: main.camera.lon },
            { lat: p.camera.lat, lon: p.camera.lon },
          ) > 0.05
        : true;
    if (p.artist !== main.artist || far) views.push(p);
  }

  const ok = await download(main.info.thumburl, `public/locations/${loc.id}.jpg`);
  if (!ok) {
    console.log(`${loc.id} ${loc.title}: download failed`);
    continue;
  }
  if (main.info.width >= 3200)
    await download(thumbAt(main.info.thumburl, HIRES_W), `public/locations/hires/${loc.id}.jpg`);
  const used = [main];
  for (const v of views) {
    if (await download(v.info.thumburl, `public/locations/views/${loc.id}-${used.length + 1}.jpg`))
      used.push(v);
    await sleep(300);
  }
  // Every photographer whose picture is shown gets credited.
  current[loc.id] = {
    attribution:
      used.length === 1
        ? `Photo: ${main.artist}, Wikimedia Commons, ${main.licence}.`
        : `Photos: ${used.map((p) => `${p.artist} (${p.licence})`).join(" · ")}, Wikimedia Commons.`,
    source: main.info.descriptionurl,
    views: used.length - 1,
  };
  writeManifest(current);
  console.log(
    `${loc.id} ${loc.title}: ${main.page.title} (${main.info.width}px) + ${used.length - 1} views`,
  );
  await sleep(600);
}

console.log(`manifest: ${Object.keys(current).length} places with photos`);
if (!existsSync("public/locations/hires")) console.log("no hires plates");
