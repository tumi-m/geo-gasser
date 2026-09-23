import type { PlayerState } from "./types.ts";

export interface VerdictRow {
  id: string;
  name: string;
  avatarId: string;
  /** Points scored this round. */
  round: number;
  /** Match total before this round, and after it. */
  before: number;
  total: number;
  /** This round's points as a share of the best round score shown (0–1). */
  share: number;
}

export interface RoundVerdict {
  rows: VerdictRow[];
  /** Who took this round; null for a solo round or a dead heat. */
  winnerId: string | null;
  tie: boolean;
  /** Who leads the match after this round; null when level. */
  leaderId: string | null;
  lead: number;
}

/**
 * Who won the round and how the match stands, for the reveal. `selfId` goes
 * first so each player reads their own row on top.
 */
export function roundVerdict(players: readonly PlayerState[], selfId?: string): RoundVerdict {
  const ordered = [...players].sort((a, b) => Number(b.id === selfId) - Number(a.id === selfId));
  const best = Math.max(1, ...ordered.map((p) => p.roundScore?.roundScore ?? 0));
  const rows = ordered.map((p) => {
    const round = Math.max(0, p.roundScore?.roundScore ?? 0);
    return {
      id: p.id,
      name: p.name,
      avatarId: p.avatarId,
      round,
      before: Math.max(0, p.totalScore - round),
      total: p.totalScore,
      share: round / best,
    };
  });
  if (rows.length < 2) return { rows, winnerId: null, tie: false, leaderId: null, lead: 0 };

  const byRound = [...rows].sort((a, b) => b.round - a.round);
  const tie = byRound[0].round === byRound[1].round;
  const byTotal = [...rows].sort((a, b) => b.total - a.total);
  const lead = byTotal[0].total - byTotal[1].total;
  return {
    rows,
    winnerId: tie ? null : byRound[0].id,
    tie,
    leaderId: lead > 0 ? byTotal[0].id : null,
    lead,
  };
}
