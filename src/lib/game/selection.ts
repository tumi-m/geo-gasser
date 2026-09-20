import { ROUND4_ENVIRONMENTS } from "./environments.ts";
import { enabledLocations, ROUND4_LOCATIONS } from "./locations.ts";
import { mulberry32, shuffle } from "./rng.ts";
import { MATCH_LENGTH, type MatchLengthId } from "./timer.ts";
import type { GeoLocation } from "./types.ts";

export const QUESTIONS_PER_ROUND = 10;
export const TOTAL_ROUNDS = 4;
export const PHOTO_ROUNDS = 3;
export const PHOTO_QUESTIONS = PHOTO_ROUNDS * QUESTIONS_PER_ROUND;
export const ROUND4_QUESTIONS = 10;
export const TOTAL_QUESTIONS = PHOTO_QUESTIONS + ROUND4_QUESTIONS;
/** @deprecated use PHOTO_ROUNDS — kept so older imports keep compiling */
export const REAL_ROUNDS = PHOTO_ROUNDS;

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

/**
 * Standard: 3 photo rounds (15 ZA + 15 NL) + 10 reconstructions.
 * Extended: 6 photo rounds (30 ZA + 30 NL) + 10 reconstructions.
 */
export function planMatch(seed: number, matchLength: MatchLengthId = "standard"): MatchPlan {
  const cfg = MATCH_LENGTH[matchLength];
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

  const photo: GeoLocation[] = [];
  for (let r = 0; r < cfg.photoRounds; r++) {
    const chunk = shuffle([...za.splice(0, 5), ...nl.splice(0, 5)], rand);
    photo.push(...chunk);
  }
  while (photo.length < cfg.photoQuestions) {
    const rest = shuffle(
      pool.filter((l) => !photo.some((p) => p.id === l.id)),
      rand,
    );
    if (!rest[0]) break;
    photo.push(rest[0]);
  }

  const r4 = shuffle([...ROUND4_LOCATIONS], rand).slice(0, ROUND4_QUESTIONS);
  const envByTruth = new Map(ROUND4_ENVIRONMENTS.map((e) => [e.truthLocationId, e.id]));
  const envIds = r4.map((l) => envByTruth.get(l.id)).filter((id): id is string => Boolean(id));

  return {
    seed,
    matchLength,
    photoRounds: cfg.photoRounds,
    photoQuestions: cfg.photoQuestions,
    totalRounds: cfg.totalRounds,
    totalQuestions: cfg.totalQuestions,
    locationIds: [...photo.slice(0, cfg.photoQuestions).map((l) => l.id), ...r4.map((l) => l.id)],
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