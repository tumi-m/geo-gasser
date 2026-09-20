import { formatClock } from "@/lib/game";
import { cn } from "@/lib/utils";

export function TimerRing({
  remaining,
  duration = 45,
  urgent = false,
  locked = false,
}: {
  remaining: number;
  duration?: number;
  urgent?: boolean;
  locked?: boolean;
}) {
  const t = Math.max(0, Math.min(1, remaining / duration));
  const r = 18;
  const c = 2 * Math.PI * r;
  const label = locked ? "Guess locked" : `${Math.ceil(remaining)} seconds remaining`;
  return (
    <div className="flex items-center gap-3" role="timer" aria-live="off" aria-label={label}>
      <svg viewBox="0 0 44 44" className="size-11 -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" className="text-border" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="currentColor"
          className={urgent && !locked ? "text-danger" : "text-accent"}
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - t)}
          strokeLinecap="round"
        />
      </svg>
      <span
        className={cn(
          "font-display tabular text-3xl leading-none tracking-tight",
          urgent && !locked && "text-danger",
          locked && "text-muted",
        )}
      >
        {formatClock(remaining)}
      </span>
    </div>
  );
}

export function RoundPips({ index, total = 4 }: { index: number; total?: number }) {
  return (
    <div className="flex gap-1" aria-label={`Round ${index + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-5 rounded-full",
            i < index ? "bg-accent" : i === index ? "bg-fg" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}
