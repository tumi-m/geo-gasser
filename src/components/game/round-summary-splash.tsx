import { Fragment } from "react";
import { Trophy } from "lucide-react";
import { audio, getLocation, roundSummary, type PlayerState, type RoundRecord } from "@/lib/game";
import { PlayerAvatar } from "./player-avatar";
import { Sparks } from "./round-splash";
import { useSplashTimeline } from "./use-splash-timeline";
import { useCountUp } from "./use-count-up";
import { cn } from "@/lib/utils";

/**
 * The end of a multi-question round (Quick is one round of ten). Every
 * question lights up in turn — who took it, or how you scored — while the
 * round totals roll up; then the round's winner is crowned.
 */

const T_PIPS = 300;
const PIP_STEP = 110;
const HOLD = 2000;

export function RoundSummarySplash({
  history,
  players,
  selfId,
  roundIndex,
  totalRounds,
  markSelf = true,
  reducedMotion,
  onDone,
}: {
  history: RoundRecord[];
  players: PlayerState[];
  selfId: string;
  roundIndex: number;
  totalRounds: number;
  markSelf?: boolean;
  reducedMotion?: boolean;
  onDone: () => void;
}) {
  const reduced = Boolean(reducedMotion);
  const s = roundSummary(history, players, roundIndex, selfId);
  const duel = s.rows.length > 1;
  const count = s.pips.length;
  const countMs = Math.max(600, count * PIP_STEP);
  const crownAt = T_PIPS + countMs + 150;
  const youWon = duel ? s.winnerId === selfId : true;
  const stage = useSplashTimeline(
    crownAt,
    crownAt + HOLD,
    () => {
      if (duel && !s.winnerId) return;
      audio.play(youWon ? "roundWin" : "roundLose");
    },
    onDone,
  );
  const crowned = stage === "crown" || stage === "leave";
  const which = totalRounds > 1 ? `round ${roundIndex + 1}` : "the round";
  const kicker = totalRounds > 1 ? `Round ${roundIndex + 1} complete` : "Round complete";

  const winner = s.rows.find((r) => r.id === s.winnerId);
  const loser = s.rows.find((r) => r.id !== s.winnerId);
  const best = s.best;
  const bestPlace = best ? getLocation(best.locationId)?.title : undefined;
  const title = duel
    ? winner
      ? `${winner.name} wins ${which}`
      : `${cap(which)} is a draw`
    : soloRating(s.rows[0]?.total ?? 0, count);
  const sub = duel
    ? winner && loser
      ? `${winner.wins} of ${count} questions · by ${(winner.total - loser.total).toLocaleString()}`
      : `${s.rows[0].wins} questions each`
    : best
      ? `Best: ${bestPlace ?? `Q${best.question}`} · ${best.score.toLocaleString()}`
      : "";

  return (
    <div
      className={cn("round-splash is-summary", `is-${stage}`, reduced && "is-reduced")}
      role="status"
      aria-live="polite"
      aria-label={`${kicker}. ${title}. ${sub}.`}
      onClick={onDone}
    >
      <div className="splash-inner">
        <p className="splash-kicker">{kicker}</p>
        {duel ? (
          <div className="splash-duel">
            {s.rows.map((row, i) => {
              const isWinner = crowned && row.id === s.winnerId;
              return (
                <div
                  key={row.id}
                  className={cn(
                    "splash-player",
                    i === 0 ? "is-left" : "is-right",
                    isWinner && "is-winner",
                    crowned && s.winnerId && !isWinner && "is-loser",
                  )}
                >
                  <div className="splash-avatar">
                    <PlayerAvatar id={row.avatarId} size={64} />
                    {isWinner && (
                      <span className="splash-trophy" aria-hidden>
                        <Trophy size={20} />
                      </span>
                    )}
                    {isWinner && !reduced && <Sparks count={20} spread={130} />}
                  </div>
                  <p className="splash-name">
                    {row.name}
                    {markSelf && row.id === selfId && <span> · you</span>}
                  </p>
                  <Total value={row.total} ms={countMs} className="splash-points" />
                </div>
              );
            })}
            <span className="splash-vs" aria-hidden>
              vs
            </span>
          </div>
        ) : (
          <div className="splash-solo">
            <Total value={s.rows[0]?.total ?? 0} ms={countMs} className="splash-big" />
            {crowned && !reduced && <Sparks count={24} spread={160} />}
          </div>
        )}

        {duel ? (
          <ol className="summary-pips" aria-hidden>
            {s.pips.map((who, i) => (
              <li
                key={i}
                className={cn(
                  who === null ? "is-tie" : who === s.rows[0].id ? "is-first" : "is-second",
                )}
                style={{ "--at": `${T_PIPS + i * PIP_STEP}ms` } as React.CSSProperties}
              />
            ))}
          </ol>
        ) : (
          <ol className="summary-bars" aria-hidden>
            {(s.rows[0]?.perQuestion ?? []).map((score, i) => (
              <li
                key={i}
                className={cn(best && best.question === i + 1 && "is-best")}
                style={
                  {
                    "--h": Math.max(0.06, Math.min(1, score / 20000)),
                    "--at": `${T_PIPS + i * PIP_STEP}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </ol>
        )}

        <h2 className="splash-headline" aria-hidden>
          {crowned
            ? title.split(" ").map((word, i) => (
                <Fragment key={`${word}-${i}`}>
                  {i > 0 && " "}
                  <span style={{ "--i": i } as React.CSSProperties}>{word}</span>
                </Fragment>
              ))
            : " "}
        </h2>
        <p className="splash-sub" aria-hidden>
          {crowned ? sub : " "}
        </p>
        <p className="splash-hint" aria-hidden>
          Tap to continue
        </p>
      </div>
    </div>
  );
}

function Total({ value, ms, className }: { value: number; ms: number; className: string }) {
  // Numbers roll even with reduced motion: counting is not movement.
  const shown = useCountUp(value, ms, false, 0, T_PIPS);
  return <p className={cn(className, "tabular")}>{Math.round(shown).toLocaleString()}</p>;
}

/** A word for a solo round, from the average per question (max 20,000). */
function soloRating(total: number, questions: number): string {
  const avg = total / Math.max(1, questions);
  if (avg >= 15000) return "Outstanding round";
  if (avg >= 11000) return "Great round";
  if (avg >= 8000) return "Solid round";
  return "Round in the books";
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
