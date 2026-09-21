#!/usr/bin/env node
/**
 * Download verified Wikimedia Commons photos for the location pool.
 * Each entry: the Commons file, the author, and the license, kept in
 * sync with the attribution strings in src/lib/game/locations.ts.
 *
 *   node scripts/fetch-location-photos.mjs
 *
 * Files land in /tmp first; they are then resized to max 1600px wide and
 * committed as public/locations/loc_XX.jpg (quality 82, no EXIF).
 */
import { mkdirSync, statSync, writeFileSync } from "node:fs";

const DEST = process.argv[2] ?? "/tmp/opencode/imgs";

const FILES = {
  loc_06: { file: "Stellenbosch Part II - Stellenbosch3758.jpg", author: "lumoplank", license: "CC0" },
  loc_07: { file: "Naval Hill - Bloemfontein - Mandela.jpg", author: "Diether", license: "CC BY-SA 4.0" },
  loc_09: { file: "Lowveld National Botanical Garden 1.jpg", author: "Werner Bayer", license: "CC0" },
  loc_10: { file: "Polokwane (Pietersburg), Limpopo, South Africa.jpg", author: "JasonMoe289", license: "CC BY-SA 4.0" },
  loc_12: { file: "Orlando Towers (8036285070).jpg", author: "Charles Haynes", license: "CC BY-SA 2.0" },
  loc_13: { file: "Knysna Heads 01.jpg", author: "Ad Meskens", license: "CC BY-SA 4.0" },
  loc_14: { file: "Amphitheatre Drakensberg View.jpg", author: "PhilippN", license: "CC BY-SA 3.0" },
  loc_16: { file: "Dam Amsterdam 7308.jpg", author: "C messier", license: "CC BY-SA 4.0" },
  loc_18: { file: "Binnenhof, The Hague -hu-1806.jpg", author: "Hubertl", license: "CC BY-SA 4.0" },
  loc_19: { file: "DomTorenUtrechtNederland.jpg", author: "Massimo Catarinella", license: "CC BY 3.0" },
  loc_22: { file: "Maastricht Vrijthof 15 BW 2017-08-19 12-06-24.jpg", author: "Berthold Werner", license: "CC BY-SA 4.0" },
  loc_23: { file: "Oude kerk delft dawn.jpg", author: "Tremlin", license: "CC BY-SA 3.0" },
  loc_24: { file: "Grote Markt Stadthuis Harlem.jpg", author: "Wolfgang Moroder", license: "CC BY-SA 4.0" },
  loc_25: { file: "Hortus Botanicus Leiden - De Wintertuin.JPG", author: "Tubantia", license: "CC BY-SA 3.0" },
  loc_26: { file: "Windmills at Zaanse Schans, Zaanstad, 2022.jpg", author: "DimiTalen", license: "CC0" },
  loc_27: { file: "Kinderdijk windmills 07.jpg", author: "John Samuel", license: "CC BY-SA 4.0" },
  loc_28: { file: "Giethoorn canal 2016.jpg", author: "Steven Lek", license: "CC BY-SA 4.0" },
  loc_29: { file: "Den Haag-Scheveningen, de Pier IMG 0095 2021-08-04 10.46.jpg", author: "Michielverbeek", license: "CC BY-SA 4.0" },
  loc_30: { file: "01 Rotterdam - Kubushaus.jpg", author: "W. Bulach", license: "CC BY-SA 4.0" },
};

const API = "https://commons.wikimedia.org/w/api.php";
const UA = { "User-Agent": "ATLAS-DUEL-map-fix/1.0 (github.com/tumi-m/geo-gasser)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function thumbUrl(title, width = 1920) {
  const q = new URLSearchParams({
    action: "query",
    titles: `File:${title}`,
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: String(width),
    format: "json",
  });
  let lastErr = new Error("unreachable");
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt) await sleep(8000 * attempt); // Commons rate-limits aggressively; back off hard.
    const res = await fetch(`${API}?${q}`, { headers: UA });
    if (res.status === 429 || !res.ok) {
      lastErr = new Error(`HTTP ${res.status}`);
      continue;
    }
    const body = await res.text();
    if (body.startsWith("You are making")) {
      lastErr = new Error("rate limited");
      continue;
    }
    const j = JSON.parse(body);
    const page = Object.values(j.query?.pages ?? {})[0];
    const ii = page?.imageinfo?.[0];
    if (ii?.thumburl || ii?.url) return ii.thumburl ?? ii.url;
    lastErr = new Error(`no imageinfo for ${title}`);
  }
  throw lastErr;
}

async function dl(url, file) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 30_000) throw new Error(`${file}: suspiciously small (${buf.length} B)`);
  writeFileSync(`${DEST}/${file}`, buf);
  return buf.length;
}

mkdirSync(DEST, { recursive: true });
const manifest = {};
for (const [id, meta] of Object.entries(FILES)) {
  // Idempotent: keep files that already made it down.
  try {
    manifest[id] = {
      ...meta,
      bytes: statSync(`${DEST}/${id}.jpg`).size,
      source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(meta.file)}`,
    };
    console.log(`${id}: already downloaded`);
    continue;
  } catch {
    /* not there yet */
  }
  const url = await thumbUrl(meta.file);
  const bytes = await dl(url, `${id}.jpg`);
  manifest[id] = { ...meta, bytes, source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(meta.file)}` };
  console.log(`${id}: ${(bytes / 1024).toFixed(0)} KB  ${meta.file}`);
  await sleep(2500);
}
writeFileSync(`${DEST}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log("manifest written");