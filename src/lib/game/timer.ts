export const ROUND_DURATION_SEC = 45;

export type TimeDifficulty = "easy" | "medium" | "hard";
export type MatchLengthId = "escape" | "quick" | "standard" | "extended" | "full";

export const DIFFICULTY_SECONDS: Record<TimeDifficulty, number> = {
  easy: 60,
  medium: 45,
  hard: 30,
};

/** What each match length is called on screen. */
export const MATCH_LENGTH_NAME: Record<MatchLengthId, string> = {
  escape: "Escape",
  quick: "Quick",
  standard: "Classic",
  extended: "Voyage",
  full: "Odyssey",
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
 * The clock's share of a round's points, in tiers. The round splits into five
 * equal slices; a guess locked in the first keeps all of its distance score,
 * then 90%, 80%, 70% and, in the last slice or at the buzzer, 60%. A perfect
 * guess is worth 5,000, then 4,500, 4,000, 3,500 and 3,000.
 */
export const CLOCK_TIERS = [1, 0.9, 0.8, 0.7, 0.6] as const;

/** Which tier (0 = first) a guess with `secondsRemaining` left falls in. */
export function clockTier(secondsRemaining: number, durationSec = ROUND_DURATION_SEC): number {
  const d = Math.max(1, durationSec);
  const elapsed = Math.min(d, Math.max(0, d - secondsRemaining));
  return Math.min(CLOCK_TIERS.length - 1, Math.floor((elapsed / d) * CLOCK_TIERS.length));
}

/** The multiplier the clock applies to a guess's distance score. */
export function clockFactor(secondsRemaining: number, durationSec = ROUND_DURATION_SEC): number {
  return CLOCK_TIERS[clockTier(secondsRemaining, durationSec)];
}

/**
 * Seconds until the pot next steps down, or null in the last tier (it holds
 * at 60% until the buzzer).
 */
export function secondsToNextTier(secondsRemaining: number, durationSec = ROUND_DURATION_SEC): number | null {
  const d = Math.max(1, durationSec);
  const tier = clockTier(secondsRemaining, d);
  if (tier >= CLOCK_TIERS.length - 1) return null;
  const nextAtRemaining = d - ((tier + 1) * d) / CLOCK_TIERS.length;
  return Math.max(0, secondsRemaining - nextAtRemaining);
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