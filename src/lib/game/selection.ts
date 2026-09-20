import { ROUND4_ENVIRONMENTS } from "./environments.ts";
import { enabledLocations, ROUND4_LOCATIONS } from "./locations.ts";
import { mulberry32, shuffle } from "./rng.ts";
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
}

export function roundOf(questionIndex: number): number {
  return Math.floor(questionIndex / QUESTIONS_PER_ROUND);
}

export function questionInRound(questionIndex: number): number {
  return questionIndex % QUESTIONS_PER_ROUND;
}

export function isRound4Question(questionIndex: number): boolean {
  return questionIndex >= PHOTO_QUESTIONS;
}

/**
 * 40 questions: 15 ZA + 15 NL photos dealt 5/5 into rounds 1–3,
 * then 10 labelled 3D reconstructions (5 ZA + 5 NL) for round 4.
 */
export function planMatch(seed: number): MatchPlan {
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
  for (let r = 0; r < PHOTO_ROUNDS; r++) {
    const chunk = shuffle([...za.splice(0, 5), ...nl.splice(0, 5)], rand);
    photo.push(...chunk);
  }
  while (photo.length < PHOTO_QUESTIONS) {
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
    locationIds: [...photo.slice(0, PHOTO_QUESTIONS).map((l) => l.id), ...r4.map((l) => l.id)],
    envIds,
  };
}

export function currentLocationId(plan: Pick<MatchPlan, "locationIds">, questionIndex: number): string {
  return plan.locationIds[questionIndex] ?? plan.locationIds[0];
}

export function currentEnvId(plan: Pick<MatchPlan, "envIds">, questionIndex: number): string | undefined {
  if (!isRound4Question(questionIndex)) return undefined;
  return plan.envIds[questionIndex - PHOTO_QUESTIONS];
}