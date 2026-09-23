// Shared shapes and React contexts for the music player. Kept apart from the
// provider component so that file exports only a component (fast refresh).

import { createContext } from "react";
import type { MusicLink, MusicProvider } from "./links.ts";
import type { NowPlaying } from "./types.ts";
import type { AppleSession } from "./use-apple-music-session.ts";
import type { SpotifySession } from "./use-spotify-session.ts";

export interface MusicContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  tab: MusicProvider;
  setTab: (tab: MusicProvider) => void;
  /** Link currently in the embed player, if that is what is playing. */
  embed: MusicLink | null;
  /** Last link played, offered again after a reload. */
  recent: MusicLink | null;
  spotify: SpotifySession;
  apple: AppleSession;
  /** Track info from whichever connected account is the active source. */
  nowPlaying: (NowPlaying & { provider: MusicProvider }) | null;
  /** Something is playing (or loaded in the embed player). */
  active: boolean;
  playLink: (link: MusicLink) => void;
  playSpotify: (uri: string) => void;
  playApple: (queue: MusicKitWeb.QueueOptions) => void;
  stopEmbed: () => void;
  togglePlayback: () => void;
  nextTrack: () => void;
}

export const MusicContext = createContext<MusicContextValue | null>(null);
