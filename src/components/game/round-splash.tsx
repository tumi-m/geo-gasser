import { Fragment, useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import { audio, formatDistance, roundVerdict, type PlayerState, type RoundScore } from "@/lib/game";
import { PlayerAvatar } from "./player-avatar";
import { useCountUp } from "./use-count-up";
import { cn } from "@/lib/utils";

/**
 * The end-of-round moment, over the photo with the map still in view below:
 * both players slide in, their round points count up, then the winner is
 * crowned — avatar grows, trophy drops, sparks — and the headline rises in.
 * Solo shows your points and a burst for a good guess. Tap or any key skips.
 */

const T_IN = 150;
const T_COUNT = 900;
const T_CROWN = T_IN + T_COUNT + 100;
const T_LEAVE = T_CROWN + 1350;
const T_GONE = T_LEAVE + 260;

export function RoundSplash({
  players,
  selfId,
  score,
  headline,
  roundLabel,
  markSelf = true,
  reducedMotion,
  onDone,
}: {
  players: PlayerState[];
  selfId: string;
  score: RoundScore;
  /** Solo headline, e.g. "SO CLOSE". Duels name the winner instead. */
  headline: string;
  roundLabel: string;
  markSelf?: boolean;
  reducedMotion?: boolean;
  onDone: () => void;
}) {
  const reduced = Boolean(reducedMotion);
  const verdict = roundVerdict(players, selfId);
  const duel = verdict.rows.length > 1;
  const winner = verdict.rows.find((r) => r.id === verdict.winnerId);
  const youWon = duel ? verdict.winnerId === selfId : score.accuracyPoints >= 7000;
  const [stage, setStage] = useState<"in" | "count" | "crown" | "leave">(reduced ? "crown" : "in");
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const at = (ms: number, fn: () => void) => window.setTimeout(fn, ms);
    const timers = reduced
      ? [at(1800, () => doneRef.current())]
      : [
          at(T_IN, () => setStage("count")),
          at(T_CROWN, () => {
            setStage("crown");
            if (duel && !verdict.winnerId) return;
            audio.play(youWon ? "roundWin" : "roundLose");
          }),
          at(T_LEAVE, () => setStage("leave")),
          at(T_GONE, () => doneRef.current()),
        ];
    // Any key skips; it must not also reach the game (Enter would continue).
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      doneRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("keydown", onKey, true);
    };
    // Runs once per splash; the parent remounts it for each round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const crowned = stage === "crown" || stage === "leave";
  const title = duel
    ? winner
      ? `${winner.name} takes the round`
      : "Dead heat"
    : headline.charAt(0) + headline.slice(1).toLowerCase();
  const leader = verdict.rows.find((r) => r.id === verdict.leaderId);
  const sub = duel
    ? leader
      ? `${leader.name} leads by ${verdict.lead.toLocaleString()}`
      : "Level on points"
    : Number.isFinite(score.distanceKm)
      ? `${formatDistance(score.distanceKm)} away`
      : "No pin this time";

  return (
    <div
      className={cn("round-splash", `is-${stage}`, reduced && "is-reduced")}
      role="status"
      aria-live="polite"
      aria-label={`${roundLabel}. ${title}. ${sub}.`}
      onClick={() => doneRef.current()}
    >
      <div className="splash-inner">
        <p className="splash-kicker">{roundLabel}</p>
        {duel ? (
          <div className="splash-duel">
            {verdict.rows.map((row, i) => {
              const isWinner = crowned && row.id === verdict.winnerId;
              const isLoser = crowned && Boolean(verdict.winnerId) && !isWinner;
              return (
                <SplashPlayer
                  key={row.id}
                  side={i === 0 ? "left" : "right"}
                  name={row.name}
                  avatarId={row.avatarId}
                  points={row.round}
                  you={markSelf && row.id === selfId}
                  winner={isWinner}
                  loser={isLoser}
                  reduced={reduced}
                />
              );
            })}
            <span className="splash-vs" aria-hidden>
              vs
            </span>
          </div>
        ) : (
          <SoloPoints
            points={score.roundScore}
            burst={crowned && youWon && !reduced}
            reduced={reduced}
          />
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

function SplashPlayer({
  side,
  name,
  avatarId,
  points,
  you,
  winner,
  loser,
  reduced,
}: {
  side: "left" | "right";
  name: string;
  avatarId: string;
  points: number;
  you: boolean;
  winner: boolean;
  loser: boolean;
  reduced: boolean;
}) {
  const shown = useCountUp(points, T_COUNT, reduced, 0, T_IN);
  return (
    <div className={cn("splash-player", `is-${side}`, winner && "is-winner", loser && "is-loser")}>
      <div className="splash-avatar">
        <PlayerAvatar id={avatarId} size={76} />
        {winner && (
          <span className="splash-trophy" aria-hidden>
            <Trophy size={22} />
          </span>
        )}
        {winner && !reduced && <Sparks />}
      </div>
      <p className="splash-name">
        {name}
        {you && <span> · you</span>}
      </p>
      <p className="splash-points tabular">+{Math.round(shown).toLocaleString()}</p>
    </div>
  );
}

function SoloPoints({
  points,
  burst,
  reduced,
}: {
  points: number;
  burst: boolean;
  reduced: boolean;
}) {
  const shown = useCountUp(points, T_COUNT, reduced, 0, T_IN);
  return (
    <div className="splash-solo">
      <p className="splash-big tabular">+{Math.round(shown).toLocaleString()}</p>
      {burst && <Sparks count={22} spread={150} />}
    </div>
  );
}

const SPARK_COLOURS = [
  "var(--color-accent)",
  "var(--color-fg)",
  "var(--color-nl)",
  "var(--color-za)",
];

/** A one-shot burst: small chips fly out from the centre and fade. */
export function Sparks({ count = 16, spread = 110 }: { count?: number; spread?: number }) {
  return (
    <span className="sparks" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.21;
        const dist = spread * (0.55 + ((i * 37) % 45) / 100);
        return (
          <i
            key={i}
            style={
              {
                "--dx": `${Math.round(Math.cos(angle) * dist)}px`,
                "--dy": `${Math.round(Math.sin(angle) * dist)}px`,
                "--r": `${(i * 47) % 360}deg`,
                "--delay": `${(i % 4) * 30}ms`,
                background: SPARK_COLOURS[i % SPARK_COLOURS.length],
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}
