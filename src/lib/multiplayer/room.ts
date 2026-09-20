import { reduce, toPublicSnapshot } from "../game/machine.ts";
import { ROUND_DURATION_SEC } from "../game/timer.ts";
import type { AtlasSpec } from "../game/atlas.ts";
import type { MatchLengthId, TimeDifficulty } from "../game/timer.ts";
import type { LatLng, MatchState, PublicSnapshot } from "../game/types.ts";

/**
 * Server-authoritative room commands. The Durable Object (or a local test)
 * applies these through the same reducer the client uses, so ranked play and
 * solo can never disagree about scoring.
 */
export type RoomCommand =
  | {
      t: "join";
      playerId: string;
      name: string;
      avatarId?: string;
      /** Creator settings; ignored for every later joiner. */
      roomCode?: string;
      seed?: number;
      difficulty?: TimeDifficulty;
      matchLength?: MatchLengthId;
      atlas?: AtlasSpec;
      now: number;
    }
  | { t: "start"; playerId: string; now: number }
  | { t: "intro"; playerId: string; now: number }
  | { t: "pin"; playerId: string; guess: LatLng; now: number }
  | { t: "lock"; playerId: string; guess: LatLng; now: number }
  | { t: "continue"; playerId: string; now: number }
  | { t: "rematch"; playerId: string; seed: number; now: number }
  | { t: "leave"; playerId: string; now: number }
  | { t: "timeout"; now: number };

export function applyRoomCommand(state: MatchState, cmd: RoomCommand): MatchState {
  switch (cmd.t) {
    case "join": {
      // First socket in a fresh room bootstraps the duel; later ones take a seat.
      if (state.phase === "lobby" || !state.hostId) {
        return reduce(state, {
          type: "CREATE_DUEL",
          playerId: cmd.playerId,
          name: cmd.name,
          avatarId: cmd.avatarId,
          roomCode: cmd.roomCode ?? "ROOM",
          seed: cmd.seed ?? 1,
          now: cmd.now,
          difficulty: cmd.difficulty,
          matchLength: cmd.matchLength,
          atlas: cmd.atlas,
        });
      }
      return autoStart(
        reduce(state, {
          type: "PLAYER_JOIN",
          playerId: cmd.playerId,
          name: cmd.name,
          avatarId: cmd.avatarId,
          now: cmd.now,
        }),
        cmd.now,
      );
    }
    case "start":
      return reduce(state, { type: "START_MATCH", now: cmd.now });
    case "intro":
      return reduce(state, { type: "INTRO_DONE", now: cmd.now });
    case "pin":
      return reduce(state, {
        type: "PLACE_PIN",
        playerId: cmd.playerId,
        guess: cmd.guess,
        now: cmd.now,
      });
    case "lock": {
      const placed = reduce(state, {
        type: "PLACE_PIN",
        playerId: cmd.playerId,
        guess: cmd.guess,
        now: cmd.now,
      });
      return reduce(placed, { type: "LOCK", playerId: cmd.playerId, now: cmd.now });
    }
    case "continue":
      return reduce(state, { type: "CONTINUE", now: cmd.now });
    case "rematch":
      return autoStart(reduce(state, { type: "REMATCH", seed: cmd.seed, now: cmd.now }), cmd.now);
    case "leave":
      return reduce(state, { type: "PLAYER_LEAVE", playerId: cmd.playerId, now: cmd.now });
    case "timeout":
      return reduce(state, { type: "TIMEOUT", now: cmd.now });
  }
}

/** A full room starts as soon as two players are present. */
function autoStart(state: MatchState, now: number): MatchState {
  if (state.phase !== "waiting_for_players" && state.phase !== "rematch_pending") return state;
  const connected = state.players.filter((p) => p.connected).length;
  if (connected < 2) return state;
  return reduce(state, { type: "START_MATCH", now });
}

/** What every socket in the room is allowed to see right now. */
export function roomSnapshot(state: MatchState): PublicSnapshot {
  return toPublicSnapshot(state);
}

/**
 * Epoch ms at which the active round must be force-revealed, or null when no
 * timer is running. The Durable Object arms its alarm from this.
 */
export function roundDeadlineMs(state: MatchState): number | null {
  if (!state.roundStartedAtMs) return null;
  const ticking =
    state.phase === "round_active" ||
    state.phase === "waiting_for_opponent" ||
    state.phase === "player_locked";
  if (!ticking) return null;
  return state.roundStartedAtMs + (state.durationSec || ROUND_DURATION_SEC) * 1000;
}
