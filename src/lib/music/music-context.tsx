// Global music state, so a player's own soundtrack keeps going from the home
// screen into a match, between rounds, and into the next match. It sits in the
// root route, which never unmounts, and the player UI is mounted beside the
// route outlet rather than inside a screen.
//
// Three ways to play, one at a time:
//   • a connected Spotify account (Web Playback SDK; Premium),
//   • a connected Apple Music account (MusicKit),
//   • a pasted link in the provider's official embed player (no account needed).

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { appleQueueFor, parseMusicLink, type MusicLink, type MusicProvider } from "./links.ts";
import { MusicContext, type MusicContextValue } from "./context.ts";
import { useAppleMusicSession } from "./use-apple-music-session.ts";
import { useSpotifySession } from "./use-spotify-session.ts";

type Active = MusicProvider | "embed" | null;

const STORAGE_KEY = "atlas-duel-music-v1";

function loadPrefs(): { tab: MusicProvider; recent: MusicLink | null } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      tab?: unknown;
      recent?: unknown;
    };
    // Re-validate rather than trust stored data: it becomes an iframe src.
    return {
      tab: raw.tab === "apple" ? "apple" : "spotify",
      recent: typeof raw.recent === "string" ? parseMusicLink(raw.recent) : null,
    };
  } catch {
    return { tab: "spotify", recent: null };
  }
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [tab, setTab] = useState<MusicProvider>("spotify");
  const [embed, setEmbed] = useState<MusicLink | null>(null);
  const [recent, setRecent] = useState<MusicLink | null>(null);
  const [active, setActive] = useState<Active>(null);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const spotify = useSpotifySession(everOpened);
  const apple = useAppleMusicSession(everOpened);

  // Stored preferences are read after mount: the server renders with none, and
  // the first client render has to match it.
  useEffect(() => {
    const prefs = loadPrefs();
    setTab(prefs.tab);
    setRecent(prefs.recent);
    setPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tab, recent: recent?.openUrl ?? null }));
    } catch {
      /* private mode */
    }
  }, [prefsLoaded, tab, recent]);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (next) setEverOpened(true);
  }, []);

  // Back from Spotify's consent screen: reopen where the player left off.
  useEffect(() => {
    if (!spotify.returned) return;
    setTab("spotify");
    setOpen(true);
  }, [spotify.returned, setOpen]);

  const { pause: pauseSpotify, play: spotifyPlay } = spotify;
  const { pause: pauseApple, play: applePlay } = apple;

  const playSpotify = useCallback(
    (uri: string) => {
      setEmbed(null);
      pauseApple();
      setActive("spotify");
      spotifyPlay(uri);
    },
    [pauseApple, spotifyPlay],
  );

  const playApple = useCallback(
    (queue: MusicKitWeb.QueueOptions) => {
      setEmbed(null);
      pauseSpotify();
      setActive("apple");
      applePlay(queue);
    },
    [pauseSpotify, applePlay],
  );

  const playLink = useCallback(
    (link: MusicLink) => {
      setRecent(link);
      // A connected account plays the link itself — full tracks, real controls.
      if (link.provider === "spotify" && spotify.status === "ready" && link.uri) {
        playSpotify(link.uri);
        return;
      }
      const queue = appleQueueFor(link);
      if (link.provider === "apple" && apple.status === "ready" && queue) {
        playApple(queue);
        return;
      }
      pauseSpotify();
      pauseApple();
      setActive("embed");
      setEmbed(link);
    },
    [spotify.status, apple.status, playSpotify, playApple, pauseSpotify, pauseApple],
  );

  const stopEmbed = useCallback(() => {
    setEmbed(null);
    setActive((a) => (a === "embed" ? null : a));
  }, []);

  const nowPlaying = useMemo<MusicContextValue["nowPlaying"]>(() => {
    if (active === "spotify" && spotify.nowPlaying)
      return { ...spotify.nowPlaying, provider: "spotify" };
    if (active === "apple" && apple.nowPlaying) return { ...apple.nowPlaying, provider: "apple" };
    return null;
  }, [active, spotify.nowPlaying, apple.nowPlaying]);

  const { toggle: toggleSpotify, next: nextSpotify } = spotify;
  const { toggle: toggleApple, next: nextApple } = apple;
  const togglePlayback = useCallback(() => {
    if (active === "spotify") toggleSpotify();
    else if (active === "apple") toggleApple();
  }, [active, toggleSpotify, toggleApple]);
  const nextTrack = useCallback(() => {
    if (active === "spotify") nextSpotify();
    else if (active === "apple") nextApple();
  }, [active, nextSpotify, nextApple]);

  const isActive = nowPlaying ? nowPlaying.playing : Boolean(embed);

  const value = useMemo<MusicContextValue>(
    () => ({
      open,
      setOpen,
      tab,
      setTab,
      embed,
      recent,
      spotify,
      apple,
      nowPlaying,
      active: isActive,
      playLink,
      playSpotify,
      playApple,
      stopEmbed,
      togglePlayback,
      nextTrack,
    }),
    [
      open,
      setOpen,
      tab,
      embed,
      recent,
      spotify,
      apple,
      nowPlaying,
      isActive,
      playLink,
      playSpotify,
      playApple,
      stopEmbed,
      togglePlayback,
      nextTrack,
    ],
  );

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}
