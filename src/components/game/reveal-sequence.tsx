import {
  ACCURACY_MAX,
  BADGE_COPY,
  feedbackHeadline,
  formatMiss,
  type PlayerState,
  type RoundScore,
} from "@/lib/game";
import { Check, Flame, Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoundVerdictCard } from "./round-verdict";
import { useCountUp } from "./use-count-up";
import { cn } from "@/lib/utils";
import { useMono } from "@/lib/theme";

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
  markSelf,
  streak = 0,
  ruleNote,
}: {
  /**
   * A line from the match's rule: a health duel's damage, or a streak's
   * verdict. "hit" and "miss" are bad news, "keep" good news.
   */
  ruleNote?: { text: string; tone: "hit" | "keep" | "miss" | "even" };
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
  markSelf?: boolean;
  /** Good guesses in a row, this one included; a flame shows from two. */
  streak?: number;
}) {
  const mono = useMono();
  const hasPin = Number.isFinite(score.distanceKm);
  const headline = !hasPin
    ? "TIME’S UP"
    : timedOut
      ? `${feedbackHeadline(score)} · TIMED OUT`
      : feedbackHeadline(score);
  const shownKm = useCountUp(hasPin ? score.distanceKm : 0, 900, Boolean(reducedMotion));
  const shownRound = useCountUp(score.roundScore, 900, Boolean(reducedMotion));
  // Scores from before the clock tiers carry no factor: read it off the totals.
  const clock =
    score.clockFactor ?? (score.accuracyPoints > 0 ? score.roundScore / score.accuracyPoints : 1);
  const tierPot = Math.round(ACCURACY_MAX * clock);
  return (
    <div
      className={cn(
        "reveal-dock pointer-events-none absolute inset-x-0 z-40 flex flex-col items-center px-3",
        expanded
          ? "top-[max(4.75rem,env(safe-area-inset-top))]"
          : "bottom-[calc(var(--atlas-map-reveal-h)+1.5rem)]",
      )}
    >
      <div className={cn("reveal-card atlas-rise pointer-events-auto max-h-[calc(100dvh-var(--atlas-map-reveal-h)-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-[var(--radius-lg)] border border-border p-3 shadow-[var(--shadow-panel)] sm:p-4", mono ? "bg-bg" : "bg-bg/92")}>
        {/* Very short screens (iPhone SE): Continue sits beside the title, not under it. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between [@media(max-height:700px)]:flex-row [@media(max-height:700px)]:items-start [@media(max-height:700px)]:justify-between">
          <div className="min-w-0 text-left">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{roundLabel}</p>
            <p className="reveal-pop font-display mt-0.5 flex flex-wrap items-center gap-x-2 text-xl tracking-tight sm:text-2xl">
              {headline}
              {streak >= 2 && (
                <span className="streak-badge">
                  <Flame aria-hidden className="size-3.5" />
                  {streak} in a row
                </span>
              )}
            </p>
            {/* The country is the answer: it never truncates; the city gives way first. */}
            <p className="mt-0.5 truncate text-sm text-fg">{locationTitle}</p>
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
              {city ? (
                <>
                  <span className="truncate">{city}</span>
                  <span aria-hidden>·</span>
                </>
              ) : null}
              <span className="shrink-0 font-medium text-fg">{country}</span>
            </p>
          </div>
          <Button
            className="w-full sm:w-auto sm:shrink-0 [@media(max-height:700px)]:w-auto [@media(max-height:700px)]:shrink-0"
            onClick={onContinue}
          >
            {lastRound ? "See results" : "Continue"}
          </Button>
        </div>
        {/* The ledger drops under the distance when a phone has no room for both. */}
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <p className="font-display whitespace-nowrap text-3xl tabular tracking-tight max-[380px]:text-[26px] sm:text-4xl">
            {hasPin ? formatMiss(score, shownKm) : "No pin"}
          </p>
          {/* A ledger: distance score × the clock's tier = the round. */}
          <div className="ledger">
            <Stat label="Distance" value={score.accuracyPoints.toLocaleString("en-US")} />
            <Stat label="Clock" value={`×${clock.toFixed(1)}`} />
            <Stat label="Round" value={Math.round(shownRound).toLocaleString("en-US")} highlight points />
          </div>
        </div>
        {hasPin && clock < 1 ? (
          // In a duel on a phone the rows below say enough; room goes to them.
          <p className={cn("ledger-note", opponent && "max-sm:hidden")}>
            Locked in the {mono ? `"${tierPot.toLocaleString("en-US")}"` : tierPot.toLocaleString("en-US")}{" "}
            tier: the clock kept{" "}
            {Math.round(clock * 100)}% of your {score.accuracyPoints.toLocaleString("en-US")}.
          </p>
        ) : null}
        {ruleNote && (
          <p className={cn("reveal-rule", `is-${ruleNote.tone}`)} role="status">
            {ruleNote.tone === "keep" ? (
              <Check className="size-4" aria-hidden />
            ) : ruleNote.tone === "miss" ? (
              <X className="size-4" aria-hidden />
            ) : (
              <Heart className="size-4" aria-hidden />
            )}
            {ruleNote.text}
          </p>
        )}
        {score.multiplier > 1 && (
          <p className="mt-2 text-left text-xs text-muted">
            Includes {score.multiplier}× reconstruction multiplier
          </p>
        )}
        {score.badges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {score.badges.map((b) => (
              <span
                key={b}
                className={cn(
                  "border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                  !mono && "rounded-full",
                )}
              >
                {BADGE_COPY[b]}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3">
          <RoundVerdictCard
            players={opponent ? [you, opponent] : [you]}
            selfId={you.id}
            markSelf={markSelf}
            reducedMotion={reducedMotion}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  points,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  /** Where the round's points fly up to the header score from. */
  points?: boolean;
}) {
  return (
    <div className={cn("ledger-cell", highlight && "is-total")} data-round-points={points || undefined}>
      <div className="ledger-label">{label}</div>
      <div className="ledger-value">{value}</div>
    </div>
  );
}
