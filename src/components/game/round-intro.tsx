import { Clock, Globe2, Sparkles, Telescope } from "lucide-react";
import { WordRise } from "@/components/motion/motion";
import { cn } from "@/lib/utils";

/**
 * The title slate before each round: the round number large, the brief in
 * ruled cells, and a hairline bar that fills for as long as the slate will
 * hold before the round starts on its own. Tap or Enter starts it at once.
 */
export function RoundIntro({
  round,
  totalRounds,
  question,
  questionsInRound,
  atlasLabel,
  seconds,
  wildcard,
  note,
  holdMs,
  waiting,
  reducedMotion,
  onStart,
  cosmos,
}: {
  /** A cosmos-round question: the card opens onto the Solar System. */
  cosmos?: boolean;
  round: number;
  totalRounds: number;
  /** Set for multi-question rounds: which question is next. */
  question?: number;
  questionsInRound?: number;
  atlasLabel: string;
  seconds: number;
  wildcard?: boolean;
  /** Replaces the timing line, e.g. for reconstruction rounds. */
  note?: string;
  holdMs: number;
  /** The scene behind the card is still loading; the clock waits for it. */
  waiting?: boolean;
  reducedMotion?: boolean;
  onStart: () => void;
}) {
  const bigNumber = question ?? round;
  const kicker = question
    ? `Round ${round} · question ${question} of ${questionsInRound}`
    : `Round ${round} of ${totalRounds}`;
  return (
    <div
      className={cn("round-intro", cosmos && "is-cosmos", reducedMotion && "is-reduced")}
      onClick={onStart}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onStart();
      }}
      role="button"
      tabIndex={0}
      aria-label={`${kicker}. Start round`}
      style={{ "--hold": `${holdMs}ms` } as React.CSSProperties}
    >
      <div className="round-intro-inner">
        <p className="round-intro-kicker">{kicker}</p>
        <span className="round-intro-number" aria-hidden>
          {String(bigNumber).padStart(2, "0")}
        </span>
        <h1 className="round-intro-title quoted">
          <WordRise text={cosmos ? "Find it in the universe." : "Locate this."} delay={120} step={40} />
        </h1>
        <ul className="round-intro-chips">
          <li>
            <Clock size={13} aria-hidden /> {note ?? `${seconds}s on the clock`}
          </li>
          <li>
            {cosmos ? (
              <>
                <Telescope size={13} aria-hidden /> Cosmos round · distance from the Sun
              </>
            ) : (
              <>
                <Globe2 size={13} aria-hidden /> {atlasLabel}
              </>
            )}
          </li>
          {wildcard && (
            <li className="is-accent">
              <Sparkles size={13} aria-hidden /> World wildcard
            </li>
          )}
        </ul>
        {/* Fills for the length of the hold: when it closes, the round starts. */}
        <span className="intro-hold" aria-hidden>
          <i />
        </span>
        <p className="round-intro-hint">
          {waiting ? "Getting the place ready… or tap to start now" : "Tap or press Enter to start"}
        </p>
      </div>
    </div>
  );
}
