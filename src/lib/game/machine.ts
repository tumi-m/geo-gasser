import { environmentById } from "./environments.ts";
import { getLocation } from "./locations.ts";
import { rankPlayers, scoreGuess } from "./scoring.ts";
import { currentLocationId, planMatch, REAL_ROUNDS } from "./selection.ts";
import { remainingSeconds, ROUND_DURATION_SEC } from "./timer.ts";
import type { LatLng, MatchPhase, MatchState, PlayerState, PublicSnapshot, RoundRecord } from "./types.ts";

export const TOTAL_ROUNDS = 4;

export type MatchEvent =
  | { type: "HYDRATE"; state: MatchState }
  | { type: "CREATE_SOLO"; playerId: string; name: string; seed: number; now: number }
  | { type: "CREATE_DUEL"; playerId: string; name: string; roomCode: string; seed: number; now: number }
  | { type: "PLAYER_JOIN"; playerId: string; name: string; now: number }
  | { type: "PLAYER_LEAVE"; playerId: string; now: number }
  | { type: "START_MATCH"; now: number }
  | { type: "INTRO_DONE"; now: number }
  | { type: "PLACE_PIN"; playerId: string; guess: LatLng; now: number }
  | { type: "LOCK"; playerId: string; now: number }
  | { type: "TIMEOUT"; now: number }
  | { type: "REVEAL_DONE"; now: number }
  | { type: "CONTINUE"; now: number }
  | { type: "REMATCH"; seed: number; now: number }
  | { type: "HOME"; now: number };

function bump(state: MatchState, phase: MatchPhase, now: number): MatchState {
  return { ...state, phase, seq: state.seq + 1, lastEventAt: now };
}

function emptyPlayer(id: string, name: string): PlayerState {
  return {
    id,
    name,
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

function locationForRound(state: MatchState, roundIndex: number) {
  const plan = { seed: state.seed, locationIds: state.locationIds, envId: state.envId };
  const id = currentLocationId(plan, roundIndex);
  return getLocation(id);
}

function applyScores(state: MatchState, now: number): MatchState {
  const loc = locationForRound(state, state.roundIndex);
  if (!loc || !state.truth || !state.roundStartedAtMs) return state;
  const isRound4 = state.roundIndex >= REAL_ROUNDS;
  const players = state.players.map((p) => {
    const remaining = p.locked && p.lockedAtMs
      ? remainingSeconds(state.roundStartedAtMs!, p.lockedAtMs)
      : 0;
    const responseMs = p.locked && p.lockedAtMs
      ? Math.max(0, p.lockedAtMs - state.roundStartedAtMs!)
      : ROUND_DURATION_SEC * 1000;
    const roundScore = scoreGuess({
      truth: state.truth!,
      guess: p.locked ? p.guess ?? null : null,
      country: loc.country,
      remainingSec: remaining,
      responseMs,
      isRound4,
    });
    const distance = Number.isFinite(roundScore.distanceKm) ? roundScore.distanceKm : 0;
    return {
      ...p,
      roundScore,
      totalScore: p.totalScore + roundScore.roundScore,
      totalDistanceKm: p.totalDistanceKm + (Number.isFinite(roundScore.distanceKm) ? distance : 0),
      totalResponseMs: p.totalResponseMs + responseMs,
    };
  });
  const record: RoundRecord = {
    index: state.roundIndex,
    locationId: loc.id,
    isRound4,
    envId: isRound4 ? state.envId : undefined,
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
    locationIds: [],
    envId: ROUND4_DEFAULT,
    players: [],
    revealed: false,
    roundHistory: [],
    winnerIds: [],
    lastEventAt: 0,
  };
}

const ROUND4_DEFAULT = "remix_cape";

function beginRound(state: MatchState, now: number): MatchState {
  const loc = locationForRound(state, state.roundIndex);
  return {
    ...bump(state, "round_intro", now),
    revealed: false,
    truth: loc ? { latitude: loc.latitude, longitude: loc.longitude } : undefined,
    roundStartedAtMs: undefined,
    players: resetRoundFlags(state.players),
  };
}

export function reduce(state: MatchState, event: MatchEvent): MatchState {
  switch (event.type) {
    case "HYDRATE":
      return event.state;
    case "HOME":
      return createLobbyState();
    case "CREATE_SOLO": {
      const plan = planMatch(event.seed);
      return beginRound(
        {
          seq: 0,
          phase: "match_starting",
          mode: "solo",
          hostId: event.playerId,
          seed: event.seed,
          roundIndex: 0,
          locationIds: plan.locationIds,
          envId: plan.envId,
          players: [emptyPlayer(event.playerId, event.name)],
          revealed: false,
          roundHistory: [],
          winnerIds: [],
          lastEventAt: event.now,
        },
        event.now,
      );
    }
    case "CREATE_DUEL": {
      const plan = planMatch(event.seed);
      return {
        seq: 1,
        phase: "waiting_for_players",
        mode: "duel",
        roomCode: event.roomCode,
        hostId: event.playerId,
        seed: event.seed,
        roundIndex: 0,
        locationIds: plan.locationIds,
        envId: plan.envId,
        players: [emptyPlayer(event.playerId, event.name)],
        revealed: false,
        roundHistory: [],
        winnerIds: [],
        lastEventAt: event.now,
      };
    }
    case "PLAYER_JOIN": {
      if (state.phase !== "waiting_for_players" && state.phase !== "rematch_pending") return state;
      if (state.players.some((p) => p.id === event.playerId)) {
        return {
          ...state,
          seq: state.seq + 1,
          players: state.players.map((p) =>
            p.id === event.playerId ? { ...p, name: event.name, connected: true } : p,
          ),
          lastEventAt: event.now,
        };
      }
      if (state.players.length >= 2) return state;
      return {
        ...state,
        seq: state.seq + 1,
        players: [...state.players, emptyPlayer(event.playerId, event.name)],
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
      return beginRound({ ...state, roundIndex: 0, roundHistory: [], winnerIds: [], players: state.players.map((p) => ({
        ...emptyPlayer(p.id, p.name),
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
      if (state.phase !== "round_active" && state.phase !== "player_locked") return state;
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
      if (state.phase !== "round_active" && state.phase !== "player_locked") return state;
      const me = state.players.find((p) => p.id === event.playerId);
      if (!me || me.locked || !me.guess) return state;
      const players = state.players.map((p) =>
        p.id === event.playerId ? { ...p, locked: true, lockedAtMs: event.now } : p,
      );
      const allLocked = players.filter((p) => p.connected).every((p) => p.locked);
      if (allLocked) {
        return applyScores({ ...state, players, phase: "round_reveal" }, event.now);
      }
      return bump({ ...state, players }, state.mode === "duel" ? "waiting_for_opponent" : "player_locked", event.now);
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
      if (state.roundIndex + 1 >= TOTAL_ROUNDS) {
        const { winnerIds } = rankPlayers(state.players);
        return { ...bump(state, "final_reveal", event.now), winnerIds };
      }
      return beginRound({ ...state, roundIndex: state.roundIndex + 1, phase: "next_round" }, event.now);
    }
    case "REMATCH": {
      const plan = planMatch(event.seed);
      const players = state.players.map((p) => emptyPlayer(p.id, p.name));
      const next: MatchState = {
        ...state,
        seq: state.seq + 1,
        phase: state.mode === "duel" ? "rematch_pending" : "match_starting",
        seed: event.seed,
        roundIndex: 0,
        locationIds: plan.locationIds,
        envId: plan.envId,
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
    locationIds: hideGuesses ? state.locationIds : state.locationIds,
    envId: state.envId,
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
  return locationForRound(state, state.roundIndex);
}

export function activeEnvironment(state: MatchState) {
  if (state.roundIndex < REAL_ROUNDS) return undefined;
  return environmentById(state.envId);
}

export function isRound4(state: MatchState): boolean {
  return state.roundIndex >= REAL_ROUNDS;
}
