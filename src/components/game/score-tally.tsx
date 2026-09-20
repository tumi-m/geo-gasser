import type { PlayerState } from "@/lib/game";
import { PlayerAvatar } from "./player-avatar";
import { cn } from "@/lib/utils";

export function ScoreTally({
  players,
  selfId,
  showRound,
}: {
  players: PlayerState[];
  selfId?: string;
  /** After reveal, show this question’s points next to the running total. */
  showRound?: boolean;
}) {
  if (players.length < 2) return null;
  const ordered = [...players].sort((a, b) => {
    if (a.id === selfId) return -1;
    if (b.id === selfId) return 1;
    return 0;
  });
  const lead = Math.max(...ordered.map((p) => p.totalScore));
  const tied = ordered.every((p) => p.totalScore === lead);

  return (
    <div
      className="min-w-[10.5rem] rounded-[var(--radius-md)] border border-border bg-bg/75 px-2.5 py-2"
      role="table"
      aria-label="Score tally"
    >
      {ordered.map((p) => {
        const you = p.id === selfId;
        const leading = !tied && p.totalScore === lead;
        const round = showRound ? p.roundScore?.roundScore : undefined;
        return (
          <div
            key={p.id}
            role="row"
            className="flex items-center gap-2 py-1 first:pt-0 last:pb-0"
          >
            <PlayerAvatar id={p.avatarId} size={28} title={p.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs text-fg">{you ? "You" : p.name}</span>
                {p.locked && !showRound ? (
                  <span className="text-[10px] uppercase tracking-wider text-subtle">in</span>
                ) : null}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "font-display tabular text-base leading-none",
                    leading ? "text-fg" : "text-muted",
                  )}
                >
                  {p.totalScore.toLocaleString()}
                </span>
                {round != null ? (
                  <span className="text-[11px] tabular text-subtle">+{round.toLocaleString()}</span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
