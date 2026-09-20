import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatDistance, getLocation, type MatchState } from "@/lib/game";
import { PlayerAvatar } from "./player-avatar";
import { cn } from "@/lib/utils";

export function FinalResults({
  state,
  selfId,
  onRematch,
  onHome,
}: {
  state: MatchState;
  selfId: string;
  onRematch: () => void;
  onHome: () => void;
}) {
  const navigate = useNavigate();
  const you = state.players.find((p) => p.id === selfId);
  const other = state.players.find((p) => p.id !== selfId);
  const shared = state.winnerIds.length > 1;
  const youWin = state.winnerIds.includes(selfId);
  const delta = you && other ? Math.abs(you.totalScore - other.totalScore) : 0;
  const closest = state.roundHistory
    .map((r) => r.guesses[selfId]?.score.distanceKm)
    .filter((d) => Number.isFinite(d)) as number[];
  const fastest = state.roundHistory
    .map((r) => r.guesses[selfId]?.score)
    .filter((s) => s && s.distanceKm <= 5)
    .map((s) => s!.responseMs);
  const avgResponse =
    you && state.roundHistory.length
      ? you.totalResponseMs / state.roundHistory.length / 1000
      : 0;
  const headline = shared ? "Draw" : state.mode === "solo" || youWin ? you?.name : other?.name;
  const kicker = shared
    ? "Shared victory"
    : state.mode === "solo"
      ? "Match complete"
      : youWin
        ? "Champion"
        : "Runner up";

  return (
    <main className="min-h-dvh bg-bg px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-lg flex-col justify-center">
        <p className="atlas-rise text-xs uppercase tracking-[0.28em] text-muted">{kicker}</p>
        <div className="atlas-rise atlas-rise-1 mt-3 flex items-center gap-3">
          <PlayerAvatar id={you?.avatarId} size={56} />
          <h1 className="font-display text-5xl leading-none tracking-tight sm:text-6xl">
            {headline}
          </h1>
        </div>
        <p className="atlas-rise atlas-rise-2 mt-6 font-display text-6xl tabular">
          {(you?.totalScore ?? 0).toLocaleString()}
        </p>
        {other && (
          <p className="mt-2 flex items-center gap-2 text-muted">
            <PlayerAvatar id={other.avatarId} size={28} />
            {other.name} {other.totalScore.toLocaleString()}
            {delta > 0 && !shared ? ` · ${delta.toLocaleString()} point margin` : ""}
          </p>
        )}
        <ol className="atlas-rise atlas-rise-3 mt-8 space-y-5">
          {[0, 1, 2, 3].map((round) => {
            const rows = state.roundHistory.filter((r) => Math.floor(r.index / 10) === round);
            if (!rows.length) return null;
            return (
              <li key={round}>
                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-subtle">
                  Round {round + 1}
                  {round === 3 ? " · 3D" : ""}
                </p>
                <ol className="space-y-1.5">
                  {rows.map((r) => {
                    const g = r.guesses[selfId];
                    const loc = getLocation(r.locationId);
                    return (
                      <div
                        key={r.index}
                        className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-fg">
                            {loc?.title ?? `Q${r.index + 1}`}
                            {r.isRound4 ? " · 3D" : ""}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                            <span
                              className={cn(
                                "inline-block size-1.5 rounded-full",
                                loc?.country === "NL" ? "bg-nl" : "bg-za",
                              )}
                            />
                            {loc?.city ?? (loc?.country === "NL" ? "Netherlands" : "South Africa")}
                          </span>
                        </span>
                        <span className="shrink-0 tabular text-xs sm:text-sm">
                          {g ? `${g.score.roundScore.toLocaleString()} · ${formatDistance(g.score.distanceKm)}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ol>
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-[var(--radius-md)] border border-border p-3">
            <dt className="text-subtle">Closest guess</dt>
            <dd className="mt-1 font-display text-xl tabular">
              {closest.length ? formatDistance(Math.min(...closest)) : "—"}
            </dd>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border p-3">
            <dt className="text-subtle">Avg. response</dt>
            <dd className="mt-1 font-display text-xl tabular">{avgResponse.toFixed(1)}s</dd>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border p-3">
            <dt className="text-subtle">Total distance</dt>
            <dd className="mt-1 font-display text-xl tabular">{formatDistance(you?.totalDistanceKm ?? 0)}</dd>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border p-3">
            <dt className="text-subtle">Fast accurate</dt>
            <dd className="mt-1 font-display text-xl tabular">
              {fastest.length ? `${(Math.min(...fastest) / 1000).toFixed(1)}s` : "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button className="flex-1" onClick={onRematch}>
            Rematch
          </Button>
          {state.mode === "duel" && (
            <Button variant="secondary" className="flex-1" onClick={() => void navigate({ to: "/duel" })}>
              New opponent
            </Button>
          )}
          <Button variant="secondary" className="flex-1" onClick={onHome}>
            Home
          </Button>
        </div>
      </div>
    </main>
  );
}
