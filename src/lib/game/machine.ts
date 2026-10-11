import { DEFAULT_ATLAS, filterByAtlas, nationOf, type AtlasSpec } from "./atlas.ts";
import { cosmosTarget } from "./cosmos.ts";
import { environmentById } from "./environments.ts";
import { getLocation, needsStreetView, playableLocations } from "./locations.ts";
import { mulberry32 } from "./rng.ts";
import { sceneCandidates } from "./scene.ts";
import { NO_GUESS_KM, rankPlayers, scoreGuess } from "./scoring.ts";
import { countryAt, pinInNation } from "../map/country-at.ts";
import { duelDamage, isHealthDuel, placeByPlace, START_HEALTH } from "./rules.ts";
import { currentEnvId, currentLocationId, isRound4Question, planHealthDuel, planMatch, planStreak, PHOTO_QUESTIONS, QUESTIONS_PER_ROUND, roundOf, TOTAL_QUESTIONS } from "./selection.ts";
import { DIFFICULTY_SECONDS, MATCH_LENGTH, remainingSeconds, ROUND_DURATION_SEC, type MatchLengthId, type TimeDifficulty } from "./timer.ts";
import type { DuelRule, LatLng, MatchPhase, MatchState, MovementRule, PlayerState, PublicSnapshot, RoundRecord, SceneInfo } from "./types.ts";

export { TOTAL_ROUNDS, TOTAL_QUESTIONS, QUESTIONS_PER_ROUND } from "./selection.ts";

export type MatchEvent =
  | { type: "HYDRATE"; state: MatchState }
  | ({ type: "CREATE_SOLO"; playerId: string; name: string; avatarId?: string; seed: number; now: number; difficulty?: TimeDifficulty; matchLength?: MatchLengthId; atlas?: AtlasSpec; avoidLocationIds?: string[]; streetView?: boolean; streak?: boolean } & Rules)
  | ({ type: "CREATE_DUEL"; playerId: string; name: string; avatarId?: string; roomCode: string; seed: number; now: number; difficulty?: TimeDifficulty; matchLength?: MatchLengthId; atlas?: AtlasSpec; avoidLocationIds?: string[]; streetView?: boolean } & Rules)
  | ({
      type: "CREATE_LOCAL_DUEL";
      seats: Array<{ id: string; name: string; avatarId?: string; kind?: "human" | "bot" }>;
      hotseat?: boolean;
      seed: number;
      now: number;
      difficulty?: TimeDifficulty;
      matchLength?: MatchLengthId;
      atlas?: AtlasSpec;
      avoidLocationIds?: string[];
      streetView?: boolean;
    } & Rules)
  | { type: "PLAYER_JOIN"; playerId: string; name: string; avatarId?: string; kind?: "human" | "bot"; now: number }
  | { type: "PLAYER_LEAVE"; playerId: string; now: number }
  | { type: "START_MATCH"; now: number }
  | { type: "INTRO_DONE"; now: number }
  | { type: "PLACE_PIN"; playerId: string; guess: LatLng; now: number }
  | {
      type: "LOCK";
      playerId: string;
      now: number;
      /**
       * Local bot only: the response time to score, when it answers sooner
       * than it planned (it hurries once you have locked, but is scored on
       * the time it meant to take). Network locks never carry this.
       */
      responseMs?: number;
    }
  | { type: "HANDOFF_DONE"; now: number }
  /** The current place needs Street View and it could not load: deal a photo place instead. */
  | { type: "SWAP_PLACE"; now: number }
  | { type: "TIMEOUT"; now: number }
  /** Solo only: stop the clock (a duel's rival keeps playing, so duels never pause). */
  | { type: "PAUSE"; now: number }
  | { type: "RESUME"; now: number }
  | { type: "REVEAL_DONE"; now: number }
  | { type: "CONTINUE"; now: number }
  | ({ type: "REMATCH"; seed: number; now: number; difficulty?: TimeDifficulty; matchLength?: MatchLengthId; atlas?: AtlasSpec; avoidLocationIds?: string[]; streetView?: boolean } & Rules)
  | { type: "HOME"; now: number };

/** Rule sets a match can be created with (rules.ts). Absent means the defaults. */
type Rules = { movement?: MovementRule; duelRule?: DuelRule };

/** Only the rules that differ from the defaults are stored, so old states read the same. */
function rulesOf(
  mode: "solo" | "duel",
  rules: Rules & { streak?: boolean },
): Pick<MatchState, "movement" | "duelRule" | "streak"> {
  return {
    movement: rules.movement && rules.movement !== "moving" ? rules.movement : undefined,
    duelRule: mode === "duel" && rules.duelRule === "health" ? "health" : undefined,
    streak: mode === "solo" && rules.streak ? true : undefined,
  };
}

/** The deck for a match: a streak, a health duel or the chosen length. */
function planFor(
  mode: "solo" | "duel",
  rules: Pick<MatchState, "duelRule" | "streak">,
  seed: number,
  matchLength: MatchLengthId | undefined,
  atlas: AtlasSpec | undefined,
  avoid: string[] | undefined,
  streetView: boolean | undefined,
) {
  if (rules.streak) return planStreak(seed, matchLength ?? "escape", avoid, { streetView });
  if (mode === "duel" && rules.duelRule === "health")
    return planHealthDuel(seed, matchLength ?? "escape", atlas, avoid, { streetView });
  return planMatch(seed, matchLength, atlas, avoid, { streetView });
}

/** Health duels start every seat at full health; other matches carry none. */
function withHealth(players: PlayerState[], state: Pick<MatchState, "mode" | "duelRule">): PlayerState[] {
  return isHealthDuel(state) ? players.map((p) => ({ ...p, health: START_HEALTH })) : players;
}

/**
 * True once the place on screen is the match's last: the deck is spent, a
 * health duel has a player on zero, or a streak has just been broken. The
 * reveal's Continue then leads to the results.
 */
export function matchOver(state: MatchState): boolean {
  if (state.questionIndex + 1 >= (state.totalQuestions ?? TOTAL_QUESTIONS)) return true;
  if (!state.revealed) return false;
  if (isHealthDuel(state) && state.players.some((p) => (p.health ?? START_HEALTH) <= 0)) return true;
  if (state.streak && state.roundHistory.at(-1)?.streak?.correct === false) return true;
  return false;
}

/** Country Streak: places named right in a row (the run so far). */
export function streakCount(state: Pick<MatchState, "roundHistory">): number {
  let n = 0;
  for (const r of state.roundHistory) {
    if (!r.streak) continue;
    if (r.streak.correct) n += 1;
    else break;
  }
  return n;
}

/** Who won: health first in a health duel, then the usual ranking. */
function finalWinners(state: MatchState): string[] {
  if (isHealthDuel(state)) {
    const top = Math.max(...state.players.map((p) => p.health ?? 0));
    const alive = state.players.filter((p) => (p.health ?? 0) === top);
    if (alive.length === 1) return [alive[0].id];
    return rankPlayers(alive).winnerIds;
  }
  return rankPlayers(state.players).winnerIds;
}

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
    responseMs: undefined,
    roundScore: undefined,
  }));
}

function locationForQuestion(state: MatchState, questionIndex: number) {
  const id = currentLocationId({ locationIds: state.locationIds }, questionIndex);
  return getLocation(id);
}

function applyScores(state: MatchState, now: number): MatchState {
  const loc = locationForQuestion(state, state.questionIndex);
  if (!loc || !state.truth || state.roundStartedAtMs == null) return state;
  const slotIsRound4 = isRound4Question(state.questionIndex, state.photoQuestions || PHOTO_QUESTIONS);
  const durationSec = state.durationSec || ROUND_DURATION_SEC;
  const players = state.players.map((p) => {
    const remaining = p.locked && p.responseMs != null ? Math.max(0, durationSec - p.responseMs / 1000) : 0;
    const responseMs =
      p.locked && p.lockedAtMs != null
        ? p.responseMs ?? Math.max(0, p.lockedAtMs - state.roundStartedAtMs!)
        : durationSec * 1000;
    const roundScore = scoreGuess({
      truth: state.truth!,
      guess: p.locked ? p.guess ?? null : null,
      country: loc.country,
      nation: loc.nation,
      remainingSec: remaining,
      responseMs,
      durationSec,
    });
    // A cosmic miss is counted in decades for the tie-break: its real gap in
    // km would swamp every map round.
    const distance = !Number.isFinite(roundScore.distanceKm)
      ? NO_GUESS_KM
      : roundScore.decades != null
        ? Math.min(NO_GUESS_KM, roundScore.decades * 2000)
        : roundScore.distanceKm;
    return {
      ...p,
      roundScore,
      totalScore: p.totalScore + roundScore.roundScore,
      totalDistanceKm: p.totalDistanceKm + distance,
      totalResponseMs: p.totalResponseMs + responseMs,
    };
  });
  // Health duels: the lower score loses the gap, times this place's multiplier.
  const damage = isHealthDuel(state) ? duelDamage(players, state.questionIndex + 1) : null;
  const hurt = damage
    ? players.map((p) =>
        p.id === damage.playerId ? { ...p, health: Math.max(0, (p.health ?? START_HEALTH) - damage.amount) } : p,
      )
    : players;
  // Country Streak: right if the pin is in the place's country.
  const pin = state.streak ? (players[0]?.locked ? players[0].guess : undefined) : undefined;
  const streak = state.streak
    ? {
        correct: Boolean(pin && pinInNation(pin, nationOf(loc), state.truth)),
        guessed: pin ? countryAt(pin).name : undefined,
      }
    : undefined;
  const record: RoundRecord = {
    index: state.questionIndex,
    locationId: loc.id,
    isRound4: slotIsRound4,
    ...(loc.country === "SPACE" ? { cosmos: true } : {}),
    envId: slotIsRound4 ? state.envId : undefined,
    truth: state.truth,
    guesses: Object.fromEntries(
      players.map((p) => [
        p.id,
        { guess: p.locked ? p.guess ?? null : null, score: p.roundScore! },
      ]),
    ),
    ...(damage ? { damage } : {}),
    ...(streak ? { streak } : {}),
  };
  return {
    ...state,
    players: hurt,
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

function applyPlan(plan: ReturnType<typeof planMatch>, streetView?: boolean) {
  return {
    streetView: Boolean(streetView),
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
    roundIndex: placeByPlace(state) ? state.questionIndex : roundOf(state.questionIndex),
  };
  if (intro) {
    return { ...bump(next, "round_intro", now), roundStartedAtMs: undefined, pausedAtMs: undefined };
  }
  return { ...bump(next, "round_active", now), roundStartedAtMs: now, pausedAtMs: undefined };
}

/**
 * A photo place to stand in for one Street View could not show: same country
 * where the map has one (the match keeps its mix), never a place already in
 * the deck, and the same pick for the same match and question.
 */
function standInFor(state: MatchState, loc: { country: string }) {
  const used = new Set(state.locationIds);
  const all = playableLocations(false);
  const onMap = filterByAtlas(all, state.atlas);
  const pool = (onMap.length ? onMap : all).filter((l) => !used.has(l.id));
  const same = pool.filter((l) => l.country === loc.country);
  const from = same.length ? same : pool;
  if (!from.length) return undefined;
  const rand = mulberry32((state.seed ^ Math.imul(state.questionIndex + 1, 2654435761)) >>> 0);
  return from[Math.floor(rand() * from.length)];
}

/** True when SWAP_PLACE would deal a stand-in for the current question. */
export function canSwapPlace(state: MatchState): boolean {
  if (state.phase !== "round_intro" && state.phase !== "round_active") return false;
  if (state.players.some((p) => p.locked)) return false;
  const loc = locationForQuestion(state, state.questionIndex);
  return Boolean(loc && needsStreetView(loc) && standInFor(state, loc));
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
      const rules = rulesOf("solo", event);
      const plan = planFor("solo", rules, event.seed, event.matchLength, event.atlas, event.avoidLocationIds, event.streetView);
      const opts = matchOptions(event.difficulty, event.matchLength);
      return beginRound(
        {
          ...rules,
          seq: 0,
          phase: "match_starting",
          mode: "solo",
          hostId: event.playerId,
          seed: event.seed,
          roundIndex: 0,
          questionIndex: 0,
          ...applyPlan(plan, event.streetView),
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
      const rules = rulesOf("duel", event);
      const plan = planFor("duel", rules, event.seed, event.matchLength, event.atlas, event.avoidLocationIds, event.streetView);
      const opts = matchOptions(event.difficulty, event.matchLength);
      return {
        ...rules,
        seq: 1,
        phase: "waiting_for_players",
        mode: "duel",
        roomCode: event.roomCode,
        hostId: event.playerId,
        seed: event.seed,
        roundIndex: 0,
        questionIndex: 0,
        ...applyPlan(plan, event.streetView),
        ...opts,
        players: withHealth([emptyPlayer(event.playerId, event.name, event.avatarId)], { mode: "duel", ...rules }),
        revealed: false,
        roundHistory: [],
        winnerIds: [],
        lastEventAt: event.now,
        duelKind: "online",
      };
    }
    case "CREATE_LOCAL_DUEL": {
      const rules = rulesOf("duel", event);
      const plan = planFor("duel", rules, event.seed, event.matchLength, event.atlas, event.avoidLocationIds, event.streetView);
      const opts = matchOptions(event.difficulty, event.matchLength);
      const seats = withHealth(
        event.seats.slice(0, 2).map((s) => emptyPlayer(s.id, s.name, s.avatarId, s.kind ?? "human")),
        { mode: "duel", ...rules },
      );
      if (seats.length < 2) return state;
      const next: MatchState = {
        ...rules,
        seq: 1,
        phase: "waiting_for_players",
        mode: "duel",
        hostId: seats[0].id,
        seed: event.seed,
        roundIndex: 0,
        questionIndex: 0,
        ...applyPlan(plan, event.streetView),
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
      if (state.phase !== "waiting_for_players" && state.phase !== "rematch_pending" && !state.players.some(p => p.id === event.playerId)) return state;
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
          ...withHealth([emptyPlayer(event.playerId, event.name, event.avatarId, event.kind ?? "human")], state),
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
      if (state.mode === "duel" && state.players.filter((p) => p.connected).length < 2) return state;
      if (!["waiting_for_players", "match_starting", "rematch_pending"].includes(state.phase)) return state;
      return beginRound({ ...state, roundIndex: 0, questionIndex: 0, roundHistory: [], winnerIds: [], players: withHealth(state.players.map((p) => ({
        ...emptyPlayer(p.id, p.name, p.avatarId, p.kind),
      })), state) }, event.now);
    }
    case "SWAP_PLACE": {
      // Only before anyone has answered, and only for a place that cannot be
      // shown without Street View. The clock starts again for the new place.
      if (!canSwapPlace(state)) return state;
      const stand = standInFor(state, locationForQuestion(state, state.questionIndex)!)!;
      const locationIds = state.locationIds.map((id, i) => (i === state.questionIndex ? stand.id : id));
      return beginQuestion({ ...state, locationIds }, event.now, state.phase === "round_intro");
    }
    case "INTRO_DONE": {
      if (state.phase !== "round_intro") return state;
      return {
        ...bump(state, "round_active", event.now),
        roundStartedAtMs: event.now,
      };
    }
    case "PLACE_PIN": {
      if (state.pausedAtMs != null) return state;
      if (!Number.isFinite(event.guess.latitude) || !Number.isFinite(event.guess.longitude) || Math.abs(event.guess.latitude)>90 || Math.abs(event.guess.longitude)>180) return state;
      if (state.roundStartedAtMs == null || event.now < state.roundStartedAtMs || remainingSeconds(state.roundStartedAtMs,event.now,state.durationSec)<=0) return state;
      if (state.duelKind === "hotseat" && state.phase !== "round_active") return state;

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
      if (state.pausedAtMs != null) return state;
      if (state.roundStartedAtMs == null || event.now < state.roundStartedAtMs || remainingSeconds(state.roundStartedAtMs,event.now,state.durationSec)<=0) return state;
      if (state.duelKind === "hotseat" && state.phase !== "round_active") return state;

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
        p.id === event.playerId
          ? {
              ...p,
              locked: true,
              lockedAtMs: event.now,
              responseMs:
                event.responseMs != null
                  ? Math.min(
                      Math.max(event.responseMs, event.now - state.roundStartedAtMs!, 0),
                      (state.durationSec || ROUND_DURATION_SEC) * 1000 - 1,
                    )
                  : Math.max(0, event.now - state.roundStartedAtMs!),
            }
          : p,
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
      if (state.pausedAtMs != null) return state;
      if (state.roundStartedAtMs == null || remainingSeconds(state.roundStartedAtMs,event.now,state.durationSec)>0) return state;
      if (state.duelKind === "hotseat" && state.phase !== "round_active") return state;

      if (state.phase !== "round_active" && state.phase !== "waiting_for_opponent" && state.phase !== "player_locked") {
        return state;
      }
      if (state.duelKind === "hotseat") {
        const players = state.players.map(p=>p.id===state.activeSeatId ? {...p,locked:true,guess:undefined,responseMs:state.durationSec*1000,lockedAtMs:event.now} : p);
        const next = players.find(p=>!p.locked);
        if (next) return {...bump({...state,players},"waiting_for_opponent",event.now),activeSeatId:next.id};
        return applyScores({...state,players,phase:"round_expired"},event.now);
      }
      return applyScores({ ...state, phase: "round_expired" }, event.now);
    }
    case "PAUSE": {
      if (state.mode !== "solo" || state.phase !== "round_active") return state;
      if (state.pausedAtMs != null || state.roundStartedAtMs == null) return state;
      if (remainingSeconds(state.roundStartedAtMs, event.now, state.durationSec) <= 0) return state;
      return { ...state, seq: state.seq + 1, pausedAtMs: event.now };
    }
    case "RESUME": {
      if (state.pausedAtMs == null) return state;
      // The round starts later by however long it stood still, so the clock,
      // the points on offer and the response time all ignore the pause.
      const held = Math.max(0, event.now - state.pausedAtMs);
      return {
        ...state,
        seq: state.seq + 1,
        pausedAtMs: undefined,
        roundStartedAtMs: state.roundStartedAtMs != null ? state.roundStartedAtMs + held : undefined,
      };
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
      // `0` means the plan held no questions: end instead of grinding blanks.
      // A health duel ends on zero health, a streak on its first miss.
      if (matchOver(state)) {
        return { ...bump(state, "final_reveal", event.now), winnerIds: finalWinners(state) };
      }
      const advancing: MatchState = {
        ...state,
        questionIndex: nextQ,
        roundIndex: placeByPlace(state) ? nextQ : roundOf(nextQ),
        phase: "next_round",
      };
      const newRound = placeByPlace(state) || nextQ % QUESTIONS_PER_ROUND === 0;
      return beginQuestion(advancing, event.now, newRound);
    }
    case "REMATCH": {
      if (!["final_reveal","match_complete"].includes(state.phase)) return state;
      const streetView = event.streetView ?? state.streetView;
      const rules = rulesOf(state.mode, {
        movement: event.movement ?? state.movement,
        duelRule: event.duelRule ?? state.duelRule,
        streak: state.streak,
      });
      const plan = planFor(state.mode, rules, event.seed, event.matchLength ?? state.matchLength, event.atlas ?? state.atlas, event.avoidLocationIds, streetView);
      const opts = matchOptions(event.difficulty ?? state.timeDifficulty, event.matchLength ?? state.matchLength);
      // A rematch never resurrects an absent seat: disconnected players are
      // dropped so the room waits for a real opponent instead of a ghost.
      const players = withHealth(
        state.players.filter((p) => p.connected).map((p) => emptyPlayer(p.id, p.name, p.avatarId, p.kind)),
        { mode: state.mode, ...rules },
      );
      const next: MatchState = {
        ...state,
        ...rules,
        seq: state.seq + 1,
        phase: state.mode === "duel" ? "rematch_pending" : "match_starting",
        seed: event.seed,
        roundIndex: 0,
        questionIndex: 0,
        ...applyPlan(plan, streetView),
        ...opts,
        players,
        revealed: false,
        roundHistory: [],
        winnerIds: [],
        truth: undefined,
        roundStartedAtMs: undefined,
        lastEventAt: event.now,
      };
      if (state.mode === "solo" || state.duelKind === "bot" || state.duelKind === "hotseat") return beginRound(next, event.now);
      return next;
    }
    default:
      return state;
  }
}

/**
 * Build the guest-safe scene descriptor for the current question. This is the
 * only scene information a joiner ever receives before the reveal: plate URLs,
 * fallbacks and credit. No id, title, source URL or coordinate.
 */
export function sceneInfoFor(state: MatchState): SceneInfo | undefined {
  const loc = locationForQuestion(state, state.questionIndex);
  if (!loc) return undefined;
  if (needsStreetView(loc)) {
    // No usable photo: Street View only. The neutral path names the place the
    // way a photo's file name does, so a guest can open the same panorama.
    return { kind: "street", src: `street:${loc.id}`, fallbacks: [] };
  }
  if (loc.country === "SPACE") {
    const target = cosmosTarget(loc.id);
    if (!target) return undefined;
    return { kind: "cosmos", src: "", fallbacks: [], cosmos: target.look, clue: target.clue };
  }
  const candidates = sceneCandidates(loc);
  const generated =
    loc.sceneKind === "generated-reconstruction" || loc.sceneUrl.startsWith("/generated/");
  return {
    kind: generated ? "generated" : "photo",
    src: candidates[0] ?? loc.sceneUrl,
    fallbacks: candidates.slice(1),
    provider: loc.panoramaProvider,
    heading: loc.heading,
    pitch: loc.pitch,
    isPano: loc.isPano ?? Boolean(loc.panoUrl),
    imageId: loc.panoramaId,
    views: loc.views?.length ? loc.views : undefined,
  };
}

/** Current scene: the guest descriptor when present, host derivation otherwise. */
export function activeScene(state: MatchState): SceneInfo | undefined {
  if (state.scene) return state.scene;
  if (!state.truth) return undefined;
  return sceneInfoFor(state);
}

export function toPublicSnapshot(state: MatchState): PublicSnapshot {
  // Anything unrevealed stays hidden — including an abandoned match
  // (`match_complete` from PLAYER_LEAVE) which never reaches a reveal.
  const hideAnswers = !state.revealed;
  return {
    seq: state.seq,
    phase: state.phase,
    mode: state.mode,
    roomCode: state.roomCode,
    hostId: state.hostId,
    // The deck, its seed and the environment list are never public: the seed
    // reproduces the deal, and ids resolve to coordinates in the bundle.
    seed: undefined,
    roundIndex: state.roundIndex,
    questionIndex: state.questionIndex,
    locationIds: [],
    envId: "",
    envIds: [],
    scene: state.truth ? sceneInfoFor(state) : undefined,
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
      guess: hideAnswers ? undefined : p.guess,
      roundScore: hideAnswers ? undefined : p.roundScore,
    })),
    truth: hideAnswers ? undefined : state.truth,
    revealed: state.revealed,
    roundHistory: state.roundHistory,
    winnerIds: state.winnerIds,
    movement: state.movement,
    duelRule: state.duelRule,
    streak: state.streak,
  };
}

export function activeLocation(state: MatchState) {
  const id = currentLocationId({ locationIds: state.locationIds }, state.questionIndex);
  if (state.locationIds.length) return getLocation(id);
  // Guests never receive the deck. Once a question is revealed, the record
  // for it is the safe way to recover the location on their side.
  if (!state.revealed) return undefined;
  const last = state.roundHistory[state.roundHistory.length - 1];
  return last ? getLocation(last.locationId) : undefined;
}

/** Location for an arbitrary question slot — used to preload the next plate. */
export function locationAt(state: MatchState, questionIndex: number) {
  if (!state.locationIds.length) return undefined;
  return locationForQuestion(state, questionIndex);
}

export function activeEnvironment(state: MatchState) {
  if (!isRound4Question(state.questionIndex, state.photoQuestions || PHOTO_QUESTIONS)) return undefined;
  return environmentById(state.envId) ?? environmentById(state.envIds[state.questionIndex - (state.photoQuestions || PHOTO_QUESTIONS)] ?? "");
}

export function isRound4(state: MatchState): boolean {
  return isRound4Question(state.questionIndex, state.photoQuestions || PHOTO_QUESTIONS);
}
