import { handleAppleMusicToken } from "../lib/music/apple-token.server.ts";
import { handleSignaling } from "../lib/multiplayer/signaling.server.ts";

/**
 * Every server endpoint the game has. One web-standard handler: Vercel runs it
 * as a function (`export default { fetch }`), and the dev server mounts it in
 * front of Vite (vite.config.ts).
 */
const endpoints: Record<string, (request: Request) => Promise<Response>> = {
  "/api/rtc": handleSignaling,
  "/api/apple-music-token": (request) => handleAppleMusicToken(request),
};

export async function handleApi(request: Request): Promise<Response> {
  const endpoint = endpoints[new URL(request.url).pathname.replace(/\/+$/, "")];
  if (!endpoint) {
    return new Response(JSON.stringify({ error: "not-found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  return endpoint(request);
}

export default { fetch: handleApi };
