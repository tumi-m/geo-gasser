#!/usr/bin/env node
/**
 * Localise the world-pool photos. pack-locations.ts hotlinked Wikimedia
 * Commons via Special:FilePath, which rate-limits (HTTP 429) under load
 * and breaks offline. This resolves every referenced file in BATCHED API
 * calls (50 titles each), downloads 1600px thumbs once into
 * /tmp/opencode/pack, and records author/license for attribution.
 *
 *   node scripts/fetch-pack-photos.mjs
 *
 * Idempotent: existing files are kept, so re-runs resume.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SRC = "src/lib/game/pack-locations.ts";
const DEST = "/tmp/opencode/pack";
const UA = { "User-Agent": "ATLAS-DUEL-pack-localise/1.0 (github.com/tumi-m/geo-gasser)" };
const API = "https://commons.wikimedia.org/w/api.php";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const text = readFileSync(SRC, "utf8");
const entries = [];
for (const chunk of text.split("loc({").slice(1)) {
  const id = chunk.match(/id:\s*"(loc_\d+)"/)?.[1];
  const file = chunk.match(/commons\("([^"]+)"\)/)?.[1];
  if (id && file) entries.push({ id, file });
}
console.log(`pack entries: ${entries.length}`);
mkdirSync(DEST, { recursive: true });
const manifestPath = `${DEST}/manifest.json`;
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};

// ── 1. Batch-resolve imageinfo (50 titles per request) ───────────────────────
const need = entries.filter((e) => !manifest[e.id] || !existsSync(`${DEST}/${e.id}.${manifest[e.id]?.ext ?? "jpg"}`));
console.log(`need resolution: ${need.length}`);
for (let i = 0; i < need.length; i += 50) {
  const batch = need.slice(i, i + 50);
  const q = new URLSearchParams({
    action: "query",
    titles: batch.map((b) => `File:${b.file}`).join("|"),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1600",
    format: "json",
  });
  let payload = null;
  for (let attempt = 0; attempt < 6 && !payload; attempt++) {
    if (attempt) await sleep(5000 * attempt);
    const res = await fetch(`${API}?${q}`, { headers: UA });
    if (!res.ok) continue;
    const body = await res.text();
    if (body.startsWith("You are making")) continue;
    payload = JSON.parse(body);
  }
  if (!payload) {
    console.log(`batch ${i / 50 + 1}: API FAILED`);
    continue;
  }
  const pages = payload.query?.pages ?? {};
  for (const page of Object.values(pages)) {
    const title = page.title ?? "";
    const file = title.replace(/^File:/, "");
    const match = batch.find((b) => b.file.replace(/_/g, " ") === file.replace(/_/g, " ")) ?? batch.find((b) => file.includes(b.file));
    if (!match) continue;
    const ii = page.imageinfo?.[0];
    if (!ii) {
      console.log(`${match.id}: NO IMAGEINFO for ${match.file}`);
      continue;
    }
    const meta = ii.extmetadata ?? {};
    manifest[match.id] = {
      file: match.file,
      url: ii.thumburl ?? ii.url,
      width: ii.width,
      height: ii.height,
      artist: (meta.Artist?.value ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 70),
      license: meta.LicenseShortName?.value ?? "see Commons",
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
  console.log(`resolved batch ${i / 50 + 1}: manifest ${Object.keys(manifest).length}`);
  await sleep(1500);
}

// ── 1b. Per-file fallback for anything the batched pass could not match ─────
const unresolved = entries.filter((e) => !manifest[e.id]);
console.log(`per-file fallback: ${unresolved.length}`);
for (const e of unresolved) {
  const q = new URLSearchParams({
    action: "query",
    titles: `File:${e.file}`,
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1600",
    format: "json",
  });
  let payload = null;
  for (let attempt = 0; attempt < 6 && !payload; attempt++) {
    if (attempt) await sleep(4000 * attempt);
    const res = await fetch(`${API}?${q}`, { headers: UA });
    if (!res.ok) continue;
    const body = await res.text();
    if (body.startsWith("You are making")) continue;
    payload = JSON.parse(body);
  }
  const page = payload ? Object.values(payload.query?.pages ?? {})[0] : null;
  const ii = page?.imageinfo?.[0];
  if (!ii) {
    console.log(`${e.id}: STILL UNRESOLVED ${e.file}`);
    continue;
  }
  const meta = ii.extmetadata ?? {};
  manifest[e.id] = {
    file: e.file,
    url: ii.thumburl ?? ii.url,
    width: ii.width,
    height: ii.height,
    artist: (meta.Artist?.value ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 70),
    license: meta.LicenseShortName?.value ?? "see Commons",
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  await sleep(1200);
}
console.log(`manifest after fallback: ${Object.keys(manifest).length}`);

// ── 2. Download thumbs (concurrency 3, retry once) ───────────────────────────
const toDownload = Object.entries(manifest).filter(
  ([id]) => !["jpg", "png", "webp"].some((e) => existsSync(`${DEST}/${id}.${e}`)),
);
console.log(`need download: ${toDownload.length}`);

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
let failed = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (cursor < toDownload.length) {
      const [id, m] = toDownload[cursor++];
      const done = await downloadOne(id, m);
      if (done) ok++;
      else {
        failed++;
        console.log(`${id}: DOWNLOAD FAILED ${m.file}`);
      }
    }
  }),
);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
const have = entries.filter((e) => ["jpg", "png", "webp"].some((x) => existsSync(`${DEST}/${e.id}.${x}`)));
console.log(`downloaded ${ok}, failed ${failed}; files on disk ${have.length}/${entries.length}`);
const missing = entries.filter((e) => !have.some((h) => h.id === e.id));
if (missing.length) console.log("missing:", missing.map((m) => m.id).join(", "));
