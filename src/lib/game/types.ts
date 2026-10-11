import type { AtlasSpec } from "./atlas.ts";
import type { CosmosLook } from "./cosmos.ts";
import type { MatchLengthId, TimeDifficulty } from "./timer.ts";

export type AtmosphereId =
  | "cape-dusk"
  | "amsterdam-neon"
  | "rotterdam-harbor"
  | "highveld-storm"
  | "veld-dawn"
  | "karoo-night"
  | "canal-fog"
  | "dune-gold"
  | "delta-steel"
  | "island-light"
  | "fynbos-wind";

/** "SPACE" marks a cosmos-round target (see cosmos.ts), never a place on Earth. */
export type CountryCode = "ZA" | "NL" | "WORLD" | "SPACE";
/** The countries a map pin can land in. */
export type EarthCountry = Exclude<CountryCode, "SPACE">;
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type GameMode = "solo" | "duel";

/**
 * How much a player may move in the scene. "moving": look around, zoom, step
 * between viewpoints and walk Street View. "no-move": look and zoom only.
 * "nmpz": no move, no pan, no zoom: one fixed view.
 */
export type MovementRule = "moving" | "no-move" | "nmpz";

/** How a duel is won: the higher total, or the last one with health left. */
export type DuelRule = "points" | "health";

export type MatchPhase =
  | "lobby"
  | "waiting_for_players"
  | "match_starting"
  | "round_intro"
  | "round_active"
  | "player_locked"
  | "waiting_for_opponent"
  | "round_expired"
  | "round_reveal"
  | "round_results"
  | "next_round"
  | "final_reveal"
  | "match_complete"
  | "rematch_pending";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface GeoLocation {
  id: string;
  country: CountryCode;
  /** ISO 3166-1 alpha-2 for WORLD sites (e.g. JP, US). */
  nation?: string;
  title: string;
  city?: string;
  region?: string;
  latitude: number;
  longitude: number;
  difficulty: Difficulty;
  tags: string[];
  panoramaProvider?: string;
  panoramaId?: string;
  heading?: number;
  pitch?: number;
  fov?: number;
  /** Equirectangular 360 plate. When set, the scene opens in the panorama viewer. */
  panoUrl?: string;
  /** Explicit 360 flag for provider-backed panos resolved at runtime. */
  isPano?: boolean;
  /** More viewpoints of the same place, to step between during a round. */
  views?: string[];
  attribution: string;
  sourceUrl?: string;
  verifiedAt: string;
  enabled: boolean;
  sceneUrl: string;
  /** "street": no photo, played in Google Street View only (street-locations.ts). */
  sceneKind: "wikimedia" | "generated-reconstruction" | "cosmos" | "street";
}

export interface RoundScore {
  distanceKm: number;
  /** The distance score, GeoGuessr's 0–5,000, before the clock's share. */
  accuracyPoints: number;
  /** Points the clock took: the distance score minus the round score. */
  timePoints: number;
  /** The clock tier's multiplier (1, 0.9, 0.8, 0.7 or 0.6). */
  clockFactor?: number;
  multiplier: number;
  roundScore: number;
  remainingSec: number;
  responseMs: number;
  badges: BadgeId[];
  feedback: FeedbackId;
  countryCorrect: boolean;
  /**
   * Cosmos rounds: the miss in decades of distance from the Sun. `distanceKm`
   * then holds the real gap in km (can be astronomically large).
   */
  decades?: number;
}

export type BadgeId =
  | "bullseye"
  | "sharpshooter"
  | "excellent"
  | "great_read"
  | "right_region"
  | "country_locked"
  | "right_zone";

export type FeedbackId =
  | "perfect"
  | "incredible"
  | "good"
  | "instincts"
  | "close"
  | "country"
  | "tough";

export interface PlayerState {
  id: string;
  name: string;
  avatarId: string;
  kind: "human" | "bot";
  connected: boolean;
  totalScore: number;
  totalDistanceKm: number;
  totalResponseMs: number;
  locked: boolean;
  guess?: LatLng;
  lockedAtMs?: number;
  /** Captured per seat, so a hotseat handoff cannot change the first score. */
  responseMs?: number;
  roundScore?: RoundScore;
  /** Health duels: what is left of the starting health (rules.ts). */
  health?: number;
}

export interface RoundRecord {
  index: number;
  locationId: string;
  isRound4: boolean;
  /** A cosmos-round question: truth and guesses are log10 AU, not lat/lon. */
  cosmos?: boolean;
  envId?: string;
  truth: LatLng;
  guesses: Record<string, { guess: LatLng | null; score: RoundScore }>;
  /** Health duels: who lost health on this place, how much, at what multiplier. */
  damage?: { playerId: string; amount: number; multiplier: number };
  /**
   * Country Streak: whether the pin landed in the right country, and the
   * country it did land in (a name to show; absent at sea or without a pin).
   */
  streak?: { correct: boolean; guessed?: string };
}

/**
 * Guest-safe descriptor for the question on screen. Carries only what the
 * renderer needs (plate URL and provider flags) — never an id, title, credit,
 * source URL or coordinate that could decode the answer.
 */
export interface SceneInfo {
  /** "street": Street View only; `src` is `street:<id>`, like a photo's neutral path. */
  kind: "photo" | "generated" | "cosmos" | "street";
  src: string;
  fallbacks: string[];
  /** Cosmos rounds: how to draw the target, and one observation. No name. */
  cosmos?: CosmosLook;
  clue?: string;
  provider?: string;
  heading?: number;
  pitch?: number;
  /** True for equirectangular 360 plates; the client opens the pano viewer. */
  isPano?: boolean;
  /** Mapillary image id when the plate is resolved through the Mapillary API. */
  imageId?: string;
  /** Extra viewpoints (neutral /locations/views/… paths). */
  views?: string[];
}

export interface MatchState {
  seq: number;
  phase: MatchPhase;
  mode: GameMode;
  roomCode?: string;
  hostId: string;
  seed: number;
  roundIndex: number;
  questionIndex: number;
  locationIds: string[];
  envId: string;
  envIds: string[];
  durationSec: number;
  photoQuestions: number;
  totalQuestions: number;
  totalRounds: number;
  timeDifficulty: TimeDifficulty;
  matchLength: MatchLengthId;
  atlas: AtlasSpec;
  /** The deck may include Street View-only places (the host has a key). */
  streetView?: boolean;
  roundStartedAtMs?: number;
  /** Solo: when the player paused the round. The clock stands still until RESUME. */
  pausedAtMs?: number;
  players: PlayerState[];
  /** Host-only until reveal. Stripped from public snapshots. */
  truth?: LatLng;
  /** Guest-side scene descriptor for the current question (never coordinates). */
  scene?: SceneInfo;
  revealed: boolean;
  roundHistory: RoundRecord[];
  winnerIds: string[];
  lastEventAt: number;
  duelKind?: "online" | "bot" | "hotseat";
  activeSeatId?: string;
  /** Movement rule for every scene in the match; absent means "moving". */
  movement?: MovementRule;
  /** Duels only; absent means "points" (highest total wins). */
  duelRule?: DuelRule;
  /** Country Streak: a solo run that ends on the first wrong country. */
  streak?: boolean;
}

export interface PublicSnapshot {
  seq: number;
  phase: MatchPhase;
  mode: GameMode;
  roomCode?: string;
  hostId: string;
  /** Hidden (undefined) until reveal — the deck is seed-derived. */
  seed?: number;
  roundIndex: number;
  questionIndex: number;
  /** Empty until reveal: location ids decode to coordinates in the bundle. */
  locationIds: string[];
  envId: string;
  /** Empty until reveal: environment specs embed truth location ids. */
  envIds: string[];
  scene?: SceneInfo;
  durationSec: number;
  photoQuestions: number;
  totalQuestions: number;
  totalRounds: number;
  timeDifficulty: TimeDifficulty;
  matchLength: MatchLengthId;
  atlas: AtlasSpec;
  roundStartedAtMs?: number;
  players: Array<
    Omit<PlayerState, "guess" | "roundScore"> & {
      guess?: LatLng;
      roundScore?: RoundScore;
    }
  >;
  truth?: LatLng;
  revealed: boolean;
  roundHistory: RoundRecord[];
  winnerIds: string[];
  movement?: MovementRule;
  duelRule?: DuelRule;
  streak?: boolean;
}

export interface SceneDescriptor {
  kind: "photo" | "generated";
  src: string;
  attribution: string;
}

export interface EnvironmentSpec {
  id: string;
  title: string;
  country: CountryCode;
  truthLocationId: string;
  backdropUrl: string;
  atmosphere: AtmosphereId;
  disclosure: string;
}

export interface GeneratedEnvironment extends EnvironmentSpec {
  provenance: {
    provider: "higgsfield" | "fallback-procedural";
    generatedAt: string;
    notes: string;
  };
}

export interface StreetImageryProvider {
  getScene(location: GeoLocation): Promise<SceneDescriptor>;
}

export interface GeneratedEnvironmentProvider {
  generate(spec: EnvironmentSpec): Promise<GeneratedEnvironment>;
}
