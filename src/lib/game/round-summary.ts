import { QUESTIONS_PER_ROUND } from "./selection.ts";
import type { MatchState, PlayerState, RoundRecord } from "./types.ts";

export interface SummaryRow {
  id: string;
  name: string;
  avatarId: string;
  /** Points over the whole round. */
  total: number;
  /** Questions this player won outright. */
  wins: number;
  /** Points per question, in order. */
  perQuestion: number[];
}

export interface RoundSummary {
  roundIndex: number;
  rows: SummaryRow[];
  /** Winner of each question in the round; null for a tie or a solo round. */
  pips: (string | null)[];
  /** Who took the round on points; null for solo or a dead heat. */
  winnerId: string | null;
  /** The viewer's best question: its position in the round and its score. */
  best: { question: number; score: number; locationId: string } | null;
}

/** The question just revealed closes a multi-question round. */
export function endsRound(
  state: Pick<MatchState, "matchLength" | "questionIndex" | "totalQuestions">,
): boolean {
  if (state.matchLength === "escape") return false; // there a round is one question
  const last = state.questionIndex >= (state.totalQuestions || 0) - 1;
  return last || (state.questionIndex + 1) % QUESTIONS_PER_ROUND === 0;
}

/** Everything the end-of-round summary shows, from the match history. */
export function roundSummary(
  history: readonly RoundRecord[],
  players: readonly PlayerState[],
  roundIndex: number,
  selfId?: string,
): RoundSummary {
  const records = history.filter((r) => Math.floor(r.index / QUESTIONS_PER_ROUND) === roundIndex);
  const ordered = [...players].sort((a, b) => Number(b.id === selfId) - Number(a.id === selfId));
  const scoreOf = (r: RoundRecord, id: string) => r.guesses[id]?.score.roundScore ?? 0;
  const pips = records.map((r) => {
    if (ordered.length < 2) return null;
    const [a, b] = ordered.map((p) => scoreOf(r, p.id));
    return a === b ? null : a > b ? ordered[0].id : ordered[1].id;
  });
  const rows = ordered.map((p) => {
    const perQuestion = records.map((r) => scoreOf(r, p.id));
    return {
      id: p.id,
      name: p.name,
      avatarId: p.avatarId,
      total: perQuestion.reduce((n, x) => n + x, 0),
      wins: pips.filter((w) => w === p.id).length,
      perQuestion,
    };
  });
  let winnerId: string | null = null;
  if (rows.length > 1 && rows[0].total !== rows[1].total)
    winnerId = rows[0].total > rows[1].total ? rows[0].id : rows[1].id;
  const mine = rows.find((r) => r.id === selfId) ?? rows[0];
  let best: RoundSummary["best"] = null;
  mine?.perQuestion.forEach((score, i) => {
    if (!best || score > best.score)
      best = { question: i + 1, score, locationId: records[i].locationId };
  });
  return { roundIndex, rows, pips, winnerId, best };
}
