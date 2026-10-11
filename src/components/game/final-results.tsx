import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Check, House, RotateCcw, Share2, Trophy } from "lucide-react";
import {
  formatDistance,
  formatMiss,
  getLocation,
  isHealthDuel,
  loadStats,
  locationCountryLabel,
  MATCH_LENGTH_NAME,
  START_HEALTH,
  streakCount,
  placeCity,
  shareCard,
  type CareerAward,
  type MatchState,
} from "@/lib/game";
import { CareerResult, MedalsUnlocked } from "./career-bits";
import { MusicHudButton } from "./music-player";
import { Sparks } from "./round-splash";
import { useCountUp } from "./use-count-up";
import { WordRise } from "@/components/motion/motion";
import { useRevealOnScroll } from "@/components/motion/use-reveal";
import { ExpeditionRoute } from "./expedition-route";
import { PassportStamps } from "./passport-stamps";
import { PlayerAvatar } from "./player-avatar";
import { ScoreTally } from "./score-tally";
import { CrownDrop, WinFx } from "./winner-moment";
import { cn, copyText } from "@/lib/utils";
import { useMono } from "@/lib/theme";

export function FinalResults({
  state,
  selfId,
  onRematch,
  onHome,
  reducedMotion,
  rematchNote,
  rematchLabel,
  rematchPending,
  beatBest,
  career,
}: {
  state: MatchState;
  selfId: string;
  onRematch: () => void;
  onHome: () => void;
  reducedMotion?: boolean;
  /** Online: "Guesty wants a rematch", or that this player has asked. */
  rematchNote?: string;
  rematchLabel?: string;
  /** Asked and waiting on the host: the button rests. */
  rematchPending?: boolean;
  /** The record this match beat for its length, when it set a new one. */
  beatBest?: number;
  /** What the match added to the career (absent in pass and play). */
  career?: CareerAward;
}) {
  const mono = useMono();
  const navigate = useNavigate();
  const you = state.players.find((p) => p.id === selfId);
  const other = state.players.find((p) => p.id !== selfId);
  const duel = state.mode === "duel" && Boolean(other);
  const escape = state.matchLength === "escape";
  const health = isHealthDuel(state);
  const streak = Boolean(state.streak);
  const run = streak ? streakCount(state) : 0;
  // Where a streak ended: the place it missed (absent when the deck ran out).
  const ended = streak ? state.roundHistory.find((r) => r.streak && !r.streak.correct) : undefined;
  const endedAt = ended ? getLocation(ended.locationId) : undefined;
  const [bestRun, setBestRun] = useState(0);
  useEffect(() => {
    if (streak) setBestRun(loadStats().bestCountryStreak ?? 0);
  }, [streak]);
  const shared = state.winnerIds.length > 1;
  const youWin = state.winnerIds.includes(selfId);
  const delta = you && other ? Math.abs(you.totalScore - other.totalScore) : 0;
  const closest = state.roundHistory
    .filter((r) => !r.cosmos)
    .map((r) => r.guesses[selfId]?.score.distanceKm)
    .filter((d) => Number.isFinite(d)) as number[];
  const scores = state.roundHistory
    .map((r) => r.guesses[selfId]?.score.roundScore)
    .filter((n): n is number => Number.isFinite(n));
  const avgResponse =
    you && state.roundHistory.length ? you.totalResponseMs / state.roundHistory.length / 1000 : 0;
  // A streak reads like a solo game: your name, then the run as the big figure.
  const headline = streak
    ? you?.name
    : shared
      ? "Draw"
      : state.mode === "solo" || youWin
        ? you?.name
        : other?.name;
  // The kicker names what the headline is: the headline shows the winner, so
  // it reads "Champion" either way (it used to say "Runner up" above the
  // winner's name when you lost, as if they had come second).
  const kicker = streak
    ? "Country Streak"
    : shared
      ? "Shared victory"
      : state.mode === "solo"
        ? "Match complete"
        : "Champion";
  const winnerName = youWin ? you?.name : other?.name;
  // A duel's winner wears the crown, whoever it is.
  const crowned = duel && !shared;
  // Confetti when this screen has news worth it: you won the duel (or, in
  // pass-and-play, someone at this device did), or you set a new best.
  const fanfare =
    !reducedMotion && ((crowned && (youWin || state.duelKind === "hotseat")) || beatBest != null);
  const winColour =
    crowned && state.winnerIds[0] === state.players[1]?.id
      ? "var(--color-rival)"
      : "var(--color-accent)";
  // A new best is known a moment after this screen mounts (the stats are
  // recorded then), so the burst starts whenever `fanfare` turns true.
  const [fxSpent, setFxSpent] = useState(false);
  const showFx = fanfare && !fxSpent;
  useEffect(() => {
    if (!fanfare) return;
    // The burst is spent by then; the spinning rays should not run forever.
    const t = window.setTimeout(() => setFxSpent(true), 4200);
    return () => window.clearTimeout(t);
  }, [fanfare]);

  // Cards and stat tiles come in as they scroll into view (styles.css).
  const shellRef = useRef<HTMLElement>(null);
  useRevealOnScroll(shellRef);
  // The match screen gives way to this one in place: bring focus along, or it
  // is left on the map that just disappeared.
  useEffect(() => {
    shellRef.current?.focus({ preventScroll: true });
  }, []);
  let cardIndex = 0;
  // The actions sit below the XP, medals and route: until they scroll into
  // view, a small bar floats at the foot with Rematch and Home.
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsInView, setActionsInView] = useState(true);
  useEffect(() => {
    const el = actionsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setActionsInView(Boolean(e?.isIntersecting)));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <main
      ref={shellRef}
      tabIndex={-1}
      className="result-shell min-h-dvh px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]"
    >
      {showFx && (
        <div className="result-fx">
          <WinFx color={winColour} confetti />
        </div>
      )}
      <div className="relative mx-auto flex min-h-[calc(100dvh-5rem)] max-w-lg flex-col justify-center">
        <div className="atlas-rise flex items-center justify-between gap-3">
          {mono ? (
            <p className="eyebrow">
              <span className="index-no" aria-hidden>
                FIN
              </span>{" "}
              {kicker}
            </p>
          ) : (
            <p className="text-xs uppercase tracking-[0.28em] text-muted">{kicker}</p>
          )}
          <div className="-my-2">
            <MusicHudButton />
          </div>
        </div>
        <div
          className={cn(
            "atlas-rise atlas-rise-1 mt-3 flex items-center gap-3",
            crowned && "result-crowned",
          )}
        >
          <span className="result-burst result-avatar-pop">
            <PlayerAvatar
              id={(youWin || state.mode === "solo" ? you : other)?.avatarId}
              size={56}
              live
              mood={shared ? "neutral" : "happy"}
            />
            {!reducedMotion && !shared && <Sparks count={20} spread={130} />}
            {crowned && <CrownDrop />}
          </span>
          <h1 className="font-display text-5xl leading-none tracking-tight sm:text-6xl">
            <WordRise text={headline ?? ""} delay={180} />
          </h1>
        </div>
        {duel ? (
          <div className="atlas-rise atlas-rise-2 mt-6">
            <ScoreTally players={state.players} selfId={selfId} winnerIds={state.winnerIds} health={health} />
            {health && !shared ? (
              <p className="mt-2 text-sm text-muted">
                {(() => {
                  const winner = state.players.find((p) => p.id === state.winnerIds[0]);
                  const left = (winner?.health ?? START_HEALTH).toLocaleString();
                  const knockedOut = state.players.some((p) => (p.health ?? START_HEALTH) <= 0);
                  return knockedOut
                    ? `${winnerName} won with ${left} health left, in ${state.roundHistory.length} rounds`
                    : `${winnerName} won on health: ${left} left when the places ran out`;
                })()}
              </p>
            ) : delta > 0 && !shared ? (
              <p className="mt-2 text-sm text-muted">
                {winnerName} won by {delta.toLocaleString()} {delta === 1 ? "point" : "points"}
              </p>
            ) : null}
          </div>
        ) : streak ? (
          <div className="atlas-rise atlas-rise-2 mt-6">
            <p className="result-score tabular">
              <FinalScore value={run} reduced={Boolean(reducedMotion)} />
            </p>
            <p className="mt-1 text-sm text-muted">
              {run === 1 ? "country" : "countries"} in a row
              {bestRun > 0 ? ` · best ${Math.max(bestRun, run).toLocaleString()}` : ""}
            </p>
            {endedAt ? (
              <p className="mt-3 text-sm text-fg">
                Ended at {endedAt.title}, {locationCountryLabel(endedAt)}
                {ended?.streak?.guessed ? `. Your pin was in ${ended.streak.guessed}.` : "."}
              </p>
            ) : (
              <p className="mt-3 text-sm text-fg">Every place, every country. Nothing left to miss.</p>
            )}
          </div>
        ) : (
          <p className="atlas-rise atlas-rise-2 mt-6 result-score tabular">
            <FinalScore value={you?.totalScore ?? 0} reduced={Boolean(reducedMotion)} />
          </p>
        )}
        {beatBest != null && (
          <p className="best-stamp" role="status">
            <Trophy size={16} aria-hidden />
            <span>
              <strong>{streak ? "New best streak" : "New personal best"}</strong>
              <span className="best-stamp-was">
                {streak ? "Streak" : MATCH_LENGTH_NAME[state.matchLength]} record was {beatBest.toLocaleString()}
              </span>
            </span>
          </p>
        )}
        {career && (
          <>
            <CareerResult award={career} reducedMotion={reducedMotion} />
            <MedalsUnlocked medals={career.medals} />
          </>
        )}
        <ExpeditionRoute
          className="mt-7"
          stops={state.roundHistory
            .filter((r) => !r.cosmos)
            .map((r) => ({
              latitude: r.truth.latitude,
              longitude: r.truth.longitude,
              score: r.guesses[selfId]?.score.roundScore,
            }))}
        />
        <PassportStamps history={state.roundHistory} />
        <dl className="mt-8 grid grid-cols-2 gap-3 text-sm">
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
            label="Total miss"
            reduced={Boolean(reducedMotion)}
            value={closest.reduce((sum, km) => sum + km, 0)}
            format={formatDistance}
          />
          <Stat
            i={3}
            label="Best question"
            reduced={Boolean(reducedMotion)}
            value={scores.length && Math.max(...scores) > 0 ? Math.max(...scores) : null}
            format={(v) => Math.round(v).toLocaleString()}
          />
        </dl>
        {rematchNote ? (
          <p className="rematch-note" role="status">
            {rematchNote}
          </p>
        ) : null}
        <div ref={actionsRef} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button className="rematch-nudge sm:flex-1" onClick={onRematch} disabled={rematchPending}>
            {rematchLabel ?? "Rematch"}
          </Button>
          {state.mode === "duel" && (
            <Button variant="secondary" className="sm:flex-1" onClick={() => navigate("/duel")}>
              New opponent
            </Button>
          )}
          <ShareResult state={state} selfId={selfId} />
          <Button variant="secondary" className="sm:flex-1" onClick={onHome}>
            Home
          </Button>
        </div>
        {!actionsInView && (
          <div className="result-fab" role="group" aria-label="Next">
            <button type="button" className="result-fab-home" aria-label="Home" onClick={onHome}>
              <House size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="result-fab-main"
              onClick={onRematch}
              disabled={rematchPending}
            >
              <RotateCcw size={16} aria-hidden />
              {rematchLabel ?? "Rematch"}
            </button>
          </div>
        )}
        {/* The breakdown comes after the actions: after a 40-question match
            Rematch used to sit under forty rows. Long matches fold each round
            into one line that opens on demand. */}
        <section className="mt-10" aria-labelledby="result-breakdown">
          <h2
            id="result-breakdown"
            className={mono ? "eyebrow" : "text-[11px] uppercase tracking-[0.2em] text-subtle"}
          >
            {escape ? "Your stops" : "Round by round"}
          </h2>
          {duel && other ? (
            <p className="mt-1 text-xs text-subtle">
              Per question · {you?.name ?? "you"} then {other.name}
            </p>
          ) : null}
          <ol className="mt-3 space-y-2">
            {/* An Escape is five single stops: one list, not five one-row rounds. */}
            {Array.from({ length: escape ? 1 : state.totalRounds || 4 }, (_, round) => {
              const rows = escape
                ? state.roundHistory
                : state.roundHistory.filter((r) => Math.floor(r.index / 10) === round);
              if (!rows.length) return null;
              const roundYou = rows.reduce(
                (n, r) => n + (r.guesses[selfId]?.score.roundScore ?? 0),
                0,
              );
              const roundOther = other
                ? rows.reduce((n, r) => n + (r.guesses[other.id]?.score.roundScore ?? 0), 0)
                : 0;
              const list = (
                <ol className="space-y-1.5">
                  {rows.map((r) => {
                    const g = r.guesses[selfId];
                    const og = other ? r.guesses[other.id] : undefined;
                    const loc = getLocation(r.locationId);
                    return (
                      <li
                        key={r.index}
                        data-reveal={escape ? "" : undefined}
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
                                "inline-block size-1.5",
                                !mono && "rounded-full",
                                loc?.country === "NL"
                                  ? "bg-nl"
                                  : loc?.country === "WORLD"
                                    ? "bg-accent"
                                    : loc?.country === "SPACE"
                                      ? mono
                                        ? "border border-fg"
                                        : "bg-[#8fb4ff]"
                                      : "bg-za",
                              )}
                            />
                            {loc
                              ? [placeCity(loc), locationCountryLabel(loc)]
                                  .filter(Boolean)
                                  .join(" · ")
                              : ""}
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
                              ? `${g.score.roundScore.toLocaleString()} · ${formatMiss(g.score)}`
                              : "—"}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              );
              if (escape) return <li key={round}>{list}</li>;
              return (
                <li key={round}>
                  <details className="result-round" data-reveal>
                    <summary>
                      <span className="result-round-name">
                        {state.roundHistory.some(
                          (r) => r.cosmos && Math.floor(r.index / 10) === round,
                        )
                          ? `Round ${round + 1} · cosmos`
                          : `Round ${round + 1}`}
                      </span>
                      <span className="text-xs text-muted">{rows.length} places</span>
                      <span className="ml-auto text-sm tabular">
                        {roundYou.toLocaleString()}
                        {duel && other ? (
                          <span className="text-muted"> · {roundOther.toLocaleString()}</span>
                        ) : null}
                      </span>
                    </summary>
                    <div className="pt-2">{list}</div>
                  </details>
                </li>
              );
            })}
          </ol>
        </section>
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
  const mono = useMono();
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
      className={cn("border border-border p-3", !mono && "rounded-[var(--radius-md)]")}
    >
      <dt className={mono ? "font-mono text-[10px] uppercase tracking-[0.12em] text-subtle" : "text-subtle"}>
        {label}
      </dt>
      <dd className="mt-1 font-display text-xl tabular">{value === null ? "—" : format(shown)}</dd>
    </div>
  );
}
