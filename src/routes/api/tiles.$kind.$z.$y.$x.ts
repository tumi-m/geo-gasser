import { createFileRoute } from "@tanstack/react-router";

/** Same-origin tile proxy. The preview iframe blocks many third-party tile hosts. */
const UPSTREAM: Record<string, (z: number, y: number, x: number) => string> = {
  esri: (z, y, x) =>
    `https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${z}/${y}/${x}`,
  labels: (z, y, x) =>
    `https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/${z}/${y}/${x}`,
};

function asInt(raw: string, max: number) {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > max) return null;
  return n;
}

export const Route = createFileRoute("/api/tiles/$kind/$z/$y/$x")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const build = UPSTREAM[params.kind];
        const z = asInt(params.z, 18);
        if (!build || z == null) return new Response("invalid tile", { status: 400 });
        const max = 2 ** z - 1;
        const y = asInt(params.y, max);
        const x = asInt(params.x, max);
        if (y == null || x == null) return new Response("invalid tile", { status: 400 });
        try {
          const upstream = await fetch(build(z, y, x), {
            headers: { "User-Agent": "ATLAS-DUEL/1.0 (https://github.com/tumi-m/geo-gasser)" },
            signal: AbortSignal.timeout(8000),
          });
          if (!upstream.ok) return new Response("upstream", { status: 502 });
          const body = await upstream.arrayBuffer();
          return new Response(body, {
            headers: {
              "content-type": upstream.headers.get("content-type") || "image/jpeg",
              "cache-control": "public, max-age=86400, immutable",
            },
          });
        } catch {
          return new Response("tile error", { status: 502 });
        }
      },
    },
  },
});
