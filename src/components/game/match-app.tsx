import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  activeEnvironment,
  activeLocation,
  audio,
  createLobbyState,
  getLocation,
  isRound4,
  loadSettings,
  loadStats,
  randomSeed,
  recordMatch,
  reduce,
  remainingSeconds,
  ROUND_DURATION_SEC,
  saveSettings,
  toPublicSnapshot,
  type GameSettings,
  type LatLng,
  type MatchEvent,
  type MatchState,
} from "@/lib/game";
import { isWireMessage, sanitizeName, useP2PRoom, type WireMessage } from "@/lib/multiplayer";
import { GuessMap } from "./guess-map";
import { RevealOverlay } from "./reveal-sequence";
import { Round4Scene } from "./round4-scene";
import { SettingsPanel } from "./settings-panel";
import { RoundPips, TimerRing } from "./timer-ring";
import { FinalResults } from "./final-results";
import { cn } from "@/lib/utils";

function applyDocumentSettings(settings: GameSettings) {
  document.documentElement.classList.toggle("hc", settings.highContrast);
  audio.setSettings(settings);
  saveSettings(settings);
}

export function MatchApp({
  mode,
  roomCode,
  isCreator = false,
}: {
  mode: "solo" | "duel";
  roomCode?: string;
  isCreator?: boolean;
}) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [state, setState] = useState<MatchState>(() => createLobbyState());
  const [remaining, setRemaining] = useState(ROUND_DURATION_SEC);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shake, setShake] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const statsRecorded = useRef(false);
  const lastUrgentRef = useRef<number | null>(null);
  const name = sanitizeName(settings.displayName);
  const selfIdRef = useRef(`solo-${Math.random().toString(36).slice(2, 8)}`);

  const p2p = useP2PRoom({
    room: roomCode ? `atlas-${roomCode}` : "atlas-idle",
    name,
    enabled: mode === "duel" && Boolean(roomCode),
  });
  const selfId = mode === "duel" ? p2p.selfId : selfIdRef.current;
  const hostRef = useRef(mode === "solo" || isCreator);
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((event: MatchEvent) => {
    setState((s) => reduce(s, event));
  }, []);

  useEffect(() => {
    applyDocumentSettings(settings);
  }, [settings]);

  const bootRef = useRef(false);

  useEffect(() => {
    if (mode !== "solo" || bootRef.current) return;
    bootRef.current = true;
    dispatch({
      type: "CREATE_SOLO",
      playerId: selfId,
      name,
      seed: randomSeed(),
      now: performance.now(),
    });
  }, [mode, selfId, name, dispatch]);

  useEffect(() => {
    if (mode !== "duel") return;
    if (isCreator && state.phase === "lobby") {
      hostRef.current = true;
      dispatch({
        type: "CREATE_DUEL",
        playerId: selfId,
        name,
        roomCode: roomCode ?? "ROOM",
        seed: randomSeed(),
        now: Date.now(),
      });
    }
  }, [mode, isCreator, selfId, name, roomCode, dispatch, state.phase]);

  useEffect(() => {
    if (mode !== "duel" || isCreator) return;
    const t = window.setTimeout(() => {
      if (stateRef.current.phase === "lobby" && p2p.peers.length === 0) {
        hostRef.current = true;
        dispatch({
          type: "CREATE_DUEL",
          playerId: selfId,
          name,
          roomCode: roomCode ?? "ROOM",
          seed: randomSeed(),
          now: Date.now(),
        });
      }
    }, 2500);
    return () => window.clearTimeout(t);
  }, [mode, isCreator, selfId, name, roomCode, dispatch, p2p.peers.length]);

  useEffect(() => {
    if (mode !== "duel") return;
    return p2p.onMessage((_from, data) => {
      if (!isWireMessage(data)) return;
      const msg = data as WireMessage;
      if (msg.t === "snapshot" && !hostRef.current) {
        setState((prev) => {
          const incoming = msg.state as MatchState;
          if (incoming.revealed) return incoming;
          const mine = prev.players.find((p) => p.id === selfId);
          return {
            ...incoming,
            players: incoming.players.map((p) =>
              p.id === selfId && mine
                ? { ...p, guess: mine.guess ?? p.guess, locked: mine.locked || p.locked, lockedAtMs: mine.lockedAtMs ?? p.lockedAtMs }
                : p,
            ),
          };
        });
        return;
      }
      if (!hostRef.current) return;
      const now = Date.now();
      if (msg.t === "hello") dispatch({ type: "PLAYER_JOIN", playerId: msg.peerId, name: msg.name, now });
      if (msg.t === "pin") dispatch({ type: "PLACE_PIN", playerId: _from, guess: { latitude: msg.lat, longitude: msg.lng }, now });
      if (msg.t === "lock") {
        dispatch({ type: "PLACE_PIN", playerId: _from, guess: { latitude: msg.lat, longitude: msg.lng }, now });
        dispatch({ type: "LOCK", playerId: _from, now });
      }
      if (msg.t === "intro-done") dispatch({ type: "INTRO_DONE", now });
      if (msg.t === "continue") dispatch({ type: "CONTINUE", now });
      if (msg.t === "reveal-done") dispatch({ type: "REVEAL_DONE", now });
      if (msg.t === "start") dispatch({ type: "START_MATCH", now });
      if (msg.t === "rematch") dispatch({ type: "REMATCH", seed: msg.seed, now });
    });
  }, [mode, p2p.onMessage, dispatch, selfId]);

  useEffect(() => {
    if (mode !== "duel" || !hostRef.current) return;
    if (state.seq === 0) return;
    p2p.send({ t: "snapshot", state: toPublicSnapshot(state) });
  }, [mode, p2p.send, state]);

  useEffect(() => {
    if (mode !== "duel" || hostRef.current) return;
    const ping = () => p2p.send({ t: "hello", peerId: selfId, name });
    ping();
    const id = setInterval(ping, 2000);
    return () => clearInterval(id);
  }, [mode, p2p.send, selfId, name]);

  const loc = activeLocation(state);
  const env = activeEnvironment(state);
  const you = state.players.find((p) => p.id === selfId) ?? state.players[0];
  const opponent = state.players.find((p) => p.id !== you?.id);
  const showingReveal = state.phase === "round_reveal" || state.phase === "round_expired" || state.phase === "round_results";
  const lastRound = state.roundIndex >= 3;

  const finishIntro = useCallback(() => {
    if (stateRef.current.phase !== "round_intro") return;
    const now = mode === "solo" ? performance.now() : Date.now();
    if (mode === "duel" && !hostRef.current) {
      p2p.send({ t: "intro-done" });
      return;
    }
    dispatch({ type: "INTRO_DONE", now });
  }, [mode, dispatch, p2p.send]);

  const continueRound = useCallback(() => {
    const now = mode === "solo" ? performance.now() : Date.now();
    if (mode === "duel" && !hostRef.current) p2p.send({ t: "continue" });
    else dispatch({ type: "CONTINUE", now });
  }, [mode, dispatch, p2p.send]);

  useEffect(() => {
    if (state.phase !== "round_intro") return;
    const wait = settings.reducedMotion ? 400 : 1600;
    const id = setTimeout(finishIntro, wait);
    return () => clearTimeout(id);
  }, [state.phase, settings.reducedMotion, finishIntro]);

  useEffect(() => {
    const ticking =
      Boolean(state.roundStartedAtMs) &&
      (state.phase === "round_active" ||
        state.phase === "waiting_for_opponent" ||
        state.phase === "player_locked");
    if (!ticking) return;
    let raf = 0;
    const loop = () => {
      const clock = mode === "solo" ? performance.now() : Date.now();
      const rem = remainingSeconds(state.roundStartedAtMs!, clock);
      setRemaining(rem);
      if (rem <= 0) {
        if (mode === "duel" && !hostRef.current) return;
        dispatch({ type: "TIMEOUT", now: clock });
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state.phase, state.roundStartedAtMs, mode, dispatch]);

  useEffect(() => {
    if (state.phase !== "round_active") {
      lastUrgentRef.current = null;
      return;
    }
    const sec = Math.ceil(remaining);
    if (sec <= 5 && sec > 0 && lastUrgentRef.current !== sec) {
      lastUrgentRef.current = sec;
      audio.play("urgent");
    }
  }, [remaining, state.phase]);

  useEffect(() => {
    if (state.phase === "round_intro") {
      setSceneReady(false);
      setSceneFailed(false);
    }
    if (state.phase === "round_active") {
      setExpanded(false);
      audio.play("start");
    }
    if (state.phase === "round_reveal" || state.phase === "round_expired") {
      setExpanded(false);
      audio.play("whoosh");
      const score = you?.roundScore;
      if (score?.badges.includes("bullseye")) audio.play("bullseye");
      if (settings.cameraShake && !settings.reducedMotion) {
        setShake(true);
        window.setTimeout(() => setShake(false), 420);
      }
    }
    if (state.phase === "final_reveal") audio.play(state.winnerIds.includes(selfId) ? "win" : "lose");
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.phase !== "match_complete" && state.phase !== "final_reveal") return;
    if (statsRecorded.current) return;
    statsRecorded.current = true;
    const distances = state.roundHistory
      .map((r) => r.guesses[selfId]?.score.distanceKm)
      .filter((d) => d != null) as number[];
    const za = { n: 0, hits: 0 };
    const nl = { n: 0, hits: 0 };
    for (const r of state.roundHistory) {
      const g = r.guesses[selfId];
      if (!g) continue;
      const country = getLocation(r.locationId)?.country;
      const bucket = country === "NL" ? nl : za;
      bucket.n += 1;
      if (g.score.countryCorrect) bucket.hits += 1;
    }
    const fastest = state.roundHistory
      .map((r) => r.guesses[selfId]?.score)
      .filter((s) => s && s.distanceKm <= 5)
      .map((s) => s!.responseMs);
    recordMatch(loadStats(), {
      score: you?.totalScore ?? 0,
      won: state.mode === "duel" && state.winnerIds.includes(selfId),
      distances,
      countryHits: { ZA: za, NL: nl },
      fastestAccurateMs: fastest.length ? Math.min(...fastest) : null,
    });
  }, [state.phase, state.roundHistory, state.winnerIds, state.mode, selfId, you]);

  const onGuess = (p: LatLng) => {
    if (you?.locked || state.phase !== "round_active") return;
    audio.play("pin");
    const now = mode === "solo" ? performance.now() : Date.now();
    dispatch({ type: "PLACE_PIN", playerId: selfId, guess: p, now });
    if (mode === "duel" && !hostRef.current) p2p.send({ t: "pin", lat: p.latitude, lng: p.longitude });
  };

  const lock = useCallback(() => {
    const current = stateRef.current;
    const me = current.players.find((p) => p.id === selfId) ?? current.players[0];
    if (!me?.guess || me.locked || current.phase !== "round_active") return;
    audio.play("lock");
    if (settings.cameraShake && !settings.reducedMotion) {
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
    }
    const now = mode === "solo" ? performance.now() : Date.now();
    dispatch({ type: "LOCK", playerId: selfId, now });
    if (mode === "duel" && !hostRef.current) {
      p2p.send({ t: "lock", lat: me.guess.latitude, lng: me.guess.longitude });
    }
  }, [mode, dispatch, p2p.send, selfId, settings.cameraShake, settings.reducedMotion]);

  const quit = () => {
    audio.stopAmbience();
    void navigate({ to: "/" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.isContentEditable;
      if (e.key === "Escape") {
        if (showSettings) {
          setShowSettings(false);
          return;
        }
      }
      if (typing || showSettings) return;
      if (e.key === "Enter" && state.phase === "round_intro") {
        finishIntro();
        return;
      }
      if (e.key === "Enter" && state.phase === "round_active") {
        lock();
        return;
      }
      if (e.key === "Enter" && showingReveal) {
        continueRound();
        return;
      }
      if ((e.key === "m" || e.key === "M") && (state.phase === "round_active" || showingReveal)) {
        setExpanded((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.phase, showSettings, lock, finishIntro, continueRound, showingReveal]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !roomCode) return "";
    return `${window.location.origin}/duel/${roomCode}`;
  }, [roomCode]);

  if (mode === "duel" && (state.phase === "lobby" || state.phase === "waiting_for_players" || state.phase === "rematch_pending")) {
    const failed = p2p.peers.some((peer) => peer.connectionState === "failed");
    return (
      <main className="min-h-dvh bg-bg px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          <p className="text-xs uppercase tracking-[0.28em] text-muted">Private room</p>
          <h1 className="font-display mt-2 text-5xl tracking-tight">{roomCode}</h1>
          <p className="mt-3 text-muted">Share this code. Host starts when both players are in.</p>
          <div className="mt-6 flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                void navigator.clipboard?.writeText(shareUrl || roomCode || "");
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? "Copied" : "Copy invite"}
            </Button>
          </div>
          <ul className="mt-8 space-y-2">
            {state.players.map((p) => (
              <li key={p.id} className="rounded-[var(--radius-md)] border border-border px-4 py-3">
                {p.name} {p.id === state.hostId ? "· host" : ""}
              </li>
            ))}
            {state.players.length < 2 && (
              <li className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-3 text-muted">
                {failed
                  ? "Connection failed — try the same network"
                  : p2p.joined
                    ? "Waiting for opponent"
                    : "Connecting…"}
              </li>
            )}
          </ul>
          {hostRef.current && (
            <Button className="mt-8 w-full" disabled={state.players.length < 2} onClick={() => dispatch({ type: "START_MATCH", now: Date.now() })}>
              {state.players.length < 2 ? "Waiting for opponent" : "Start match"}
            </Button>
          )}
          <Button variant="ghost" className="mt-3 w-full" onClick={quit}>
            Home
          </Button>
        </div>
      </main>
    );
  }

  if (state.phase === "final_reveal" || state.phase === "match_complete") {
    return (
      <FinalResults
        state={state}
        selfId={selfId}
        onRematch={() => {
          statsRecorded.current = false;
          const seed = randomSeed();
          if (mode === "duel" && !hostRef.current) p2p.send({ t: "rematch", seed });
          else dispatch({ type: "REMATCH", seed, now: mode === "solo" ? performance.now() : Date.now() });
        }}
        onHome={quit}
      />
    );
  }

  const roundLabel = `Round ${state.roundIndex + 1} of 4${isRound4(state) ? " · reconstruction" : ""}`;
  const urgent = remaining <= 10 && state.phase === "round_active" && !you?.locked;

  return (
    <main className={cn("relative min-h-dvh overflow-hidden bg-bg", shake && "atlas-shake")}>
      {state.phase === "round_intro" && (
        <div
          className="absolute inset-0 z-40 flex cursor-pointer flex-col items-center justify-center bg-bg text-center"
          onClick={finishIntro}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") finishIntro();
          }}
          role="button"
          tabIndex={0}
          aria-label="Start round"
        >
          <p className="atlas-rise text-xs uppercase tracking-[0.28em] text-muted">{roundLabel}</p>
          <h1 className="atlas-rise atlas-rise-1 font-display mt-3 text-5xl sm:text-7xl">
            {isRound4(state) ? "Reality remix" : "Locate this"}
          </h1>
          {isRound4(state) && env && (
            <p className="atlas-rise atlas-rise-2 mt-4 max-w-sm text-sm text-muted">
              {env.disclosure} · {env.title} · 1.25× score
            </p>
          )}
          <p className="atlas-rise atlas-rise-3 mt-8 text-xs uppercase tracking-[0.2em] text-subtle">Tap or Enter to start</p>
        </div>
      )}

      <div className="absolute inset-0">
        {isRound4(state) && env ? (
          <Round4Scene env={env} reducedMotion={settings.reducedMotion} />
        ) : (
          <>
            <div className={cn("absolute inset-0 bg-bg-subtle transition-opacity duration-500", sceneReady ? "opacity-0" : "opacity-100")} />
            <img
              key={loc?.sceneUrl}
              src={loc?.sceneUrl}
              alt="Location to identify"
              className={cn(
                "h-full w-full object-cover transition-opacity duration-500",
                sceneReady && !sceneFailed ? "opacity-100" : "opacity-0",
              )}
              onLoad={() => {
                setSceneFailed(false);
                setSceneReady(true);
              }}
              onError={() => {
                setSceneFailed(true);
                setSceneReady(true);
              }}
              ref={(el) => {
                if (el?.complete && el.naturalWidth > 0) {
                  setSceneFailed(false);
                  setSceneReady(true);
                }
              }}
            />
            {sceneFailed && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-subtle">
                <p className="px-6 text-center text-sm text-muted">Scene unavailable — use the map</p>
              </div>
            )}
          </>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.45)_0%,transparent_26%,transparent_62%,rgba(9,9,11,0.5)_100%)]" />
      </div>

      <header className="relative z-20 flex items-start justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex flex-col gap-2">
          {!showingReveal && (
            <TimerRing
              remaining={remaining}
              duration={45}
              urgent={urgent}
              locked={Boolean(you?.locked && !showingReveal)}
            />
          )}
          <RoundPips index={state.roundIndex} />
        </div>
        <div className="flex items-center gap-2">
          {isRound4(state) && (
            <div className="hidden rounded-[var(--radius-sm)] border border-border bg-bg/70 px-3 py-2 text-[10px] uppercase tracking-wider text-muted sm:block">
              3D · drag
            </div>
          )}
          <div className="rounded-[var(--radius-sm)] border border-border bg-bg/70 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wider text-subtle">Score</div>
            <div className="font-display tabular text-lg leading-none">{(you?.totalScore ?? 0).toLocaleString()}</div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => setShowSettings(true)}>
            <SettingsIcon className="size-5" />
          </Button>
        </div>
      </header>

      {you?.locked && !showingReveal && (
        <p className="relative z-20 mx-4 mt-1 w-fit rounded-full border border-border bg-bg/80 px-3 py-1 text-xs uppercase tracking-wider">
          Guess locked
          {mode === "duel" ? ` · ${Math.ceil(remaining)}s left` : ""}
        </p>
      )}

      {state.phase === "round_active" && !you?.guess && !you?.locked && (
        <p className="relative z-20 mx-4 mt-2 w-fit rounded-full border border-border bg-bg/75 px-3 py-1.5 text-xs text-muted">
          Tap the map to drop a pin
        </p>
      )}

      {loc && (
        <GuessMap
          guess={you?.guess}
          onGuess={onGuess}
          disabled={you?.locked || state.phase !== "round_active"}
          expanded={expanded}
          onToggleExpand={() => setExpanded((v) => !v)}
          truth={showingReveal ? state.truth : undefined}
          opponent={
            showingReveal && opponent?.guess
              ? { guess: opponent.guess, name: opponent.name }
              : null
          }
          reveal={showingReveal}
          reducedMotion={settings.reducedMotion}
          onLock={state.phase === "round_active" && !you?.locked ? lock : undefined}
          canLock={Boolean(you?.guess)}
        />
      )}

      {state.phase === "round_active" && !you?.locked && !expanded && (
        <div className="absolute bottom-[calc(32vh+1rem)] left-3 z-20 max-sm:right-3">
          <Button
            size="lg"
            disabled={!you?.guess}
            onClick={lock}
            className={cn("max-sm:w-full", you?.guess && "atlas-lock-ready")}
          >
            {urgent && you?.guess ? `Lock guess · ${Math.ceil(remaining)}s` : "Lock guess"}
          </Button>
        </div>
      )}

      {showingReveal && you?.roundScore && loc && (
        <RevealOverlay
          score={you.roundScore}
          you={you}
          opponent={opponent}
          locationTitle={loc.title}
          city={loc.city}
          country={loc.country === "ZA" ? "South Africa" : "Netherlands"}
          roundLabel={roundLabel}
          lastRound={lastRound}
          expanded={expanded}
          onContinue={continueRound}
        />
      )}

      {loc && isRound4(state) && env && !showingReveal && (
        <p className="pointer-events-none absolute right-3 bottom-[calc(32vh+0.75rem)] z-10 max-w-[46%] text-right text-[10px] leading-snug text-subtle max-sm:max-w-[70%]">
          {env.disclosure}
        </p>
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
          onQuit={quit}
        />
      )}
    </main>
  );
}
