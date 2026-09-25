import { Clock, Globe2, Sparkles } from "lucide-react";
import { WordRise } from "@/components/motion/motion";
import { cn } from "@/lib/utils";

/**
 * The title card before each round: a compass draws itself and its needle
 * swings to north, the round number rolls up, the brief rises in, and a ring
 * around the compass fills for as long as the card will hold before the round
 * starts on its own. Tap or Enter starts it at once.
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
  reducedMotion,
  onStart,
}: {
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
  reducedMotion?: boolean;
  onStart: () => void;
}) {
  const bigNumber = question ?? round;
  const kicker = question
    ? `Round ${round} · question ${question} of ${questionsInRound}`
    : `Round ${round} of ${totalRounds}`;
  return (
    <div
      className={cn("round-intro", reducedMotion && "is-reduced")}
      onClick={onStart}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onStart();
      }}
      role="button"
      tabIndex={0}
      aria-label={`${kicker}. Start round`}
      style={{ "--hold": `${holdMs}ms` } as React.CSSProperties}
    >
      <GridBackdrop />
      <div className="round-intro-inner">
        <div className="round-intro-emblem" aria-hidden>
          <Compass />
          <span className="round-intro-number">
            <span>{bigNumber}</span>
          </span>
        </div>
        <p className="round-intro-kicker">{kicker}</p>
        <h1 className="font-display round-intro-title">
          <WordRise text="Locate this" delay={260} step={90} />
        </h1>
        <ul className="round-intro-chips">
          <li style={{ "--i": 0 } as React.CSSProperties}>
            <Clock size={13} /> {note ?? `${seconds}s on the clock`}
          </li>
          <li style={{ "--i": 1 } as React.CSSProperties}>
            <Globe2 size={13} /> {atlasLabel}
          </li>
          {wildcard && (
            <li className="is-accent" style={{ "--i": 2 } as React.CSSProperties}>
              <Sparkles size={13} /> World wildcard
            </li>
          )}
        </ul>
        <p className="round-intro-hint">Tap or press Enter to start</p>
      </div>
    </div>
  );
}

/** Compass rose: ring and ticks draw in, the needle swings and settles. */
function Compass() {
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg viewBox="-60 -60 120 120" className="round-intro-compass">
      {/* Fills for the length of the hold: when it closes, the round starts. */}
      <circle className="compass-hold" r="56" pathLength={1} />
      <circle className="compass-ring" r="46" pathLength={1} />
      {ticks.map((deg, i) => (
        <line
          key={deg}
          className={cn("compass-tick", deg % 90 === 0 && "is-cardinal")}
          x1="0"
          y1={-46}
          x2="0"
          y2={deg % 90 === 0 ? -36 : -41}
          transform={`rotate(${deg})`}
          style={{ animationDelay: `${120 + i * 18}ms` }}
        />
      ))}
      <g className="compass-needle">
        <path d="M0 -30 L6 0 L0 5 L-6 0 Z" className="is-north" />
        <path d="M0 30 L6 0 L0 -5 L-6 0 Z" className="is-south" />
      </g>
      <circle r="3" className="compass-hub" />
    </svg>
  );
}

/** Faint latitude and longitude lines drifting behind the card. */
function GridBackdrop() {
  return (
    <svg
      className="round-intro-grid"
      viewBox="0 0 800 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {Array.from({ length: 9 }, (_, i) => (
        <ellipse key={`m${i}`} cx="400" cy="400" rx={40 + i * 45} ry="380" />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <line key={`p${i}`} x1="0" x2="800" y1={80 + i * 80} y2={80 + i * 80} />
      ))}
    </svg>
  );
}
