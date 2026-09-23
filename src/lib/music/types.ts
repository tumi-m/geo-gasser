// FILE: src/lib/music/types.ts
// Shapes shared by the two account sessions and the music player.

/**
 * off        — this deployment has not configured the provider; hide it entirely.
 * signed-out — configured, nobody connected yet.
 * starting   — connected (or checking); the player is getting ready.
 * ready      — connected and able to play here.
 * error      — connected but unusable; `message` says why.
 */
export type SessionStatus = "off" | "signed-out" | "starting" | "ready" | "error";

export interface NowPlaying {
  title: string;
  artist: string;
  image?: string;
  playing: boolean;
}

export interface PlaylistRow {
  id: string;
  name: string;
  image?: string;
}
