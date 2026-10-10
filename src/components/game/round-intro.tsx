import { Clock, Globe2, Sparkles, Telescope } from "lucide-react";
import { WordRise } from "@/components/motion/motion";
import { DotGlobe } from "@/components/motion/dot-globe";
import { globeForAtlas } from "@/components/motion/globe-presets";
import type { AtlasSpec } from "@/lib/game";
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
  waiting,
  reducedMotion,
  onStart,
  atlas,
  cosmos,
}: {
  /** A cosmos-round question: the card opens onto the Solar System. */
  cosmos?: boolean;
  /** Turns the globe behind the card toward the atlas being played. */
  atlas?: AtlasSpec;
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
      {cosmos ? (
        <Orrery reducedMotion={reducedMotion} />
      ) : (
        <>
          <GridBackdrop />
          <DotGlobe
            className="round-intro-globe"
            reducedMotion={reducedMotion}
            {...globeForAtlas(atlas)}
          />
        </>
      )}
      <div className="round-intro-inner">
        <div className="round-intro-emblem" aria-hidden>
          <Compass />
          <span className="round-intro-number">
            <span>{bigNumber}</span>
          </span>
        </div>
        <p className="round-intro-kicker">{kicker}</p>
        <h1 className="font-display round-intro-title">
          <WordRise text={cosmos ? "Find it in the universe" : "Locate this"} delay={260} step={90} />
        </h1>
        <ul className="round-intro-chips">
          <li style={{ "--i": 0 } as React.CSSProperties}>
            <Clock size={13} /> {note ?? `${seconds}s on the clock`}
          </li>
          <li style={{ "--i": 1 } as React.CSSProperties}>
            {cosmos ? (
              <>
                <Telescope size={13} /> Cosmos round · distance from the Sun
              </>
            ) : (
              <>
                <Globe2 size={13} /> {atlasLabel}
              </>
            )}
          </li>
          {wildcard && (
            <li className="is-accent" style={{ "--i": 2 } as React.CSSProperties}>
              <Sparkles size={13} /> World wildcard
            </li>
          )}
        </ul>
        <p className="round-intro-hint">
          {waiting ? "Getting the place ready… or tap to start now" : "Tap or press Enter to start"}
        </p>
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

/**
 * The Solar System as an orrery behind the card: eight planets on tilted
 * orbits, inner ones fast and outer ones slow, a ring around the sixth, and a
 * field of stars beyond.
 */
function Orrery({ reducedMotion }: { reducedMotion?: boolean }) {
  const planets = [
    { r: 46, s: 2.2, c: "#b9b2aa", d: 4 },
    { r: 66, s: 3.4, c: "#ecd6a0", d: 7 },
    { r: 88, s: 3.6, c: "#5aa0e0", d: 10 },
    { r: 108, s: 2.8, c: "#d77a48", d: 15 },
    { r: 150, s: 8, c: "#d8b88e", d: 26 },
    { r: 196, s: 6.8, c: "#e2cf9e", d: 38, ring: true },
    { r: 238, s: 5, c: "#9fd0d6", d: 52 },
    { r: 276, s: 5, c: "#4677e0", d: 66 },
  ];
  const stars = Array.from({ length: 70 }, (_, i) => ({
    x: ((i * 7919) % 1000) / 1000,
    y: ((i * 104729) % 1000) / 1000,
    r: 0.6 + ((i * 31) % 10) / 10,
  }));
  return (
    <svg className="round-intro-orrery" viewBox="-400 -300 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="orrery-sun">
          <stop offset="0" stopColor="#fff6d8" />
          <stop offset="0.35" stopColor="#ffc35a" />
          <stop offset="1" stopColor="#ff8a2a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {stars.map((st, i) => (
        <circle key={i} cx={st.x * 800 - 400} cy={st.y * 600 - 300} r={st.r} className="orrery-star" style={{ animationDelay: `${(i % 9) * 0.4}s` }} />
      ))}
      <g transform="rotate(-14)">
        <circle r="34" fill="url(#orrery-sun)" />
        <circle r="11" fill="#fff1c8" />
        {planets.map((p, i) => (
          <g key={i}>
            <ellipse rx={p.r} ry={p.r * 0.36} className="orrery-orbit" />
            <g transform={`scale(1 0.36)`}>
              <g transform={`rotate(${i * 47})`}>
                {!reducedMotion && (
                  <animateTransform attributeName="transform" type="rotate" from={`${i * 47}`} to={`${i * 47 + 360}`} dur={`${p.d}s`} repeatCount="indefinite" />
                )}
                <g transform={`translate(${p.r} 0) scale(1 2.78)`}>
                  <circle r={p.s} fill={p.c} />
                  {p.ring && <ellipse rx={p.s * 2.1} ry={p.s * 0.55} className="orrery-ring" />}
                </g>
              </g>
            </g>
          </g>
        ))}
      </g>
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
