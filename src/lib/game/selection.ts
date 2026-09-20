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

/** Photo-round country mix. Round 4 always appends the 10 reserved reconstructions. */
export const MATCH_QUOTA: Record<MatchLengthId, Record<CountryCode, number>> = {
  standard: { ZA: 15, NL: 15, WORLD: 0 },
  extended: { ZA: 25, NL: 25, WORLD: 10 },
  full: { ZA: 35, NL: 35, WORLD: 20 },
};

export interface MatchPlan {
  seed: number;
  locationIds: string[];
  envIds: string[];
  matchLength: MatchLengthId;
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

/**
 * Standard: 15 ZA + 15 NL stills, then 10 reserved reconstructions.
 * Extended / full pull extra stills from the 149-site pool, then the same 3D tail.
 * The 3D renderer is parked (`ROUND4_3D_LIVE`) — plates still play as round 4.
 */
export function planMatch(seed: number, matchLength: MatchLengthId = "standard"): MatchPlan {
  const cfg = MATCH_LENGTH[matchLength];
  const quota = MATCH_QUOTA[matchLength];
  const rand = mulberry32(seed);
  const reserved = new Set(ROUND4_LOCATIONS.map((l) => l.id));
  const pool = enabledLocations().filter((l) => !reserved.has(l.id));
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

  const picked: GeoLocation[] = [
    ...take(za, quota.ZA),
    ...take(nl, quota.NL),
    ...take(world, quota.WORLD),
  ];
  const used = new Set(picked.map((l) => l.id));
  const rest = shuffle(
    pool.filter((l) => !used.has(l.id)),
    rand,
  );
  while (picked.length < cfg.photoQuestions && rest.length) {
    picked.push(rest.shift()!);
  }

  const photoIds = shuffle(picked, rand)
    .slice(0, cfg.photoQuestions)
    .map((l) => l.id);

  const reconstructions = shuffle([...ROUND4_LOCATIONS], rand);
  const locationIds = [...photoIds, ...reconstructions.map((l) => l.id)].slice(0, cfg.totalQuestions);
  const envIds = reconstructions.map(
    (l, i) => environmentForLocation(l.id)?.id ?? ROUND4_ENVIRONMENTS[i % ROUND4_ENVIRONMENTS.length].id,
  );

  return {
    seed,
    matchLength,
    photoRounds: cfg.photoRounds,
    photoQuestions: cfg.photoQuestions,
    totalRounds: cfg.totalRounds,
    totalQuestions: cfg.totalQuestions,
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
