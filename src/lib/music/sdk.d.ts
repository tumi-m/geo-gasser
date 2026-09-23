// FILE: src/lib/music/sdk.d.ts
// The slice of the two vendor SDKs the music player uses, typed from their
// published definitions (DefinitelyTyped for the Spotify Web Playback SDK;
// MusicKit on the Web v3, cross-checked against two independent typings).
// Declared here rather than pulled in as packages: the surface is small and
// the SDKs themselves load from the vendors' CDNs at runtime.

declare namespace Spotify {
  interface Entity {
    name: string;
    uri: string;
  }
  interface Track {
    name: string;
    uri: string;
    artists: Entity[];
    album: { name: string; images: { url: string }[] };
  }
  interface PlaybackState {
    paused: boolean;
    track_window: { current_track: Track };
  }
  interface PlayerInit {
    name: string;
    getOAuthToken(cb: (token: string) => void): void;
    volume?: number;
  }
  type ErrorTypes =
    "account_error" | "authentication_error" | "initialization_error" | "playback_error";
  class Player {
    constructor(options: PlayerInit);
    connect(): Promise<boolean>;
    disconnect(): void;
    togglePlay(): Promise<void>;
    pause(): Promise<void>;
    nextTrack(): Promise<void>;
    /** Must run inside a user gesture before playback on mobile / Safari. */
    activateElement(): Promise<void>;
    addListener(event: "ready" | "not_ready", cb: (inst: { device_id: string }) => void): boolean;
    addListener(event: "player_state_changed", cb: (state: PlaybackState | null) => void): boolean;
    addListener(event: "autoplay_failed", cb: () => void): boolean;
    addListener(event: ErrorTypes, cb: (err: { message: string }) => void): boolean;
  }
}

declare namespace MusicKitWeb {
  interface MediaItem {
    id: string;
    title: string;
    artistName: string;
    artworkURL?: string;
  }
  interface QueueOptions {
    album?: string;
    playlist?: string;
    song?: string;
    startPlaying?: boolean;
  }
  interface Instance {
    readonly isAuthorized: boolean;
    readonly isPlaying: boolean;
    /** True when the account cannot stream full tracks (no subscription). */
    readonly previewOnly: boolean;
    readonly nowPlayingItem: MediaItem | undefined;
    readonly api: {
      music(path: string, query?: Record<string, unknown>): Promise<{ data: unknown }>;
    };
    authorize(): Promise<string | void>;
    unauthorize(): Promise<void>;
    setQueue(options: QueueOptions): Promise<unknown>;
    play(): Promise<void> | void;
    pause(): void;
    skipToNextItem(): Promise<void>;
    addEventListener(name: string, cb: () => void): void;
    removeEventListener(name: string, cb: () => void): void;
  }
  interface Global {
    configure(config: {
      developerToken: string;
      app: { name: string; build?: string };
    }): Promise<Instance>;
    getInstance(): Instance;
  }
}

interface Window {
  onSpotifyWebPlaybackSDKReady?: () => void;
  Spotify?: typeof Spotify;
  MusicKit?: MusicKitWeb.Global;
}
