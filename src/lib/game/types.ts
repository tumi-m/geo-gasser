import type { AtlasSpec } from "./atlas.ts";

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

export type CountryCode = "ZA" | "NL" | "WORLD";
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type GameMode = "solo" | "duel";

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
  attribution: string;
  sourceUrl?: string;
  verifiedAt: string;
  enabled: boolean;
  sceneUrl: string;
  sceneKind: "wikimedia" | "generated-reconstruction";
}

export interface RoundScore {
  distanceKm: number;
  accuracyPoints: number;
  timePoints: number;
  multiplier: number;
  roundScore: number;
  remainingSec: number;
  responseMs: number;
  badges: BadgeId[];
  feedback: FeedbackId;
  countryCorrect: boolean;
}

export type BadgeId =
  | "bullseye"
  | "sharpshooter"
  | "excellent"
  | "great_read"
  | "right_region"
  | "country_locked";

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
  roundScore?: RoundScore;
}

export interface RoundRecord {
  index: number;
  locationId: string;
  isRound4: boolean;
  envId?: string;
  truth: LatLng;
  guesses: Record<string, { guess: LatLng | null; score: RoundScore }>;
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
  timeDifficulty: "easy" | "medium" | "hard";
  matchLength: "standard" | "extended" | "full";
  atlas: AtlasSpec;
  roundStartedAtMs?: number;
  players: PlayerState[];
  /** Host-only until reveal. Stripped from public snapshots. */
  truth?: LatLng;
  revealed: boolean;
  roundHistory: RoundRecord[];
  winnerIds: string[];
  lastEventAt: number;
  duelKind?: "online" | "bot" | "hotseat";
  activeSeatId?: string;
}

export interface PublicSnapshot {
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
  timeDifficulty: "easy" | "medium" | "hard";
  matchLength: "standard" | "extended" | "full";
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
