export const ROUND_DURATION_SEC = 45;
export const TIME_MAX = 10_000;
export const TIME_AT_ONE_SEC = 1_000;

export type TimeDifficulty = "easy" | "medium" | "hard";
export type MatchLengthId = "escape" | "quick" | "standard" | "extended" | "full";

export const DIFFICULTY_SECONDS: Record<TimeDifficulty, number> = {
  easy: 60,
  medium: 45,
  hard: 30,
};

export const MATCH_LENGTH: Record<
  MatchLengthId,
  { photoRounds: number; totalRounds: number; photoQuestions: number; totalQuestions: number }
> = {
  escape: { photoRounds: 5, totalRounds: 5, photoQuestions: 5, totalQuestions: 5 },
  quick: { photoRounds: 1, totalRounds: 1, photoQuestions: 10, totalQuestions: 10 },
  standard: { photoRounds: 3, totalRounds: 4, photoQuestions: 30, totalQuestions: 40 },
  extended: { photoRounds: 6, totalRounds: 7, photoQuestions: 60, totalQuestions: 70 },
  full: { photoRounds: 9, totalRounds: 10, photoQuestions: 90, totalQuestions: 100 },
};

/**
 * Linear interpolation:
 * duration remaining → 10,000; 1s remaining → 1,000; ≤0 → 0.
 */
export function timePoints(secondsRemaining: number, durationSec = ROUND_DURATION_SEC): number {
  if (secondsRemaining <= 0) return 0;
  const cap = Math.max(2, durationSec);
  const s = Math.min(cap, Math.max(1, secondsRemaining));
  return Math.round(TIME_AT_ONE_SEC + ((s - 1) / (cap - 1)) * 9_000);
}

export function remainingSeconds(startedAtMs: number, atMs: number, durationSec = ROUND_DURATION_SEC): number {
  return Math.max(0, durationSec - (atMs - startedAtMs) / 1000);
}

export function isTimeDifficulty(v: unknown): v is TimeDifficulty {
  return v === "easy" || v === "medium" || v === "hard";
}

export function isMatchLengthId(v: unknown): v is MatchLengthId {
  return v === "escape" || v === "quick" || v === "standard" || v === "extended" || v === "full";
}