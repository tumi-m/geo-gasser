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
