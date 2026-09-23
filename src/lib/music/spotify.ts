// FILE: src/lib/music/spotify.ts
// Spotify account connection for the music player: PKCE sign-in, token refresh,
// the Web Playback SDK (which turns this tab into a Spotify device), and the
// two Web API calls the player needs. Browser-only; the pure pieces are in pkce.ts.

import {
  authorizeUrl,
  codeChallenge,
  codeExchangeBody,
  needsRefresh,
  randomString,
  readTokenResponse,
  refreshBody,
  SPOTIFY_TOKEN_URL,
  type StoredTokens,
} from "./pkce.ts";

const TOKENS_KEY = "atlas-duel-spotify";
const PENDING_KEY = "atlas-duel-spotify-pending";
const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
const API = "https://api.spotify.com/v1";

export const spotifyClientId = (import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? "").trim();
/** Without a client id there is no way to connect, so the player hides the option. */
export const spotifyConfigured = spotifyClientId.length > 0;

/** Must match a redirect URI registered on the Spotify app, character for character. */
export function spotifyRedirectUri(): string {
  const configured = (import.meta.env.VITE_SPOTIFY_REDIRECT_URI ?? "").trim();
  return configured || `${window.location.origin}/`;
}

export type SpotifyErrorCode =
  "signed-out" | "premium-required" | "play-failed" | "list-failed" | "no-device";

export class SpotifyError extends Error {
  constructor(readonly code: SpotifyErrorCode) {
    super(code);
  }
}

// ── tokens ───────────────────────────────────────────────────────────────────

function readTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as Partial<StoredTokens>;
    return typeof t.accessToken === "string" &&
      typeof t.refreshToken === "string" &&
      typeof t.expiresAt === "number"
      ? (t as StoredTokens)
      : null;
  } catch {
    return null;
  }
}

function writeTokens(tokens: StoredTokens | null): void {
  try {
    if (tokens) localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    else localStorage.removeItem(TOKENS_KEY);
  } catch {
    /* private mode: the session simply will not outlive the tab */
  }
}

export function hasSpotifySession(): boolean {
  return spotifyConfigured && readTokens() !== null;
}

export function disconnectSpotify(): void {
  writeTokens(null);
}

let refreshing: Promise<string | null> | null = null;

async function refresh(tokens: StoredTokens): Promise<string | null> {
  try {
    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: refreshBody({ clientId: spotifyClientId, refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) {
      // 400 is Spotify's answer to a revoked or expired refresh token.
      if (res.status === 400 || res.status === 401) writeTokens(null);
      return null;
    }
    const next = readTokenResponse(await res.json(), Date.now(), tokens.refreshToken);
    writeTokens(next);
    return next?.accessToken ?? null;
  } catch {
    // Offline: keep the session and let the next call try again.
    return null;
  }
}

/** A usable access token, refreshed first if it is about to expire. */
export function getSpotifyAccessToken(): Promise<string | null> {
  const tokens = readTokens();
  if (!tokens) return Promise.resolve(null);
  if (!needsRefresh(tokens, Date.now())) return Promise.resolve(tokens.accessToken);
  return (refreshing ??= refresh(tokens).finally(() => {
    refreshing = null;
  }));
}

// ── sign-in redirect ─────────────────────────────────────────────────────────

/** Leaves the page for Spotify's consent screen; it returns to the redirect URI. */
export async function beginSpotifyConnect(): Promise<void> {
  const verifier = randomString(64);
  const state = randomString(24);
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state }));
  const challenge = await codeChallenge(verifier);
  window.location.assign(
    authorizeUrl({
      clientId: spotifyClientId,
      redirectUri: spotifyRedirectUri(),
      challenge,
      state,
    }),
  );
}

export type CallbackResult =
  { kind: "none" } | { kind: "connected" } | { kind: "error"; message: string };

async function runCallback(): Promise<CallbackResult> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");
  // Only a load that follows our own redirect is ours to consume.
  const pendingRaw = sessionStorage.getItem(PENDING_KEY);
  if ((!code && !error) || !pendingRaw) return { kind: "none" };

  sessionStorage.removeItem(PENDING_KEY);
  for (const p of ["code", "error", "state"]) url.searchParams.delete(p);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);

  if (error) {
    return {
      kind: "error",
      message:
        error === "access_denied"
          ? "Spotify connection was cancelled."
          : "Spotify could not connect.",
    };
  }

  let pending: { verifier?: unknown; state?: unknown };
  try {
    pending = JSON.parse(pendingRaw) as typeof pending;
  } catch {
    return { kind: "error", message: "Spotify sign-in could not be verified. Try again." };
  }
  if (typeof pending.verifier !== "string" || pending.state !== state) {
    return { kind: "error", message: "Spotify sign-in could not be verified. Try again." };
  }

  try {
    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: codeExchangeBody({
        clientId: spotifyClientId,
        code: code!,
        redirectUri: spotifyRedirectUri(),
        verifier: pending.verifier,
      }),
    });
    const tokens = res.ok ? readTokenResponse(await res.json(), Date.now()) : null;
    if (!tokens) return { kind: "error", message: "Spotify could not connect." };
    writeTokens(tokens);
    return { kind: "connected" };
  } catch {
    return { kind: "error", message: "Spotify could not connect. Check your connection." };
  }
}

let callback: Promise<CallbackResult> | null = null;

/**
 * Finish a sign-in redirect if this page load is one. Memoised: React's strict
 * mode runs effects twice, and an authorization code can be spent only once.
 */
export function completeSpotifyConnect(): Promise<CallbackResult> {
  if (!spotifyConfigured) return Promise.resolve({ kind: "none" });
  return (callback ??= runCallback());
}

// ── Web Playback SDK ─────────────────────────────────────────────────────────

let sdk: Promise<typeof Spotify> | null = null;

export function loadSpotifySdk(timeoutMs = 15_000): Promise<typeof Spotify> {
  if (window.Spotify) return Promise.resolve(window.Spotify);
  return (sdk ??= new Promise<typeof Spotify>((resolve, reject) => {
    const fail = (why: string) => {
      window.clearTimeout(timer);
      sdk = null;
      reject(new Error(why));
    };
    const timer = window.setTimeout(() => fail("sdk-timeout"), timeoutMs);
    window.onSpotifyWebPlaybackSDKReady = () => {
      window.clearTimeout(timer);
      if (window.Spotify) resolve(window.Spotify);
      else fail("sdk-missing");
    };
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => {
      script.remove();
      fail("sdk-blocked");
    };
    document.body.appendChild(script);
  }));
}

// ── Web API ──────────────────────────────────────────────────────────────────

async function api(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const token = await getSpotifyAccessToken();
  if (!token) throw new SpotifyError("signed-out");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 && !retried) {
    // Expired early (revoked, clock skew): force one refresh, then give up.
    const tokens = readTokens();
    if (tokens) writeTokens({ ...tokens, expiresAt: 0 });
    return api(path, init, true);
  }
  return res;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  image?: string;
}

export async function listSpotifyPlaylists(): Promise<SpotifyPlaylist[]> {
  const res = await api("/me/playlists?limit=50");
  if (!res.ok) throw new SpotifyError("list-failed");
  const body = (await res.json()) as { items?: unknown[] };
  const out: SpotifyPlaylist[] = [];
  for (const raw of body.items ?? []) {
    // Spotify can return null entries for playlists it no longer serves.
    if (!raw || typeof raw !== "object") continue;
    const p = raw as {
      id?: unknown;
      name?: unknown;
      uri?: unknown;
      images?: { url?: unknown }[] | null;
    };
    if (typeof p.id !== "string" || typeof p.name !== "string" || typeof p.uri !== "string")
      continue;
    const image = p.images?.[0]?.url;
    out.push({
      id: p.id,
      name: p.name,
      uri: p.uri,
      image: typeof image === "string" ? image : undefined,
    });
  }
  return out;
}

/** Start a playlist / album / artist, or a single track, on this tab's device. */
export async function playOnSpotify(deviceId: string, uri: string): Promise<void> {
  const body = uri.startsWith("spotify:track:") ? { uris: [uri] } : { context_uri: uri };
  const res = await api(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // The Web API documents this endpoint as Premium-only.
  if (res.status === 403) throw new SpotifyError("premium-required");
  if (res.status === 404) throw new SpotifyError("no-device");
  if (!res.ok) throw new SpotifyError("play-failed");
}
