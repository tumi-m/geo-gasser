import { cn } from "@/lib/utils";

/**
 * The end of a round, marked like a camera shutter. Behind the splash: one
 * white frame, then a hairline grid draws itself across the scene in the
 * winner's colour (`WinFx`; orange for you, white for your rival). In front:
 * the winner's name lands in a hard type slam over "wins round 2"
 * (`WinBanner`), and solo rounds stamp up to three stars. Reduced motion keeps
 * the words and stars and drops the shutter and the grid.
 */

const LINES = 7;

export function WinFx({ color, grid }: { color: string; grid: boolean }) {
  const at = (i: number) => `${((i + 1) * 100) / (LINES + 1)}%`;
  return (
    <div className="win-fx" aria-hidden style={{ "--win": color } as React.CSSProperties}>
      <i className="win-shutter" />
      {grid && (
        <span className="win-grid">
          {Array.from({ length: LINES }, (_, i) => (
            <i key={`h${i}`} className="is-h" style={{ "--i": i, "--at": at(i) } as React.CSSProperties} />
          ))}
          {Array.from({ length: LINES }, (_, i) => (
            <i key={`v${i}`} className="is-v" style={{ "--i": i, "--at": at(i) } as React.CSSProperties} />
          ))}
        </span>
      )}
    </div>
  );
}

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
