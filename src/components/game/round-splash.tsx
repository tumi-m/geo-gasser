import { Fragment } from "react";
import { Trophy } from "lucide-react";
import {
  ACCURACY_MAX,
  audio,
  formatMiss,
  roundStars,
  roundVerdict,
  type PlayerState,
  type RoundScore,
} from "@/lib/game";
import { PlayerAvatar } from "./player-avatar";
import { useCountUp } from "./use-count-up";
import { useSplashTimeline } from "./use-splash-timeline";
import { CrownDrop, WinBanner, WinFx } from "./winner-moment";
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
/** A question that is a whole round (Escape) gets the full winner moment. */
const T_LEAVE_ROUND = T_CROWN + 2500;
export function RoundSplash({
  players,
  selfId,
  score,
  headline,
  roundLabel,
  winUnit = "the round",
  roundNumber,
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
  /** What the winner takes: "the round" when a round is one question. */
  winUnit?: string;
  /** Set when this question ends a round: it gets the full winner moment. */
  roundNumber?: number;
  markSelf?: boolean;
  reducedMotion?: boolean;
  onDone: () => void;
}) {
  const reduced = Boolean(reducedMotion);
  const verdict = roundVerdict(players, selfId);
  const duel = verdict.rows.length > 1;
  const winner = verdict.rows.find((r) => r.id === verdict.winnerId);
  const youWon = duel ? verdict.winnerId === selfId : score.accuracyPoints >= ACCURACY_MAX * 0.7;
  const roundEnd = roundNumber !== undefined;
  const stage = useSplashTimeline(
    T_CROWN,
    roundEnd ? T_LEAVE_ROUND : T_LEAVE,
    () => {
      if (duel && !verdict.winnerId) return;
      audio.play(youWon ? "roundWin" : "roundLose");
    },
    onDone,
  );
  const skip = () => onDone();

  const crowned = stage === "crown" || stage === "leave";
  const winnerIndex = verdict.rows.findIndex((r) => r.id === verdict.winnerId);
  const winColour = winnerIndex === 1 ? "var(--color-nl)" : "var(--color-accent)";
  const youWin = duel && markSelf && verdict.winnerId === selfId;
  const stars = duel ? undefined : roundStars(score.roundScore);
  const celebrate = roundEnd && crowned;
  const confetti = duel ? Boolean(verdict.winnerId) : (stars ?? 0) >= 2;
  const title = duel
    ? winner
      ? `${winner.name} takes ${winUnit}`
      : "Dead heat"
    : headline.charAt(0) + headline.slice(1).toLowerCase();
  const leader = verdict.rows.find((r) => r.id === verdict.leaderId);
  const sub = duel
    ? leader
      ? `${leader.name} leads by ${verdict.lead.toLocaleString()}`
      : "Level on points"
    : Number.isFinite(score.distanceKm)
      ? `${formatMiss(score)} away`
      : "No pin this time";

  return (
    <div
      className={cn(
        "round-splash",
        `is-${stage}`,
        reduced && "is-reduced",
        celebrate && confetti && "has-win",
      )}
      role="status"
      aria-live="polite"
      aria-label={`${roundLabel}. ${title}. ${sub}.`}
      onClick={skip}
    >
      {celebrate && !reduced && (
        <WinFx
          color={duel && !verdict.winnerId ? "var(--color-muted)" : winColour}
          confetti={confetti}
        />
      )}
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
                  crown={roundEnd}
                  reduced={reduced}
                />
              );
            })}
            <span className="splash-vs" aria-hidden>
              vs
            </span>
          </div>
        ) : (
          <SoloPoints points={score.roundScore} burst={crowned && youWon && !reduced} />
        )}
        {celebrate ? (
          <div className="splash-headline" aria-hidden>
            {duel && winner ? (
              <WinBanner
                big={youWin ? "You" : winner.name}
                label={`${youWin ? "win" : "wins"} round ${roundNumber}`}
                color={winColour}
              />
            ) : duel ? (
              <WinBanner
                big="Dead heat"
                label={`round ${roundNumber}`}
                color="var(--color-fg)"
                draw
              />
            ) : (
              <WinBanner
                big={title}
                label={`round ${roundNumber} complete`}
                color={winColour}
                stars={stars}
              />
            )}
          </div>
        ) : (
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
        )}
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
  crown,
  reduced,
}: {
  side: "left" | "right";
  name: string;
  avatarId: string;
  points: number;
  you: boolean;
  winner: boolean;
  loser: boolean;
  /** This question ends a round: the winner gets a crown, not a trophy. */
  crown: boolean;
  reduced: boolean;
}) {
  const shown = useCountUp(points, T_COUNT, false, 0, T_IN);
  return (
    <div className={cn("splash-player", `is-${side}`, winner && "is-winner", loser && "is-loser")}>
      <div className="splash-avatar">
        <PlayerAvatar
          id={avatarId}
          size={76}
          live
          mood={winner ? "happy" : loser ? "sad" : "focus"}
        />
        {winner && crown && <CrownDrop />}
        {winner && !crown && (
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

function SoloPoints({ points, burst }: { points: number; burst: boolean }) {
  // Numbers still roll with reduced motion: counting is not movement.
  const shown = useCountUp(points, T_COUNT, false, 0, T_IN);
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
