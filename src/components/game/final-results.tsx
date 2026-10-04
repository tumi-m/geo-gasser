import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Share2 } from "lucide-react";
import {
  formatDistance,
  getLocation,
  locationCountryLabel,
  shareCard,
  type MatchState,
} from "@/lib/game";
import { MusicHudButton } from "./music-player";
import { Sparks } from "./round-splash";
import { useCountUp } from "./use-count-up";
import { WordRise } from "@/components/motion/motion";
import { useRevealOnScroll } from "@/components/motion/use-reveal";
import { ExpeditionRoute } from "./expedition-route";
import { PassportStamps } from "./passport-stamps";
import { PlayerAvatar } from "./player-avatar";
import { ScoreTally } from "./score-tally";
import { cn, copyText } from "@/lib/utils";

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
  const scores = state.roundHistory
    .map((r) => r.guesses[selfId]?.score.roundScore)
    .filter((n): n is number => Number.isFinite(n));
  const avgResponse =
    you && state.roundHistory.length ? you.totalResponseMs / state.roundHistory.length / 1000 : 0;
  const headline = shared ? "Draw" : state.mode === "solo" || youWin ? you?.name : other?.name;
  // The kicker names what the headline is: the headline shows the winner, so
  // it reads "Champion" either way (it used to say "Runner up" above the
  // winner's name when you lost, as if they had come second).
  const kicker = shared ? "Shared victory" : state.mode === "solo" ? "Match complete" : "Champion";
  const winnerName = youWin ? you?.name : other?.name;

  // Cards and stat tiles come in as they scroll into view (styles.css).
  const shellRef = useRef<HTMLElement>(null);
  useRevealOnScroll(shellRef);
  let cardIndex = 0;

  return (
    <main
      ref={shellRef}
      className="result-shell min-h-dvh px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-lg flex-col justify-center">
        <div className="atlas-rise flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.28em] text-muted">{kicker}</p>
          <div className="-my-2">
            <MusicHudButton />
          </div>
        </div>
        <div className="atlas-rise atlas-rise-1 mt-3 flex items-center gap-3">
          <span className="result-burst result-avatar-pop">
            <PlayerAvatar
              id={(youWin || state.mode === "solo" ? you : other)?.avatarId}
              size={56}
              live
              mood={shared ? "neutral" : "happy"}
            />
            {!reducedMotion && !shared && <Sparks count={20} spread={130} />}
          </span>
          <h1 className="font-display text-5xl leading-none tracking-tight sm:text-6xl">
            <WordRise text={headline ?? ""} delay={180} />
          </h1>
        </div>
        {duel ? (
          <div className="atlas-rise atlas-rise-2 mt-6">
            <ScoreTally players={state.players} selfId={selfId} winnerIds={state.winnerIds} />
            {delta > 0 && !shared ? (
              <p className="mt-2 text-sm text-muted">
                {winnerName} won by {delta.toLocaleString()} {delta === 1 ? "point" : "points"}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="atlas-rise atlas-rise-2 mt-6 result-score tabular">
            <FinalScore value={you?.totalScore ?? 0} reduced={Boolean(reducedMotion)} />
          </p>
        )}
        <ExpeditionRoute
          className="mt-7"
          stops={state.roundHistory.map((r) => ({
            latitude: r.truth.latitude,
            longitude: r.truth.longitude,
            score: r.guesses[selfId]?.score.roundScore,
          }))}
        />
        <PassportStamps history={state.roundHistory} />
        {duel && other ? (
          <p className="mt-8 text-xs text-subtle">Per question · you then {other.name}</p>
        ) : null}
        <ol className={cn("space-y-5", duel && other ? "mt-5" : "mt-8")}>
          {Array.from({ length: state.totalRounds || 4 }, (_, round) => {
            const rows = state.roundHistory.filter(
              (r) =>
                (state.matchLength === "escape" ? r.index : Math.floor(r.index / 10)) === round,
            );
            if (!rows.length) return null;
            const roundYou = rows.reduce(
              (n, r) => n + (r.guesses[selfId]?.score.roundScore ?? 0),
              0,
            );
            const roundOther = other
              ? rows.reduce((n, r) => n + (r.guesses[other.id]?.score.roundScore ?? 0), 0)
              : 0;
            return (
              <li key={round}>
                <div className="mb-2 flex items-baseline justify-between gap-3" data-reveal>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">
                    Round {round + 1}
                  </p>
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
                        data-reveal
                        style={{ "--i": Math.min(6, cardIndex++ % 7) } as React.CSSProperties}
                        className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-fg">
                            {loc?.title ?? `Q${r.index + 1}`}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                            <span
                              className={cn(
                                "inline-block size-1.5 rounded-full",
                                loc?.country === "NL"
                                  ? "bg-nl"
                                  : loc?.country === "WORLD"
                                    ? "bg-accent"
                                    : "bg-za",
                              )}
                            />
                            {loc?.city ?? (loc ? locationCountryLabel(loc) : "")}
                          </span>
                        </span>
                        {duel ? (
                          <span className="shrink-0 text-right text-xs tabular sm:text-sm">
                            <span className="block">
                              {g ? g.score.roundScore.toLocaleString() : "—"}
                            </span>
                            <span className="text-muted">
                              {og ? og.score.roundScore.toLocaleString() : "—"}
                            </span>
                          </span>
                        ) : (
                          <span className="shrink-0 tabular text-xs sm:text-sm">
                            {g
                              ? `${g.score.roundScore.toLocaleString()} · ${formatDistance(g.score.distanceKm)}`
                              : "—"}
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
          <Stat
            i={0}
            label="Closest guess"
            reduced={Boolean(reducedMotion)}
            value={closest.length ? Math.min(...closest) : null}
            format={formatDistance}
          />
          <Stat
            i={1}
            label="Avg. response"
            reduced={Boolean(reducedMotion)}
            value={avgResponse}
            format={(v) => `${v.toFixed(1)}s`}
          />
          <Stat
            i={2}
            label="Total distance"
            reduced={Boolean(reducedMotion)}
            value={you?.totalDistanceKm ?? 0}
            format={formatDistance}
          />
          <Stat
            i={3}
            label="Best question"
            reduced={Boolean(reducedMotion)}
            value={scores.length ? Math.max(...scores) : null}
            format={(v) => Math.round(v).toLocaleString()}
          />
        </dl>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button className="rematch-nudge sm:flex-1" onClick={onRematch}>
            Rematch
          </Button>
          {state.mode === "duel" && (
            <Button
              variant="secondary"
              className="sm:flex-1"
              onClick={() => void navigate({ to: "/duel" })}
            >
              New opponent
            </Button>
          )}
          <ShareResult state={state} selfId={selfId} />
          <Button variant="secondary" className="sm:flex-1" onClick={onHome}>
            Home
          </Button>
        </div>
      </div>
    </main>
  );
}

/** Share a spoiler-free card: the share sheet where there is one, else the clipboard. */
function ShareResult({ state, selfId }: { state: MatchState; selfId: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}/`;
    const text = shareCard(state, selfId, url);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Atlas Duel", text });
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
      }
    }
    const ok = await copyText(text);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Button variant="secondary" className="sm:flex-1" onClick={() => void share()}>
      {copied ? <Check size={16} /> : <Share2 size={16} />}
      <span aria-live="polite">{copied ? "Copied" : "Share"}</span>
    </Button>
  );
}

/** The final score rolls up from zero as the screen settles in. */
function FinalScore({ value, reduced }: { value: number; reduced: boolean }) {
  const shown = useCountUp(value, 1400, reduced, 0, 250);
  return <>{Math.round(shown).toLocaleString()}</>;
}

/** A stat tile whose number counts up the first time it scrolls into view. */
function Stat({
  i,
  label,
  value,
  format,
  reduced,
}: {
  i: number;
  label: string;
  value: number | null;
  format: (v: number) => string;
  reduced: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        setSeen(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const shown = useCountUp(seen ? (value ?? 0) : 0, 900, reduced, 0, 120 + i * 90);
  return (
    <div
      ref={ref}
      data-reveal
      style={{ "--i": i } as React.CSSProperties}
      className="rounded-[var(--radius-md)] border border-border p-3"
    >
      <dt className="text-subtle">{label}</dt>
      <dd className="mt-1 font-display text-xl tabular">{value === null ? "—" : format(shown)}</dd>
    </div>
  );
}
