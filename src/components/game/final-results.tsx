import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatDistance, getLocation, locationCountryLabel, type MatchState } from "@/lib/game";
import { MusicHudButton } from "./music-player";
import { Sparks } from "./round-splash";
import { useCountUp } from "./use-count-up";
import { PlayerAvatar } from "./player-avatar";
import { ScoreTally } from "./score-tally";
import { cn } from "@/lib/utils";

export function FinalResults({
  state,
  selfId,
  onRematch,
  onHome,
  reducedMotion,
}: {
  state: MatchState;
  selfId: string;
  onRematch: () => void;
  onHome: () => void;
  reducedMotion?: boolean;
}) {
  const navigate = useNavigate();
  const you = state.players.find((p) => p.id === selfId);
  const other = state.players.find((p) => p.id !== selfId);
  const duel = state.mode === "duel" && Boolean(other);
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
    <main className="result-shell min-h-dvh px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-lg flex-col justify-center">
        <div className="atlas-rise flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.28em] text-muted">{kicker}</p>
          <div className="-my-2">
            <MusicHudButton />
          </div>
        </div>
        <div className="atlas-rise atlas-rise-1 mt-3 flex items-center gap-3">
          <span className="result-burst">
            <PlayerAvatar id={(youWin || state.mode === "solo" ? you : other)?.avatarId} size={56} />
            {!reducedMotion && !shared && <Sparks count={20} spread={130} />}
          </span>
          <h1 className="font-display text-5xl leading-none tracking-tight sm:text-6xl">{headline}</h1>
        </div>
        {duel ? (
          <div className="atlas-rise atlas-rise-2 mt-6">
            <ScoreTally players={state.players} selfId={selfId} />
            {delta > 0 && !shared ? (
              <p className="mt-2 text-sm text-muted">{delta.toLocaleString()} point margin</p>
            ) : null}
          </div>
        ) : (
          <p className="atlas-rise atlas-rise-2 mt-6 result-score tabular">
            <FinalScore value={you?.totalScore ?? 0} reduced={Boolean(reducedMotion)} />
          </p>
        )}
        <ol className="atlas-rise atlas-rise-3 mt-8 space-y-5">
          {duel && other ? (
            <p className="text-xs text-subtle">
              Per question · you then {other.name}
            </p>
          ) : null}
          {Array.from({ length: state.totalRounds || 4 }, (_, round) => {
            const rows = state.roundHistory.filter((r) => (state.matchLength === "escape" ? r.index : Math.floor(r.index / 10)) === round);
            if (!rows.length) return null;
            const roundYou = rows.reduce((n, r) => n + (r.guesses[selfId]?.score.roundScore ?? 0), 0);
            const roundOther = other
              ? rows.reduce((n, r) => n + (r.guesses[other.id]?.score.roundScore ?? 0), 0)
              : 0;
            return (
              <li key={round}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Round {round + 1}</p>
                  {duel && other ? (
                    <p className="text-xs tabular text-muted">
                      {roundYou.toLocaleString()} · {roundOther.toLocaleString()}
                    </p>
                  ) : null}
                </div>
                <ol className="space-y-1.5">
                  {rows.map((r) => {
                    const g = r.guesses[selfId];
                    const og = other ? r.guesses[other.id] : undefined;
                    const loc = getLocation(r.locationId);
                    return (
                      <li
                        key={r.index}
                        className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-fg">{loc?.title ?? `Q${r.index + 1}`}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                            <span
                              className={cn(
                                "inline-block size-1.5 rounded-full",
                                loc?.country === "NL" ? "bg-nl" : loc?.country === "WORLD" ? "bg-accent" : "bg-za",
                              )}
                            />
                            {loc?.city ?? (loc ? locationCountryLabel(loc) : "")}
                          </span>
                        </span>
                        {duel ? (
                          <span className="shrink-0 text-right text-xs tabular sm:text-sm">
                            <span className="block">{g ? g.score.roundScore.toLocaleString() : "—"}</span>
                            <span className="text-muted">{og ? og.score.roundScore.toLocaleString() : "—"}</span>
                          </span>
                        ) : (
                          <span className="shrink-0 tabular text-xs sm:text-sm">
                            {g ? `${g.score.roundScore.toLocaleString()} · ${formatDistance(g.score.distanceKm)}` : "—"}
                          </span>
                        )}
                      </li>
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

/** The final score rolls up from zero as the screen settles in. */
function FinalScore({ value, reduced }: { value: number; reduced: boolean }) {
  const shown = useCountUp(value, 1400, reduced, 0, 250);
  return <>{Math.round(shown).toLocaleString()}</>;
}
