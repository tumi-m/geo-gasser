// FILE: src/lib/music/use-spotify-session.ts
// Lifecycle of a connected Spotify account: finish the sign-in redirect, then —
// only once the player opens the music panel — load the Web Playback SDK and
// register this tab as a Spotify device. Nothing third-party loads until then.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  beginSpotifyConnect,
  completeSpotifyConnect,
  disconnectSpotify,
  getSpotifyAccessToken,
  hasSpotifySession,
  listSpotifyPlaylists,
  loadSpotifySdk,
  playOnSpotify,
  SpotifyError,
  spotifyConfigured,
  type SpotifyPlaylist,
} from "./spotify.ts";
import type { NowPlaying, SessionStatus } from "./types.ts";

export interface SpotifySession {
  status: SessionStatus;
  message: string | null;
  playlists: SpotifyPlaylist[];
  nowPlaying: NowPlaying | null;
  /** Set once, after the page comes back from Spotify's consent screen. */
  returned: "connected" | "error" | null;
  connect: () => void;
  disconnect: () => void;
  play: (uri: string) => void;
  toggle: () => void;
  next: () => void;
  pause: () => void;
}

function messageFor(err: unknown): string {
  const code = err instanceof SpotifyError ? err.code : null;
  switch (code) {
    case "premium-required":
      return "Spotify Premium is needed to play inside the game. Paste a link below to use Spotify’s own player instead.";
    case "signed-out":
      return "Your Spotify session ended. Connect again.";
    case "no-device":
      return "Spotify lost this browser as a player. Close and reopen Music to reconnect.";
    case "list-failed":
      return "Couldn’t load your playlists.";
    default:
      return "Spotify couldn’t play that. Try another.";
  }
}

function fromState(state: Spotify.PlaybackState): NowPlaying {
  const track = state.track_window.current_track;
  return {
    title: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    image: track.album.images[0]?.url,
    playing: !state.paused,
  };
}

export function useSpotifySession(wanted: boolean): SpotifySession {
  // Rendered on the server too, where no session exists: start from what the
  // server can know, then read the stored session after mount.
  const [status, setStatus] = useState<SessionStatus>(spotifyConfigured ? "signed-out" : "off");
  const [message, setMessage] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [returned, setReturned] = useState<SpotifySession["returned"]>(null);
  /** Bumped after a fresh sign-in so the player effect starts again. */
  const [epoch, setEpoch] = useState(0);
  const playerRef = useRef<Spotify.Player | null>(null);
  const deviceRef = useRef<string | null>(null);

  const signOut = useCallback((why: string | null) => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    deviceRef.current = null;
    disconnectSpotify();
    setStatus("signed-out");
    setMessage(why);
    setPlaylists([]);
    setNowPlaying(null);
  }, []);

  useEffect(() => {
    if (hasSpotifySession()) setStatus("starting");
  }, []);

  // Coming back from Spotify with ?code=… (or ?error=…).
  useEffect(() => {
    let live = true;
    void completeSpotifyConnect().then((result) => {
      if (!live || result.kind === "none") return;
      if (result.kind === "connected") {
        setStatus("starting");
        setMessage(null);
        setReturned("connected");
        setEpoch((e) => e + 1);
      } else {
        setStatus("signed-out");
        setMessage(result.message);
        setReturned("error");
      }
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!wanted || playerRef.current || !hasSpotifySession()) return;
    let cancelled = false;
    const fail = (why: string) => {
      setStatus("error");
      setMessage(why);
    };
    setStatus("starting");

    loadSpotifySdk()
      .then((sdk) => {
        if (cancelled || playerRef.current) return;
        const player = new sdk.Player({
          name: "Atlas Duel",
          volume: 0.6,
          getOAuthToken: (cb) => {
            void getSpotifyAccessToken().then((token) => {
              if (token) cb(token);
              else signOut("Your Spotify session ended. Connect again.");
            });
          },
        });
        player.addListener("ready", ({ device_id }) => {
          deviceRef.current = device_id;
          setStatus("ready");
          setMessage(null);
          listSpotifyPlaylists().then(setPlaylists, (err: unknown) => setMessage(messageFor(err)));
        });
        player.addListener("not_ready", () => {
          deviceRef.current = null;
          setStatus("starting");
        });
        player.addListener("player_state_changed", (state) => {
          setNowPlaying(state ? fromState(state) : null);
        });
        player.addListener("account_error", () =>
          fail(
            "Spotify Premium is needed to play inside the game. Paste a link below to use Spotify’s own player instead.",
          ),
        );
        player.addListener("authentication_error", () =>
          signOut("Your Spotify session ended. Connect again."),
        );
        player.addListener("initialization_error", () =>
          fail("This browser can’t run Spotify’s in-page player. Paste a link below instead."),
        );
        player.addListener("playback_error", () =>
          setMessage("Spotify couldn’t play that. Try another."),
        );
        player.addListener("autoplay_failed", () =>
          setMessage("Your browser held back autoplay. Press play."),
        );
        playerRef.current = player;
        void player.connect().then((ok) => {
          if (!ok) fail("Spotify’s player couldn’t start.");
        });
      })
      .catch(() => {
        if (!cancelled)
          fail(
            "Spotify’s player couldn’t load. A content blocker or the network may be stopping it.",
          );
      });

    return () => {
      cancelled = true;
    };
  }, [wanted, epoch, signOut]);

  const connect = useCallback(() => {
    setMessage(null);
    void beginSpotifyConnect();
  }, []);

  const disconnect = useCallback(() => signOut(null), [signOut]);

  const play = useCallback((uri: string) => {
    const player = playerRef.current;
    const device = deviceRef.current;
    if (!player || !device) {
      setMessage("Spotify is still connecting.");
      return;
    }
    // Called synchronously inside the click: mobile Safari only lets audio
    // start from a user gesture, and this is the SDK's hook for that.
    void player.activateElement().catch(() => undefined);
    playOnSpotify(device, uri).then(
      () => setMessage(null),
      (err: unknown) => setMessage(messageFor(err)),
    );
  }, []);

  const toggle = useCallback(() => void playerRef.current?.togglePlay(), []);
  const next = useCallback(() => void playerRef.current?.nextTrack(), []);
  const pause = useCallback(() => void playerRef.current?.pause().catch(() => undefined), []);

  // Stable identity until something changes, so the provider value is too.
  return useMemo(
    () => ({
      status,
      message,
      playlists,
      nowPlaying,
      returned,
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
      playlists,
      nowPlaying,
      returned,
      connect,
      disconnect,
      play,
      toggle,
      next,
      pause,
    ],
  );
}
