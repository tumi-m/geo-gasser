// FILE: src/lib/music/pkce.ts
// Authorization Code + PKCE for Spotify, as pure functions over WebCrypto so
// they run (and are tested) the same in the browser and in Node. No client
// secret exists anywhere: PKCE is the flow Spotify provides for apps that
// cannot keep one, which is every browser-only game.

export const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

/**
 * `streaming` + the two read scopes are what the Web Playback SDK needs to
 * register this tab as a device; the rest list the player's playlists and
 * start playback on that device.
 */
export const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
] as const;

const VERIFIER_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Random string from the unreserved alphabet (RFC 7636 allows 43–128 chars). */
export function randomString(length = 64): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  // 62 does not divide 256, so reject the top of the range to stay unbiased.
  for (const b of bytes) {
    if (b < 248) out += VERIFIER_ALPHABET[b % 62];
  }
  return out.length >= length ? out.slice(0, length) : out + randomString(length - out.length);
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** S256 code challenge: base64url(SHA-256(verifier)), unpadded. */
export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function authorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
  scopes?: readonly string[];
}): string {
  const url = new URL(SPOTIFY_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    scope: (opts.scopes ?? SPOTIFY_SCOPES).join(" "),
    code_challenge_method: "S256",
    code_challenge: opts.challenge,
    redirect_uri: opts.redirectUri,
    state: opts.state,
  }).toString();
  return url.toString();
}

export function codeExchangeBody(opts: {
  clientId: string;
  code: string;
  redirectUri: string;
  verifier: string;
}): URLSearchParams {
  return new URLSearchParams({
    client_id: opts.clientId,
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    code_verifier: opts.verifier,
  });
}

export function refreshBody(opts: { clientId: string; refreshToken: string }): URLSearchParams {
  return new URLSearchParams({
    client_id: opts.clientId,
    grant_type: "refresh_token",
    refresh_token: opts.refreshToken,
  });
}

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms at which the access token stops working. */
  expiresAt: number;
}

/**
 * Read a token endpoint response. A refresh may omit `refresh_token`, in which
 * case the one already held stays valid and must be kept, not dropped.
 */
export function readTokenResponse(
  body: unknown,
  now: number,
  previousRefresh?: string,
): StoredTokens | null {
  if (!body || typeof body !== "object") return null;
  const r = body as Record<string, unknown>;
  if (typeof r.access_token !== "string" || typeof r.expires_in !== "number") return null;
  const refreshToken = typeof r.refresh_token === "string" ? r.refresh_token : previousRefresh;
  if (!refreshToken) return null;
  return { accessToken: r.access_token, refreshToken, expiresAt: now + r.expires_in * 1000 };
}

/** Refresh a minute early so a request never races the expiry. */
export function needsRefresh(tokens: StoredTokens, now: number, marginMs = 60_000): boolean {
  return now >= tokens.expiresAt - marginMs;
}
