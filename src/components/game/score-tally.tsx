import { START_HEALTH, type PlayerState } from "@/lib/game";
import { PlayerAvatar, type AvatarMood } from "./player-avatar";
import { cn } from "@/lib/utils";
import { useMono } from "@/lib/theme";

export function ScoreTally({
  players,
  selfId,
  roundLive,
  urgent,
  winnerIds,
  health = false,
}: {
  /** A health duel: each row shows health left and a bar that drains. */
  health?: boolean;
  players: PlayerState[];
  selfId?: string;
  /** A question is being played: rivals think, locked players smile. */
  roundLive?: boolean;
  urgent?: boolean;
  /** Match over: winners beam, the rest sulk. */
  winnerIds?: string[];
}) {
  const mono = useMono();
  const moodFor = (p: PlayerState): AvatarMood => {
    if (winnerIds?.length) return winnerIds.includes(p.id) ? "happy" : "sad";
    if (!roundLive) return "neutral";
    if (p.locked) return "happy";
    if (urgent) return "surprised";
    return p.id === selfId ? "focus" : "thinking";
  };
  if (players.length < 2) return null;
  const ordered = [...players].sort((a, b) => {
    if (a.id === selfId) return -1;
    if (b.id === selfId) return 1;
    return 0;
  });
  const value = (p: PlayerState) => (health ? (p.health ?? START_HEALTH) : p.totalScore);
  const lead = Math.max(...ordered.map(value));
  const tied = ordered.every((p) => value(p) === lead);

  return (
    <div
      className={cn("score-tally min-w-[10.5rem] rounded-[var(--radius-md)] border border-border px-2.5 py-2", mono ? "bg-bg" : "bg-bg/75")}
      role="list"
      aria-label={health ? "Health" : "Score tally"}
    >
      {ordered.map((p) => {
        const leading = !tied && value(p) === lead;
        const share = health ? Math.max(0, Math.min(1, (p.health ?? START_HEALTH) / START_HEALTH)) : 0;
        return (
          <div
            key={p.id}
            role="listitem"
            className="flex items-center gap-2 py-1 first:pt-0 last:pb-0"
          >
            <PlayerAvatar id={p.avatarId} size={28} title={p.name} mood={moodFor(p)} />
            <div className="min-w-0 flex-1">
              {/* Names drop out of the phone HUD (styles.css); bots tell players apart. */}
              <div className="tally-name-line flex items-center gap-1.5">
                <span className="truncate text-xs text-fg">{p.name}</span>
                {p.locked && !winnerIds?.length ? (
                  <span className="text-[10px] uppercase tracking-wider text-subtle">in</span>
                ) : null}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span
                  // Re-keyed on each hit, so the number shakes when it drops.
                  key={health ? value(p) : undefined}
                  className={cn(
                    "font-display tabular text-base leading-none",
                    leading ? "text-fg" : "text-muted",
                    health && share < 1 && "tally-hit",
                  )}
                >
                  {value(p).toLocaleString()}
                </span>
                {health && <span className="sr-only">health</span>}
                {p.locked && !winnerIds?.length ? (
                  <span className="tally-in-dot" role="img" aria-label="locked in" />
                ) : null}
              </div>
              {health && (
                <span
                  className={cn("tally-health", share <= 0.25 && "is-low")}
                  style={{ "--hp": share } as React.CSSProperties}
                  aria-hidden
                >
                  <i />
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
