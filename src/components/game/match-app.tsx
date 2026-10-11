import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@/lib/navigation";
import {
  Check,
  Copy,
  Eye,
  Map,
  Maximize,
  Minimize,
  Flame,
  Pause as PauseIcon,
  Settings as SettingsIcon,
  Share2,
} from "lucide-react";
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
  feedbackHeadline,
  grokThinkMs,
  GROK_BOT_ID,
  GROK_BOT_NAME,
  isRound4,
  streetViewTarget,
  streetViewStatus,
  streetViewUsable,
  canSwapPlace,
  locationAt,
  locationCountryLabel,
  placeCity,
  scoreStreak,
  QUESTIONS_PER_ROUND,
  questionInRound,
  ROUND4_3D_LIVE,
  TOTAL_QUESTIONS,
  loadSettings,
  damageMultiplier,
  isHealthDuel,
  matchOver,
  MOVEMENT_NAME,
  START_HEALTH,
  levelOf,
  movementOf,
  placeByPlace,
  streakCount,
  roundMoment,
  loadStats,
  isNewBest,
  previousBest,
  randomSeed,
  loadRecentIds,
  recordMatch,
  recordStreak,
  recordCareer,
  nationOf,
  ROUND_MAX,
  type CareerAward,
  type MatchSummary,
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
import { PlayerAvatar } from "./player-avatar";
import { RevealOverlay } from "./reveal-sequence";
import { RollingScore } from "./rolling-score";
import { useMusic } from "@/lib/music/use-music";
import { LockStamp } from "./lock-stamp";
import { PointsFly } from "./points-fly";
import { PointsPot } from "./points-pot";
import { PauseMenu } from "./pause-menu";
import { VsFaceoff } from "./vs-faceoff";
import { RoundIntro } from "./round-intro";
import { RoundSplash } from "./round-splash";
import { RoundSummarySplash } from "./round-summary-splash";
import { SceneExplorer } from "./scene-explorer";
import { StreetViewScene } from "./street-view-scene";
import { SettingsPanel } from "./settings-panel";
import { MatchMeta, QuestionMark, RoundPips, TimerRing } from "./timer-ring";
import { ScoreTally } from "./score-tally";
import { FinalResults } from "./final-results";
import { cn, copyText } from "@/lib/utils";
import { applyTheme, useTheme } from "@/lib/theme";
import { DotGlobe } from "@/components/motion/dot-globe";
import { globeForAtlas } from "@/components/motion/globe-presets";

// three.js and the reconstruction scene load only when a round needs them, so
// flat-photo matches (most of them) never download the 3D code.
const PanoViewer = lazy(() => import("./pano-viewer").then((m) => ({ default: m.PanoViewer })));
const Round4Scene = lazy(() => import("./round4-scene").then((m) => ({ default: m.Round4Scene })));
// The cosmos round (Voyage and Odyssey only) loads its painters on demand.
const CosmosScene = lazy(() =>
  import("@/components/motion/cosmos-scene").then((m) => ({ default: m.CosmosScene })),
);
const CosmicRuler = lazy(() => import("./cosmic-ruler").then((m) => ({ default: m.CosmicRuler })));

function applyDocumentSettings(settings: GameSettings) {
  document.documentElement.classList.toggle("hc", settings.highContrast);
  document.documentElement.classList.toggle("reduce-motion", settings.reducedMotion);
  void applyTheme(settings.theme);
  audio.setSettings(settings);
  saveSettings(settings);
}

export function MatchApp({
  mode,
  roomCode,
  duelKind = "online",
  streak = false,
}: {
  mode: "solo" | "duel";
  roomCode?: string;
  duelKind?: "online" | "bot" | "hotseat";
  /** Country Streak: a solo run that ends on the first wrong country. */
  streak?: boolean;
}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const mono = theme === "mono";
  // The small status chips under the clock: solid squares in Mono.
  const hudChip = mono ? "bg-bg" : "rounded-full bg-bg/75";
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [state, setState] = useState<MatchState>(() => createLobbyState());
  const [remaining, setRemaining] = useState(ROUND_DURATION_SEC);
  const [expanded, setExpanded] = useState(false);
  const [exploring, setExploring] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const gameRoot = useRef<HTMLElement>(null);
  // Phones place the photo below the HUD instead of under it (styles.css),
  // so nothing in the frame hides behind the timer and score.
  const measureHud = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const root = el.parentElement;
    const set = () =>
      root?.style.setProperty("--atlas-hud-h", `${Math.round(el.offsetTop + el.offsetHeight)}px`);
    set();
    const observer = new ResizeObserver(set);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
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
  const [shutter, setShutter] = useState(0);
  // The native share sheet exists only on some browsers; learn that after mount
  // so the server and first client render agree.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const [shake, setShake] = useState(false);
  const [panoFailed, setPanoFailed] = useState(false);
  // Street View where it is configured and covers the place; the photo is one
  // tap away, and takes over if there is no panorama nearby.
  // The scene whose Street View failed. Keyed to the scene, not a flag, so a
  // failure on one place never carries over to the next before it has tried.
  const [streetFailedSrc, setStreetFailedSrc] = useState<string | null>(null);
  // Every place opens on its photo; Street View is one press away.
  const [viewSource, setViewSource] = useState<"street" | "photo">("photo");
  const [scene3dFailed, setScene3dFailed] = useState(false);
  const [pendingLock, setPendingLock] = useState<{
    roundStartedAtMs?: number;
    questionIndex: number;
    lat: number;
    lng: number;
  } | null>(null);
  const clockOffset = useRef(0);
  const statsRecorded = useRef(false);
  // A record beaten by the match that just ended, keyed by its seed so a
  // rematch's results never show the last match's news.
  const [beatBest, setBeatBest] = useState<{ seed: number; previous: number } | null>(null);
  // What the match added to the career (XP, levels, medals), keyed the same way.
  const [careerAward, setCareerAward] = useState<{ seed: number; award: CareerAward } | null>(null);
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
    streetView: streetViewUsable(),
    movement: settings.movement,
    duelRule: settings.duelRule,
    enabled: serverMode,
  });
  const {
    selfId: p2pSelfId,
    hostId: p2pHostId,
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
  const hostRef = useRef(false);
  // The relay assigns one owner even when both players open an invite directly.
  // Router history is only a navigation hint, never room ownership.
  hostRef.current =
    mode === "solo" ||
    duelKind !== "online" ||
    (!serverMode && (state.hostId === selfId || (state.phase === "lobby" && p2pHostId === selfId)));
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
      streetView: streetViewUsable(),
      movement: settings.movement,
      streak,
    });
  }, [
    settings.movement,
    streak,
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
        streetView: streetViewUsable(),
        movement: settings.movement,
        duelRule: settings.duelRule,
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
        streetView: streetViewUsable(),
        movement: settings.movement,
        duelRule: settings.duelRule,
        seats: [
          { id: selfId, name, avatarId },
          { id: "seat-2", name: guest.name, avatarId: sanitizeAvatar(guest.avatarId) },
        ],
      });
    }
  }, [
    settings.movement,
    settings.duelRule,
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
    if (p2pHostId === selfId && state.phase === "lobby") {
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
        streetView: streetViewUsable(),
        movement: settings.movement,
        duelRule: settings.duelRule,
      });
    }
  }, [
    settings.movement,
    settings.duelRule,
    mode,
    duelKind,
    serverMode,
    p2pHostId,
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

  // Your rival locking in while you still think is news: a short pop says so.
  const opponentLocked = Boolean(
    state.players.find((p) => p.id !== selfId)?.locked,
  );
  const [rivalLockedAt, setRivalLockedAt] = useState(0);
  const sawRivalLock = useRef(false);
  useEffect(() => {
    // When the rival locks first the phase is "waiting_for_opponent": you.
    const live =
      state.phase === "round_active" ||
      state.phase === "player_locked" ||
      state.phase === "waiting_for_opponent";
    const mine = state.players.find((p) => p.id === selfId);
    if (opponentLocked && !sawRivalLock.current && live && !mine?.locked && duelKind !== "hotseat") {
      setRivalLockedAt(Date.now());
    }
    sawRivalLock.current = opponentLocked;
  }, [opponentLocked, state.phase, state.players, selfId, duelKind]);
  useEffect(() => {
    if (!rivalLockedAt) return;
    const id = window.setTimeout(() => setRivalLockedAt(0), 2400);
    return () => window.clearTimeout(id);
  }, [rivalLockedAt]);

  // Rematch handshake: the guest asks, the host accepts.
  const [rematchAsk, setRematchAsk] = useState<string | null>(null);
  const [rematchSent, setRematchSent] = useState(false);
  const finished = state.phase === "final_reveal" || state.phase === "match_complete";
  useEffect(() => {
    if (finished) return;
    setRematchAsk(null);
    setRematchSent(false);
  }, [finished]);

  // The host speaks every 2.5 s (the snapshot heartbeat below). A guest who
  // hears nothing for longer has lost the host: say so, instead of leaving a
  // round on screen that will never resolve.
  const lastHostWord = useRef(0);
  const [hostSilent, setHostSilent] = useState(false);
  useEffect(() => {
    if (mode !== "duel" || duelKind !== "online" || serverMode) return;
    const id = window.setInterval(() => {
      setHostSilent(
        !hostRef.current && lastHostWord.current > 0 && Date.now() - lastHostWord.current > 10_000,
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [mode, duelKind, serverMode]);

  useEffect(() => {
    if (mode !== "duel" || serverMode) return;
    return p2pOnMessage((_from, data) => {
      if (!isWireMessage(data)) return;
      const msg = data as WireMessage;
      if (msg.t === "snapshot") {
        if (hostRef.current || msg.state.hostId !== _from) return;
        if (p2pHostId && p2pHostId !== _from) return;
        if (stateRef.current.hostId && stateRef.current.hostId !== _from) return;
        clockOffset.current = msg.sentAt - Date.now();
        lastHostWord.current = Date.now();
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
      // A guest's rematch is a request: the host may still be reading the
      // results. It shows on the host's screen until they accept.
      if (msg.t === "rematch" && ["final_reveal", "match_complete"].includes(current.phase))
        setRematchAsk(_from);
    });
  }, [mode, serverMode, p2pOnMessage, p2pSend, dispatch, selfId, p2pHostId]);

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
  }, [mode, duelKind, serverMode, p2pSend, state.phase, p2pHostId]);

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
  }, [mode, duelKind, serverMode, p2pSend, selfId, name, avatarId, seated, p2pHostId]);

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
  /** How long Grok meant to think this question (it is scored on this). */
  const grokPlan = useRef(0);
  const grokAnswer = useCallback(() => {
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
    dispatch({ type: "LOCK", playerId: b.id, now: now + 1, responseMs: grokPlan.current });
  }, [dispatch]);
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
    grokPlan.current = wait;
    window.clearTimeout(grokTimer.current);
    grokTimer.current = window.setTimeout(grokAnswer, wait);
    // The bot reads the live state through stateRef; re-running on every pin
    // would keep resetting its think timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, duelKind, state.phase, state.questionIndex, state.seed, state.durationSec, dispatch]);

  // Once you lock, Grok stops dawdling: it answers within a beat (scored on
  // the time it planned, so a fast player does not make it stronger). It used
  // to leave you watching "Grok is guessing…" for up to twenty seconds.
  const youLockedNow = Boolean(
    state.players.find((p) => p.kind !== "bot" && p.id === selfId)?.locked,
  );
  useEffect(() => {
    if (mode !== "duel" || duelKind !== "bot" || !youLockedNow) return;
    const bot = stateRef.current.players.find((p) => p.kind === "bot");
    if (!bot || bot.locked) return;
    window.clearTimeout(grokTimer.current);
    grokTimer.current = window.setTimeout(grokAnswer, 900 + Math.random() * 900);
  }, [mode, duelKind, youLockedNow, grokAnswer]);

  useEffect(() => () => window.clearTimeout(grokTimer.current), []);

  const loc = activeLocation(state);
  // Mark each site seen as soon as it is on screen (a guest learns it at the
  // reveal), so a match left halfway still keeps the next one from repeating it.
  const shownId =
    loc &&
    !["lobby", "waiting_for_players", "match_starting", "rematch_pending"].includes(state.phase)
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
  const streetTarget = useMemo(
    // Once Google has refused the key, photo places stop trying Street View.
    () => (streetViewUsable() ? streetViewTarget(scene, loc ?? undefined) : null),
    // The target only changes with the place on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene?.src, loc?.id],
  );
  // A place with no usable photo of its own is Street View only: its Photo
  // side is the panorama's starting view, frozen.
  const streetOnly = scene?.kind === "street";
  const streetFailed = streetFailedSrc !== null && streetFailedSrc === scene?.src;
  // The scene whose panorama has been found. The Street View / Photo switch
  // waits for it: shown while the search was still running, the switch let a
  // player cancel it, and the retry could then find nothing and take the
  // switch away mid-round.
  const [streetReadySrc, setStreetReadySrc] = useState<string | null>(null);
  const streetReady = streetReadySrc !== null && streetReadySrc === scene?.src;
  const streetAvailable = Boolean(streetTarget) && !streetFailed;
  const showStreet = streetAvailable && (streetOnly || viewSource === "street");
  const streetStill = streetOnly && viewSource === "photo";
  useEffect(() => {
    setViewSource("photo");
  }, [scene?.src]);
  // Why the Street View side can't be pressed yet, if it can't.
  const streetWhy = streetReady
    ? null
    : !streetTarget
      ? streetViewStatus().state === "on"
        ? "No Street View for this place"
        : "Street View is off (see Settings, Picture)"
      : streetFailed
        ? "No Street View near this place"
        : "Looking for Street View…";

  // A Street View-only place that cannot load would be a blind round. Where
  // this screen runs the match, a photo place from the same country takes its
  // place before anyone answers, and the clock starts again. (An online guest
  // sees the swap arrive with the host's next snapshot.)
  const [swapped, setSwapped] = useState<"intro" | "live" | null>(null);
  const swapTried = useRef("");
  const streetDead =
    streetOnly &&
    !streetAvailable &&
    (state.phase === "round_intro" || state.phase === "round_active") &&
    !state.players.some((p) => p.locked);
  useEffect(() => {
    const runsMatch =
      !serverMode && !(mode === "duel" && duelKind === "online" && !hostRef.current);
    if (!streetDead || !runsMatch) return;
    const key = `${state.seed}:${state.questionIndex}`;
    if (swapTried.current === key) return;
    swapTried.current = key;
    if (!canSwapPlace(stateRef.current)) return;
    const live = stateRef.current.phase === "round_active";
    dispatch({ type: "SWAP_PLACE", now: mode === "solo" ? performance.now() : Date.now() });
    setSwapped(live ? "live" : "intro");
  }, [streetDead, serverMode, duelKind, state.seed, state.questionIndex, mode, dispatch]);
  useEffect(() => {
    if (!swapped) return;
    const id = window.setTimeout(() => setSwapped(null), 5000);
    return () => window.clearTimeout(id);
  }, [swapped]);

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
  const cosmic = scene?.kind === "cosmos";
  // How much the player may move in the scene (Settings → Game, fixed per match).
  const movement = movementOf(state);
  // Solo rounds can pause: the clock stands still and the scene is covered.
  const paused = state.pausedAtMs != null;
  const canPause = mode === "solo" && state.phase === "round_active" && !paused;
  // Who paused: the player, or leaving the tab (the menu says "Welcome back").
  const pausedBy = useRef<"menu" | "away">("menu");
  const pause = useCallback(
    (by: "menu" | "away") => {
      if (!canPause) return;
      pausedBy.current = by;
      dispatch({ type: "PAUSE", now: performance.now() });
    },
    [canPause, dispatch],
  );
  const resume = useCallback(() => dispatch({ type: "RESUME", now: performance.now() }), [dispatch]);
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  useEffect(() => {
    if (mode !== "solo") return;
    const onHide = () => {
      if (document.visibilityState === "hidden") pauseRef.current("away");
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [mode]);
  const live3d = ROUND4_3D_LIVE && reconstructionRound && Boolean(env);

  // The clock waits for the scene: the intro holds until the photo, panorama
  // or Street View is on screen. On a slow connection the round used to start
  // over a dark, empty scene, and after a Street View swap the stand-in photo
  // (never warmed) took seconds to arrive.
  const sceneKey = `${state.seed}:${state.questionIndex}:${scene?.src ?? ""}`;
  const sceneKeyRef = useRef(sceneKey);
  sceneKeyRef.current = sceneKey;
  const [readyKey, setReadyKey] = useState("");
  const markSceneReady = useCallback(() => setReadyKey(sceneKeyRef.current), []);
  const sceneReady =
    readyKey === sceneKey || !scene || cosmic || (streetOnly && !streetAvailable) || (live3d && !scene3dFailed);
  const you =
    duelKind === "hotseat"
      ? (state.players.find((p) => p.id === state.activeSeatId) ?? state.players[0])
      : (state.players.find((p) => p.id === selfId) ?? state.players[0]);
  const opponent = state.players.find((p) => p.id !== you?.id);
  // A duel opens with the two players facing off, once per match, over the
  // first round's title card (whose clock waits for it).
  const [faceoffDone, setFaceoffDone] = useState<number | null>(null);
  const showFaceoff =
    mode === "duel" &&
    Boolean(opponent) &&
    state.phase === "round_intro" &&
    state.questionIndex === 0 &&
    faceoffDone !== state.seed;
  const showingReveal =
    state.phase === "round_reveal" ||
    state.phase === "round_expired" ||
    state.phase === "round_results";
  // The last place: the deck is spent, a health duel has a player on zero, or
  // a streak has just been broken. Continue then leads to the results.
  const lastRound = state.questionIndex >= (state.totalQuestions || TOTAL_QUESTIONS) - 1 || matchOver(state);
  // The end-of-round splash plays once per reveal; the result card follows it,
  // so the card's own animation runs while the player is looking at it.
  const revealKey = showingReveal ? `${state.questionIndex}:${state.roundStartedAtMs ?? 0}` : null;
  const [splashSeen, setSplashSeen] = useState<string | null>(null);
  const [summarySeen, setSummarySeen] = useState<string | null>(null);
  const questionSplash = revealKey !== null && splashSeen !== revealKey && Boolean(you?.roundScore);
  // When the question closes a multi-question round (Quick is one round of
  // ten), the round summary follows the question's own splash.
  // Solo: the header holds the old total until the round's points have flown
  // up from the reveal card, then rolls over as they land.
  const [flownFor, setFlownFor] = useState<string | null>(null);
  const pointsInFlight =
    mode === "solo" && !state.streak && revealKey !== null && flownFor !== revealKey
      ? (you?.roundScore?.roundScore ?? 0)
      : 0;
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

  // The Atmosphere bed plays while a round is live (the clock running) and
  // fades out for intros, reveals and results. The player's own Spotify or
  // Apple Music takes precedence: no bed underneath it.
  const ownMusic = useMusic().active;
  const roundLive =
    state.phase === "round_active" ||
    state.phase === "player_locked" ||
    state.phase === "waiting_for_opponent";
  useEffect(() => {
    if (roundLive && !ownMusic) audio.startAmbience();
    else audio.stopAmbience();
  }, [roundLive, ownMusic]);
  useEffect(() => () => audio.stopAmbience(), []);

  // Long enough for the intro's title sequence (round-intro.tsx), whose ring
  // shows this hold; with reduced motion the card is still, so it is shorter.
  const introHoldMs = settings.reducedMotion ? 1200 : 2200;
  // The usual hold, or longer while the scene loads, but never past 8 s: a
  // stalled photo or panorama must not stop the match.
  const introStartedAt = useRef(0);
  useEffect(() => {
    if (state.phase === "round_intro") introStartedAt.current = performance.now();
  }, [state.phase, state.questionIndex]);
  useEffect(() => {
    if (state.phase !== "round_intro" || showFaceoff) return;
    const elapsed = performance.now() - introStartedAt.current;
    const wait = Math.max(0, (sceneReady ? introHoldMs : 8000) - elapsed);
    const id = setTimeout(finishIntro, wait);
    return () => clearTimeout(id);
  }, [state.phase, introHoldMs, finishIntro, sceneReady, showFaceoff]);
  const endFaceoff = useCallback(() => {
    // The title card's hold starts once the face-off has gone.
    introStartedAt.current = performance.now();
    setFaceoffDone(state.seed);
  }, [state.seed]);

  useEffect(() => {
    const ticking =
      state.roundStartedAtMs != null &&
      state.pausedAtMs == null &&
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
      // Whole seconds, not every frame: the whole match screen re-rendered 60
      // times a second for a clock that shows whole seconds. Equal values skip
      // the render; the ring glides on to the next second in CSS.
      setRemaining(Math.ceil(rem));
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
    state.pausedAtMs,
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

  // An opponent sitting down in the room is an event: a whoosh as their row
  // slides in (the motion is in styles.css).
  const lobbyCount = useRef(state.players.length);
  useEffect(() => {
    const before = lobbyCount.current;
    lobbyCount.current = state.players.length;
    if (mode !== "duel" || duelKind !== "online") return;
    if (state.phase !== "lobby" && state.phase !== "waiting_for_players") return;
    if (before === 1 && state.players.length === 2) audio.play("whoosh");
  }, [state.players.length, state.phase, mode, duelKind]);

  useEffect(() => {
    if (state.phase !== "match_complete" && state.phase !== "final_reveal") {
      // Any way out of the results re-arms the record: an online guest's
      // rematch is started by the host, never by this screen's button.
      statsRecorded.current = false;
      return;
    }
    if (statsRecorded.current) return;
    statsRecorded.current = true;
    // Hotseat switches the active seat; record the seat that just finished so
    // its score, distances and win flag all describe the same player.
    const statsId = you?.id ?? selfId;
    // Cosmos questions are measured in AU, not km: map stats skip them.
    const earthRounds = state.roundHistory.filter((r) => !r.cosmos);
    const distances = earthRounds
      .map((r) => r.guesses[statsId]?.score.distanceKm)
      .filter((d) => d != null) as number[];
    const za = { n: 0, hits: 0 };
    const nl = { n: 0, hits: 0 };
    const world = { n: 0, hits: 0 };
    for (const r of earthRounds) {
      const g = r.guesses[statsId];
      if (!g) continue;
      const country = getLocation(r.locationId)?.country;
      const bucket = country === "NL" ? nl : country === "WORLD" ? world : za;
      bucket.n += 1;
      if (g.score.countryCorrect) bucket.hits += 1;
    }
    const fastest = earthRounds
      .map((r) => r.guesses[statsId]?.score)
      .filter((s) => s && s.distanceKm <= 5)
      .map((s) => s!.responseMs);
    const before = loadStats();
    // Pass-and-play shares one device's stats between two people: its scores
    // neither set nor beat a record, which would credit whoever finished last.
    const hotseat = mode === "duel" && duelKind === "hotseat";
    const healthDuelMatch = isHealthDuel({ mode: state.mode, duelRule: state.duelRule });
    const run = state.streak ? streakCount({ roundHistory: state.roundHistory }) : 0;
    // The career's view of the match: XP and medals are worked out from this.
    const summary: MatchSummary = {
      kind: state.streak ? "streak" : state.mode,
      opponent: duelKind === "bot" ? "bot" : duelKind === "online" ? "online" : undefined,
      health: healthDuelMatch,
      score: you?.totalScore ?? 0,
      won: state.mode === "duel" && state.winnerIds.includes(statsId) && state.winnerIds.length === 1,
      places: earthRounds.filter((r) => r.guesses[statsId]).length,
      rightCountries: state.streak
        ? run
        : earthRounds.filter((r) => r.guesses[statsId]?.score.countryCorrect).length,
      perfect: earthRounds.filter((r) => (r.guesses[statsId]?.score.accuracyPoints ?? 0) >= ROUND_MAX).length,
      closestKm: distances.filter((d) => Number.isFinite(d)).length
        ? Math.min(...distances.filter((d) => Number.isFinite(d)))
        : null,
      fastestAccurateMs: fastest.length ? Math.min(...fastest) : null,
      run: state.streak ? run : undefined,
      healthLeft: healthDuelMatch ? you?.health : undefined,
      movement: movementOf({ movement: state.movement }),
      nations: earthRounds.flatMap((r) => {
        const loc = getLocation(r.locationId);
        return loc ? [nationOf(loc)] : [];
      }),
    };
    const award = (recorded: ReturnType<typeof loadStats>) => {
      if (hotseat) return;
      setCareerAward({ seed: state.seed, award: recordCareer(recorded, summary).award });
    };
    // A Country Streak's record is its run, not its points.
    if (state.streak) {
      const prev = before.bestCountryStreak ?? 0;
      if (prev > 0 && run > prev) setBeatBest({ seed: state.seed, previous: prev });
      award(recordStreak(before, run));
      return;
    }
    const score = you?.totalScore ?? 0;
    // A health duel ends when someone is out, so its points total is no record.
    const noRecord = hotseat || healthDuelMatch;
    if (!noRecord && isNewBest(before, state.matchLength, score))
      setBeatBest({ seed: state.seed, previous: previousBest(before, state.matchLength)! });
    const recorded = recordMatch(before, {
      score,
      length: noRecord ? undefined : state.matchLength,
      won: state.mode === "duel" && state.winnerIds.includes(statsId),
      distances,
      countryHits: { ZA: za, NL: nl, WORLD: world },
      fastestAccurateMs: fastest.length ? Math.min(...fastest) : null,
    });
    award(recorded);
  }, [
    state.phase,
    state.locationIds,
    state.roundHistory,
    state.winnerIds,
    state.mode,
    state.matchLength,
    state.seed,
    state.streak,
    state.duelRule,
    state.movement,
    mode,
    duelKind,
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
    setShutter((n) => n + 1);
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
    navigate("/");
  };

  const keyboardStart = useRef(false);
  useEffect(() => {
    if (state.phase !== "round_active" || !keyboardStart.current) return;
    keyboardStart.current = false;
    const id = requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('[aria-label="Guessing map"]')?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(id);
  }, [state.phase, state.questionIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The pause menu is a dialog: it answers its own keys (Esc resumes).
      // Its Esc can also reach this listener after the resume has rendered,
      // so a key a dialog already handled is left alone.
      if (paused || e.defaultPrevented) return;
      if (showFaceoff && (e.key === "Enter" || e.key === " " || e.key === "Escape")) {
        e.preventDefault();
        endFaceoff();
        return;
      }
      const el = e.target as HTMLElement | null;
      const typing = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable;
      if (e.key === "Escape") {
        setExploring(false);
        if (showSettings) {
          setShowSettings(false);
          return;
        }
        // Esc pauses a solo round (after leaving the explore view first).
        if (!typing && !exploring && canPause) {
          e.preventDefault();
          pause("menu");
          return;
        }
      }
      if (typing || showSettings) return;
      if ((e.key === "Enter" || e.key === " ") && state.phase === "round_intro") {
        // Started from the keyboard: the map takes focus when the round
        // opens, instead of fifteen Tabs away behind the header buttons.
        keyboardStart.current = true;
        if (e.key === "Enter") finishIntro();
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
  }, [
    state.phase,
    showSettings,
    lock,
    finishIntro,
    continueRound,
    showingReveal,
    duelKind,
    paused,
    exploring,
    canPause,
    pause,
    showFaceoff,
    endFaceoff,
  ]);

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
    const lobbyRival =
      state.players.length === 2 ? state.players.find((p) => p.id !== selfId) : undefined;
    return (
      <main className="relative min-h-dvh overflow-hidden bg-bg px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        {/* The world waits with you: a dotted Earth turns behind the room. */}
        <DotGlobe
          className="lobby-globe"
          reducedMotion={settings.reducedMotion}
          {...globeForAtlas(state.atlas)}
        />
        <div className="relative mx-auto max-w-md">
          <div className="flex items-center justify-between gap-3">
            {mono ? (
              <p className="eyebrow">
                <span className="index-no" aria-hidden>
                  01
                </span>{" "}
                Private room
              </p>
            ) : (
              <p className="text-xs uppercase tracking-[0.28em] text-muted">Private room</p>
            )}
            <div className="-my-2">
              <MusicHudButton />
            </div>
          </div>
          {/* The code flips in a letter at a time, like a departures board. */}
          <h1
            className={
              mono
                ? "room-code mt-4 font-mono text-5xl font-semibold tracking-[0.04em]"
                : "room-code font-display mt-2 text-5xl tracking-tight"
            }
          >
            {[...(roomCode ?? "")].map((ch, i) => (
              <span key={i} style={{ "--i": i } as React.CSSProperties}>
                {ch}
              </span>
            ))}
          </h1>
          <p className="mt-3 text-muted">Share the invite. Start when you’re both ready.</p>
          <div className="mt-6 flex gap-2">
            {canShare && (
              <Button
                className="flex-1"
                onClick={async () => {
                  try {
                    await navigator.share({
                      title: "Atlas Duel",
                      text: `Join my Atlas Duel room ${roomCode}`,
                      url: shareUrl,
                    });
                  } catch {
                    // Dismissed, or the share target failed: the copy button remains.
                  }
                }}
              >
                <Share2 size={16} /> Share invite
              </Button>
            )}
            <Button
              variant="secondary"
              className={cn("flex-1", copied && "is-copied")}
              onClick={async () => {
                const ok = await copyText(shareUrl || roomCode || "");
                setCopied(ok);
                if (ok) window.setTimeout(() => setCopied(false), 1600);
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : canShare ? "Copy link" : "Copy invite"}
            </Button>
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {copied ? "Invite link copied" : ""}
          </p>
          <input
            aria-label="Invite link"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.target.select()}
            className="atlas-search mt-3 text-xs"
          />
          <div className="relative mt-8">
            <ul className="space-y-2">
              {state.players.map((p) => (
                <li
                  key={p.id}
                  className="lobby-player flex items-center gap-3 rounded-[var(--radius-md)] border border-border px-3 py-3"
                >
                  <span className="lobby-player-avatar">
                    <PlayerAvatar id={p.avatarId} size={40} sleepy />
                  </span>
                  <span className="min-w-0 truncate">
                    {p.name} {p.id === state.hostId ? "· host" : ""}
                  </span>
                </li>
              ))}
              {state.players.length < 2 && (
                <li className="lobby-empty flex items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-border px-3 py-3 text-muted">
                  <span className="lobby-seat" aria-hidden>
                    {/* A ghost bot keeps the seat, typing dots until someone sits. */}
                    <PlayerAvatar
                      id="circle-grey"
                      size={30}
                      mood="waiting"
                      gaze={false}
                      className="lobby-ghost"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    {(serverMode ? null : p2pError) ??
                      (failed
                        ? "Using the room relay to connect"
                        : (serverMode ? socketJoined && socketConnected : p2pJoined)
                          ? state.players.length === 0
                            ? "Joining room…"
                            : "Waiting for opponent"
                          : "Connecting…")}
                  </span>
                </li>
              )}
            </ul>
            {/* Both seats taken: the rivalry is stamped between them. */}
            {state.players.length === 2 && (
              <span className="lobby-vs" aria-hidden>
                VS
              </span>
            )}
          </div>
          <p className="sr-only" role="status">
            {lobbyRival ? `${lobbyRival.name} is here` : ""}
          </p>
          {!hostRef.current && state.players.length === 2 && !serverMode && (
            <p role="status" className="mt-6 text-center text-sm text-muted">
              Both players are here. Waiting for the host to start.
            </p>
          )}
          {hostRef.current && !serverMode && (
            <Button
              className={cn("mt-8 w-full", state.players.length === 2 && "start-ready")}
              disabled={state.players.length < 2}
              onClick={() => dispatch({ type: "START_MATCH", now: Date.now() })}
            >
              {state.players.length < 2 ? "Start when they join" : "Start match"}
            </Button>
          )}
          <Button variant="secondary" className="mt-3 w-full" onClick={() => navigate("/duel/bot")}>
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
        beatBest={beatBest?.seed === state.seed ? beatBest.previous : undefined}
        career={careerAward?.seed === state.seed ? careerAward.award : undefined}
        onRematch={() => {
          statsRecorded.current = false;
          const seed = randomSeed();
          if (serverMode) {
            socketSend({ t: "rematch" });
            return;
          }
          if (mode === "duel" && duelKind === "online" && !hostRef.current) {
            p2pSend({
              t: "rematch",
              nextSeed: seed,
              roundStartedAtMs: state.roundStartedAtMs,
              questionIndex: state.questionIndex,
            });
            setRematchSent(true);
            return;
          }
          const now = mode === "solo" ? performance.now() : Date.now();
          dispatch({
            type: "REMATCH",
            seed,
            now,
            difficulty: settings.difficulty,
            matchLength: settings.matchLength,
            atlas: settings.atlas,
            avoidLocationIds: loadRecentIds(),
            streetView: streetViewUsable(),
            movement: settings.movement,
            duelRule: settings.duelRule,
          });
          // Both have asked for it: no lobby stop on the way back in.
          if (rematchAsk && state.players.some((p) => p.id === rematchAsk && p.connected))
            dispatch({ type: "START_MATCH", now });
        }}
        rematchNote={
          hostSilent
            ? `Lost touch with ${state.players.find((p) => p.id === state.hostId)?.name ?? "the host"}`
            : rematchAsk && hostRef.current
              ? `${state.players.find((p) => p.id === rematchAsk)?.name ?? "Your rival"} wants a rematch`
              : rematchSent
                ? `Asked ${state.players.find((p) => p.id === state.hostId)?.name ?? "the host"} for a rematch`
                : undefined
        }
        rematchLabel={
          rematchAsk && hostRef.current ? "Accept rematch" : rematchSent ? "Waiting…" : undefined
        }
        rematchPending={rematchSent || hostSilent}
        onHome={quit}
      />
    );
  }

  // Escape, health duels and Country Streak: every place is its own round.
  const byPlace = placeByPlace(state);
  const healthDuel = isHealthDuel(state);
  const runSoFar = state.streak ? streakCount(state) : 0;
  const hitMultiplier = damageMultiplier(state.questionIndex + 1);
  const qNum = byPlace ? 1 : questionInRound(state.questionIndex) + 1;
  const rounds = state.totalRounds || 4;
  // The last round of a multi-round match: real places, like every other.
  const finalRound =
    !byPlace && rounds > 1 && state.roundIndex === rounds - 1 && !cosmic;
  const roundLabel = state.streak
    ? `Country Streak · place ${state.questionIndex + 1}`
    : healthDuel
      ? `Round ${state.roundIndex + 1} · ×${hitMultiplier} damage`
      : state.matchLength === "escape"
        ? `Round ${state.roundIndex + 1} of ${rounds}${state.questionIndex === 4 && state.atlas.preset === "sa-nl" && !state.atlas.cities?.length ? " · World wildcard" : ""}`
        : `Round ${state.roundIndex + 1} of ${rounds} · Q${qNum}/${Math.min(QUESTIONS_PER_ROUND, state.totalQuestions - state.roundIndex * QUESTIONS_PER_ROUND)}`;
  // What this place did under the match's rule: a health duel's damage, or a
  // streak's verdict. Read from the record of the place just revealed.
  const revealedRecord = state.revealed ? state.roundHistory.at(-1) : undefined;
  // The celebration after a round: rounds won so far and the moments worth
  // calling out (round-moment.ts). Place-by-place matches count each place;
  // longer ones count rounds of ten.
  const momentIds = state.players.map((p) => p.id);
  const momentFor = (groupOf: (r: { index: number }) => number) =>
    revealedRecord
      ? roundMoment(state.roundHistory, momentIds.length === 2 ? momentIds : [you?.id ?? selfId], groupOf, {
          leadBy: healthDuel ? "health" : "points",
          selfId: you?.id ?? selfId,
        })
      : undefined;
  const placeMoment = byPlace && !state.streak ? momentFor((r) => r.index) : undefined;
  const tenMoment = !byPlace ? momentFor((r) => Math.floor(r.index / QUESTIONS_PER_ROUND)) : undefined;
  // Country Streak: every fifth country in a row gets the full celebration.
  const streakMilestone = Boolean(
    state.streak && revealedRecord?.streak?.correct && streakCount(state) >= 5 && streakCount(state) % 5 === 0,
  );
  const hit = healthDuel ? revealedRecord?.damage : undefined;
  const hitPlayer = hit ? state.players.find((p) => p.id === hit.playerId) : undefined;
  const ruleNote: { text: string; tone: "hit" | "keep" | "miss" | "even" } | undefined = healthDuel
    ? hit && hitPlayer
      ? {
          tone: "hit",
          text: `${hitPlayer.id === selfId && duelKind !== "hotseat" ? "You lose" : `${hitPlayer.name} loses`} ${hit.amount.toLocaleString()} health${
            hit.multiplier > 1 ? ` (gap ×${hit.multiplier})` : ""
          } · ${(hitPlayer.health ?? 0) > 0 ? `${(hitPlayer.health ?? 0).toLocaleString()} left` : "knocked out"}`,
        }
      : revealedRecord
        ? { tone: "even", text: "Dead level: no damage this round" }
        : undefined
    : state.streak && revealedRecord?.streak
      ? revealedRecord.streak.correct
        ? { tone: "keep", text: `Right country · ${streakCount(state)} in a row` }
        : {
            tone: "miss",
            text: `${
              revealedRecord.streak.guessed
                ? `Your pin was in ${revealedRecord.streak.guessed}.`
                : you?.guess
                  ? "Your pin was at sea."
                  : "Time ran out."
            } The streak ends at ${streakCount(state)}.`,
          }
      : undefined;
  // Rule chips on the round's title card.
  const introRules: Array<{ kind: "movement" | "health" | "streak"; label: string; accent?: boolean }> = [
    ...(movement !== "moving" && !cosmic
      ? [
          {
            kind: "movement" as const,
            label: movement === "no-move" ? "No move · look and zoom only" : "NMPZ · no move, no pan, no zoom",
          },
        ]
      : []),
    ...(healthDuel
      ? [{ kind: "health" as const, label: `×${hitMultiplier} damage this round`, accent: hitMultiplier > 1 }]
      : []),
    ...(state.streak ? [{ kind: "streak" as const, label: "One wrong country ends the run" }] : []),
  ];
  // Same test as the clock itself: your time is still running after the other
  // player locks (the duel is then "waiting_for_opponent"), so the last ten
  // seconds must still read as urgent — they are the tensest of the round.
  const clockRunning =
    !paused &&
    (state.phase === "round_active" ||
      ((state.phase === "waiting_for_opponent" || state.phase === "player_locked") &&
        duelKind !== "hotseat"));
  const urgent = remaining <= 10 && clockRunning && !you?.locked;

  return (
    <main
      ref={gameRoot}
      className={cn(
        "match-stage relative min-h-dvh overflow-hidden bg-bg",
        exploring && !showingReveal && "is-exploring",
        cosmic && "is-cosmos",
        showingReveal && "is-revealing",
        shake && "atlas-shake",
      )}
    >
      <h1 className="sr-only">Atlas Duel · {roundLabel}</h1>
      {/* Locking in: a camera shutter over everything, even the splash. */}
      {shutter > 0 && <i key={shutter} className="scene-flash" aria-hidden />}

      {showFaceoff && you && opponent && (
        <VsFaceoff
          left={{
            name: you.name,
            avatarId: you.avatarId,
            tag:
              duelKind === "hotseat"
                ? "Player one"
                : `You · level ${levelOf(loadStats().xp ?? 0).level} ${levelOf(loadStats().xp ?? 0).title}`,
          }}
          right={{
            name: opponent.name,
            avatarId: opponent.avatarId,
            tag: opponent.kind === "bot" ? "Bot rival" : duelKind === "hotseat" ? "Player two" : "Online rival",
          }}
          rule={[
            healthDuel
              ? `Health duel · ${START_HEALTH.toLocaleString()} each`
              : `Points race · ${rounds} ${rounds === 1 ? "round" : "rounds"}`,
            movement !== "moving" ? MOVEMENT_NAME[movement] : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          reducedMotion={settings.reducedMotion}
          onDone={endFaceoff}
        />
      )}
      {state.phase === "round_intro" && (
        <RoundIntro
          key={`${state.questionIndex}:${state.roundIndex}`}
          round={state.roundIndex + 1}
          totalRounds={rounds}
          question={byPlace ? undefined : qNum}
          questionsInRound={Math.min(
            QUESTIONS_PER_ROUND,
            state.totalQuestions - state.roundIndex * QUESTIONS_PER_ROUND,
          )}
          atlasLabel={atlasLabel(state.atlas)}
          seconds={state.durationSec || 45}
          wildcard={
            state.matchLength === "escape" &&
            state.questionIndex === 4 &&
            state.atlas.preset === "sa-nl" &&
            !state.atlas.cities?.length
          }
          cosmos={cosmic}
          note={
            reconstructionRound
              ? ROUND4_3D_LIVE
                ? "3D reconstruction"
                : "Reconstruction"
              : finalRound
                ? `Final round · ${state.durationSec || 45}s on the clock`
                : undefined
          }
          holdMs={introHoldMs}
          waiting={!sceneReady}
          reducedMotion={settings.reducedMotion}
          onStart={finishIntro}
          atlas={state.atlas}
          kicker={
            state.streak
              ? runSoFar
                ? `Country Streak · ${runSoFar} in a row`
                : "Country Streak"
              : healthDuel
                ? `Round ${state.roundIndex + 1} · health duel`
                : undefined
          }
          title={state.streak ? "Which country?" : undefined}
          rules={introRules}
        />
      )}

      <div className="scene-viewport">
        <Suspense fallback={<div className="absolute inset-0 bg-bg-subtle" />}>
          {/* Street View is searched once per place and stays loaded while the
              photo is on screen, so switching back is instant and keeps where
              the player walked to. */}
          {!cosmic && streetAvailable && streetTarget && (
            <StreetViewScene
              key={`${streetTarget.latitude},${streetTarget.longitude}`}
              target={streetTarget}
              wide={streetOnly}
              hidden={!showStreet}
              still={streetStill}
              movement={movement}
              interactive={
                canGuess && !showSettings && !showingReveal && showStreet && !streetStill && movement !== "nmpz"
              }
              showHints={settings.showHints}
              onReady={() => {
                setStreetReadySrc(scene?.src ?? null);
                if (showStreet) markSceneReady();
              }}
              onUnavailable={() => setStreetFailedSrc(scene?.src ?? null)}
            />
          )}
          {cosmic && scene?.cosmos ? (
            <CosmosScene
              key={`${state.questionIndex}:${scene.cosmos.seed}`}
              look={scene.cosmos}
              clue={showingReveal ? undefined : scene.clue}
              reducedMotion={settings.reducedMotion}
              interactive={!showSettings}
            />
          ) : showStreet ? null : streetOnly ? (
            <div className="street-view-missing" role="status">
              <p>Street View could not load this place.</p>
              <p>Make your best guess, or wait out the clock.</p>
            </div>
          ) : live3d && env && !scene3dFailed ? (
            <Round4Scene
              key={env.id}
              env={env}
              reducedMotion={settings.reducedMotion}
              onUnavailable={() => setScene3dFailed(true)}
              movement={movement}
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
              interactive={canGuess && !showSettings && !showingReveal && movement !== "nmpz"}
              onReady={markSceneReady}
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
                  photoFitChosen: true,
                }))
              }
              showHints={settings.showHints}
              fallbacks={flatScene.fallbacks}
              views={flatScene.views}
              movement={movement}
              sourceUrl={loc?.sourceUrl}
              title={loc?.title}
              alt="Location to identify"
              reducedMotion={settings.reducedMotion}
              interactive={canGuess && !showSettings && !showingReveal}
              onReady={markSceneReady}
            />
          ) : (
            <div className="absolute inset-0 bg-bg-subtle" />
          )}
        </Suspense>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.22)_0%,transparent_18%,transparent_78%,rgba(9,9,11,0.28)_100%)]" />
        {swapped && !showingReveal && (
          <p className="scene-swap-notice" role="status">
            Street View could not load that place, so here is another.
            {swapped === "live" ? " The clock has restarted." : ""}
          </p>
        )}
        {/* A lens over the photo: vignette and grain, and in the last ten
            seconds a red edge that closes in on every heartbeat. */}
        <div
          className={cn("scene-atmos", urgent && "is-urgent", showingReveal && "is-calm")}
          style={
            {
              "--tension": urgent ? Math.min(1, Math.max(0, (10 - remaining) / 10)) : 0,
            } as React.CSSProperties
          }
          aria-hidden
        >
          <i className="scene-grain" />
          <i className="scene-tension" />
        </div>
        {/* The last five seconds thump over the scene, one number a beat. */}
        {clockRunning && !you?.locked && !showingReveal && remaining > 0 && remaining <= 5 && (
          <span key={remaining} className="final-count" aria-hidden>
            {remaining}
          </span>
        )}
      </div>

      {/* The switch is on every photo and Street View round, from the
          first second: Photo first, Street View once a panorama is found.
          It used to appear only after the search, and never on places with
          no photo of their own, so whole rounds went by without it. */}
      {!cosmic && scene && (
        <div className={cn("view-source", showingReveal && "is-reveal")} role="group" aria-label="Scene">
          <button
            type="button"
            aria-pressed={viewSource === "photo"}
            onClick={() => setViewSource("photo")}
          >
            Photo
          </button>
          <button
            type="button"
            aria-pressed={viewSource === "street"}
            aria-disabled={streetWhy ? true : undefined}
            aria-describedby={streetWhy ? "street-why" : undefined}
            title={streetWhy ?? undefined}
            className={cn(streetWhy && "is-waiting")}
            onClick={() => {
              if (!streetWhy) setViewSource("street");
            }}
          >
            Street View
          </button>
          {streetWhy && (
            <span id="street-why" className="sr-only">
              {streetWhy}
            </span>
          )}
        </div>
      )}

      <header
        ref={measureHud}
        className="match-hud relative z-20 flex items-start justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
      >
        <div className="flex min-w-0 flex-col gap-2">
          {!showingReveal && (
            <TimerRing
              remaining={remaining}
              running={clockRunning && state.phase !== "round_intro"}
              duration={state.durationSec || 45}
              urgent={urgent}
              locked={Boolean(you?.locked && !showingReveal)}
            />
          )}
          {/* What a perfect guess still earns: steps down with the clock. */}
          {!showingReveal && (
            <PointsPot
              remaining={remaining}
              duration={state.durationSec || ROUND_DURATION_SEC}
              running={clockRunning && state.phase !== "round_intro"}
              lockedAt={
                you?.locked && you.responseMs != null
                  ? Math.max(0, (state.durationSec || ROUND_DURATION_SEC) - you.responseMs / 1000)
                  : undefined
              }
            />
          )}
          {mono ? (
            <MatchMeta
              round={state.roundIndex + 1}
              rounds={state.totalRounds || 4}
              question={qNum}
              escape={byPlace}
              label={
                state.streak
                  ? `STREAK ${runSoFar}`
                  : healthDuel
                    ? `ROUND ${state.roundIndex + 1} · ×${hitMultiplier}`
                    : undefined
              }
            />
          ) : (
            <>
              {/* A streak or a health duel has no fixed length to count off. */}
              {!state.streak && !healthDuel && (
                <RoundPips index={state.roundIndex} total={state.totalRounds || 4} />
              )}
              {!byPlace && <QuestionMark current={qNum} />}
            </>
          )}
          {reconstructionRound ? (
            <div className={cn("w-fit border border-border px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted", hudChip)}>
              {ROUND4_3D_LIVE ? "3D reconstruction" : "Reconstruction plates"}
            </div>
          ) : cosmic ? (
            <div className={cn("w-fit border border-accent/40 px-2.5 py-1 text-[10px] uppercase tracking-wider text-accent", hudChip)}>
              Cosmos round
            </div>
          ) : finalRound ? (
            <div className={cn("w-fit border border-accent/40 px-2.5 py-1 text-[10px] uppercase tracking-wider text-accent", hudChip)}>
              Final round
            </div>
          ) : null}
          {movement !== "moving" && !cosmic && !showingReveal && (
            <div
              className={cn("hud-rule w-fit border border-border px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted", hudChip)}
              title={movement === "no-move" ? "No move: look and zoom only" : "No move, no pan, no zoom"}
            >
              {MOVEMENT_NAME[movement]}
            </div>
          )}
        </div>
        <div className="hud-actions flex shrink-0 items-start gap-2">
          {!showingReveal && (
            <button
              type="button"
              className="view-mode-button shrink-0"
              aria-pressed={exploring}
              aria-label={exploring ? "Show map" : "Explore view"}
              title={exploring ? "Show map" : "Explore view: the photo, full screen"}
              onClick={() => setExploring((v) => !v)}
            >
              {exploring ? <Map size={17} /> : <Eye size={17} />}
              <span className="view-mode-label">{exploring ? "Show map" : "Explore view"}</span>
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
            <ScoreTally
              players={state.players}
              selfId={you?.id}
              roundLive={clockRunning || state.phase === "player_locked"}
              urgent={urgent}
              health={healthDuel}
              lastHit={(() => {
                const last = state.roundHistory.at(-1);
                return healthDuel && last?.damage
                  ? { playerId: last.damage.playerId, amount: last.damage.amount, key: last.index }
                  : undefined;
              })()}
            />
          ) : mode === "duel" && showingReveal ? null : (
            <div className={cn("hud-score flex items-center gap-2 rounded-[var(--radius-md)] border border-border py-1.5 pl-1.5 pr-3", mono ? "bg-bg" : "bg-bg/70")}>
              <PlayerAvatar
                id={you?.avatarId}
                size={32}
                live
                mood={
                  you?.locked ? "happy" : urgent ? "surprised" : you?.guess ? "focus" : "neutral"
                }
              />
              <div className="text-right">
                <div className="hud-score-label text-[10px] uppercase tracking-wider text-subtle">
                  {state.streak ? "Streak" : "Score"}
                </div>
                {state.streak && runSoFar > 0 && (
                  // The flame grows hotter as the run goes on, and jumps on each country.
                  <span
                    key={runSoFar}
                    className="hud-streak-flame"
                    style={{ "--heat": Math.min(1, runSoFar / 10) } as React.CSSProperties}
                    aria-hidden
                  >
                    <Flame size={14} />
                  </span>
                )}
                <div className="font-display tabular text-lg leading-none" data-score-target>
                  {/* Country Streak counts countries in a row, not points. */}
                  <RollingScore
                    value={state.streak ? runSoFar : (you?.totalScore ?? 0) - pointsInFlight}
                    reducedMotion={settings.reducedMotion}
                  />
                </div>
              </div>
            </div>
          )}
          <span className="music-hud flex">
            <MusicHudButton />
          </span>
          {/* Solo, mid-round: the menu button pauses (Settings is inside). */}
          {canPause ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Pause"
              title="Pause (Esc)"
              className="shrink-0"
              onClick={() => pause("menu")}
            >
              <PauseIcon className="size-5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Settings"
              className="shrink-0"
              onClick={() => setShowSettings(true)}
            >
              <SettingsIcon className="size-5" />
            </Button>
          )}
        </div>
      </header>

      {rivalLockedAt > 0 && !you?.locked && !showingReveal && opponent && (
        <p key={rivalLockedAt} className="rival-locked" role="status">
          <span aria-hidden className="flex">
            <PlayerAvatar id={opponent.avatarId} size={26} mood="happy" gaze={false} />
          </span>
          <span>
            <strong>{opponent.name}</strong> locked in!
          </span>
        </p>
      )}

      {you?.locked && !showingReveal && (
        <LockStamp key={`lock:${state.questionIndex}:${state.roundStartedAtMs ?? 0}`} />
      )}

      {(you?.locked || (pendingLock && matchesQuestion(state, pendingLock))) && !showingReveal && (
        <p className={cn("waiting-chip relative z-20 mx-4 mt-1 flex w-fit items-center gap-2 border border-border py-1 pl-1 pr-3 text-xs uppercase tracking-wider", mono ? "bg-bg" : "rounded-full bg-bg/80")}>
          {/* Whoever we wait on types three dots with their eyes. */}
          <PlayerAvatar
            id={(you?.locked ? opponent : you)?.avatarId}
            size={24}
            mood="waiting"
            gaze={false}
          />
          {!you?.locked
            ? "Sending your guess…"
            : opponent?.kind === "bot"
              ? "Grok is guessing…"
              : "Guess locked"}
          {mode === "duel" && duelKind === "online" ? ` · ${Math.ceil(remaining)}s left` : ""}
        </p>
      )}

      {duelKind === "hotseat" && state.phase === "waiting_for_opponent" && (
        <div className={cn("absolute inset-0 z-40 flex flex-col items-center justify-center px-6 text-center", mono ? "bg-bg" : "bg-bg/92")}>
          <PlayerAvatar id={you?.avatarId} size={72} live track />
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

      {cosmic && (
        <div hidden={exploring && !showingReveal}>
          <Suspense fallback={null}>
            <CosmicRuler
              guess={you?.guess}
              onGuess={onGuess}
              disabled={!canGuess}
              truth={showingReveal ? state.truth : undefined}
              truthLabel={showingReveal ? loc?.title : undefined}
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
            />
          </Suspense>
        </div>
      )}

      {(loc || scene) && !cosmic && (
        <div hidden={exploring && !showingReveal}>
          <GuessMap
            // The map paints its palette once; a new look draws a new map.
            key={theme}
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
          moment={tenMoment}
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
            state.streak && revealedRecord?.streak
              ? revealedRecord.streak.correct
                ? "RIGHT COUNTRY"
                : "STREAK OVER"
              : Number.isFinite(you.roundScore.distanceKm)
                ? feedbackHeadline(you.roundScore)
                : "TIME’S UP"
          }
          roundLabel={roundLabel}
          winUnit={
            byPlace
              ? "the round"
              : `question ${questionInRound(state.questionIndex) + 1}`
          }
          roundNumber={
            byPlace && !state.streak ? state.roundIndex + 1 : streakMilestone ? streakCount(state) : undefined
          }
          moment={byPlace && !state.streak ? placeMoment : undefined}
          bannerBig={streakMilestone ? `${streakCount(state)} in a row` : undefined}
          bannerLabel={streakMilestone ? "streak milestone" : undefined}
          fanfare={streakMilestone}
          note={
            // The headline already says "Right country": the note keeps the count.
            streakMilestone
              ? "Keep it going"
              : state.streak && revealedRecord?.streak?.correct
                ? `${streakCount(state)} in a row`
                : ruleNote?.text
          }
          soloFigure={
            state.streak && revealedRecord?.streak
              ? revealedRecord.streak.correct
                ? `${streakCount(state)}`
                : "×"
              : undefined
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
          city={placeCity(loc)}
          country={loc ? locationCountryLabel(loc) : ""}
          roundLabel={roundLabel}
          lastRound={lastRound}
          expanded={expanded}
          timedOut={state.phase === "round_expired"}
          reducedMotion={settings.reducedMotion}
          markSelf={duelKind !== "hotseat"}
          streak={you && !state.streak ? scoreStreak(state.roundHistory, you.id) : 0}
          ruleNote={ruleNote}
          onContinue={continueRound}
        />
      )}

      {pointsInFlight > 0 && showingReveal && !splashing && revealKey && (
        <PointsFly
          key={revealKey}
          points={pointsInFlight}
          reduced={settings.reducedMotion}
          onDone={() => setFlownFor(revealKey)}
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
          className={cn("absolute top-32 left-4 z-30 border border-border px-4 py-2 text-xs", mono ? "bg-bg" : "rounded-xl bg-bg/95")}
        >
          {connectionNotice}
        </p>
      )}
      {hostSilent && (
        <div role="status" className="host-silent">
          <p>
            Lost touch with {state.players.find((p) => p.id === state.hostId)?.name ?? "the host"}.
            Waiting for them to come back…
          </p>
          <button type="button" onClick={quit}>
            Leave match
          </button>
        </div>
      )}
      {/* The scene stays covered for the whole pause, Settings included. */}
      {paused && <div className="pause-cover" aria-hidden />}
      {paused && !showSettings && (
        <PauseMenu
          remaining={remaining}
          away={pausedBy.current === "away"}
          onResume={resume}
          onSettings={() => {
            pausedBy.current = "menu";
            setShowSettings(true);
          }}
          onQuit={quit}
        />
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
