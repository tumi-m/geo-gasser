import { BADGE_COPY, FEEDBACK_COPY, formatDistance, type PlayerState, type RoundScore } from "@/lib/game";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-40 flex flex-col items-center px-3",
        expanded ? "top-[max(4.75rem,env(safe-area-inset-top))]" : "bottom-[calc(46vh+0.75rem)]",
      )}
    >
      <div className="atlas-rise pointer-events-auto w-full max-w-lg rounded-[var(--radius-lg)] border border-border bg-bg/92 p-3 shadow-[var(--shadow-panel)] sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 text-left">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{roundLabel}</p>
            <p className="font-display mt-0.5 text-xl tracking-tight sm:text-2xl">{FEEDBACK_COPY[score.feedback]}</p>
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
            {Number.isFinite(score.distanceKm) ? formatDistance(score.distanceKm) : "No pin"}
          </p>
          <div className="flex gap-4 text-right text-[11px] uppercase tracking-wider text-muted">
            <Stat label="Acc" value={score.accuracyPoints.toLocaleString()} />
            <Stat label="Time" value={score.timePoints.toLocaleString()} />
            <Stat label="Round" value={score.roundScore.toLocaleString()} highlight />
          </div>
        </div>
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
          <div className="mt-3 grid grid-cols-2 gap-2 text-left text-sm">
            <PlayerChip name={you.name} score={you.totalScore} you />
            <PlayerChip name={opponent.name} score={opponent.totalScore} />
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

function PlayerChip({ name, score, you }: { name: string; score: number; you?: boolean }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-border px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-subtle">{you ? "You" : "Opponent"}</div>
      <div className="truncate">{name}</div>
      <div className="font-display tabular">{score.toLocaleString()}</div>
    </div>
  );
}
