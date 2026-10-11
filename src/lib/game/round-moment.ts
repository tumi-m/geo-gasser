import { START_HEALTH } from "./rules.ts";
import { ROUND_MAX } from "./scoring.ts";
import type { RoundRecord } from "./types.ts";

/**
 * What the end of a round means for the match, for the celebration after
 * it: rounds won so far, and the moments worth calling out (a run of wins,
 * a lead change, a close call, a perfect read, a shutout, a hot streak).
 */

export type Callout =
  /** The round's winner has now won `count` rounds in a row (2+). */
  | { kind: "run"; count: number }
  /** The match lead changed hands this round. */
  | { kind: "lead-change" }
  /** The round was won by very little. */
  | { kind: "close-call"; margin: number }
  /** A full 5,000 for distance on a place this round. */
  | { kind: "perfect" }
  /** The loser scored nothing this round. */
  | { kind: "shutout" }
  /** Solo: great rounds in a row (`count` of them, 2+). */
  | { kind: "hot-streak"; count: number };

export interface RoundMoment {
  /** Rounds won so far by each player, this one included. */
  wins: Record<string, number>;
  /** Who took this round; absent for a draw or a solo game. */
  winnerId?: string;
  /** At most two, most remarkable first. */
  callouts: Callout[];
}

/** A round "won by very little": within 2% of what it could pay. */
export const CLOSE_CALL_SHARE = 0.02;
/** Solo: a great round averages 80% of the maximum or more. */
export const GREAT_ROUND_SHARE = 0.8;

const RANK: Record<Callout["kind"], number> = {
  perfect: 0,
  shutout: 1,
  "lead-change": 2,
  "hot-streak": 3,
  run: 4,
  "close-call": 5,
};

/**
 * The moment for the round the latest record belongs to.
 * `groupOf` says which round a record is in (a place-by-place match: its
 * index; otherwise ten places to a round). Health duels are led on health.
 */
export function roundMoment(
  history: readonly RoundRecord[],
  playerIds: readonly string[],
  groupOf: (record: RoundRecord) => number,
  options: { leadBy?: "points" | "health"; selfId?: string } = {},
): RoundMoment {
  const latest = history.at(-1);
  const wins: Record<string, number> = Object.fromEntries(playerIds.map((id) => [id, 0]));
  if (!latest) return { wins, callouts: [] };
  const current = groupOf(latest);
  const groups = new Map<number, RoundRecord[]>();
  for (const record of history) {
    const g = groupOf(record);
    if (g > current) continue;
    groups.set(g, [...(groups.get(g) ?? []), record]);
  }
  const order = [...groups.keys()].sort((a, b) => a - b);
  const points = (records: RoundRecord[], id: string) =>
    records.reduce((sum, r) => sum + (r.guesses[id]?.score.roundScore ?? 0), 0);
  const duel = playerIds.length === 2;

  // Who took each round, in order.
  const winners: (string | undefined)[] = order.map((g) => {
    if (!duel) return undefined;
    const records = groups.get(g)!;
    const [a, b] = playerIds.map((id) => points(records, id));
    return a === b ? undefined : a > b ? playerIds[0] : playerIds[1];
  });
  winners.forEach((id) => {
    if (id) wins[id] += 1;
  });
  const winnerId = winners.at(-1);
  const records = groups.get(current)!;
  const callouts: Callout[] = [];

  if (duel) {
    if (winnerId) {
      let run = 0;
      for (let i = winners.length - 1; i >= 0 && winners[i] === winnerId; i--) run++;
      if (run >= 2) callouts.push({ kind: "run", count: run });
      const loserId = playerIds.find((id) => id !== winnerId)!;
      const won = points(records, winnerId);
      const lost = points(records, loserId);
      if (lost === 0 && won > 0) callouts.push({ kind: "shutout" });
      const margin = won - lost;
      if (margin > 0 && margin <= ROUND_MAX * records.length * CLOSE_CALL_SHARE)
        callouts.push({ kind: "close-call", margin });
      if (records.some((r) => (r.guesses[winnerId]?.score.accuracyPoints ?? 0) >= ROUND_MAX))
        callouts.push({ kind: "perfect" });
    }
    // The lead before this round against the lead after it.
    const before = history.filter((r) => groupOf(r) < current);
    const upTo = history.filter((r) => groupOf(r) <= current);
    const leader = (list: readonly RoundRecord[]) => {
      const [a, b] =
        options.leadBy === "health"
          ? playerIds.map(
              (id) =>
                START_HEALTH -
                list.reduce((sum, r) => sum + (r.damage?.playerId === id ? r.damage.amount : 0), 0),
            )
          : playerIds.map((id) => points([...list], id));
      return a === b ? undefined : a > b ? playerIds[0] : playerIds[1];
    };
    const was = leader(before);
    const now = leader(upTo);
    if (was && now && was !== now) callouts.push({ kind: "lead-change" });
  } else {
    const self = options.selfId ?? playerIds[0];
    if (self) {
      if (records.some((r) => (r.guesses[self]?.score.accuracyPoints ?? 0) >= ROUND_MAX))
        callouts.push({ kind: "perfect" });
      let hot = 0;
      for (let i = order.length - 1; i >= 0; i--) {
        const group = groups.get(order[i])!;
        if (points(group, self) < ROUND_MAX * group.length * GREAT_ROUND_SHARE) break;
        hot++;
      }
      if (hot >= 2) callouts.push({ kind: "hot-streak", count: hot });
    }
  }

  callouts.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
  // A long run outranks a lead change (it is the bigger story); two is not.
  const run = callouts.find((c) => c.kind === "run");
  if (run && run.kind === "run" && run.count >= 3) {
    callouts.splice(callouts.indexOf(run), 1);
    callouts.unshift(run);
  }
  return { wins, winnerId, callouts: callouts.slice(0, 2) };
}

/** What a callout says on screen. */
export function calloutLabel(callout: Callout): string {
  switch (callout.kind) {
    case "run":
      return callout.count >= 4 ? `Unstoppable · ${callout.count} in a row` : `${callout.count} in a row`;
    case "lead-change":
      return "Lead change";
    case "close-call":
      return `Close call · ${callout.margin.toLocaleString("en-US")} ${callout.margin === 1 ? "point" : "points"}`;
    case "perfect":
      return "Perfect";
    case "shutout":
      return "Shutout";
    case "hot-streak":
      return `On fire · ${callout.count} great rounds`;
  }
}
