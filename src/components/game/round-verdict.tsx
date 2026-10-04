import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { roundVerdict, type PlayerState, type VerdictRow } from "@/lib/game";
import { PlayerAvatar, type AvatarMood } from "./player-avatar";
import { useCountUp } from "./use-count-up";
import { cn } from "@/lib/utils";

/** Bars fill, then the winner is crowned and the totals roll over. */
const BAR_DELAY = 250;
const BAR_MS = 700;
const SETTLE_AT = BAR_DELAY + BAR_MS;
const TOTAL_MS = 650;

/**
 * The round's result by name: each player's points for the round race each
 * other, the winner is crowned, then the match totals tick over.
 */
export function RoundVerdictCard({
  players,
  selfId,
  markSelf = true,
  reducedMotion,
}: {
  players: PlayerState[];
  selfId?: string;
  /** Tag the viewer's row "you"; off for pass-and-play, where both share a screen. */
  markSelf?: boolean;
  reducedMotion?: boolean;
}) {
  const reduced = Boolean(reducedMotion);
  const verdict = roundVerdict(players, selfId);
  const duel = verdict.rows.length > 1;
  // `run` starts the bars on the frame after mount so the transition plays.
  const [run, setRun] = useState(reduced);
  const [settled, setSettled] = useState(reduced);
  useEffect(() => {
    if (reduced) {
      setRun(true);
      setSettled(true);
      return;
    }
    const raf = requestAnimationFrame(() => setRun(true));
    const id = window.setTimeout(() => setSettled(true), SETTLE_AT);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(id);
    };
  }, [reduced]);

  const winner = verdict.rows.find((r) => r.id === verdict.winnerId);
  const leader = verdict.rows.find((r) => r.id === verdict.leaderId);
  return (
    <section
      className={cn("verdict", run && "is-run", settled && "is-settled")}
      aria-label={duel ? "Round result" : "Your score"}
    >
      {duel && (
        <div
          className="verdict-headline flex flex-col max-sm:flex-row max-sm:items-baseline max-sm:gap-2"
          aria-live="polite"
        >
          <p className="font-display shrink-0 text-lg leading-tight tracking-tight">
            {settled ? (winner ? `${winner.name} takes the round` : "Dead heat") : " "}
          </p>
          <p className="min-w-0 truncate text-xs text-muted">
            {settled
              ? leader
                ? `${leader.name} leads by ${verdict.lead.toLocaleString()}`
                : "Level on points"
              : " "}
          </p>
        </div>
      )}
      <ol className="verdict-rows">
        {verdict.rows.map((row, i) => (
          <Row
            key={row.id}
            row={row}
            index={i}
            winner={duel && settled && row.id === verdict.winnerId}
            mood={
              !settled
                ? "focus"
                : duel
                  ? verdict.winnerId
                    ? row.id === verdict.winnerId
                      ? "happy"
                      : "sad"
                    : "neutral"
                  : row.round >= 12000
                    ? "happy"
                    : row.round === 0
                      ? "sad"
                      : row.round < 4000
                        ? "surprised"
                        : "wink"
            }
            you={duel && markSelf && row.id === selfId}
            reduced={reduced}
            // Solo has no winner to wait for: the total rolls with the round.
            totalDelay={duel ? SETTLE_AT : BAR_DELAY}
          />
        ))}
      </ol>
    </section>
  );
}

function Row({
  row,
  index,
  winner,
  you,
  reduced,
  totalDelay,
  mood,
}: {
  mood: AvatarMood;
  row: VerdictRow;
  index: number;
  winner: boolean;
  you: boolean;
  reduced: boolean;
  totalDelay: number;
}) {
  const round = useCountUp(row.round, BAR_MS, reduced, 0, BAR_DELAY);
  const total = useCountUp(row.total, TOTAL_MS, reduced, row.before, totalDelay);
  return (
    <li
      className={cn(
        "verdict-row",
        index === 0 ? "is-left-in" : "is-right-in",
        winner && "is-winner",
      )}
    >
      <PlayerAvatar id={row.avatarId} size={34} mood={mood} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm">
          <span className="truncate font-medium text-fg">{row.name}</span>
          {you && <span className="text-[10px] uppercase tracking-wider text-subtle">you</span>}
          {winner && (
            <span className="verdict-crown" aria-hidden>
              <Trophy size={14} />
            </span>
          )}
        </p>
        <div className="verdict-bar" aria-hidden>
          <i style={{ "--share": row.share } as React.CSSProperties} />
        </div>
      </div>
      <div className="text-right">
        <p className="font-display text-base leading-none tabular text-fg">
          +{Math.round(round).toLocaleString()}
        </p>
        <p className="mt-1 text-[11px] leading-none tabular text-muted">
          {Math.round(total).toLocaleString()} total
        </p>
      </div>
    </li>
  );
}
