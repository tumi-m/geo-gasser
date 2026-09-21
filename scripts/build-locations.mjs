#!/usr/bin/env node
/**
 * Build a location pack from open imagery.
 *
 * Sources:
 *   commons    geosearch on Wikimedia Commons around each --near point
 *   mapillary  Mapillary image radius search around each --near point
 *
 * Downloads display-size plates into public/packs/<pack>/ and writes
 * src/data/packs/<pack>.json with coordinates, credit and provider flags.
 * Idempotent: existing files are kept, so re-runs resume.
 *
 *   node scripts/build-locations.mjs --pack=cape-flats --source=commons \
 *     --near="-33.96,18.41" --radius=4000 --limit=25
 *
 *   MAPILLARY_TOKEN=... node scripts/build-locations.mjs --pack=amsterdam \
 *     --source=mapillary --near="52.36,4.89" --limit=25
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "ATLAS-DUEL-pack-builder/1.0 (github.com/tumi-m/geo-gasser)";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const MAPILLARY_GRAPH = "https://graph.mapillary.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const args = { near: [], radius: 3000, limit: 20, source: "commons" };
  for (const raw of argv) {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    const value = rest.join("=");
    if (key === "near") args.near.push(value);
    else if (key === "radius") args.radius = Number(value);
    else if (key === "limit") args.limit = Number(value);
    else if (key === "pack") args.pack = value;
    else if (key === "source") args.source = value;
    else if (key === "country") args.country = value;
    else if (key === "nation") args.nation = value;
    else if (key === "title-prefix") args.titlePrefix = value;
    else if (key === "help") args.help = true;
  }
  return args;
}

function usage() {
  console.log(`usage: node scripts/build-locations.mjs --pack=NAME --source=commons|mapillary \\
  --near="lat,lng" [--near=...] [--radius=m] [--limit=n] [--country=ZA|NL|WORLD] [--nation=XX]`);
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(url, tries = 4) {
  for (let attempt = 0; attempt < tries; attempt++) {
    if (attempt) await sleep(1500 * attempt);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const body = await res.text();
      if (body.startsWith("You are making")) continue;
      return JSON.parse(body);
    } catch {
      /* retry */
    }
  }
  return null;
}

async function download(url, dest, minBytes = 15_000) {
  if (existsSync(dest)) return true;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(2000 * attempt);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < minBytes) continue;
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, buf);
      return true;
    } catch {
      /* retry */
    }
  }
  return false;
}

async function commonsNearby(point, radius, limit) {
  const query = new URLSearchParams({
    action: "query",
    generator: "geosearch",
    ggscoord: `${point.latitude}|${point.longitude}`,
    ggsradius: String(Math.min(Math.max(radius, 10), 10000)),
    ggsnamespace: "6",
    ggslimit: String(Math.min(limit * 2, 50)),
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1600",
    format: "json",
  });
  const data = await fetchJson(`${COMMONS_API}?${query}`);
  const pages = Object.values(data?.query?.pages ?? {});
  return pages
    .map((page) => {
      const ii = page.imageinfo?.[0];
      if (!ii) return null;
      const meta = ii.extmetadata ?? {};
      return {
        provider: "commons",
        providerId: page.title,
        title: String(page.title).replace(/^File:/, "").replace(/\.[a-z]+$/i, "").replace(/[_-]+/g, " "),
        sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        url: ii.thumburl ?? ii.url,
        width: ii.width,
        height: ii.height,
        mime: ii.mime,
        latitude: page.coordinates?.[0]?.lat ?? point.latitude,
        longitude: page.coordinates?.[0]?.lon ?? point.longitude,
        artist: stripHtml(meta.Artist?.value).slice(0, 70) || "Wikimedia Commons contributors",
        license: meta.LicenseShortName?.value ?? "see Commons",
      };
    })
    .filter(Boolean);
}

async function mapillaryNearby(point, radius, limit, token) {
  const query = new URLSearchParams({
    access_token: token,
    fields: "id,is_pano,compass_angle,thumb_2048_url,captured_at,computed_geometry,quality_score",
    lat: String(point.latitude),
    lng: String(point.longitude),
    radius: String(Math.min(Math.max(radius, 1), 50)),
    limit: String(Math.min(limit, 100)),
  });
  const data = await fetchJson(`${MAPILLARY_GRAPH}/images?${query}`);
  return (data?.data ?? [])
    .map((raw) => {
      const coords = raw.computed_geometry?.coordinates;
      if (!coords || !raw.thumb_2048_url) return null;
      return {
        provider: "mapillary",
        providerId: String(raw.id),
        title: `Mapillary ${raw.id}`,
        sourceUrl: `https://www.mapillary.com/app/?focus=photo&pKey=${raw.id}`,
        url: raw.thumb_2048_url,
        width: 2048,
        height: 1024,
        mime: "image/jpeg",
        latitude: coords[1],
        longitude: coords[0],
        isPano: Boolean(raw.is_pano),
        heading: typeof raw.compass_angle === "number" ? raw.compass_angle : undefined,
        quality: typeof raw.quality_score === "number" ? raw.quality_score : 0,
        artist: "Mapillary contributor",
        license: "CC BY-SA 4.0",
      };
    })
    .filter(Boolean);
}

function keep(candidate) {
  if (!candidate.url) return false;
  if (!/jpe?g|png/i.test(candidate.mime ?? "")) return false;
  if ((candidate.width ?? 0) < 1200) return false;
  const ratio = (candidate.width ?? 1) / (candidate.height ?? 1);
  if (ratio > 2.2 || ratio < 0.5) return false;
  if (candidate.provider === "mapillary" && (candidate.quality ?? 0) < 0.4) return false;
  return true;
}

function slug(value, fallback) {
  const s = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return s || fallback;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.pack || args.near.length === 0) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const token = process.env.MAPILLARY_TOKEN;
  if (args.source === "mapillary" && !token) {
    console.error("MAPILLARY_TOKEN is required for --source=mapillary");
    process.exit(1);
  }
  const points = args.near.map((pair) => {
    const [latitude, longitude] = pair.split(",").map(Number);
    return { latitude, longitude };
  });

  const candidates = [];
  for (const point of points) {
    const found =
      args.source === "mapillary"
        ? await mapillaryNearby(point, args.radius, args.limit, token)
        : await commonsNearby(point, args.radius, args.limit);
    console.log(`${point.latitude},${point.longitude}: ${found.length} candidates`);
    candidates.push(...found);
    await sleep(800);
  }

  const kept = [];
  for (const candidate of candidates) {
    if (!keep(candidate)) continue;
    if (kept.some((existing) => haversineKm(existing, candidate) < 0.5)) continue;
    kept.push(candidate);
    if (kept.length >= args.limit) break;
  }
  console.log(`kept ${kept.length}/${candidates.length} after filters and dedupe`);

  const outDir = join(ROOT, "public", "packs", args.pack);
  const locations = [];
  for (const [index, candidate] of kept.entries()) {
    const id = `pk_${slug(args.pack, "pack")}_${String(index + 1).padStart(3, "0")}`;
    const ext = /png/i.test(candidate.mime) ? "png" : "jpg";
    const rel = `/packs/${args.pack}/${id}.${ext}`;
    const ok = await download(candidate.url, join(outDir, `${id}.${ext}`));
    if (!ok) {
      console.log(`${id}: download failed, skipped`);
      continue;
    }
    locations.push({
      id,
      country: args.country ?? "WORLD",
      nation: args.nation,
      title: args.titlePrefix ? `${args.titlePrefix} ${index + 1}` : candidate.title,
      latitude: Number(candidate.latitude.toFixed(5)),
      longitude: Number(candidate.longitude.toFixed(5)),
      difficulty: 3,
      tags: [candidate.provider, candidate.isPano ? "360" : "photo"],
      attribution:
        candidate.provider === "mapillary"
          ? `Photo: ${candidate.artist}, Mapillary, ${candidate.license}.`
          : `Photo: ${candidate.artist}, Wikimedia Commons, ${candidate.license}.`,
      sourceUrl: candidate.sourceUrl,
      sceneUrl: rel,
      sceneKind: "wikimedia",
      panoramaProvider: candidate.provider,
      panoramaId: candidate.providerId,
      heading: candidate.heading,
      isPano: candidate.isPano ?? undefined,
    });
    console.log(`${id}: ${candidate.title.slice(0, 48)} ${candidate.width}x${candidate.height}`);
    await sleep(250);
  }

  const outFile = join(ROOT, "src", "data", "packs", `${args.pack}.json`);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(
    outFile,
    `${JSON.stringify(
      {
        name: args.pack,
        source: args.source,
        generatedAt: new Date().toISOString(),
        locations,
      },
      null,
      2,
    )}\n`,
  );
  const panos = locations.filter((l) => l.isPano).length;
  console.log(`wrote ${outFile}: ${locations.length} locations (${panos} panoramas)`);
  if (!locations.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
