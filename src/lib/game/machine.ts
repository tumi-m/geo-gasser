import { DEFAULT_ATLAS, type AtlasSpec } from "./atlas.ts";
import { environmentById } from "./environments.ts";
import { getLocation } from "./locations.ts";
import { NO_GUESS_KM, rankPlayers, scoreGuess } from "./scoring.ts";
import { currentEnvId, currentLocationId, isRound4Question, planMatch, PHOTO_QUESTIONS, QUESTIONS_PER_ROUND, ROUND4_3D_LIVE, roundOf, TOTAL_QUESTIONS } from "./selection.ts";
import { DIFFICULTY_SECONDS, MATCH_LENGTH, remainingSeconds, ROUND_DURATION_SEC, type MatchLengthId, type TimeDifficulty } from "./timer.ts";
import type { LatLng, MatchPhase, MatchState, PlayerState, PublicSnapshot, RoundRecord } from "./types.ts";

export { TOTAL_ROUNDS, TOTAL_QUESTIONS, QUESTIONS_PER_ROUND } from "./selection.ts";

export type MatchEvent =
  | { type: "HYDRATE"; state: MatchState }
  | { type: "CREATE_SOLO"; playerId: string; name: string; avatarId?: string; seed: number; now: number; difficulty?: TimeDifficulty; matchLength?: MatchLengthId; atlas?: AtlasSpec }
  | { type: "CREATE_DUEL"; playerId: string; name: string; avatarId?: string; roomCode: string; seed: number; now: number; difficulty?: TimeDifficulty; matchLength?: MatchLengthId; atlas?: AtlasSpec }
  | {
      type: "CREATE_LOCAL_DUEL";
      seats: Array<{ id: string; name: string; avatarId?: string; kind?: "human" | "bot" }>;
      hotseat?: boolean;
      seed: number;
      now: number;
      difficulty?: TimeDifficulty;
      matchLength?: MatchLengthId;
      atlas?: AtlasSpec;
    }
  | { type: "PLAYER_JOIN"; playerId: string; name: string; avatarId?: string; kind?: "human" | "bot"; now: number }
  | { type: "PLAYER_LEAVE"; playerId: string; now: number }
  | { type: "START_MATCH"; now: number }
  | { type: "INTRO_DONE"; now: number }
  | { type: "PLACE_PIN"; playerId: string; guess: LatLng; now: number }
  | { type: "LOCK"; playerId: string; now: number }
  | { type: "HANDOFF_DONE"; now: number }
  | { type: "TIMEOUT"; now: number }
  | { type: "REVEAL_DONE"; now: number }
  | { type: "CONTINUE"; now: number }
  | { type: "REMATCH"; seed: number; now: number; difficulty?: TimeDifficulty; matchLength?: MatchLengthId; atlas?: AtlasSpec }
  | { type: "HOME"; now: number };

function bump(state: MatchState, phase: MatchPhase, now: number): MatchState {
  return { ...state, phase, seq: state.seq + 1, lastEventAt: now };
}

function emptyPlayer(
  id: string,
  name: string,
  avatarId = "atlas",
  kind: "human" | "bot" = "human",
): PlayerState {
  return {
    id,
    name,
    avatarId,
    kind,
    connected: true,
    totalScore: 0,
    totalDistanceKm: 0,
    totalResponseMs: 0,
    locked: false,
  };
}

function resetRoundFlags(players: PlayerState[]): PlayerState[] {
  return players.map((p) => ({
    ...p,
    locked: false,
    guess: undefined,
    lockedAtMs: undefined,
    roundScore: undefined,
  }));
}

function locationForQuestion(state: MatchState, questionIndex: number) {
  const id = currentLocationId({ locationIds: state.locationIds }, questionIndex);
  return getLocation(id);
}

function applyScores(state: MatchState, now: number): MatchState {
  const loc = locationForQuestion(state, state.questionIndex);
  if (!loc || !state.truth || !state.roundStartedAtMs) return state;
  const slotIsRound4 = isRound4Question(state.questionIndex, state.photoQuestions || PHOTO_QUESTIONS);
  const durationSec = state.durationSec || ROUND_DURATION_SEC;
  const players = state.players.map((p) => {
    const remaining =
      p.locked && p.lockedAtMs ? remainingSeconds(state.roundStartedAtMs!, p.lockedAtMs, durationSec) : 0;
    const responseMs =
      p.locked && p.lockedAtMs
        ? Math.max(0, p.lockedAtMs - state.roundStartedAtMs!)
        : durationSec * 1000;
    const roundScore = scoreGuess({
      truth: state.truth!,
      guess: p.guess ?? null,
      country: loc.country,
      nation: loc.nation,
      remainingSec: remaining,
      responseMs,
      isRound4: ROUND4_3D_LIVE && slotIsRound4,
      durationSec,
    });
    const distance = Number.isFinite(roundScore.distanceKm) ? roundScore.distanceKm : NO_GUESS_KM;
    return {
      ...p,
      roundScore,
      totalScore: p.totalScore + roundScore.roundScore,
      totalDistanceKm: p.totalDistanceKm + distance,
      totalResponseMs: p.totalResponseMs + responseMs,
    };
  });
  const record: RoundRecord = {
    index: state.questionIndex,
    locationId: loc.id,
    isRound4: slotIsRound4,
    envId: slotIsRound4 ? state.envId : undefined,
    truth: state.truth,
    guesses: Object.fromEntries(
      players.map((p) => [
        p.id,
        { guess: p.guess ?? null, score: p.roundScore! },
      ]),
    ),
  };
  return {
    ...state,
    players,
    revealed: true,
    roundHistory: [...state.roundHistory, record],
    seq: state.seq + 1,
    lastEventAt: now,
  };
}

export function createLobbyState(): MatchState {
  return {
    seq: 0,
    phase: "lobby",
    mode: "solo",
    hostId: "",
    seed: 0,
    roundIndex: 0,
    questionIndex: 0,
    locationIds: [],
    envId: ROUND4_DEFAULT,
    envIds: [],
    durationSec: ROUND_DURATION_SEC,
    photoQuestions: MATCH_LENGTH.standard.photoQuestions,
    totalQuestions: MATCH_LENGTH.standard.totalQuestions,
    totalRounds: MATCH_LENGTH.standard.totalRounds,
    timeDifficulty: "medium",
    matchLength: "standard",
    atlas: DEFAULT_ATLAS,
    players: [],
    revealed: false,
    roundHistory: [],
    winnerIds: [],
    lastEventAt: 0,
  };
}

const ROUND4_DEFAULT = "remix_rondavels";

function matchOptions(difficulty?: TimeDifficulty, matchLength?: MatchLengthId) {
  const timeDifficulty = difficulty ?? "medium";
  const length = matchLength ?? "standard";
  return {
    timeDifficulty,
    matchLength: length,
    durationSec: DIFFICULTY_SECONDS[timeDifficulty],
  };
}

function applyPlan(plan: ReturnType<typeof planMatch>) {
  return {
    locationIds: plan.locationIds,
    envId: plan.envIds[0] ?? ROUND4_DEFAULT,
    envIds: plan.envIds,
    photoQuestions: plan.photoQuestions,
    totalQuestions: plan.totalQuestions,
    totalRounds: plan.totalRounds,
    atlas: plan.atlas,
  };
}

function beginQuestion(state: MatchState, now: number, intro: boolean): MatchState {
  const loc = locationForQuestion(state, state.questionIndex);
  const envId =
    currentEnvId({ envIds: state.envIds, photoQuestions: state.photoQuestions || PHOTO_QUESTIONS }, state.questionIndex) ?? state.envId;
  const firstHuman = state.players.find((p) => p.kind !== "bot") ?? state.players[0];
  const next = {
    ...state,
    envId,
    revealed: false,
    truth: loc ? { latitude: loc.latitude, longitude: loc.longitude } : undefined,
    players: resetRoundFlags(state.players),
    activeSeatId: state.duelKind === "hotseat" ? firstHuman?.id : undefined,
    roundIndex: roundOf(state.questionIndex),
  };
  if (intro) {
    return { ...bump(next, "round_intro", now), roundStartedAtMs: undefined };
  }
  return { ...bump(next, "round_active", now), roundStartedAtMs: now };
}

function beginRound(state: MatchState, now: number): MatchState {
  return beginQuestion(state, now, true);
}

export function reduce(state: MatchState, event: MatchEvent): MatchState {
  switch (event.type) {
    case "HYDRATE":
      return event.state;
    case "HOME":
      return createLobbyState();
    case "CREATE_SOLO": {
      const plan = planMatch(event.seed, event.matchLength, event.atlas);
      const opts = matchOptions(event.difficulty, event.matchLength);
      return beginRound(
        {
          seq: 0,
          phase: "match_starting",
          mode: "solo",
          hostId: event.playerId,
          seed: event.seed,
          roundIndex: 0,
          questionIndex: 0,
          ...applyPlan(plan),
          ...opts,
          players: [emptyPlayer(event.playerId, event.name, event.avatarId)],
          revealed: false,
          roundHistory: [],
          winnerIds: [],
          lastEventAt: event.now,
        },
        event.now,
      );
    }
    case "CREATE_DUEL": {
      const plan = planMatch(event.seed, event.matchLength, event.atlas);
      const opts = matchOptions(event.difficulty, event.matchLength);
      return {
        seq: 1,
        phase: "waiting_for_players",
        mode: "duel",
        roomCode: event.roomCode,
        hostId: event.playerId,
        seed: event.seed,
        roundIndex: 0,
        questionIndex: 0,
        ...applyPlan(plan),
        ...opts,
        players: [emptyPlayer(event.playerId, event.name, event.avatarId)],
        revealed: false,
        roundHistory: [],
        winnerIds: [],
        lastEventAt: event.now,
        duelKind: "online",
      };
    }
    case "CREATE_LOCAL_DUEL": {
      const plan = planMatch(event.seed, event.matchLength, event.atlas);
      const opts = matchOptions(event.difficulty, event.matchLength);
      const seats = event.seats.slice(0, 2).map((s) =>
        emptyPlayer(s.id, s.name, s.avatarId, s.kind ?? "human"),
      );
      if (seats.length < 2) return state;
      const next: MatchState = {
        seq: 1,
        phase: "waiting_for_players",
        mode: "duel",
        hostId: seats[0].id,
        seed: event.seed,
        roundIndex: 0,
        questionIndex: 0,
        ...applyPlan(plan),
        ...opts,
        players: seats,
        revealed: false,
        roundHistory: [],
        winnerIds: [],
        lastEventAt: event.now,
        duelKind: event.hotseat ? "hotseat" : "bot",
      };
      return beginRound(next, event.now);
    }
    case "PLAYER_JOIN": {
      if (state.phase !== "waiting_for_players" && state.phase !== "rematch_pending") return state;
      if (state.players.some((p) => p.id === event.playerId)) {
        return {
          ...state,
          seq: state.seq + 1,
          players: state.players.map((p) =>
            p.id === event.playerId
              ? {
                  ...p,
                  name: event.name,
                  avatarId: event.avatarId ?? p.avatarId,
                  kind: event.kind ?? p.kind,
                  connected: true,
                }
              : p,
          ),
          lastEventAt: event.now,
        };
      }
      if (state.players.length >= 2) return state;
      return {
        ...state,
        seq: state.seq + 1,
        players: [
          ...state.players,
          emptyPlayer(event.playerId, event.name, event.avatarId, event.kind ?? "human"),
        ],
        lastEventAt: event.now,
      };
    }
    case "PLAYER_LEAVE": {
      const players = state.players.map((p) =>
        p.id === event.playerId ? { ...p, connected: false } : p,
      );
      if (state.phase === "waiting_for_players" || state.phase === "lobby") {
        return { ...state, players: players.filter((p) => p.id !== event.playerId), seq: state.seq + 1 };
      }
      if (state.mode === "duel" && !["match_complete", "final_reveal", "rematch_pending"].includes(state.phase)) {
        const remaining = players.filter((p) => p.connected);
        if (remaining.length === 1) {
          return {
            ...bump(state, "match_complete", event.now),
            players,
            winnerIds: [remaining[0].id],
          };
        }
      }
      return { ...state, players, seq: state.seq + 1, lastEventAt: event.now };
    }
    case "START_MATCH": {
      if (state.mode === "duel" && state.players.length < 2) return state;
      if (!["waiting_for_players", "match_starting", "rematch_pending"].includes(state.phase)) return state;
      return beginRound({ ...state, roundIndex: 0, questionIndex: 0, roundHistory: [], winnerIds: [], players: state.players.map((p) => ({
        ...emptyPlayer(p.id, p.name, p.avatarId, p.kind),
      })) }, event.now);
    }
    case "INTRO_DONE": {
      if (state.phase !== "round_intro") return state;
      return {
        ...bump(state, "round_active", event.now),
        roundStartedAtMs: event.now,
      };
    }
    case "PLACE_PIN": {
      if (
        state.phase !== "round_active" &&
        state.phase !== "player_locked" &&
        state.phase !== "waiting_for_opponent"
      ) {
        return state;
      }
      if (state.duelKind === "hotseat" && state.activeSeatId && event.playerId !== state.activeSeatId) {
        return state;
      }
      return {
        ...state,
        seq: state.seq + 1,
        lastEventAt: event.now,
        players: state.players.map((p) =>
          p.id === event.playerId && !p.locked ? { ...p, guess: event.guess } : p,
        ),
      };
    }
    case "LOCK": {
      if (
        state.phase !== "round_active" &&
        state.phase !== "player_locked" &&
        state.phase !== "waiting_for_opponent"
      ) {
        return state;
      }
      const me = state.players.find((p) => p.id === event.playerId);
      if (!me || me.locked || !me.guess) return state;
      if (state.duelKind === "hotseat" && state.activeSeatId && event.playerId !== state.activeSeatId) {
        return state;
      }
      const players = state.players.map((p) =>
        p.id === event.playerId ? { ...p, locked: true, lockedAtMs: event.now } : p,
      );
      const allLocked = players.filter((p) => p.connected).every((p) => p.locked);
      if (allLocked) {
        return applyScores({ ...state, players, phase: "round_reveal" }, event.now);
      }
      if (state.duelKind === "hotseat") {
        const next = players.find((p) => p.connected && !p.locked);
        return {
          ...bump({ ...state, players }, "waiting_for_opponent", event.now),
          activeSeatId: next?.id,
        };
      }
      return bump({ ...state, players }, state.mode === "duel" ? "waiting_for_opponent" : "player_locked", event.now);
    }
    case "HANDOFF_DONE": {
      if (state.phase !== "waiting_for_opponent" || state.duelKind !== "hotseat") return state;
      return {
        ...bump(state, "round_active", event.now),
        roundStartedAtMs: event.now,
      };
    }
    case "TIMEOUT": {
      if (state.phase !== "round_active" && state.phase !== "waiting_for_opponent" && state.phase !== "player_locked") {
        return state;
      }
      return applyScores({ ...state, phase: "round_expired" }, event.now);
    }
    case "REVEAL_DONE": {
      if (state.phase !== "round_reveal" && state.phase !== "round_expired") return state;
      return bump(state, "round_results", event.now);
    }
    case "CONTINUE": {
      if (state.phase === "final_reveal") {
        return bump(state, "match_complete", event.now);
      }
      if (state.phase === "round_reveal" || state.phase === "round_expired") {
        return reduce(bump(state, "round_results", event.now), { type: "CONTINUE", now: event.now });
      }
      if (state.phase !== "round_results" && state.phase !== "next_round") return state;
      const nextQ = state.questionIndex + 1;
      if (nextQ >= (state.totalQuestions || TOTAL_QUESTIONS)) {
        const { winnerIds } = rankPlayers(state.players);
        return { ...bump(state, "final_reveal", event.now), winnerIds };
      }
      const advancing: MatchState = {
        ...state,
        questionIndex: nextQ,
        roundIndex: roundOf(nextQ),
        phase: "next_round",
      };
      const newRound = nextQ % QUESTIONS_PER_ROUND === 0;
      return beginQuestion(advancing, event.now, newRound);
    }
    case "REMATCH": {
      const plan = planMatch(event.seed, event.matchLength ?? state.matchLength, event.atlas ?? state.atlas);
      const opts = matchOptions(event.difficulty ?? state.timeDifficulty, event.matchLength ?? state.matchLength);
      const players = state.players.map((p) => emptyPlayer(p.id, p.name, p.avatarId, p.kind));
      const next: MatchState = {
        ...state,
        seq: state.seq + 1,
        phase: state.mode === "duel" ? "rematch_pending" : "match_starting",
        seed: event.seed,
        roundIndex: 0,
        questionIndex: 0,
        ...applyPlan(plan),
        ...opts,
        players,
        revealed: false,
        roundHistory: [],
        winnerIds: [],
        truth: undefined,
        roundStartedAtMs: undefined,
        lastEventAt: event.now,
      };
      if (state.mode === "solo") return beginRound(next, event.now);
      return next;
    }
    default:
      return state;
  }
}

export function toPublicSnapshot(state: MatchState): PublicSnapshot {
  const hideGuesses = !state.revealed &&
    (state.phase === "round_active" ||
      state.phase === "player_locked" ||
      state.phase === "waiting_for_opponent" ||
      state.phase === "round_intro" ||
      state.phase === "match_starting");
  return {
    seq: state.seq,
    phase: state.phase,
    mode: state.mode,
    roomCode: state.roomCode,
    hostId: state.hostId,
    seed: state.seed,
    roundIndex: state.roundIndex,
    questionIndex: state.questionIndex,
    locationIds: hideGuesses ? state.locationIds : state.locationIds,
    envId: state.envId,
    envIds: state.envIds,
    durationSec: state.durationSec,
    photoQuestions: state.photoQuestions,
    totalQuestions: state.totalQuestions,
    totalRounds: state.totalRounds,
    timeDifficulty: state.timeDifficulty,
    matchLength: state.matchLength,
    atlas: state.atlas,
    roundStartedAtMs: state.roundStartedAtMs,
    players: state.players.map((p) => ({
      ...p,
      guess: hideGuesses ? undefined : p.guess,
      roundScore: hideGuesses ? undefined : p.roundScore,
    })),
    truth: hideGuesses ? undefined : state.truth,
    revealed: state.revealed,
    roundHistory: hideGuesses ? [] : state.roundHistory,
    winnerIds: state.winnerIds,
  };
}

export function activeLocation(state: MatchState) {
  return locationForQuestion(state, state.questionIndex);
}

export function activeEnvironment(state: MatchState) {
  if (!isRound4Question(state.questionIndex, state.photoQuestions || PHOTO_QUESTIONS)) return undefined;
  return environmentById(state.envId) ?? environmentById(state.envIds[state.questionIndex - (state.photoQuestions || PHOTO_QUESTIONS)] ?? "");
}

export function isRound4(state: MatchState): boolean {
  return isRound4Question(state.questionIndex, state.photoQuestions || PHOTO_QUESTIONS);
}
