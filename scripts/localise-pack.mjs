#!/usr/bin/env node
/**
 * Resolve, download and report the world-pool photos.
 *
 * pack-locations.ts referenced 79 Commons files by guessed names; many do
 * not exist (the API returns "missing"). This resolves each entry:
 *   1. exact file from the manifest / API when it exists
 *   2. otherwise a Commons search for "<title> <city>" (top bitmap result)
 * Downloads 1600px thumbs to /tmp/opencode/pack and writes manifest.json
 * with author/license plus a `missing` list for anything unresolvable.
 *
 *   node scripts/localise-pack.mjs
 *
 * Idempotent and resumable.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SRC = "src/lib/game/pack-locations.ts";
const DEST = "/tmp/opencode/pack";
const UA = { "User-Agent": "ATLAS-DUEL-pack-localise/1.0 (github.com/tumi-m/geo-gasser)" };
const API = "https://commons.wikimedia.org/w/api.php";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── parse ────────────────────────────────────────────────────────────────────
const text = readFileSync(SRC, "utf8");
const entries = [];
for (const chunk of text.split("loc({").slice(1)) {
  const id = chunk.match(/id:\s*"(loc_\d+)"/)?.[1];
  const file = chunk.match(/commons\("([^"]+)"\)/)?.[1];
  const title = chunk.match(/title:\s*"([^"]+)"/)?.[1];
  const city = chunk.match(/city:\s*"([^"]+)"/)?.[1];
  const region = chunk.match(/region:\s*"([^"]+)"/)?.[1];
  if (id && file) entries.push({ id, file, title: title ?? "", city: city ?? "", region: region ?? "" });
}
console.log(`entries: ${entries.length}`);
mkdirSync(DEST, { recursive: true });
const manifestPath = `${DEST}/manifest.json`;
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
const haveFile = (id) => ["jpg", "png", "webp"].some((e) => existsSync(`${DEST}/${id}.${e}`));

async function api(params) {
  const q = new URLSearchParams({ ...params, format: "json" });
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await sleep(4000 * attempt);
    const res = await fetch(`${API}?${q}`, { headers: UA });
    if (!res.ok) continue;
    const body = await res.text();
    if (body.startsWith("You are making")) continue;
    return JSON.parse(body);
  }
  return null;
}

function metaFrom(ii) {
  const meta = ii.extmetadata ?? {};
  return {
    url: ii.thumburl ?? ii.url,
    width: ii.width,
    height: ii.height,
    artist: (meta.Artist?.value ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 70),
    license: meta.LicenseShortName?.value ?? "see Commons",
  };
}

// ── resolve ──────────────────────────────────────────────────────────────────
const unresolved = entries.filter((e) => !manifest[e.id]?.url);
console.log(`resolving: ${unresolved.length}`);
for (const e of unresolved) {
  // Exact file first.
  const exact = await api({
    action: "query",
    titles: `File:${e.file}`,
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1600",
  });
  const page = exact ? Object.values(exact.query?.pages ?? {})[0] : null;
  const ii = page?.imageinfo?.[0];
  if (ii) {
    manifest[e.id] = { file: e.file, via: "exact", ...metaFrom(ii) };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    await sleep(900);
    continue;
  }
  // Search fallback: title + city, top bitmap.
  const query = [e.title, e.city, e.region].filter(Boolean).join(" ");
  const found = await api({
    action: "query",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "6",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1600",
  });
  const candidates = Object.values(found?.query?.pages ?? {})
    .map((p) => ({ title: p.title, ii: p.imageinfo?.[0] }))
    .filter((c) => c.ii && c.ii.width >= 800 && /jpe?g|png/i.test(c.ii.mime ?? ""));
  const pick = candidates[0];
  if (pick) {
    manifest[e.id] = { file: pick.title.replace(/^File:/, ""), via: "search", ...metaFrom(pick.ii) };
    console.log(`${e.id}: SEARCH -> ${manifest[e.id].file} (${manifest[e.id].artist || "?"})`);
  } else {
    manifest[e.id] = { file: e.file, via: "missing", missing: true };
    console.log(`${e.id}: UNRESOLVED ${e.file}`);
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  await sleep(1400);
}

// ── download ─────────────────────────────────────────────────────────────────
const toDownload = Object.entries(manifest).filter(([id, m]) => !m.missing && !haveFile(id));
console.log(`downloading: ${toDownload.length}`);
async function downloadOne(id, m) {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await sleep(3000 * attempt);
    try {
      const res = await fetch(m.url, { headers: UA, redirect: "follow" });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 15_000) continue;
      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
      writeFileSync(`${DEST}/${id}.${ext}`, buf);
      m.bytes = buf.length;
      m.ext = ext;
      return true;
    } catch {
      /* retry */
    }
  }
  return false;
}
let cursor = 0;
let ok = 0;
let failed = [];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (cursor < toDownload.length) {
      const [id, m] = toDownload[cursor++];
      if (await downloadOne(id, m)) ok++;
      else failed.push(id);
    }
  }),
);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const missing = entries.filter((e) => manifest[e.id]?.missing);
const onDisk = entries.filter((e) => haveFile(e.id));
console.log(`downloaded ${ok}; files on disk ${onDisk.length}/${entries.length}`);
console.log(`download failures: ${failed.join(", ") || "none"}`);
console.log(`unresolvable (disable these): ${missing.map((m) => `${m.id}(${m.title})`).join(", ") || "none"}`);
