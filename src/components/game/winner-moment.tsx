import { ArrowLeftRight, Flame, Scale, ShieldCheck, Target, Trophy } from "lucide-react";
import { calloutLabel, type Callout } from "@/lib/game";
import { cn } from "@/lib/utils";

/**
 * The end of a round, celebrated. Behind the splash: rays turn, a flash
 * goes off and confetti fires from both lower corners in the winner's
 * colour (`WinFx`). In front: the winner's name slams in over "wins round 2"
 * (`WinBanner`), and solo rounds stamp in up to three stars. Reduced motion
 * keeps the words and stars and drops the rays, flash, shake and confetti.
 */

const CONFETTI = 46;

export function WinFx({ color, confetti }: { color: string; confetti: boolean }) {
  return (
    <div className="win-fx" aria-hidden style={{ "--win": color } as React.CSSProperties}>
      <i className="win-rays" />
      <i className="win-flash" />
      {confetti && (
        <span className="win-confetti">
          {Array.from({ length: CONFETTI }, (_, i) => {
            // Deterministic scatter: the same burst every time, no randomness
            // in render. Even pieces fire from the left, odd from the right.
            const left = i % 2 === 0;
            const spread = 70 + ((i * 53) % 230);
            const up = 220 + ((i * 97) % 300);
            const fall = 300 + ((i * 61) % 280);
            const shape = i % 5 === 0 ? "is-dot" : i % 3 === 0 ? "is-ribbon" : "";
            return (
              <i
                key={i}
                className={cn(left ? "from-left" : "from-right", shape)}
                style={
                  {
                    "--dx": `${(left ? 1 : -1) * spread}px`,
                    "--up": `${-up}px`,
                    "--down": `${fall - up}px`,
                    "--rot": `${((i * 137) % 720) - 360}deg`,
                    "--delay": `${(i % 6) * 35}ms`,
                    "--dur": `${1700 + ((i * 89) % 900)}ms`,
                    background:
                      i % 3 === 1 ? "var(--win)" : CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
                  } as React.CSSProperties
                }
              />
            );
          })}
        </span>
      )}
    </div>
  );
}

const CONFETTI_COLOURS = [
  "var(--color-accent)",
  "#ffffff",
  "var(--color-nl)",
  "var(--color-za)",
  "#8fb4ff",
  "#ffd166",
];

export function WinBanner({
  big,
  label,
  color,
  stars,
  draw = false,
}: {
  /** The winner's name, "You", "Dead heat", or a solo verdict. */
  big: string;
  /** "wins round 2", "round 2 complete" … */
  label: string;
  color: string;
  /** Solo rounds: how many of three stars were earned. */
  stars?: number;
  draw?: boolean;
}) {
  return (
    <div
      className={cn(
        "win-banner",
        draw && "is-draw",
        // Long names and solo verdicts step down so they fit a phone.
        big.length > 10 ? "is-long" : big.length > 6 && "is-mid",
      )}
      aria-hidden
      style={{ "--win": color } as React.CSSProperties}
    >
      <span className="win-big">{big}</span>
      <span className="win-label">{label}</span>
      {stars !== undefined && (
        <span className="win-stars">
          {[0, 1, 2].map((i) => (
            <svg
              key={i}
              viewBox="0 0 24 24"
              className={cn(i < stars && "is-on")}
              style={{ "--i": i } as React.CSSProperties}
            >
              <path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8z" />
            </svg>
          ))}
        </span>
      )}
    </div>
  );
}

/** A crown that drops onto the winner's avatar. */
export function CrownDrop() {
  return (
    <svg className="splash-crown" viewBox="0 0 64 40" aria-hidden>
      <path d="M4 34 L8 10 L22 22 L32 4 L42 22 L56 10 L60 34 Z" />
      <rect x="4" y="33" width="56" height="5" rx="2" />
      <circle cx="8" cy="9" r="3.4" />
      <circle cx="32" cy="4" r="3.6" />
      <circle cx="56" cy="9" r="3.4" />
    </svg>
  );
}

/**
 * Rounds won so far, after a round ends: a trophy flies into the winner's
 * count and the number flips up by one.
 */
export function RoundTally({
  rows,
  winnerId,
}: {
  rows: { id: string; name: string; wins: number }[];
  winnerId?: string;
}) {
  return (
    <div className="round-tally" aria-hidden>
      <span className="round-tally-label">Rounds won</span>
      <span className="round-tally-row">
        {rows.map((row, i) => {
          const won = row.id === winnerId;
          return (
            <span
              key={row.id}
              className={cn("round-tally-side", i === 1 && "is-right", won && "is-winner")}
              style={{ "--side": i === 0 ? "var(--color-accent)" : "var(--color-rival)" } as React.CSSProperties}
            >
              <span className="round-tally-name">{row.name}</span>
              <span className="round-tally-count tabular">
                {won ? (
                  <>
                    <span className="is-was">{row.wins - 1}</span>
                    <span className="is-now">{row.wins}</span>
                  </>
                ) : (
                  row.wins
                )}
              </span>
              {won && (
                <span className="round-tally-trophy">
                  <Trophy size={18} />
                </span>
              )}
            </span>
          );
        })}
      </span>
    </div>
  );
}

const CALLOUT_ICON: Record<Callout["kind"], typeof Flame> = {
  run: Flame,
  "hot-streak": Flame,
  "lead-change": ArrowLeftRight,
  "close-call": Scale,
  perfect: Target,
  shutout: ShieldCheck,
};

/** The round's big moments, stamped in one after the other. */
export function CalloutStamps({ callouts }: { callouts: Callout[] }) {
  if (!callouts.length) return null;
  return (
    <span className="callouts" aria-hidden>
      {callouts.map((callout, i) => {
        const Icon = CALLOUT_ICON[callout.kind];
        return (
          <span
            key={callout.kind}
            className={cn("callout", `is-${callout.kind}`)}
            style={{ "--i": i } as React.CSSProperties}
          >
            <Icon size={14} strokeWidth={2.4} />
            {calloutLabel(callout)}
          </span>
        );
      })}
    </span>
  );
}
