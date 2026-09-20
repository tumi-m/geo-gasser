export const ROUND_DURATION_SEC = 45;
export const TIME_MAX = 10_000;
export const TIME_AT_ONE_SEC = 1_000;

/**
 * Linear interpolation specified by the game contract:
 * 45s remaining → 10,000; 1s remaining → 1,000; ≤0 → 0.
 */
export function timePoints(secondsRemaining: number): number {
  if (secondsRemaining <= 0) return 0;
  const s = Math.min(ROUND_DURATION_SEC, Math.max(1, secondsRemaining));
  return Math.round(TIME_AT_ONE_SEC + ((s - 1) / 44) * 9_000);
}

export function remainingSeconds(startedAtMs: number, atMs: number, durationSec = ROUND_DURATION_SEC): number {
  return Math.max(0, durationSec - (atMs - startedAtMs) / 1000);
}
