import { CLOCK_TIERS, ROUND_MAX, clockTier } from "@/lib/game";
import { cn } from "@/lib/utils";

/**
 * The points a perfect guess would still earn, stepping down with the clock
 * in five tiers (timer.ts): 5,000, 4,500, 4,000, 3,500, 3,000. Drawn as a
 * ledger strip: the pot, then one cell per tier. Spent tiers go dark, the
 * live one drains toward the next step, and the strip names the next drop.
 */
export function PointsPot({
  remaining,
  duration,
  lockedAt,
  running,
}: {
  /** Whole seconds left on the clock. */
  remaining: number;
  duration: number;
  /** Seconds that were left when you locked: the pot freezes there. */
  lockedAt?: number;
  running: boolean;
}) {
  const d = Math.max(1, duration);
  const locked = lockedAt != null;
  const at = lockedAt ?? remaining;
  const tier = clockTier(at, d);
  const pot = Math.round(ROUND_MAX * CLOCK_TIERS[tier]);
  const last = tier === CLOCK_TIERS.length - 1;
  const slice = d / CLOCK_TIERS.length;
  // Seconds left in this tier, and the share of it still to run.
  const left = Math.max(0, at - (d - (tier + 1) * slice));
  const drain = Math.max(0, Math.min(1, left / slice));
  const drop = last ? 0 : Math.round(ROUND_MAX * (CLOCK_TIERS[tier] - CLOCK_TIERS[tier + 1]));
  return (
    <div className={cn("pot", locked && "is-locked", last && "is-floor")}>
      <span className="pot-figure">
        {/* Re-keyed on each step, so the new figure clicks into place. */}
        <span key={pot} className="pot-value">
          {pot.toLocaleString("en-US")}
        </span>
        <span className="pot-unit">PTS</span>
      </span>
      <span className="pot-tiers" aria-hidden>
        {CLOCK_TIERS.map((_, i) => (
          <i
            key={i}
            className={i < tier ? "is-spent" : i === tier ? "is-live" : "is-next"}
            style={i === tier ? ({ "--drain": drain } as React.CSSProperties) : undefined}
          />
        ))}
      </span>
      <span className="pot-next" aria-hidden>
        {locked ? "LOCKED" : last ? "FLOOR" : `−${drop} · ${Math.ceil(left)}S`}
      </span>
      {/* Spoken once per step, not every second. */}
      <span className="sr-only" aria-live="polite">
        {running && !locked ? `${pot.toLocaleString("en-US")} points on offer` : ""}
      </span>
    </div>
  );
}
