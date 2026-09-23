// Apple Music developer tokens, per Apple's "Generating Developer Tokens":
// an ES256 (ECDSA P-256 / SHA-256) JWT, header { alg, kid }, claims
// { iss: team id, iat, exp <= iat + 15777000 }, plus the `origin` allow-list
// Apple recommends for web clients. Signed with the MusicKit private key, which
// is why this is a .server module: the key never reaches the browser.

import { createPrivateKey, sign } from "node:crypto";

/** Apple's ceiling: six months, in seconds. */
export const MAX_TTL_SECONDS = 15_777_000;
const TTL_SECONDS = 12 * 3600;

const b64url = (value: string) => Buffer.from(value).toString("base64url");

/** Env vars often hold a .p8 with its newlines escaped as `\n`; accept both. */
export function normalisePem(raw: string): string {
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

export interface AppleTokenConfig {
  teamId: string;
  keyId: string;
  privateKey: string;
  origins: string[];
}

export function mintDeveloperToken(opts: {
  teamId: string;
  keyId: string;
  privateKey: string;
  origins?: string[];
  now?: number;
  ttlSeconds?: number;
}): string {
  const iat = Math.floor((opts.now ?? Date.now()) / 1000);
  const ttl = Math.min(Math.max(opts.ttlSeconds ?? TTL_SECONDS, 60), MAX_TTL_SECONDS);
  const header = { alg: "ES256", kid: opts.keyId };
  const claims: Record<string, unknown> = { iss: opts.teamId, iat, exp: iat + ttl };
  if (opts.origins?.length) claims.origin = opts.origins;

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const key = createPrivateKey(normalisePem(opts.privateKey));
  // JWS wants the raw r||s signature, not DER.
  const signature = sign("sha256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${signature.toString("base64url")}`;
}

/** Null until all three required values are set: the player then hides Apple Music. */
export function configFromEnv(env: Record<string, string | undefined>): AppleTokenConfig | null {
  const teamId = env.APPLE_MUSIC_TEAM_ID?.trim();
  const keyId = env.APPLE_MUSIC_KEY_ID?.trim();
  const privateKey = env.APPLE_MUSIC_PRIVATE_KEY?.trim();
  if (!teamId || !keyId || !privateKey) return null;
  const origins = (env.APPLE_MUSIC_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return { teamId, keyId, privateKey, origins };
}

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extra },
  });

/** Reuse a minted token until it has an hour left. */
let cached: { token: string; expiresAt: number } | null = null;

/**
 * GET /api/apple-music-token → { configured, token? }.
 * "Not configured" is a normal 200, not an error status: it is an answer, and an
 * error status would log to every player's console each time they open Music.
 */
export async function handleAppleMusicToken(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): Promise<Response> {
  if (request.method !== "GET") return json(405, { error: "method-not-allowed" });
  const config = configFromEnv(env);
  if (!config) return json(200, { configured: false }, { "cache-control": "private, max-age=300" });

  const now = Date.now();
  if (!cached || cached.expiresAt - now < 3_600_000) {
    try {
      cached = {
        token: mintDeveloperToken({ ...config, now, ttlSeconds: TTL_SECONDS }),
        expiresAt: now + TTL_SECONDS * 1000,
      };
    } catch (error) {
      // A malformed key is an operator error; say so without leaking it.
      console.error(
        "[apple-music-token] could not sign developer token:",
        (error as Error).message,
      );
      return json(500, { error: "apple-music-key-invalid" });
    }
  }
  // Meant for the page (MusicKit sends it from the browser), so caching is
  // fine; `private` keeps shared caches from pinning a stale one.
  return json(
    200,
    { configured: true, token: cached.token },
    { "cache-control": "private, max-age=1800" },
  );
}

/** Test hook: forget the cached token so a config change takes effect. */
export function resetAppleTokenCache(): void {
  cached = null;
}
