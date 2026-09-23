// FILE: src/lib/music/apple-music.ts
// Apple Music account connection for the music player, through MusicKit on
// the Web (v3). MusicKit needs a developer token signed with the game's private
// MusicKit key, so that is minted server-side by the `/api/apple-music-token`
// route; this file only ever sees the signed token.

const MUSICKIT_URL = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
const TOKEN_ENDPOINT = "/api/apple-music-token";

let token: Promise<string | null> | null = null;

/**
 * The developer token, or null when this deployment has not configured Apple
 * Music. Only a JSON body with a token counts as an answer.
 */
export function fetchAppleDeveloperToken(): Promise<string | null> {
  return (token ??= (async () => {
    try {
      const res = await fetch(TOKEN_ENDPOINT, { headers: { Accept: "application/json" } });
      if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) return null;
      const body = (await res.json()) as { token?: unknown };
      return typeof body.token === "string" ? body.token : null;
    } catch {
      return null;
    }
  })().then((t) => {
    // Do not remember a failure: the next open of the player asks again.
    if (!t) token = null;
    return t;
  }));
}

let kit: Promise<MusicKitWeb.Global> | null = null;

export function loadMusicKit(timeoutMs = 15_000): Promise<MusicKitWeb.Global> {
  if (window.MusicKit) return Promise.resolve(window.MusicKit);
  return (kit ??= new Promise<MusicKitWeb.Global>((resolve, reject) => {
    const fail = (why: string) => {
      window.clearTimeout(timer);
      kit = null;
      reject(new Error(why));
    };
    const timer = window.setTimeout(() => fail("musickit-timeout"), timeoutMs);
    document.addEventListener(
      "musickitloaded",
      () => {
        window.clearTimeout(timer);
        if (window.MusicKit) resolve(window.MusicKit);
        else fail("musickit-missing");
      },
      { once: true },
    );
    const script = document.createElement("script");
    script.src = MUSICKIT_URL;
    script.async = true;
    script.onerror = () => {
      script.remove();
      fail("musickit-blocked");
    };
    document.head.appendChild(script);
  }));
}

let instance: Promise<MusicKitWeb.Instance | null> | null = null;

/**
 * A configured MusicKit instance, or null when Apple Music is not set up on
 * this deployment. Prepared ahead of the click: `authorize()` opens Apple's sign-in
 * window, and browsers only allow that directly inside the user's gesture.
 */
export function prepareAppleMusic(): Promise<MusicKitWeb.Instance | null> {
  return (instance ??= (async () => {
    const developerToken = await fetchAppleDeveloperToken();
    if (!developerToken) return null;
    const musicKit = await loadMusicKit();
    return musicKit.configure({ developerToken, app: { name: "Atlas Duel", build: "1.0.0" } });
  })().then(
    (inst) => {
      if (!inst) instance = null;
      return inst;
    },
    (err: unknown) => {
      instance = null;
      throw err;
    },
  ));
}

export interface ApplePlaylist {
  id: string;
  name: string;
  image?: string;
}

/** The signed-in listener's library playlists. */
export async function listAppleLibraryPlaylists(
  music: MusicKitWeb.Instance,
): Promise<ApplePlaylist[]> {
  const { data } = await music.api.music("/v1/me/library/playlists");
  const rows = (data as { data?: unknown[] } | null)?.data ?? [];
  const out: ApplePlaylist[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as {
      id?: unknown;
      attributes?: { name?: unknown; artwork?: { url?: unknown } };
    };
    const name = row.attributes?.name;
    if (typeof row.id !== "string" || typeof name !== "string") continue;
    // Apple artwork URLs are templates: {w}x{h} is filled in by the caller.
    const art = row.attributes?.artwork?.url;
    out.push({
      id: row.id,
      name,
      image: typeof art === "string" ? art.replace("{w}", "96").replace("{h}", "96") : undefined,
    });
  }
  return out;
}
