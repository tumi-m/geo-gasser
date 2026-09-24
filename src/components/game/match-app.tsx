import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, Map, Maximize, Minimize, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  atlasLabel,
  activeEnvironment,
  activeLocation,
  activeScene,
  audio,
  createLobbyState,
  getLocation,
  grokGuess,
  endsRound,
  FEEDBACK_COPY,
  grokThinkMs,
  GROK_BOT_ID,
  GROK_BOT_NAME,
  isRound4,
  locationAt,
  locationCountryLabel,
  QUESTIONS_PER_ROUND,
  questionInRound,
  ROUND4_3D_LIVE,
  TOTAL_QUESTIONS,
  loadSettings,
  loadStats,
  randomSeed,
  loadRecentIds,
  recordMatch,
  rememberRecentIds,
  reduce,
  remainingSeconds,
  responsiveSceneSrcSet,
  ROUND_DURATION_SEC,
  saveSettings,
  sanitizeAvatar,
  toPublicSnapshot,
  type GameSettings,
  type LatLng,
  type MatchEvent,
  type MatchState,
} from "@/lib/game";
import { mergeHostSnapshot, matchesQuestion } from "@/lib/multiplayer/sync";
import {
  isWireMessage,
  sanitizeName,
  useMatchRoom,
  useP2PRoom,
  type WireMessage,
} from "@/lib/multiplayer";
import { GuessMap } from "./guess-map";
import { MusicHudButton } from "./music-player";
import { PanoViewer } from "./pano-viewer";
import { PlayerAvatar } from "./player-avatar";
import { RevealOverlay } from "./reveal-sequence";
import { RollingScore } from "./rolling-score";
import { RoundSplash } from "./round-splash";
import { RoundSummarySplash } from "./round-summary-splash";
import { Round4Scene } from "./round4-scene";
import { SceneExplorer } from "./scene-explorer";
import { SettingsPanel } from "./settings-panel";
import { QuestionMark, RoundPips, TimerRing } from "./timer-ring";
import { ScoreTally } from "./score-tally";
import { FinalResults } from "./final-results";
import { cn } from "@/lib/utils";

function applyDocumentSettings(settings: GameSettings) {
  document.documentElement.classList.toggle("hc", settings.highContrast);
  document.documentElement.classList.toggle("reduce-motion", settings.reducedMotion);
  audio.setSettings(settings);
  saveSettings(settings);
}

export function MatchApp({
  mode,
  roomCode,
  isCreator = false,
  duelKind = "online",
}: {
  mode: "solo" | "duel";
  roomCode?: string;
  isCreator?: boolean;
  duelKind?: "online" | "bot" | "hotseat";
}) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [state, setState] = useState<MatchState>(() => createLobbyState());
  const [remaining, setRemaining] = useState(ROUND_DURATION_SEC);
  const [expanded, setExpanded] = useState(false);
  const [exploring, setExploring] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const gameRoot = useRef<HTMLElement>(null);
  // Reading `document` during render made the server emit nothing where the
  // client emitted a button, and React threw out the whole match tree on
  // hydration. Decide after mount, when both sides already agree.
  const [canFullscreen, setCanFullscreen] = useState(false);
  useEffect(() => {
    setCanFullscreen(document.fullscreenEnabled);
    const changed = () => setFullScreen(document.fullscreenElement === gameRoot.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await gameRoot.current?.requestFullscreen();
    } catch {
      /* Unsupported browsers keep the normal viewport. */
    }
  };
  const [copied, setCopied] = useState(false);
  const [shake, setShake] = useState(false);
  const [panoFailed, setPanoFailed] = useState(false);
  const [scene3dFailed, setScene3dFailed] = useState(false);
  const [pendingLock, setPendingLock] = useState<{
    roundStartedAtMs?: number;
    questionIndex: number;
    lat: number;
    lng: number;
  } | null>(null);
  const clockOffset = useRef(0);
  const statsRecorded = useRef(false);
  const lastUrgentRef = useRef<number | null>(null);
  const name = sanitizeName(settings.displayName);
  const avatarId = sanitizeAvatar(settings.avatarId);
  const selfIdRef = useRef(`solo-${Math.random().toString(36).slice(2, 8)}`);
  const matchServerUrl =
    (import.meta.env.VITE_MATCH_SERVER_URL as string | undefined)?.trim() || "";
  const serverMode = mode === "duel" && duelKind === "online" && Boolean(matchServerUrl);
  const playerIdRef = useRef<string>("");
  if (!playerIdRef.current && typeof window !== "undefined") {
    const key = "atlas-player-id";
    try {
      playerIdRef.current = sessionStorage.getItem(key) ?? "";
    } catch {
      /* Storage may be unavailable. */
    }
    if (!playerIdRef.current) {
      playerIdRef.current = `p-${Math.random().toString(36).slice(2, 10)}`;
      try {
        sessionStorage.setItem(key, playerIdRef.current);
      } catch {
        /* Keep the in-memory identity. */
      }
    }
  }

  const p2p = useP2PRoom({
    room: roomCode ? `atlas-${roomCode}` : "atlas-idle",
    name,
    enabled: mode === "duel" && duelKind === "online" && Boolean(roomCode) && !serverMode,
  });
  const socket = useMatchRoom({
    url: matchServerUrl || undefined,
    room: roomCode,
    name,
    avatarId,
    playerId: playerIdRef.current,
    difficulty: settings.difficulty,
    matchLength: settings.matchLength,
    atlas: settings.atlas,
    enabled: serverMode,
  });
  const {
    selfId: p2pSelfId,
    peers: p2pPeers,
    joined: p2pJoined,
    error: p2pError,
    send: p2pSend,
    onMessage: p2pOnMessage,
  } = p2p;
  const {
    selfId: socketSelfId,
    joined: socketJoined,
    connected: socketConnected,
    send: socketSend,
    onMessage: socketOnMessage,
  } = socket;
  const selfId =
    mode === "duel" && duelKind === "online"
      ? serverMode
        ? socketSelfId || playerIdRef.current
        : p2pSelfId
      : selfIdRef.current;
  const hostRef = useRef(mode === "solo" || duelKind !== "online" || isCreator);
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((event: MatchEvent) => {
    setState((s) => reduce(s, event));
  }, []);

  useEffect(() => {
    applyDocumentSettings(settings);
  }, [settings]);

  const adoptSnapshot = useCallback(
    (incoming: MatchState) => {
      setState((prev) => mergeHostSnapshot(prev, incoming, selfId));
    },
    [selfId],
  );

  const bootRef = useRef(false);

  useEffect(() => {
    if (mode !== "solo" || bootRef.current) return;
    bootRef.current = true;
    dispatch({
      type: "CREATE_SOLO",
      playerId: selfId,
      name,
      avatarId,
      seed: randomSeed(),
      now: performance.now(),
      difficulty: settings.difficulty,
      matchLength: settings.matchLength,
      atlas: settings.atlas,
      avoidLocationIds: loadRecentIds(),
    });
  }, [
    mode,
    selfId,
    name,
    avatarId,
    dispatch,
    settings.difficulty,
    settings.matchLength,
    settings.atlas,
  ]);

  useEffect(() => {
    if (mode !== "duel" || bootRef.current) return;
    if (duelKind === "bot") {
      bootRef.current = true;
      hostRef.current = true;
      dispatch({
        type: "CREATE_LOCAL_DUEL",
        seed: randomSeed(),
        now: Date.now(),
        difficulty: settings.difficulty,
        matchLength: settings.matchLength,
        atlas: settings.atlas,
        avoidLocationIds: loadRecentIds(),
        seats: [
          { id: selfId, name, avatarId },
          { id: GROK_BOT_ID, name: GROK_BOT_NAME, avatarId: "grok", kind: "bot" },
        ],
      });
      return;
    }
    if (duelKind === "hotseat") {
      bootRef.current = true;
      hostRef.current = true;
      let guest = { name: "Rival", avatarId: "canal" };
      try {
        const raw = sessionStorage.getItem("atlas-hotseat-v1");
        if (raw) guest = { ...guest, ...JSON.parse(raw) };
      } catch {
        /* ignore */
      }
      dispatch({
        type: "CREATE_LOCAL_DUEL",
        hotseat: true,
        seed: randomSeed(),
        now: Date.now(),
        difficulty: settings.difficulty,
        matchLength: settings.matchLength,
        atlas: settings.atlas,
        avoidLocationIds: loadRecentIds(),
        seats: [
          { id: selfId, name, avatarId },
          { id: "seat-2", name: guest.name, avatarId: sanitizeAvatar(guest.avatarId) },
        ],
      });
    }
  }, [
    mode,
    duelKind,
    selfId,
    name,
    avatarId,
    dispatch,
    settings.difficulty,
    settings.matchLength,
    settings.atlas,
  ]);

  useEffect(() => {
    if (mode !== "duel" || duelKind !== "online" || serverMode) return;
    if (isCreator && state.phase === "lobby") {
      hostRef.current = true;
      try {
        const raw = sessionStorage.getItem(`atlas-host:${roomCode}`);
        if (raw) {
          const saved = JSON.parse(raw, (_key, value) =>
            value === "__Infinity" ? Infinity : value,
          ) as MatchState;
          if (
            saved.hostId === selfId &&
            saved.roomCode === roomCode &&
            Date.now() - saved.lastEventAt < 2 * 60 * 60 * 1000
          ) {
            dispatch({ type: "HYDRATE", state: saved });
            return;
          }
        }
      } catch {
        /* A corrupt cache starts a fresh room. */
      }

      dispatch({
        type: "CREATE_DUEL",
        playerId: selfId,
        name,
        avatarId,
        roomCode: roomCode ?? "ROOM",
        seed: randomSeed(),
        now: Date.now(),
        difficulty: settings.difficulty,
        matchLength: settings.matchLength,
        atlas: settings.atlas,
        avoidLocationIds: loadRecentIds(),
      });
    }
  }, [
    mode,
    duelKind,
    serverMode,
    isCreator,
    selfId,
    name,
    avatarId,
    roomCode,
    dispatch,
    state.phase,
    settings.difficulty,
    settings.matchLength,
    settings.atlas,
  ]);

  useEffect(() => {
    if (mode !== "duel" || serverMode) return;
    return p2pOnMessage((_from, data) => {
      if (!isWireMessage(data)) return;
      const msg = data as WireMessage;
      if (msg.t === "snapshot") {
        if (hostRef.current || msg.state.hostId !== _from) return;
        if (stateRef.current.hostId && stateRef.current.hostId !== _from) return;
        clockOffset.current = msg.sentAt - Date.now();
        setState((prev) => mergeHostSnapshot(prev, msg.state, selfId));
        return;
      }
      if (!hostRef.current) return;
      const now = Date.now();
      if (msg.t === "hello") {
        if (msg.peerId !== _from) return;
        dispatch({
          type: "PLAYER_JOIN",
          playerId: _from,
          name: sanitizeName(msg.name),
          avatarId: sanitizeAvatar(msg.avatarId),
          now,
        });
        p2pSend({ t: "snapshot", state: toPublicSnapshot(stateRef.current), sentAt: now }, _from);
        return;
      }
      const current = stateRef.current;
      if (!current.players.some((p) => p.id === _from) || !matchesQuestion(current, msg)) return;
      if (msg.t === "lock") {
        dispatch({
          type: "PLACE_PIN",
          playerId: _from,
          guess: { latitude: msg.lat, longitude: msg.lng },
          now,
        });
        dispatch({ type: "LOCK", playerId: _from, now });
      }
      if (msg.t === "continue") dispatch({ type: "CONTINUE", now });
      if (msg.t === "rematch" && ["final_reveal", "match_complete"].includes(current.phase))
        dispatch({ type: "REMATCH", seed: msg.nextSeed, now });
    });
  }, [mode, serverMode, p2pOnMessage, p2pSend, dispatch, selfId]);

  useEffect(() => {
    if (!serverMode) return;
    return socketOnMessage({
      onWelcome: (_id, snapshot, sentAt) => {
        if (sentAt) clockOffset.current = sentAt - Date.now();
        adoptSnapshot(snapshot as MatchState);
      },
      onSnapshot: (snapshot, sentAt) => {
        if (sentAt) clockOffset.current = sentAt - Date.now();
        adoptSnapshot(snapshot as MatchState);
      },
    });
  }, [serverMode, socketOnMessage, adoptSnapshot]);

  useEffect(() => {
    if (mode !== "duel" || !hostRef.current || serverMode) return;
    if (state.seq === 0) return;
    p2pSend({ t: "snapshot", state: toPublicSnapshot(state), sentAt: Date.now() });
  }, [mode, serverMode, p2pSend, state]);

  // While the room is filling there is no other state change to trigger a
  // resend, yet the data channel often opens AFTER CREATE_DUEL was
  // broadcast. Re-announce on a timer so a late joiner can never miss the
  // only snapshot that ever carried the room.
  useEffect(() => {
    if (mode !== "duel" || duelKind !== "online" || !hostRef.current || serverMode) return;
    const send = () =>
      p2pSend({ t: "snapshot", state: toPublicSnapshot(stateRef.current), sentAt: Date.now() });
    send();
    const id = window.setInterval(send, 2500);
    return () => window.clearInterval(id);
  }, [mode, duelKind, serverMode, p2pSend, state.phase]);

  // Whether the host's state actually has a seat for us yet.
  const seated = Boolean(state.hostId) && state.players.some((p) => p.id === selfId);

  useEffect(() => {
    if (mode !== "duel" || duelKind !== "online" || serverMode) return;
    // Keep announcing until this player is IN the host's game — not merely
    // until a peer is visible. A host that received our hello may have had
    // its reply lost; a resend costs nothing and unsticks the room.
    if (hostRef.current) return;
    // Once seated, stop: the host answers every hello with a full snapshot to
    // the whole room, so announcing for the rest of the match floods the wire
    // and re-renders both clients twice a second for nothing.
    if (seated) return;
    const ping = () => p2pSend({ t: "hello", peerId: selfId, name, avatarId });
    ping();
    const id = window.setInterval(ping, 1500);
    return () => window.clearInterval(id);
  }, [mode, duelKind, serverMode, p2pSend, selfId, name, avatarId, seated]);

  useEffect(() => {
    if (
      mode !== "duel" ||
      duelKind !== "online" ||
      !hostRef.current ||
      serverMode ||
      !roomCode ||
      !state.hostId
    )
      return;
    try {
      sessionStorage.setItem(
        `atlas-host:${roomCode}`,
        JSON.stringify(state, (_key, value) => (value === Infinity ? "__Infinity" : value)),
      );
    } catch {
      /* Refresh recovery is optional. */
    }
  }, [state, mode, duelKind, serverMode, roomCode]);

  // The P2P transport drops a peer from the roster once its signaling lease
  // expires (~30s). Treat a missing opponent as a forfeit so the host does
  // not play out every remaining round against a ghost. The countdown keys
  // on the missing set, not on every state update.
  const ghostKey = useMemo(() => {
    if (mode !== "duel" || duelKind !== "online" || serverMode || !hostRef.current) return "";
    if (!state.hostId || state.hostId !== selfId) return "";
    const roster = new Set(p2pPeers.map((peer) => peer.id));
    return state.players
      .filter((p) => p.kind === "human" && p.id !== selfId && p.connected && !roster.has(p.id))
      .map((p) => p.id)
      .join(",");
  }, [mode, duelKind, serverMode, p2pPeers, state.hostId, state.players, selfId]);

  useEffect(() => {
    if (!ghostKey) return;
    const ids = ghostKey.split(",");
    const id = window.setTimeout(() => {
      for (const ghostId of ids) {
        dispatch({ type: "PLAYER_LEAVE", playerId: ghostId, now: Date.now() });
      }
    }, 8000);
    return () => window.clearTimeout(id);
  }, [ghostKey, dispatch]);

  const grokTimer = useRef(0);
  const grokQ = useRef(-1);
  const grokSeed = useRef(-1);

  useEffect(() => {
    if (mode !== "duel" || duelKind !== "bot") return;
    if (state.phase !== "round_active" && state.phase !== "waiting_for_opponent") return;
    if (grokQ.current === state.questionIndex && grokSeed.current === state.seed) return;
    grokQ.current = state.questionIndex;
    grokSeed.current = state.seed;
    const place = activeLocation(state);
    const bot = state.players.find((p) => p.kind === "bot");
    if (!place || !bot || bot.locked) return;
    const cap = Math.max(1400, (state.durationSec || ROUND_DURATION_SEC) * 1000 - 2000);
    const wait = Math.min(grokThinkMs(place.difficulty, state.seed, state.questionIndex), cap);
    window.clearTimeout(grokTimer.current);
    grokTimer.current = window.setTimeout(() => {
      const s = stateRef.current;
      const b = s.players.find((p) => p.kind === "bot");
      if (!b || b.locked) return;
      const loc = activeLocation(s);
      if (!loc) return;
      const now = Date.now();
      dispatch({
        type: "PLACE_PIN",
        playerId: b.id,
        guess: grokGuess(loc, s.seed, s.questionIndex),
        now,
      });
      dispatch({ type: "LOCK", playerId: b.id, now: now + 1 });
    }, wait);
    // The bot reads the live state through stateRef; re-running on every pin
    // would keep resetting its think timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, duelKind, state.phase, state.questionIndex, state.seed, state.durationSec, dispatch]);

  useEffect(() => () => window.clearTimeout(grokTimer.current), []);

  const loc = activeLocation(state);
  // Mark each site seen as soon as it is on screen (a guest learns it at the
  // reveal), so a match left halfway still keeps the next one from repeating it.
  const shownId =
    loc && !["lobby", "waiting_for_players", "match_starting", "rematch_pending"].includes(state.phase)
      ? loc.id
      : undefined;
  useEffect(() => {
    if (shownId) rememberRecentIds([shownId]);
  }, [shownId]);
  const scene = activeScene(state);
  const env = activeEnvironment(state);
  // If the 360 plate cannot render, fall back to the first flat candidate
  // instead of feeding the equirectangular image to the still viewer.
  const flatScene = useMemo(() => {
    if (!scene) return undefined;
    if (!panoFailed || !scene.isPano) return scene;
    const [first, ...rest] = scene.fallbacks;
    return { ...scene, src: first ?? scene.src, fallbacks: rest, isPano: false };
  }, [scene, panoFailed]);
  useEffect(() => {
    setPanoFailed(false);
    setScene3dFailed(false);
  }, [scene?.src, env?.id]);

  // Warm the next plate while the player studies the current one. Only the
  // host/solo knows the deck, so guests simply skip this.
  useEffect(() => {
    if (!loc) return;
    if (state.questionIndex + 1 >= (state.totalQuestions || TOTAL_QUESTIONS)) return;
    const next = locationAt(state, state.questionIndex + 1);
    if (!next) return;
    const src = next.panoUrl ?? next.sceneUrl;
    if (!src || !src.startsWith("/")) return;
    const img = new Image();
    img.decoding = "async";
    img.srcset = responsiveSceneSrcSet(src) ?? "";
    img.sizes = "100vw";
    img.src = src;
    // `state` is read for the deck lookup; questionIndex/totalQuestions are
    // the only values that should re-run this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc, state.questionIndex, state.totalQuestions]);
  const reconstructionRound = isRound4(state);
  const live3d = ROUND4_3D_LIVE && reconstructionRound && Boolean(env);
  const you =
    duelKind === "hotseat"
      ? (state.players.find((p) => p.id === state.activeSeatId) ?? state.players[0])
      : (state.players.find((p) => p.id === selfId) ?? state.players[0]);
  const opponent = state.players.find((p) => p.id !== you?.id);
  const showingReveal =
    state.phase === "round_reveal" ||
    state.phase === "round_expired" ||
    state.phase === "round_results";
  const lastRound = state.questionIndex >= (state.totalQuestions || TOTAL_QUESTIONS) - 1;
  // The end-of-round splash plays once per reveal; the result card follows it,
  // so the card's own animation runs while the player is looking at it.
  const revealKey = showingReveal ? `${state.questionIndex}:${state.roundStartedAtMs ?? 0}` : null;
  const [splashSeen, setSplashSeen] = useState<string | null>(null);
  const [summarySeen, setSummarySeen] = useState<string | null>(null);
  const questionSplash =
    revealKey !== null && splashSeen !== revealKey && Boolean(you?.roundScore);
  // When the question closes a multi-question round (Quick is one round of
  // ten), the round summary follows the question's own splash.
  const summarySplash =
    revealKey !== null && !questionSplash && summarySeen !== revealKey && endsRound(state);
  const splashing = questionSplash || summarySplash;
  const canGuess =
    Boolean(you) &&
    !you?.locked &&
    !(pendingLock && matchesQuestion(state, pendingLock)) &&
    (state.phase === "round_active" ||
      state.phase === "waiting_for_opponent" ||
      state.phase === "player_locked") &&
    (duelKind !== "hotseat" || you?.id === state.activeSeatId) &&
    !(duelKind === "hotseat" && state.phase === "waiting_for_opponent");

  const finishIntro = useCallback(() => {
    if (stateRef.current.phase !== "round_intro") return;
    const now = mode === "solo" ? performance.now() : Date.now();
    if (serverMode) {
      socketSend({ t: "intro", questionIndex: stateRef.current.questionIndex });
      return;
    }
    if (mode === "duel" && duelKind === "online" && !hostRef.current) {
      return;
    }
    dispatch({ type: "INTRO_DONE", now });
  }, [mode, duelKind, serverMode, dispatch, socketSend]);

  const continueRound = useCallback(() => {
    const now = mode === "solo" ? performance.now() : Date.now();
    if (serverMode) {
      socketSend({ t: "continue", questionIndex: stateRef.current.questionIndex });
      return;
    }
    if (mode === "duel" && duelKind === "online" && !hostRef.current)
      p2pSend({
        t: "continue",
        roundStartedAtMs: stateRef.current.roundStartedAtMs,
        questionIndex: stateRef.current.questionIndex,
      });
    else dispatch({ type: "CONTINUE", now });
  }, [mode, duelKind, serverMode, dispatch, p2pSend, socketSend]);

  useEffect(() => {
    if (state.phase !== "round_intro") return;
    const wait = settings.reducedMotion ? 400 : 1600;
    const id = setTimeout(finishIntro, wait);
    return () => clearTimeout(id);
  }, [state.phase, settings.reducedMotion, finishIntro]);

  useEffect(() => {
    const ticking =
      state.roundStartedAtMs != null &&
      (state.phase === "round_active" ||
        ((state.phase === "waiting_for_opponent" || state.phase === "player_locked") &&
          duelKind !== "hotseat"));
    if (!ticking) return;
    const clock = () =>
      mode === "solo"
        ? performance.now()
        : Date.now() + (serverMode || !hostRef.current ? clockOffset.current : 0);
    const duration = state.durationSec || ROUND_DURATION_SEC;
    const fire = () => {
      const now = clock();
      const rem = remainingSeconds(state.roundStartedAtMs!, now, duration);
      setRemaining(rem);
      if (rem > 0) return false;
      if (serverMode || (mode === "duel" && duelKind === "online" && !hostRef.current)) return true;
      dispatch({ type: "TIMEOUT", now });
      return true;
    };
    let raf = 0;
    const loop = () => {
      if (fire()) return;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // rAF stops in hidden tabs. A wall-clock timer plus a visibility catch-up
    // keeps the host's authoritative timeout firing while backgrounded.
    const rem0 = remainingSeconds(state.roundStartedAtMs!, clock(), duration);
    const timeoutId = window.setTimeout(fire, Math.max(0, rem0 * 1000) + 150);
    const onVisible = () => {
      if (document.visibilityState === "visible") fire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    state.phase,
    state.roundStartedAtMs,
    state.durationSec,
    mode,
    duelKind,
    serverMode,
    dispatch,
  ]);

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
      setRemaining(state.durationSec || ROUND_DURATION_SEC);
    }
    if (state.phase === "round_active") {
      setRemaining(state.durationSec || ROUND_DURATION_SEC);
      // Phones use the split layout; collapsing there would shrink the map.
      if (!window.matchMedia("(max-width: 640px)").matches) setExpanded(false);
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
    if (state.phase === "final_reveal")
      audio.play(state.winnerIds.includes(selfId) ? "win" : "lose");
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPendingLock(null);
    setExploring(false);
  }, [state.questionIndex, state.roundStartedAtMs]);

  useEffect(() => {
    if (state.phase !== "match_complete" && state.phase !== "final_reveal") return;
    if (statsRecorded.current) return;
    statsRecorded.current = true;
    // Hotseat switches the active seat; record the seat that just finished so
    // its score, distances and win flag all describe the same player.
    const statsId = you?.id ?? selfId;
    const distances = state.roundHistory
      .map((r) => r.guesses[statsId]?.score.distanceKm)
      .filter((d) => d != null) as number[];
    const za = { n: 0, hits: 0 };
    const nl = { n: 0, hits: 0 };
    const world = { n: 0, hits: 0 };
    for (const r of state.roundHistory) {
      const g = r.guesses[statsId];
      if (!g) continue;
      const country = getLocation(r.locationId)?.country;
      const bucket = country === "NL" ? nl : country === "WORLD" ? world : za;
      bucket.n += 1;
      if (g.score.countryCorrect) bucket.hits += 1;
    }
    const fastest = state.roundHistory
      .map((r) => r.guesses[statsId]?.score)
      .filter((s) => s && s.distanceKm <= 5)
      .map((s) => s!.responseMs);
    recordMatch(loadStats(), {
      score: you?.totalScore ?? 0,
      won: state.mode === "duel" && state.winnerIds.includes(statsId),
      distances,
      countryHits: { ZA: za, NL: nl, WORLD: world },
      fastestAccurateMs: fastest.length ? Math.min(...fastest) : null,
    });
  }, [
    state.phase,
    state.locationIds,
    state.roundHistory,
    state.winnerIds,
    state.mode,
    selfId,
    you,
  ]);

  const onGuess = (p: LatLng) => {
    if (!canGuess) return;
    audio.play("pin");
    const now = mode === "solo" ? performance.now() : Date.now();
    const actor = you?.id ?? selfId;
    if (mode === "duel" && duelKind === "online") {
      if (serverMode || !hostRef.current)
        setState((current) => ({
          ...current,
          players: current.players.map((player) =>
            player.id === selfId ? { ...player, guess: p } : player,
          ),
        }));
      else dispatch({ type: "PLACE_PIN", playerId: actor, guess: p, now });
      if (serverMode)
        socketSend({
          t: "pin",
          lat: p.latitude,
          lng: p.longitude,
          questionIndex: state.questionIndex,
        });
    } else dispatch({ type: "PLACE_PIN", playerId: actor, guess: p, now });
  };

  const lock = useCallback(() => {
    const current = stateRef.current;
    const me =
      duelKind === "hotseat"
        ? current.players.find((p) => p.id === current.activeSeatId)
        : current.players.find((p) => p.id === selfId);
    if (
      !me?.guess ||
      me.locked ||
      !["round_active", "waiting_for_opponent", "player_locked"].includes(current.phase)
    )
      return;
    if (duelKind === "hotseat" && current.phase === "waiting_for_opponent") return;
    audio.play("lock");
    const pending = {
      roundStartedAtMs: current.roundStartedAtMs,
      questionIndex: current.questionIndex,
      lat: me.guess.latitude,
      lng: me.guess.longitude,
    };
    if (serverMode) {
      // Hold it pending here too: the lock is only real once the server says
      // so, and until then the button must not fire a second one.
      setPendingLock(pending);
      socketSend({
        t: "lock",
        lat: pending.lat,
        lng: pending.lng,
        questionIndex: pending.questionIndex,
      });
      return;
    }
    if (mode === "duel" && duelKind === "online" && !hostRef.current) {
      setPendingLock(pending);
      p2pSend({ t: "lock", ...pending });
    } else
      dispatch({
        type: "LOCK",
        playerId: me.id,
        now: mode === "solo" ? performance.now() : Date.now(),
      });
  }, [mode, duelKind, serverMode, socketSend, dispatch, p2pSend, selfId]);

  // P2P has no delivery guarantee, so an unacknowledged lock is retried until
  // the host's snapshot shows it. The socket transport replays from its own
  // outbox instead, and needs no polling.
  useEffect(() => {
    if (serverMode || !pendingLock || you?.locked || state.revealed) return;
    if (
      !matchesQuestion(
        { roundStartedAtMs: state.roundStartedAtMs, questionIndex: state.questionIndex },
        pendingLock,
      )
    )
      return;
    const id = window.setInterval(() => p2pSend({ t: "lock", ...pendingLock }), 900);
    return () => window.clearInterval(id);
  }, [
    serverMode,
    pendingLock,
    state.roundStartedAtMs,
    state.questionIndex,
    state.revealed,
    you?.locked,
    p2pSend,
  ]);

  const quit = () => {
    audio.stopAmbience();
    void navigate({ to: "/" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable;
      if (e.key === "Escape") {
        setExploring(false);
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
      if (
        e.key === "Enter" &&
        (state.phase === "round_active" ||
          (state.phase === "waiting_for_opponent" && duelKind === "online"))
      ) {
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
  }, [state.phase, showSettings, lock, finishIntro, continueRound, showingReveal, duelKind]);

  // Both transports report trouble the same way: the P2P room through its
  // error channel, the socket by not being open. Without this, a dropped
  // match-server connection was invisible mid-round.
  const connectionNotice =
    mode === "duel" && duelKind === "online"
      ? serverMode
        ? socketConnected
          ? null
          : "Connection lost. Reconnecting…"
        : p2pError
      : null;

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !roomCode) return "";
    return `${window.location.origin}/duel/${roomCode}`;
  }, [roomCode]);

  if (
    mode === "duel" &&
    (state.phase === "lobby" ||
      state.phase === "waiting_for_players" ||
      state.phase === "rematch_pending")
  ) {
    const failed = p2pPeers.some((peer) => peer.connectionState === "failed");
    return (
      <main className="min-h-dvh bg-bg px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.28em] text-muted">Private room</p>
            <div className="-my-2">
              <MusicHudButton />
            </div>
          </div>
          <h1 className="font-display mt-2 text-5xl tracking-tight">{roomCode}</h1>
          <p className="mt-3 text-muted">Share the invite. Start when you’re both ready.</p>
          <div className="mt-6 flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl || roomCode || "");
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied" : "Copy invite"}
            </Button>
          </div>
          <input
            aria-label="Invite link"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.target.select()}
            className="atlas-search mt-3 text-xs"
          />
          <ul className="mt-8 space-y-2">
            {state.players.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border px-3 py-3"
              >
                <PlayerAvatar id={p.avatarId} size={40} />
                <span className="min-w-0 truncate">
                  {p.name} {p.id === state.hostId ? "· host" : ""}
                </span>
              </li>
            ))}
            {state.players.length < 2 && (
              <li className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-3 text-muted">
                {(serverMode ? null : p2pError) ??
                  (failed
                    ? "Using the room relay to connect"
                    : (serverMode ? socketJoined && socketConnected : p2pJoined)
                      ? "Waiting for opponent"
                      : "Connecting…")}
              </li>
            )}
          </ul>
          {hostRef.current && !serverMode && (
            <Button
              className="mt-8 w-full"
              disabled={state.players.length < 2}
              onClick={() => dispatch({ type: "START_MATCH", now: Date.now() })}
            >
              {state.players.length < 2 ? "Waiting for opponent" : "Start match"}
            </Button>
          )}
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => void navigate({ to: "/duel/bot" })}
          >
            <PlayerAvatar id="grok" size={24} />
            Play vs Grok instead
          </Button>
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
        reducedMotion={settings.reducedMotion}
        onRematch={() => {
          statsRecorded.current = false;
          const seed = randomSeed();
          if (serverMode) {
            socketSend({ t: "rematch" });
            return;
          }
          if (mode === "duel" && duelKind === "online" && !hostRef.current)
            p2pSend({
              t: "rematch",
              nextSeed: seed,
              roundStartedAtMs: state.roundStartedAtMs,
              questionIndex: state.questionIndex,
            });
          else
            dispatch({
              type: "REMATCH",
              seed,
              now: mode === "solo" ? performance.now() : Date.now(),
              difficulty: settings.difficulty,
              matchLength: settings.matchLength,
              atlas: settings.atlas,
              avoidLocationIds: loadRecentIds(),
            });
        }}
        onHome={quit}
      />
    );
  }

  const qNum = state.matchLength === "escape" ? 1 : questionInRound(state.questionIndex) + 1;
  const rounds = state.totalRounds || 4;
  const roundLabel =
    state.matchLength === "escape"
      ? `Round ${state.roundIndex + 1} of ${rounds}${state.questionIndex === 4 && state.atlas.preset === "sa-nl" && !state.atlas.cities?.length ? " · World wildcard" : ""}`
      : `Round ${state.roundIndex + 1} of ${rounds} · Q${qNum}/${Math.min(QUESTIONS_PER_ROUND, state.totalQuestions - state.roundIndex * QUESTIONS_PER_ROUND)}`;
  const urgent = remaining <= 10 && state.phase === "round_active" && !you?.locked;

  return (
    <main
      ref={gameRoot}
      className={cn(
        "match-stage relative min-h-dvh overflow-hidden bg-bg",
        exploring && !showingReveal && "is-exploring",
        shake && "atlas-shake",
      )}
    >
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
          <p className="atlas-rise text-xs uppercase tracking-[0.28em] text-muted">
            {atlasLabel(state.atlas)} · {roundLabel}
          </p>
          <h1 className="atlas-rise atlas-rise-1 font-display mt-3 text-5xl sm:text-7xl">
            Locate this
          </h1>
          <p className="atlas-rise atlas-rise-2 mt-4 max-w-sm text-sm text-muted">
            {reconstructionRound
              ? ROUND4_3D_LIVE
                ? "3D reconstruction · not a live photograph"
                : "Reconstruction · illustrated geography"
              : `${state.durationSec || 45} seconds · trust your instincts`}
          </p>
          <p className="atlas-rise atlas-rise-3 mt-8 text-xs uppercase tracking-[0.2em] text-subtle">
            Tap or Enter to start
          </p>
        </div>
      )}

      <div className="scene-viewport">
        {live3d && env && !scene3dFailed ? (
          <Round4Scene
            key={env.id}
            env={env}
            reducedMotion={settings.reducedMotion}
            onUnavailable={() => setScene3dFailed(true)}
          />
        ) : scene?.isPano && !panoFailed ? (
          <PanoViewer
            key={scene.src}
            src={scene.src}
            imageId={scene.imageId}
            provider={scene.provider}
            heading={scene.heading}
            pitch={scene.pitch}
            alt="Location to identify"
            reducedMotion={settings.reducedMotion}
            interactive={canGuess && !showSettings && !showingReveal}
            onError={() => setPanoFailed(true)}
          />
        ) : flatScene ? (
          <SceneExplorer
            key={flatScene.src}
            src={flatScene.src}
            fit={settings.photoFit}
            onToggleFit={() =>
              setSettings((current) => ({
                ...current,
                photoFit: current.photoFit === "contain" ? "cover" : "contain",
              }))
            }
            showHints={settings.showHints}
            fallbacks={flatScene.fallbacks}
            sourceUrl={loc?.sourceUrl}
            title={loc?.title}
            alt="Location to identify"
            reducedMotion={settings.reducedMotion}
            interactive={canGuess && !showSettings && !showingReveal}
          />
        ) : (
          <div className="absolute inset-0 bg-bg-subtle" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.22)_0%,transparent_18%,transparent_78%,rgba(9,9,11,0.28)_100%)]" />
      </div>

      <header className="match-hud relative z-20 flex items-start justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex flex-col gap-2">
          {!showingReveal && (
            <TimerRing
              remaining={remaining}
              duration={state.durationSec || 45}
              urgent={urgent}
              locked={Boolean(you?.locked && !showingReveal)}
            />
          )}
          <RoundPips index={state.roundIndex} total={state.totalRounds || 4} />
          {state.matchLength !== "escape" && <QuestionMark current={qNum} />}
          {reconstructionRound ? (
            <div className="w-fit rounded-full border border-border bg-bg/75 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted">
              {ROUND4_3D_LIVE ? "3D reconstruction" : "Reconstruction plates"}
            </div>
          ) : null}
        </div>
        <div className="flex items-start gap-2">
          {!showingReveal && (
            <button
              type="button"
              className="view-mode-button"
              aria-pressed={exploring}
              onClick={() => setExploring((v) => !v)}
            >
              {exploring ? <Map size={17} /> : <Eye size={17} />}
              <span>{exploring ? "Show map" : "Explore view"}</span>
            </button>
          )}
          {canFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={fullScreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={toggleFullscreen}
            >
              {fullScreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </Button>
          )}
          {mode === "duel" && state.players.length > 1 && !showingReveal ? (
            <ScoreTally players={state.players} selfId={you?.id} />
          ) : mode === "duel" && showingReveal ? null : (
            <div className="flex items-center gap-2">
              <PlayerAvatar id={you?.avatarId} size={36} />
              <div className="rounded-[var(--radius-sm)] border border-border bg-bg/70 px-3 py-2 text-right">
                <div className="text-[10px] uppercase tracking-wider text-subtle">Score</div>
                <div className="font-display tabular text-lg leading-none">
                  <RollingScore
                    value={you?.totalScore ?? 0}
                    reducedMotion={settings.reducedMotion}
                  />
                </div>
              </div>
            </div>
          )}
          <MusicHudButton />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            onClick={() => setShowSettings(true)}
          >
            <SettingsIcon className="size-5" />
          </Button>
        </div>
      </header>

      {(you?.locked || (pendingLock && matchesQuestion(state, pendingLock))) && !showingReveal && (
        <p className="relative z-20 mx-4 mt-1 w-fit rounded-full border border-border bg-bg/80 px-3 py-1 text-xs uppercase tracking-wider">
          {!you?.locked
            ? "Sending your guess…"
            : opponent?.kind === "bot"
              ? "Grok is guessing…"
              : "Guess locked"}
          {mode === "duel" && duelKind === "online" ? ` · ${Math.ceil(remaining)}s left` : ""}
        </p>
      )}

      {duelKind === "hotseat" && state.phase === "waiting_for_opponent" && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-bg/92 px-6 text-center">
          <PlayerAvatar id={you?.avatarId} size={72} />
          <p className="mt-5 text-xs uppercase tracking-[0.28em] text-muted">Pass the phone</p>
          <h2 className="font-display mt-2 text-4xl">{you?.name}</h2>
          <p className="mt-3 max-w-sm text-muted">
            Same location. Fresh {state.durationSec || 45} seconds. Don’t peek at the last pin.
          </p>
          <Button
            className="mt-8"
            size="lg"
            onClick={() => dispatch({ type: "HANDOFF_DONE", now: Date.now() })}
          >
            I’m {you?.name}
          </Button>
        </div>
      )}

      {settings.showHints &&
        !exploring &&
        state.phase === "round_active" &&
        !you?.guess &&
        !you?.locked && (
          <p className="relative z-20 mx-4 mt-2 w-fit rounded-full border border-border bg-bg/75 px-3 py-1.5 text-xs text-muted">
            Tap the map to drop a pin
          </p>
        )}

      {(loc || scene) && (
        <div hidden={exploring && !showingReveal}>
          <GuessMap
            guess={you?.guess}
            onGuess={onGuess}
            disabled={!canGuess}
            expanded={expanded}
            onToggleExpand={() => setExpanded((v) => !v)}
            truth={showingReveal ? state.truth : undefined}
            opponent={
              showingReveal && opponent?.guess
                ? { guess: opponent.guess, name: opponent.name }
                : null
            }
            reveal={showingReveal}
            selfName={you?.name}
            reducedMotion={settings.reducedMotion}
            urgent={urgent}
            onLock={canGuess ? lock : undefined}
            canLock={Boolean(you?.guess)}
            atlas={
              state.matchLength === "escape" &&
              state.questionIndex === 4 &&
              state.atlas.preset === "sa-nl" &&
              !state.atlas.cities?.length
                ? { preset: "mix", nations: [] }
                : state.atlas
            }
          />
        </div>
      )}

      {summarySplash && you && (
        <RoundSummarySplash
          key={`${revealKey}:summary`}
          history={state.roundHistory}
          players={opponent ? [you, opponent] : [you]}
          selfId={you.id}
          roundIndex={state.roundIndex}
          totalRounds={state.totalRounds || 1}
          markSelf={duelKind !== "hotseat"}
          reducedMotion={settings.reducedMotion}
          onDone={() => setSummarySeen(revealKey)}
        />
      )}

      {questionSplash && you?.roundScore && (
        <RoundSplash
          key={revealKey}
          players={opponent ? [you, opponent] : [you]}
          selfId={you.id}
          score={you.roundScore}
          headline={
            Number.isFinite(you.roundScore.distanceKm)
              ? FEEDBACK_COPY[you.roundScore.feedback]
              : "TIME’S UP"
          }
          roundLabel={roundLabel}
          winUnit={
            state.matchLength === "escape"
              ? "the round"
              : `question ${questionInRound(state.questionIndex) + 1}`
          }
          markSelf={duelKind !== "hotseat"}
          reducedMotion={settings.reducedMotion}
          onDone={() => setSplashSeen(revealKey)}
        />
      )}

      {showingReveal && !splashing && you?.roundScore && loc && (
        <RevealOverlay
          score={you.roundScore}
          you={you}
          opponent={opponent}
          locationTitle={loc.title}
          city={loc.city}
          country={loc ? locationCountryLabel(loc) : ""}
          roundLabel={roundLabel}
          lastRound={lastRound}
          expanded={expanded}
          timedOut={state.phase === "round_expired"}
          reducedMotion={settings.reducedMotion}
          markSelf={duelKind !== "hotseat"}
          onContinue={continueRound}
        />
      )}

      {scene?.kind === "generated" && !showingReveal && (
        <p className="pointer-events-none absolute left-3 bottom-[calc(var(--atlas-map-h)+0.75rem)] z-10 max-w-[52%] text-[10px] leading-snug text-subtle max-sm:max-w-[70%]">
          Reconstruction · not a live street photo
        </p>
      )}

      {connectionNotice && (
        <p
          role="status"
          className="absolute top-32 left-4 z-30 rounded-xl bg-bg/95 border border-border px-4 py-2 text-xs"
        >
          {connectionNotice}
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
