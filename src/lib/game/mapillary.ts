/**
 * Mapillary API v4 access. Imagery is CC-BY-SA 4.0; credit Mapillary and the
 * contributor wherever a plate is shown.
 *
 * A Mapillary client access token is public by design (MapillaryJS ships it in
 * the browser), so `VITE_MAPILLARY_TOKEN` is the expected way to configure it.
 * Without a token the game keeps using bundled stills.
 */

const GRAPH = "https://graph.mapillary.com";
const FIELDS = [
  "id",
  "is_pano",
  "compass_angle",
  "thumb_2048_url",
  "captured_at",
  "computed_geometry",
  "quality_score",
].join(",");

export interface MapillaryImage {
  id: string;
  isPano: boolean;
  compassAngle?: number;
  thumbUrl?: string;
  capturedAt?: number;
  qualityScore?: number;
  latitude: number;
  longitude: number;
}

function clientToken(): string | undefined {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    return env?.VITE_MAPILLARY_TOKEN;
  } catch {
    return undefined;
  }
}

export function mapillaryConfigured(): boolean {
  return Boolean(clientToken());
}

function parseImage(raw: Record<string, unknown>): MapillaryImage | null {
  const geometry = raw.computed_geometry as { coordinates?: [number, number] } | undefined;
  const coords = geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  return {
    id: String(raw.id),
    isPano: Boolean(raw.is_pano),
    compassAngle: typeof raw.compass_angle === "number" ? raw.compass_angle : undefined,
    thumbUrl: typeof raw.thumb_2048_url === "string" ? raw.thumb_2048_url : undefined,
    capturedAt: typeof raw.captured_at === "number" ? raw.captured_at : undefined,
    qualityScore: typeof raw.quality_score === "number" ? raw.quality_score : undefined,
    longitude: coords[0],
    latitude: coords[1],
  };
}

async function graph(path: string, params: Record<string, string>, token: string) {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("fields", FIELDS);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

export async function mapillaryImage(
  id: string,
  token = clientToken(),
): Promise<MapillaryImage | null> {
  if (!token) return null;
  const data = await graph(`/${encodeURIComponent(id)}`, {}, token);
  return data ? parseImage(data) : null;
}

/**
 * Best images within 50 m of a point (API max radius). Prefers panoramas and
 * higher quality scores, newest first.
 */
export async function mapillaryNearby(
  latitude: number,
  longitude: number,
  options: { token?: string; radius?: number; limit?: number; panosOnly?: boolean } = {},
): Promise<MapillaryImage[]> {
  const token = options.token ?? clientToken();
  if (!token) return [];
  const radius = Math.min(Math.max(options.radius ?? 50, 1), 50);
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
  const data = await graph(
    "/images",
    {
      lat: String(latitude),
      lng: String(longitude),
      radius: String(radius),
      limit: String(limit),
    },
    token,
  );
  const rows = (data?.data as Array<Record<string, unknown>> | undefined) ?? [];
  const images = rows
    .map(parseImage)
    .filter((img): img is MapillaryImage => Boolean(img))
    .filter((img) => (options.panosOnly ? img.isPano : true));
  return images.sort(
    (a, b) =>
      Number(b.isPano) - Number(a.isPano) ||
      (b.qualityScore ?? 0) - (a.qualityScore ?? 0) ||
      (b.capturedAt ?? 0) - (a.capturedAt ?? 0),
  );
}

/** Resolve the display URL for a Mapillary image id. */
export async function mapillaryImageUrl(
  id: string,
  token = clientToken(),
): Promise<string | null> {
  const image = await mapillaryImage(id, token);
  return image?.thumbUrl ?? null;
}
