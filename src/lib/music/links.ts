// FILE: src/lib/music/links.ts
// Turns a pasted Spotify / Apple Music share link into something the sound
// player can play. This is the only place player input reaches an <iframe src>,
// so it never passes the input through: every embed URL is rebuilt here from
// parts that have been checked against a fixed host and a strict id pattern.

export type MusicProvider = "spotify" | "apple";
export type MusicKind = "playlist" | "album" | "track" | "artist";

export interface MusicLink {
  provider: MusicProvider;
  kind: MusicKind;
  /** Provider id: Spotify base62 id, or Apple catalog id (`pl.…` for playlists). */
  id: string;
  /** Official embed player URL, rebuilt from validated parts. */
  embedUrl: string;
  /** The provider's own page for this item. */
  openUrl: string;
  /** Spotify URI (`spotify:playlist:…`) for Web API playback. */
  uri?: string;
  /** Apple storefront (two-letter country code from the link). */
  storefront?: string;
}

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_KINDS: Record<string, MusicKind> = {
  playlist: "playlist",
  album: "album",
  track: "track",
  artist: "artist",
};

const APPLE_NUMERIC_ID = /^\d{1,15}$/;
const APPLE_PLAYLIST_ID = /^pl\.[A-Za-z0-9-]{8,64}$/;
const STOREFRONT = /^[a-z]{2}$/;
const APPLE_KINDS: Record<string, MusicKind> = {
  playlist: "playlist",
  album: "album",
  song: "track",
  artist: "artist",
};

function spotifyLink(kind: MusicKind, id: string): MusicLink {
  return {
    provider: "spotify",
    kind,
    id,
    embedUrl: `https://open.spotify.com/embed/${kind}/${id}`,
    openUrl: `https://open.spotify.com/${kind}/${id}`,
    uri: `spotify:${kind}:${id}`,
  };
}

function parseSpotify(input: string): MusicLink | null {
  // spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
  const uri = /^spotify:(playlist|album|track|artist):([A-Za-z0-9]+)$/.exec(input);
  if (uri) {
    return SPOTIFY_ID.test(uri[2]) ? spotifyLink(SPOTIFY_KINDS[uri[1]], uri[2]) : null;
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") return null;

  // Share links may carry a locale segment (/intl-de/) or come from an embed.
  const parts = url.pathname.split("/").filter(Boolean);
  while (parts.length && (parts[0].startsWith("intl-") || parts[0] === "embed")) parts.shift();
  const [type, id] = parts;
  const kind = SPOTIFY_KINDS[type ?? ""];
  if (!kind || !id || !SPOTIFY_ID.test(id)) return null;
  return spotifyLink(kind, id);
}

function parseApple(input: string): MusicLink | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  const host = url.hostname;
  if (
    url.protocol !== "https:" ||
    (host !== "music.apple.com" && host !== "embed.music.apple.com")
  ) {
    return null;
  }

  // /{storefront}/{type}/{optional slug}/{id}
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 3 && parts.length !== 4) return null;
  const [storefront, type] = parts;
  const kind = APPLE_KINDS[type];
  if (!STOREFRONT.test(storefront) || !kind) return null;
  const rawId = parts[parts.length - 1];
  const slug = parts.length === 4 ? parts[2] : undefined;

  const idOk = kind === "playlist" ? APPLE_PLAYLIST_ID.test(rawId) : APPLE_NUMERIC_ID.test(rawId);
  if (!idOk) return null;
  // Slugs are decorative, but they end up in a URL we build, so keep them tame.
  const safeSlug = slug && /^[\p{L}\p{N}%._-]{1,120}$/u.test(slug) ? slug : undefined;
  const path = `/${storefront}/${type}/${safeSlug ? `${safeSlug}/` : ""}${rawId}`;

  // An album link with ?i= points at one song on that album.
  const songParam = url.searchParams.get("i");
  if (kind === "album" && songParam !== null) {
    if (!APPLE_NUMERIC_ID.test(songParam)) return null;
    return {
      provider: "apple",
      kind: "track",
      id: songParam,
      embedUrl: `https://embed.music.apple.com${path}?i=${songParam}`,
      openUrl: `https://music.apple.com${path}?i=${songParam}`,
      storefront,
    };
  }

  return {
    provider: "apple",
    kind,
    id: rawId,
    embedUrl: `https://embed.music.apple.com${path}`,
    openUrl: `https://music.apple.com${path}`,
    storefront,
  };
}

/** Parse a share link or Spotify URI. Returns null for anything else. */
export function parseMusicLink(raw: string): MusicLink | null {
  const input = raw.trim();
  if (!input || input.length > 2048) return null;
  return parseSpotify(input) ?? parseApple(input);
}

/** Embed player height, per the provider's own generator sizes. */
export function embedHeight(link: MusicLink): number {
  if (link.provider === "spotify") return 152;
  return link.kind === "track" ? 175 : 450;
}

/** What MusicKit's setQueue needs to play this link; null for artists. */
export function appleQueueFor(
  link: MusicLink,
): { playlist: string } | { album: string } | { song: string } | null {
  if (link.provider !== "apple") return null;
  if (link.kind === "playlist") return { playlist: link.id };
  if (link.kind === "album") return { album: link.id };
  if (link.kind === "track") return { song: link.id };
  return null;
}
