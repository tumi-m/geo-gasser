// FILE: src/lib/music/use-apple-music-session.ts
// Lifecycle of a connected Apple Music account through MusicKit. Like Spotify,
// nothing loads until the player opens the music panel; unlike Spotify the
// instance is prepared before the Connect click, because `authorize()` opens
// Apple's sign-in window and browsers only allow that inside the gesture.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listAppleLibraryPlaylists, prepareAppleMusic, type ApplePlaylist } from "./apple-music.ts";
import type { NowPlaying, SessionStatus } from "./types.ts";

export interface AppleSession {
  status: SessionStatus;
  message: string | null;
  /** The account can't stream full tracks (no Apple Music subscription). */
  previewOnly: boolean;
  playlists: ApplePlaylist[];
  nowPlaying: NowPlaying | null;
  connect: () => void;
  disconnect: () => void;
  play: (queue: MusicKitWeb.QueueOptions) => void;
  toggle: () => void;
  next: () => void;
  pause: () => void;
}

/**
 * `playbackStateDidChange` fires on every transition, including between
 * tracks, in both MusicKit typings checked. The item-change event is named
 * differently across MusicKit versions, so both names are listened for; a name
 * the SDK does not know is simply never fired.
 */
const EVENTS = ["playbackStateDidChange", "nowPlayingItemDidChange", "mediaItemDidChange"] as const;

export function useAppleMusicSession(wanted: boolean): AppleSession {
  const [status, setStatus] = useState<SessionStatus>("starting");
  const [message, setMessage] = useState<string | null>(null);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [playlists, setPlaylists] = useState<ApplePlaylist[]>([]);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const musicRef = useRef<MusicKitWeb.Instance | null>(null);

  const sync = useCallback(() => {
    const music = musicRef.current;
    const item = music?.nowPlayingItem;
    setNowPlaying(
      music && item
        ? {
            title: item.title,
            artist: item.artistName,
            image: item.artworkURL?.replace("{w}", "96").replace("{h}", "96"),
            playing: music.isPlaying,
          }
        : null,
    );
  }, []);

  const loadLibrary = useCallback(async (music: MusicKitWeb.Instance) => {
    setPreviewOnly(music.previewOnly);
    try {
      setPlaylists(await listAppleLibraryPlaylists(music));
    } catch {
      setMessage("Couldn’t load your Apple Music library.");
    }
  }, []);

  useEffect(() => {
    if (!wanted || musicRef.current) return;
    let cancelled = false;
    prepareAppleMusic().then(
      (music) => {
        if (cancelled) return;
        if (!music) {
          setStatus("off");
          return;
        }
        musicRef.current = music;
        for (const name of EVENTS) music.addEventListener(name, sync);
        if (music.isAuthorized) {
          setStatus("ready");
          void loadLibrary(music);
        } else {
          setStatus("signed-out");
        }
        sync();
      },
      () => {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          "Apple Music couldn’t load. A content blocker or the network may be stopping it.",
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [wanted, sync, loadLibrary]);

  const connect = useCallback(() => {
    const music = musicRef.current;
    if (!music) return;
    setMessage(null);
    music.authorize().then(
      () => {
        // Closing Apple's window resolves without authorising.
        if (!music.isAuthorized) return;
        setStatus("ready");
        void loadLibrary(music);
      },
      () => setMessage("Apple Music sign-in was cancelled."),
    );
  }, [loadLibrary]);

  const disconnect = useCallback(() => {
    const music = musicRef.current;
    if (!music) return;
    if (music.isPlaying) music.pause();
    void music.unauthorize().finally(() => {
      setStatus("signed-out");
      setPlaylists([]);
      setNowPlaying(null);
      setPreviewOnly(false);
    });
  }, []);

  const play = useCallback(
    (queue: MusicKitWeb.QueueOptions) => {
      const music = musicRef.current;
      if (!music) return;
      setMessage(null);
      music
        .setQueue(queue)
        .then(() => music.play())
        .then(sync, () => setMessage("Apple Music couldn’t play that. Try another."));
    },
    [sync],
  );

  const toggle = useCallback(() => {
    const music = musicRef.current;
    if (!music) return;
    if (music.isPlaying) music.pause();
    else void music.play();
  }, []);

  const next = useCallback(() => void musicRef.current?.skipToNextItem(), []);

  const pause = useCallback(() => {
    if (musicRef.current?.isPlaying) musicRef.current.pause();
  }, []);

  return useMemo(
    () => ({
      status,
      message,
      previewOnly,
      playlists,
      nowPlaying,
      connect,
      disconnect,
      play,
      toggle,
      next,
      pause,
    }),
    [
      status,
      message,
      previewOnly,
      playlists,
      nowPlaying,
      connect,
      disconnect,
      play,
      toggle,
      next,
      pause,
    ],
  );
}
