import {
  DEFAULT_ATLAS,
  filterByAtlas,
  sanitizeAtlas,
  type AtlasSpec,
} from "./atlas.ts";
import { environmentForLocation, ROUND4_ENVIRONMENTS } from "./environments.ts";
import { enabledLocations, ROUND4_LOCATIONS } from "./locations.ts";
import { mulberry32, shuffle } from "./rng.ts";
import { MATCH_LENGTH, type MatchLengthId } from "./timer.ts";
import type { CountryCode, GeoLocation } from "./types.ts";

export const QUESTIONS_PER_ROUND = 10;
export const TOTAL_ROUNDS = 4;
export const PHOTO_ROUNDS = 3;
export const PHOTO_QUESTIONS = PHOTO_ROUNDS * QUESTIONS_PER_ROUND;
export const ROUND4_QUESTIONS = 10;
export const TOTAL_QUESTIONS = PHOTO_QUESTIONS + ROUND4_QUESTIONS;
/** @deprecated use PHOTO_ROUNDS — kept so older imports keep compiling */
export const REAL_ROUNDS = PHOTO_ROUNDS;

/**
 * OpenCode / GPT-6 Astra own the 3D round.
 * Keep `round4-scene.tsx`, `environments.ts`, `ROUND4_LOCATIONS`, and
 * `/generated/round4-*.jpg`. Flip this when their renderer is ready to mount.
 * Do not delete those files.
 */
export const ROUND4_3D_LIVE = false;

/** Photo-round country mix for the SA × NL atlas. Round 4 appends reconstructions. */
export const MATCH_QUOTA: Record<MatchLengthId, Record<CountryCode, number>> = {
  standard: { ZA: 15, NL: 15, WORLD: 0 },
  extended: { ZA: 25, NL: 25, WORLD: 10 },
  full: { ZA: 35, NL: 35, WORLD: 20 },
};

export const MIX_QUOTA: Record<MatchLengthId, Record<CountryCode, number>> = {
  standard: { ZA: 10, NL: 10, WORLD: 10 },
  extended: { ZA: 20, NL: 20, WORLD: 20 },
  full: { ZA: 30, NL: 30, WORLD: 30 },
};

export interface MatchPlan {
  seed: number;
  locationIds: string[];
  envIds: string[];
  matchLength: MatchLengthId;
  atlas: AtlasSpec;
  photoRounds: number;
  photoQuestions: number;
  totalRounds: number;
  totalQuestions: number;
}

export function roundOf(questionIndex: number): number {
  return Math.floor(questionIndex / QUESTIONS_PER_ROUND);
}

export function questionInRound(questionIndex: number): number {
  return questionIndex % QUESTIONS_PER_ROUND;
}

export function isRound4Question(questionIndex: number, photoQuestions = PHOTO_QUESTIONS): boolean {
  return questionIndex >= photoQuestions;
}

function take(list: GeoLocation[], n: number): GeoLocation[] {
  return list.splice(0, Math.max(0, Math.min(n, list.length)));
}

function dealQuota(
  pool: GeoLocation[],
  quota: Record<CountryCode, number>,
  rand: () => number,
  want: number,
): GeoLocation[] {
  const za = shuffle(
    pool.filter((l) => l.country === "ZA"),
    rand,
  );
  const nl = shuffle(
    pool.filter((l) => l.country === "NL"),
    rand,
  );
  const world = shuffle(
    pool.filter((l) => l.country === "WORLD"),
    rand,
  );
  const picked: GeoLocation[] = [...take(za, quota.ZA), ...take(nl, quota.NL), ...take(world, quota.WORLD)];
  const used = new Set(picked.map((l) => l.id));
  const rest = shuffle(
    pool.filter((l) => !used.has(l.id)),
    rand,
  );
  while (picked.length < want && rest.length) picked.push(rest.shift()!);
  return shuffle(picked, rand).slice(0, want);
}

/**
 * Deal a match from the selected atlas.
 * SA × NL keeps a balanced 15/15 + 10 reconstructions.
 * Other atlases filter the 149-site pool and shrink the match if the map is smaller.
 */
export function planMatch(
  seed: number,
  matchLength: MatchLengthId = "standard",
  atlas: AtlasSpec = DEFAULT_ATLAS,
): MatchPlan {
  const spec = sanitizeAtlas(atlas);
  const cfg = MATCH_LENGTH[matchLength];
  const rand = mulberry32(seed);
  const reserved = new Set(ROUND4_LOCATIONS.map((l) => l.id));
  const photoPool = filterByAtlas(
    enabledLocations().filter((l) => !reserved.has(l.id)),
    spec,
  );
  const r4Pool = filterByAtlas(ROUND4_LOCATIONS, spec);
  const available = photoPool.length + r4Pool.length;
  const target = Math.max(1, Math.min(cfg.totalQuestions, available || 1));

  let photos: GeoLocation[];
  if (spec.preset === "sa-nl") {
    photos = dealQuota(photoPool, MATCH_QUOTA[matchLength], rand, Math.min(cfg.photoQuestions, photoPool.length));
  } else if (spec.preset === "mix") {
    photos = dealQuota(photoPool, MIX_QUOTA[matchLength], rand, Math.min(cfg.photoQuestions, photoPool.length));
  } else {
    photos = shuffle([...photoPool], rand);
  }

  const r4Take = Math.min(r4Pool.length, Math.max(0, target - Math.min(photos.length, cfg.photoQuestions)));
  const photoTake = Math.min(photos.length, target - r4Take);
  const photoIds = (photos.length === photoTake ? photos : photos.slice(0, photoTake)).map((l) => l.id);
  const reconstructions = shuffle([...r4Pool], rand).slice(0, r4Take);
  const locationIds = [...photoIds, ...reconstructions.map((l) => l.id)];
  const envIds = reconstructions.map(
    (l, i) => environmentForLocation(l.id)?.id ?? ROUND4_ENVIRONMENTS[i % ROUND4_ENVIRONMENTS.length].id,
  );

  const totalQuestions = locationIds.length;
  const photoQuestions = photoIds.length;
  const totalRounds = Math.max(1, Math.ceil(totalQuestions / QUESTIONS_PER_ROUND));
  const photoRounds = Math.max(0, Math.ceil(photoQuestions / QUESTIONS_PER_ROUND));

  return {
    seed,
    matchLength,
    atlas: spec,
    photoRounds,
    photoQuestions,
    totalRounds,
    totalQuestions,
    locationIds,
    envIds,
  };
}

export function currentLocationId(plan: Pick<MatchPlan, "locationIds">, questionIndex: number): string {
  return plan.locationIds[questionIndex] ?? plan.locationIds[0];
}

export function currentEnvId(
  plan: Pick<MatchPlan, "envIds" | "photoQuestions">,
  questionIndex: number,
): string | undefined {
  if (!isRound4Question(questionIndex, plan.photoQuestions)) return undefined;
  return plan.envIds[questionIndex - plan.photoQuestions];
}

