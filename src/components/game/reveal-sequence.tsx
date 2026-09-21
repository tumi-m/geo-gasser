import { useEffect, useState } from "react";
import { BADGE_COPY, FEEDBACK_COPY, formatDistance, type PlayerState, type RoundScore } from "@/lib/game";
import { Button } from "@/components/ui/button";
import { ScoreTally } from "./score-tally";
import { cn } from "@/lib/utils";

/** Counts a number up from 0 over `ms`, eased; instant when motion is reduced. */
function useCountUp(target: number, ms: number, reduced: boolean) {
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced || !Number.isFinite(target)) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced]);
  return value;
}

export function RevealOverlay({
  score,
  you,
  opponent,
  locationTitle,
  city,
  country,
  onContinue,
  roundLabel,
  lastRound,
  expanded,
  timedOut,
  reducedMotion,
}: {
  score: RoundScore;
  you: PlayerState;
  opponent?: PlayerState;
  locationTitle: string;
  city?: string;
  country: string;
  onContinue: () => void;
  roundLabel: string;
  lastRound?: boolean;
  expanded?: boolean;
  timedOut?: boolean;
  reducedMotion?: boolean;
}) {
  const hasPin = Number.isFinite(score.distanceKm);
  const headline = !hasPin ? "TIME’S UP" : timedOut ? `${FEEDBACK_COPY[score.feedback]} · TIMED OUT` : FEEDBACK_COPY[score.feedback];
  const shownKm = useCountUp(hasPin ? score.distanceKm : 0, 900, Boolean(reducedMotion));
  const shownRound = useCountUp(score.roundScore, 900, Boolean(reducedMotion));
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-40 flex flex-col items-center px-3",
        expanded ? "top-[max(4.75rem,env(safe-area-inset-top))]" : "bottom-[calc(var(--atlas-map-reveal-h)+1.5rem)]",
      )}
    >
      <div className="atlas-rise pointer-events-auto max-h-[calc(100dvh-var(--atlas-map-reveal-h)-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-[var(--radius-lg)] border border-border bg-bg/92 p-3 shadow-[var(--shadow-panel)] sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 text-left">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{roundLabel}</p>
            <p className="font-display mt-0.5 text-xl tracking-tight sm:text-2xl">{headline}</p>
            <p className="mt-0.5 truncate text-sm text-muted">
              {locationTitle}
              {city ? ` · ${city}` : ""} · {country}
            </p>
          </div>
          <Button className="w-full sm:w-auto sm:shrink-0" onClick={onContinue}>
            {lastRound ? "See results" : "Continue"}
          </Button>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="font-display text-3xl tabular tracking-tight sm:text-4xl">
            {hasPin ? formatDistance(shownKm) : "No pin"}
          </p>
          <div className="flex gap-4 text-right text-[11px] uppercase tracking-wider text-muted">
            <Stat label="Acc" value={score.accuracyPoints.toLocaleString()} />
            <Stat label="Time" value={score.timePoints.toLocaleString()} />
            <Stat label="Round" value={Math.round(shownRound).toLocaleString()} highlight />
          </div>
        </div>
        {timedOut && hasPin && (
          <p className="mt-2 text-left text-xs text-muted">
            {formatDistance(score.distanceKm)} off · the clock hit zero, so the time bonus is 0.
          </p>
        )}
        {score.multiplier > 1 && (
          <p className="mt-2 text-left text-xs text-muted">Includes {score.multiplier}× reconstruction multiplier</p>
        )}
        {score.badges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {score.badges.map((b) => (
              <span key={b} className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider">
                {BADGE_COPY[b]}
              </span>
            ))}
          </div>
        )}
        {opponent && (
          <div className="mt-3">
            <ScoreTally players={[you, opponent]} selfId={you.id} showRound />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn(highlight && "text-fg")}>
      <div className="text-subtle">{label}</div>
      <div className="mt-0.5 font-display text-base text-fg tabular sm:text-lg">{value}</div>
    </div>
  );
}
