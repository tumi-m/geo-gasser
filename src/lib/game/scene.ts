import type { GeoLocation } from "./types.ts";

const UA = "AtlasDuel/1.0 (https://geo-gasser.vercel.app)";

export function wikiTitleFrom(sourceUrl?: string): string | undefined {
  if (!sourceUrl) return undefined;
  try {
    const u = new URL(sourceUrl);
    const marker = "/wiki/";
    const i = u.pathname.indexOf(marker);
    if (i < 0) return undefined;
    return decodeURIComponent(u.pathname.slice(i + marker.length)).replace(/_/g, " ");
  } catch {
    return undefined;
  }
}

export function localScenePath(id: string): string {
  return `/locations/${id}.jpg`;
}

/** Ordered candidates: 360 plate first, then the local still, then stored. */
export function sceneCandidates(loc: Pick<GeoLocation, "id" | "sceneUrl" | "panoUrl">): string[] {
  const url = loc.sceneUrl;
  if (url.startsWith("/generated/")) return [url];
  const urls: string[] = [];
  if (loc.panoUrl) urls.push(loc.panoUrl);
  const local = localScenePath(loc.id);
  if (!urls.includes(local)) urls.push(local);
  if (url && url !== local && !urls.includes(url)) urls.push(url);
  return urls;
}

async function wikiJson(params: Record<string, string>): Promise<Record<string, unknown> | null> {
  const api = new URL("https://en.wikipedia.org/w/api.php");
  api.searchParams.set("action", "query");
  api.searchParams.set("format", "json");
  api.searchParams.set("origin", "*");
  for (const [k, v] of Object.entries(params)) api.searchParams.set(k, v);
  try {
    const res = await fetch(api.toString(), { headers: { "Api-User-Agent": UA } });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function firstThumb(data: Record<string, unknown> | null): string | null {
  const query = data?.query as
    { pages?: Record<string, { thumbnail?: { source?: string } }> } | undefined;
  const pages = query?.pages;
  if (!pages) return null;
  for (const page of Object.values(pages)) {
    if (page.thumbnail?.source) return page.thumbnail.source;
  }
  return null;
}

async function pageImage(page: string): Promise<string | null> {
  const data = await wikiJson({
    redirects: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "1920",
    titles: page,
  });
  return firstThumb(data);
}

export async function resolveWikiImage(sourceUrl?: string, title?: string): Promise<string | null> {
  const pages = [...new Set([wikiTitleFrom(sourceUrl), title?.trim()].filter(Boolean) as string[])];
  for (const page of pages) {
    const src = await pageImage(page);
    if (src) return src;
  }
  const search = title?.trim() || wikiTitleFrom(sourceUrl);
  if (!search) return null;
  const data = await wikiJson({
    generator: "search",
    gsrsearch: search,
    gsrlimit: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "1920",
  });
  return firstThumb(data);
}

/** Keep the lightweight plate on phones; allow large displays to request the original. */
export function responsiveSceneSrcSet(src: string): string | undefined {
  if (src === "/locations/loc_02.jpg") {
    return "/locations/loc_02.jpg 1280w, /locations/hires/loc_02.jpg 5844w";
  }
  return undefined;
}
