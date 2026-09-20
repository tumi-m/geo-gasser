import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLobbyState, reduce, toPublicSnapshot } from "./machine.ts";

const now = 1_000_000;

describe("match state machine", () => {
  it("plays a solo lock → reveal without leaking answers mid-round", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 42,
      now,
    });
    assert.equal(s.phase, "round_intro");
    assert.ok(s.truth);
    s = reduce(s, { type: "INTRO_DONE", now: now + 10 });
    assert.equal(s.phase, "round_active");
    const pub = toPublicSnapshot(s);
    assert.equal(pub.truth, undefined);
    assert.equal(pub.players[0].guess, undefined);

    s = reduce(s, {
      type: "PLACE_PIN",
      playerId: "p1",
      guess: { latitude: -33.96, longitude: 18.41 },
      now: now + 5_000,
    });
    s = reduce(s, { type: "LOCK", playerId: "p1", now: now + 5_000 });
    assert.equal(s.phase, "round_reveal");
    assert.ok(s.revealed);
    assert.ok((s.players[0].roundScore?.roundScore ?? 0) > 0);
  });

  it("scores a placed pin on timeout with no speed bonus", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 7,
      now,
    });
    s = reduce(s, { type: "INTRO_DONE", now });
    const truth = s.truth!;
    s = reduce(s, {
      type: "PLACE_PIN",
      playerId: "p1",
      guess: truth,
      now: now + 1000,
    });
    s = reduce(s, { type: "TIMEOUT", now: now + 45_000 });
    const score = s.players[0].roundScore;
    assert.ok(score);
    assert.equal(score.timePoints, 0);
    assert.ok(score.accuracyPoints > 9000);
    assert.equal(score.roundScore, score.accuracyPoints);
  });

  it("scores a missed pin as zero and a long miss distance", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 11,
      now,
    });
    s = reduce(s, { type: "INTRO_DONE", now });
    s = reduce(s, { type: "TIMEOUT", now: now + 45_000 });
    assert.equal(s.players[0].roundScore?.roundScore, 0);
    assert.ok((s.players[0].totalDistanceKm ?? 0) > 10_000);
  });

  it("requires two players before a duel can start", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_DUEL",
      playerId: "h",
      name: "Host",
      roomCode: "ABC123",
      seed: 1,
      now,
    });
    const blocked = reduce(s, { type: "START_MATCH", now: now + 1 });
    assert.equal(blocked.phase, "waiting_for_players");
    s = reduce(s, { type: "PLAYER_JOIN", playerId: "g", name: "Guest", now: now + 2 });
    s = reduce(s, { type: "START_MATCH", now: now + 3 });
    assert.equal(s.phase, "round_intro");
    assert.equal(s.players.length, 2);
  });

  it("keeps opponent guesses hidden until both lock", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_DUEL",
      playerId: "h",
      name: "Host",
      roomCode: "ABC123",
      seed: 3,
      now,
    });
    s = reduce(s, { type: "PLAYER_JOIN", playerId: "g", name: "Guest", now: now + 1 });
    s = reduce(s, { type: "START_MATCH", now: now + 2 });
    s = reduce(s, { type: "INTRO_DONE", now: now + 3 });
    s = reduce(s, {
      type: "PLACE_PIN",
      playerId: "h",
      guess: s.truth!,
      now: now + 4,
    });
    s = reduce(s, { type: "LOCK", playerId: "h", now: now + 5 });
    assert.equal(s.phase, "waiting_for_opponent");
    const pub = toPublicSnapshot(s);
    assert.equal(pub.players.find((p) => p.id === "h")?.guess, undefined);
    assert.equal(pub.truth, undefined);
    s = reduce(s, { type: "TIMEOUT", now: now + 45_000 });
    assert.equal(s.phase, "round_expired");
    assert.ok((s.players.find((p) => p.id === "h")?.roundScore?.roundScore ?? 0) > 0);
    assert.equal(s.players.find((p) => p.id === "g")?.roundScore?.roundScore, 0);
  });
});

describe("two-player lock and local duels", () => {
  const now = 1_000_000;
  it("lets the second player lock after the first, instead of freezing on wait", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_DUEL",
      playerId: "h",
      name: "Host",
      roomCode: "ABC123",
      seed: 3,
      now,
    });
    s = reduce(s, { type: "PLAYER_JOIN", playerId: "g", name: "Guest", now: now + 1 });
    s = reduce(s, { type: "START_MATCH", now: now + 2 });
    s = reduce(s, { type: "INTRO_DONE", now: now + 3 });
    s = reduce(s, { type: "PLACE_PIN", playerId: "h", guess: s.truth!, now: now + 4 });
    s = reduce(s, { type: "LOCK", playerId: "h", now: now + 5 });
    assert.equal(s.phase, "waiting_for_opponent");
    s = reduce(s, {
      type: "PLACE_PIN",
      playerId: "g",
      guess: { latitude: 52.37, longitude: 4.89 },
      now: now + 6,
    });
    s = reduce(s, { type: "LOCK", playerId: "g", now: now + 7 });
    assert.equal(s.phase, "round_reveal");
    assert.equal(s.players.filter((p) => p.locked).length, 2);
  });

  it("starts a grok bot duel without a lobby wait", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_LOCAL_DUEL",
      seed: 9,
      now,
      seats: [
        { id: "p1", name: "Ada", avatarId: "atlas" },
        { id: "grok-bot", name: "Grok", avatarId: "grok", kind: "bot" },
      ],
    });
    assert.equal(s.phase, "round_intro");
    assert.equal(s.duelKind, "bot");
    assert.equal(s.players.length, 2);
    s = reduce(s, { type: "INTRO_DONE", now: now + 1 });
    s = reduce(s, { type: "PLACE_PIN", playerId: "p1", guess: s.truth!, now: now + 2 });
    s = reduce(s, { type: "LOCK", playerId: "p1", now: now + 3 });
    assert.equal(s.phase, "waiting_for_opponent");
    s = reduce(s, { type: "PLACE_PIN", playerId: "grok-bot", guess: s.truth!, now: now + 4 });
    s = reduce(s, { type: "LOCK", playerId: "grok-bot", now: now + 5 });
    assert.equal(s.phase, "round_reveal");
  });

  it("hands a pass-and-play seat to player two", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_LOCAL_DUEL",
      hotseat: true,
      seed: 12,
      now,
      seats: [
        { id: "a", name: "One", avatarId: "veld" },
        { id: "b", name: "Two", avatarId: "canal" },
      ],
    });
    assert.equal(s.duelKind, "hotseat");
    s = reduce(s, { type: "INTRO_DONE", now: now + 1 });
    s = reduce(s, { type: "PLACE_PIN", playerId: "a", guess: s.truth!, now: now + 2 });
    s = reduce(s, { type: "LOCK", playerId: "a", now: now + 3 });
    assert.equal(s.phase, "waiting_for_opponent");
    assert.equal(s.activeSeatId, "b");
    const blocked = reduce(s, { type: "PLACE_PIN", playerId: "a", guess: s.truth!, now: now + 4 });
    assert.equal(blocked.seq, s.seq);
    s = reduce(s, { type: "HANDOFF_DONE", now: now + 5 });
    assert.equal(s.phase, "round_active");
    s = reduce(s, { type: "PLACE_PIN", playerId: "b", guess: s.truth!, now: now + 6 });
    s = reduce(s, { type: "LOCK", playerId: "b", now: now + 7 });
    assert.equal(s.phase, "round_reveal");
  });
});

describe("match options", () => {
  it("hard solo uses a 30 second timer", () => {
    const s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 4,
      now,
      difficulty: "hard",
    });
    assert.equal(s.durationSec, 30);
    assert.equal(s.timeDifficulty, "hard");
  });
  it("extended solo deals 70 unique questions", () => {
    const s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 8,
      now,
      matchLength: "extended",
    });
    assert.equal(s.totalQuestions, 70);
    assert.equal(s.locationIds.length, 70);
    assert.equal(new Set(s.locationIds).size, 70);
    assert.equal(s.totalRounds, 7);
  });
  it("full game deals 100 unique questions across 10 rounds", () => {
    const s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 19,
      now,
      matchLength: "full",
    });
    assert.equal(s.totalQuestions, 100);
    assert.equal(s.locationIds.length, 100);
    assert.equal(new Set(s.locationIds).size, 100);
    assert.equal(s.totalRounds, 10);
    assert.equal(s.matchLength, "full");
  });
});

describe("forty-question match", () => {
  const now = 1_000_000;
  it("plays ten questions in a round before advancing", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 3,
      now,
    });
    assert.equal(s.questionIndex, 0);
    assert.equal(s.locationIds.length, 40);
    for (let q = 0; q < 10; q++) {
      if (s.phase === "round_intro") s = reduce(s, { type: "INTRO_DONE", now: now + q * 100 });
      s = reduce(s, { type: "PLACE_PIN", playerId: "p1", guess: s.truth!, now: now + q * 100 + 1 });
      s = reduce(s, { type: "LOCK", playerId: "p1", now: now + q * 100 + 2 });
      s = reduce(s, { type: "CONTINUE", now: now + q * 100 + 3 });
    }
    assert.equal(s.roundIndex, 1);
    assert.equal(s.questionIndex, 10);
    assert.equal(s.phase, "round_intro");
    assert.equal(s.roundHistory.length, 10);
  });
  it("opens round 4 on question 30 with reserved reconstructions", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 3,
      now,
    });
    assert.equal(s.photoQuestions, 30);
    assert.equal(s.totalQuestions, 40);
    assert.equal(s.envIds.length, 10);
    for (let q = 0; q < 30; q++) {
      if (s.phase === "round_intro") s = reduce(s, { type: "INTRO_DONE", now: now + q * 100 });
      s = reduce(s, { type: "PLACE_PIN", playerId: "p1", guess: s.truth!, now: now + q * 100 + 1 });
      s = reduce(s, { type: "LOCK", playerId: "p1", now: now + q * 100 + 2 });
      s = reduce(s, { type: "CONTINUE", now: now + q * 100 + 3 });
    }
    assert.equal(s.questionIndex, 30);
    assert.equal(s.roundIndex, 3);
    assert.equal(s.phase, "round_intro");
    assert.ok(s.envId);
    assert.equal(s.roundHistory.filter((r) => r.isRound4).length, 0);
  });
});
