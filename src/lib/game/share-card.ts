import { atlasLabel } from "./atlas.ts";
import { formatDistance } from "./geo.ts";
import { ROUND_MAX } from "./scoring.ts";
import type { MatchState } from "./types.ts";

/**
 * A spoiler-free result to paste in a chat: one square per question, coloured
 * by how close you came, then the score line and a link back to the game.
 */

const PER_LINE = 10;

export function scoreMark(score: number | undefined): string {
  if (!score || score <= 0) return "⬛";
  const share = score / ROUND_MAX;
  if (share >= 0.75) return "🟩";
  if (share >= 0.4) return "🟨";
  return "🟧";
}

export function shareCard(
  state: Pick<MatchState, "mode" | "atlas" | "players" | "roundHistory">,
  selfId: string,
  url?: string,
): string {
  const you = state.players.find((p) => p.id === selfId);
  const other = state.players.find((p) => p.id !== selfId);
  const marks = state.roundHistory.map((r) => scoreMark(r.guesses[selfId]?.score.roundScore));
  const lines: string[] = [];
  for (let i = 0; i < marks.length; i += PER_LINE)
    lines.push(marks.slice(i, i + PER_LINE).join(""));

  const total = (you?.totalScore ?? 0).toLocaleString("en-US");
  let score: string;
  if (state.mode === "duel" && other) {
    const them = other.totalScore.toLocaleString("en-US");
    score = `${you?.name ?? "Me"} ${total} · ${other.name} ${them}`;
  } else {
    const closest = Math.min(
      ...state.roundHistory.map((r) => r.guesses[selfId]?.score.distanceKm ?? Infinity),
    );
    score = Number.isFinite(closest)
      ? `${total} pts · closest ${formatDistance(closest)}`
      : `${total} pts`;
  }
  return [`Atlas Duel · ${atlasLabel(state.atlas)}`, ...lines, score, url]
    .filter(Boolean)
    .join("\n");
}
