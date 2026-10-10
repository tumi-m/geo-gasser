import { formatClock } from "@/lib/game";
import { cn } from "@/lib/utils";

export function TimerRing({
  remaining,
  duration = 45,
  urgent = false,
  locked = false,
  running = false,
}: {
  remaining: number;
  duration?: number;
  urgent?: boolean;
  locked?: boolean;
  /** The clock is ticking: the ring leads toward the next second. */
  running?: boolean;
}) {
  // `remaining` steps once a second; aim the ring at where it will be at the
  // next step and let a 1s linear transition carry it there, so it sweeps
  // smoothly without re-rendering every frame.
  const t = Math.max(0, Math.min(1, (running && !locked ? remaining - 1 : remaining) / duration));
  const r = 18;
  const c = 2 * Math.PI * r;
  const label = locked ? "Guess locked" : `${Math.ceil(remaining)} seconds remaining`;
  // The clock itself stays quiet for screen readers; two warnings are spoken.
  const left = Math.ceil(remaining);
  const warning =
    running && !locked && left > 0 && left <= 10 ? (left <= 5 ? "5 seconds left" : "10 seconds left") : "";
  return (
    <div className="flex items-center gap-3" role="timer" aria-live="off" aria-label={label}>
      <span className="sr-only" aria-live="assertive">
        {warning}
      </span>
      <svg
        viewBox="0 0 44 44"
        className={cn("size-11 -rotate-90", urgent && !locked && "timer-urgent")}
        aria-hidden="true"
      >
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-border"
          strokeWidth="3"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="currentColor"
          className={cn("timer-progress", urgent && !locked ? "text-danger" : "text-accent")}
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - t)}
          strokeLinecap="round"
        />
      </svg>
      <span
        // Re-keyed each second while urgent, so the heartbeat replays per tick.
        key={urgent && !locked ? Math.ceil(remaining) : "calm"}
        className={cn(
          "font-display tabular text-3xl leading-none tracking-tight",
          urgent && !locked && "text-danger timer-beat",
          locked && "text-muted",
        )}
      >
        {formatClock(remaining)}
      </span>
    </div>
  );
}

/**
 * Where the match stands, as one line of caps metadata: "R 2/4 · Q 3/10", or
 * "STOP 2/5" in an Escape. It replaces a row of round pips and a separate
 * question line, which together cost the photo a row of height on phones.
 */
export function MatchMeta({
  round,
  rounds,
  question,
  questions = 10,
  escape = false,
}: {
  round: number;
  rounds: number;
  question: number;
  questions?: number;
  escape?: boolean;
}) {
  const shown = escape ? `STOP ${round}/${rounds}` : `R ${round}/${rounds} · Q ${question}/${questions}`;
  const spoken = escape
    ? `Stop ${round} of ${rounds}`
    : `Round ${round} of ${rounds}, question ${question} of ${questions}`;
  return (
    // aria-label is not read on a paragraph; the spoken form sits beside the
    // visible shorthand instead.
    <p className="hud-meta">
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{spoken}</span>
    </p>
  );
}
