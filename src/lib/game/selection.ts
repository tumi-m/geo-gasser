import { enabledLocations } from "./locations.ts";
import { mulberry32, shuffle } from "./rng.ts";
import { MATCH_LENGTH, type MatchLengthId } from "./timer.ts";
import type { CountryCode, GeoLocation } from "./types.ts";

export const QUESTIONS_PER_ROUND = 10;
export const TOTAL_ROUNDS = 4;
export const PHOTO_ROUNDS = 4;
export const PHOTO_QUESTIONS = PHOTO_ROUNDS * QUESTIONS_PER_ROUND;
/** Parked 3D round — kept at 0 so older imports keep compiling. */
export const ROUND4_QUESTIONS = 0;
export const TOTAL_QUESTIONS = PHOTO_QUESTIONS;
/** @deprecated use PHOTO_ROUNDS — kept so older imports keep compiling */
export const REAL_ROUNDS = PHOTO_ROUNDS;

/** Deal from the 149-site pool so matches are hard to memorise. */
export const MATCH_QUOTA: Record<MatchLengthId, Record<CountryCode, number>> = {
  standard: { ZA: 13, NL: 13, WORLD: 14 },
  extended: { ZA: 23, NL: 23, WORLD: 24 },
  full: { ZA: 33, NL: 33, WORLD: 34 },
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
 * Shuffle the 149-site pool and deal a unique set.
 * Standard 40 ≈ 13/13/14, extended 70 ≈ 23/23/24, full 100 = 33 ZA + 33 NL + 34 world.
 * No 3D final round — reconstructions sit in the photo pool like everything else.
 */
export function planMatch(seed: number, matchLength: MatchLengthId = "standard"): MatchPlan {
  const cfg = MATCH_LENGTH[matchLength];
  const quota = MATCH_QUOTA[matchLength];
  const rand = mulberry32(seed);
  const pool = enabledLocations();
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
  while (picked.length < cfg.totalQuestions && rest.length) {
    picked.push(rest.shift()!);
  }

  const locationIds = shuffle(picked, rand)
    .slice(0, cfg.totalQuestions)
    .map((l) => l.id);

  return {
    seed,
    matchLength,
    photoRounds: cfg.photoRounds,
    photoQuestions: cfg.photoQuestions,
    totalRounds: cfg.totalRounds,
    totalQuestions: cfg.totalQuestions,
    locationIds,
    envIds: [],
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
