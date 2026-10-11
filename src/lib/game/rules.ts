import type { DuelRule, MatchState, MovementRule, PlayerState } from "./types.ts";

/**
 * The rule sets borrowed from the big geo games, as this game plays them.
 * Each is rebuilt from how the mode publicly works; the numbers are ours.
 */

/** Health duels: what both players start with. */
export const START_HEALTH = 6000;

/** Health duels: the most places a deck holds; a duel usually ends sooner. */
export const HEALTH_DECK = 20;

/**
 * Health duels: how hard place `n` (1-based) hits. ×1 for the first four,
 * then half a point more each place: ×1.5, ×2, ×2.5…, so a duel that drags
 * on settles itself.
 */
export function damageMultiplier(placeNumber: number): number {
  return placeNumber <= 4 ? 1 : 1 + 0.5 * (placeNumber - 4);
}

/**
 * Health duels: the lower round score loses the gap, times the multiplier.
 * Returns who is hit and how hard, or null on a draw (or with one player).
 */
export function duelDamage(
  players: Pick<PlayerState, "id" | "roundScore">[],
  placeNumber: number,
): { playerId: string; amount: number; multiplier: number } | null {
  if (players.length !== 2) return null;
  const [a, b] = players;
  const sa = a.roundScore?.roundScore ?? 0;
  const sb = b.roundScore?.roundScore ?? 0;
  if (sa === sb) return null;
  const multiplier = damageMultiplier(placeNumber);
  const loser = sa < sb ? a : b;
  return { playerId: loser.id, amount: Math.round(Math.abs(sa - sb) * multiplier), multiplier };
}

/** Country Streak: the most places a run can deal before it has seen them all. */
export const STREAK_DECK_MAX = 400;

export const MOVEMENT_RULES: readonly MovementRule[] = ["moving", "no-move", "nmpz"];

export const MOVEMENT_NAME: Record<MovementRule, string> = {
  moving: "Moving",
  "no-move": "No move",
  nmpz: "NMPZ",
};

export function isMovementRule(v: unknown): v is MovementRule {
  return v === "moving" || v === "no-move" || v === "nmpz";
}

export function isDuelRule(v: unknown): v is DuelRule {
  return v === "points" || v === "health";
}

/** The match's movement rule ("moving" when none was set). */
export function movementOf(state: Pick<MatchState, "movement">): MovementRule {
  return state.movement ?? "moving";
}

/** True for a duel won on health rather than on points. */
export function isHealthDuel(state: Partial<Pick<MatchState, "mode" | "duelRule">>): boolean {
  return state.mode === "duel" && state.duelRule === "health";
}

/**
 * True when every place is its own round, with its own intro: Escape, health
 * duels and Country Streak. Longer matches group ten places to a round.
 */
export function placeByPlace(
  state: Pick<MatchState, "matchLength"> & Partial<Pick<MatchState, "streak" | "duelRule" | "mode">>,
): boolean {
  return state.matchLength === "escape" || Boolean(state.streak) || isHealthDuel(state);
}
