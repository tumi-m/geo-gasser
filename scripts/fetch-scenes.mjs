#!/usr/bin/env node
/** Cache Wikipedia page images into public/locations for pack sites. */
import { writeFile, mkdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

async function loadLocations() {
  const { enabledLocations } = await import("../src/lib/game/locations.ts");
  return enabledLocations();
}

function wikiTitle(sourceUrl, title) {
  if (sourceUrl) {
    try {
      const u = new URL(sourceUrl);
      const i = u.pathname.indexOf("/wiki/");
      if (i >= 0) return decodeURIComponent(u.pathname.slice(i + 6)).replace(/_/g, " ");
    } catch {
      /* ignore */
    }
  }
  return title;
}

async function wikiThumb(title, attempt = 0) {
  const api = new URL("https://en.wikipedia.org/w/api.php");
  api.searchParams.set("action", "query");
  api.searchParams.set("format", "json");
  api.searchParams.set("redirects", "1");
  api.searchParams.set("prop", "pageimages");
  api.searchParams.set("piprop", "thumbnail");
  api.searchParams.set("pithumbsize", "960");
  api.searchParams.set("titles", title);
  const res = await fetch(api, {
    headers: { "Api-User-Agent": "AtlasDuel/1.0 (geo-gasser; contact: github.com/tumi-m/geo-gasser)" },
  });
  const text = await res.text();
  if ((res.status === 429 || text.startsWith("You are making")) && attempt < 6) {
    await new Promise((r) => setTimeout(r, 4000 + attempt * 1000));
    return wikiThumb(title, attempt + 1);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const pages = data?.query?.pages ?? {};
  for (const page of Object.values(pages)) {
    if (page.thumbnail?.source) return page.thumbnail.source;
  }
  return null;
}

async function exists(path) {
  try {
    const s = await stat(path);
    return s.size > 8000;
  } catch {
    return false;
  }
}

const locs = await loadLocations();
await mkdir("public/locations", { recursive: true });
let ok = 0;
let skip = 0;
let fail = 0;
for (const loc of locs) {
  const dest = `public/locations/${loc.id}.jpg`;
  if (loc.sceneUrl.startsWith("/generated/")) {
    skip++;
    continue;
  }
  if (await exists(dest)) {
    skip++;
    continue;
  }
  const title = wikiTitle(loc.sourceUrl, loc.title);
  const thumb = title ? await wikiThumb(title) : null;
  if (!thumb) {
    console.log("no-thumb", loc.id, loc.title);
    fail++;
    continue;
  }
  const img = await fetch(thumb, { headers: { "Api-User-Agent": "AtlasDuel/1.0 (geo-gasser)" } });
  if (img.status === 429) {
    await new Promise((r) => setTimeout(r, 5000));
    fail++;
    console.log("retry-later", loc.id);
    continue;
  }
  if (!img.ok) {
    console.log("fetch-fail", loc.id, img.status);
    fail++;
    continue;
  }
  const buf = Buffer.from(await img.arrayBuffer());
  await writeFile(dest, buf);
  console.log("saved", loc.id, loc.title, buf.length);
  ok++;
  await new Promise((r) => setTimeout(r, 450));
}
console.log({ ok, skip, fail });
