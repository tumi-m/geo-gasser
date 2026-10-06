import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSwapPlace, createLobbyState, isRound4, reduce, sceneInfoFor, toPublicSnapshot } from "./machine.ts";
import { getLocation, needsStreetView } from "./locations.ts";

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

    const truth = s.truth!;
    s = reduce(s, {
      type: "PLACE_PIN",
      playerId: "p1",
      guess: { latitude: truth.latitude + 0.05, longitude: truth.longitude },
      now: now + 5_000,
    });
    s = reduce(s, { type: "LOCK", playerId: "p1", now: now + 5_000 });
    assert.equal(s.phase, "round_reveal");
    assert.ok(s.revealed);
    assert.ok((s.players[0].roundScore?.roundScore ?? 0) > 0);
  });

  it("scores a hurried bot on the time it planned, never sooner than real time", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 7,
      now,
    });
    s = reduce(s, { type: "INTRO_DONE", now: now + 10 });
    const t0 = s.roundStartedAtMs!;
    const truth = s.truth!;
    s = reduce(s, { type: "PLACE_PIN", playerId: "p1", guess: truth, now: t0 + 2_000 });
    const planned = reduce(s, {
      type: "LOCK",
      playerId: "p1",
      now: t0 + 2_000,
      responseMs: 14_000,
    });
    assert.equal(planned.players[0].responseMs, 14_000);
    // A plan shorter than the real wait cannot buy speed it did not have.
    const late = reduce(s, { type: "LOCK", playerId: "p1", now: t0 + 9_000, responseMs: 1_000 });
    assert.equal(late.players[0].responseMs, 9_000);
    assert.ok(
      (planned.players[0].roundScore?.timePoints ?? 0) <
        (reduce(s, { type: "LOCK", playerId: "p1", now: t0 + 2_000 }).players[0].roundScore
          ?.timePoints ?? 0),
    );
  });

  it("scores an unsubmitted pin as zero on timeout", () => {
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
    s = reduce(s, { type: "TIMEOUT", now: s.roundStartedAtMs! + s.durationSec * 1000 });
    const score = s.players[0].roundScore;
    assert.ok(score);
    assert.equal(score.timePoints, 0);
    assert.equal(score.accuracyPoints, 0);
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
    s = reduce(s, { type: "TIMEOUT", now: s.roundStartedAtMs! + s.durationSec * 1000 });
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
    s = reduce(s, { type: "TIMEOUT", now: now + 45_003 });
    assert.equal(s.phase, "round_expired");
    assert.ok((s.players.find((p) => p.id === "h")?.roundScore?.roundScore ?? 0) > 0);
    assert.equal(s.players.find((p) => p.id === "g")?.roundScore?.roundScore, 0);
  });
});

describe("public snapshot answer hygiene", () => {
  function lobbyDuel() {
    return reduce(createLobbyState(), {
      type: "CREATE_DUEL",
      playerId: "h",
      name: "Host",
      roomCode: "ABC123",
      seed: 1234,
      now,
    });
  }

  function activeDuel() {
    let s = lobbyDuel();
    s = reduce(s, { type: "PLAYER_JOIN", playerId: "g", name: "Guest", now: now + 1 });
    s = reduce(s, { type: "START_MATCH", now: now + 2 });
    s = reduce(s, { type: "INTRO_DONE", now: now + 3 });
    return s;
  }

  it("never ships the deck, seed or environment list, even in the lobby", () => {
    const lobby = toPublicSnapshot(lobbyDuel());
    assert.deepEqual(lobby.locationIds, []);
    assert.deepEqual(lobby.envIds, []);
    assert.equal(lobby.envId, "");
    assert.equal(lobby.seed, undefined);
    assert.equal(lobby.truth, undefined);
    const wire = JSON.stringify(lobby);
    assert.equal(wire.includes('"latitude"'), false);
    assert.equal(wire.includes('"longitude"'), false);
  });

  it("hides guesses and truth before reveal but ships the scene", () => {
    const s = activeDuel();
    const pub = toPublicSnapshot(s);
    assert.equal(pub.seed, undefined);
    assert.deepEqual(pub.locationIds, []);
    assert.deepEqual(pub.envIds, []);
    assert.equal(pub.envId, "");
    assert.equal(pub.truth, undefined);
    assert.deepEqual(pub.roundHistory, []);
    assert.ok(pub.scene?.src.startsWith("/locations/"));
    const wire = JSON.stringify(pub);
    // The deck must not leak: only the plate for the question on screen may
    // appear (its filename carries the id), never the rest of the match.
    assert.equal(wire.includes(s.locationIds[1]), false);
    assert.equal(wire.includes(s.locationIds[s.locationIds.length - 1]), false);
    assert.equal(wire.includes("wikipedia.org"), false);
    assert.equal(wire.includes('"latitude"'), false);
    assert.equal(wire.includes('"longitude"'), false);
  });

  it("does not leak truth or a pin when a player forfeits mid-question", () => {
    let s = activeDuel();
    s = reduce(s, { type: "PLACE_PIN", playerId: "g", guess: s.truth!, now: now + 10 });
    s = reduce(s, { type: "PLAYER_LEAVE", playerId: "g", now: now + 12 });
    assert.equal(s.phase, "match_complete");
    assert.equal(s.revealed, false);
    const pub = toPublicSnapshot(s);
    assert.equal(pub.truth, undefined);
    assert.equal(pub.players.find((p) => p.id === "g")?.guess, undefined);
    const wire = JSON.stringify(pub);
    assert.equal(wire.includes('"latitude"'), false);
    assert.equal(wire.includes('"longitude"'), false);
  });

  it("releases truth and the round record at reveal, never the deck", () => {
    let s = activeDuel();
    s = reduce(s, { type: "PLACE_PIN", playerId: "h", guess: s.truth!, now: now + 10 });
    s = reduce(s, { type: "LOCK", playerId: "h", now: now + 11 });
    s = reduce(s, { type: "TIMEOUT", now: s.roundStartedAtMs! + s.durationSec * 1000 });
    assert.ok(s.revealed);
    const pub = toPublicSnapshot(s);
    assert.equal(pub.seed, undefined);
    assert.deepEqual(pub.locationIds, []);
    assert.ok(pub.truth);
    assert.equal(pub.roundHistory.length, 1);
    assert.ok(pub.players.find((p) => p.id === "h")?.roundScore);
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

  it("drops a disconnected seat on rematch and refuses to start against a ghost", () => {
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
    s = reduce(s, { type: "PLAYER_LEAVE", playerId: "g", now: now + 4 });
    assert.equal(s.phase, "match_complete");
    s = reduce(s, { type: "REMATCH", seed: 77, now: now + 5 });
    assert.deepEqual(
      s.players.map((p) => p.id),
      ["h"],
    );
    const before = s;
    assert.equal(reduce(s, { type: "START_MATCH", now: now + 6 }), before);
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
  it("quick solo is a single round of ten with no reconstructions", () => {
    const s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 4,
      now,
      matchLength: "quick",
    });
    assert.equal(s.totalQuestions, 10);
    assert.equal(s.totalRounds, 1);
    assert.equal(s.photoQuestions, 10);
    assert.equal(s.locationIds.length, 10);
    assert.equal(s.envIds.length, 0);
    assert.equal(s.phase, "round_intro");
  });
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
  it("full game deals 100 unique questions across 10 rounds (with Street View)", () => {
    const s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 19,
      now,
      matchLength: "full",
      streetView: true,
    });
    assert.equal(s.streetView, true);
    assert.equal(s.totalQuestions, 100);
    assert.equal(s.locationIds.length, 100);
    assert.equal(new Set(s.locationIds).size, 100);
    assert.equal(s.totalRounds, 10);
    assert.equal(s.matchLength, "full");
  });
  it("South Africa atlas stays inside ZA", () => {
    const s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 5,
      now,
      atlas: { preset: "za", nations: ["ZA"] },
    });
    assert.equal(s.atlas.preset, "za");
    assert.ok(s.locationIds.length > 0);
    assert.ok(s.locationIds.every((id) => getLocation(id)?.country === "ZA"));
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
  it("opens the final round on question 30 with real places, not reconstructions", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 3,
      now,
    });
    assert.equal(s.photoQuestions, 40);
    assert.equal(s.totalQuestions, 40);
    assert.equal(s.envIds.length, 0);
    for (let q = 0; q < 30; q++) {
      if (s.phase === "round_intro") s = reduce(s, { type: "INTRO_DONE", now: now + q * 100 });
      s = reduce(s, { type: "PLACE_PIN", playerId: "p1", guess: s.truth!, now: now + q * 100 + 1 });
      s = reduce(s, { type: "LOCK", playerId: "p1", now: now + q * 100 + 2 });
      s = reduce(s, { type: "CONTINUE", now: now + q * 100 + 3 });
    }
    assert.equal(s.questionIndex, 30);
    assert.equal(s.roundIndex, 3);
    assert.equal(s.phase, "round_intro");
    const scene = sceneInfoFor(s)!;
    assert.equal(scene.kind, "photo");
    assert.match(scene.src, /^\/locations\/loc_/);
    assert.equal(isRound4(s), false);
  });
  it("describes a Street View-only place without naming it, and rematches keep the option", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 5,
      now,
      matchLength: "full",
      streetView: true,
    });
    const i = s.locationIds.findIndex((id) => id.startsWith("st_"));
    assert.ok(i >= 0);
    s = { ...s, questionIndex: i };
    const scene = sceneInfoFor(s)!;
    assert.equal(scene.kind, "street");
    assert.equal(scene.src, `street:${s.locationIds[i]}`);
    assert.ok(!JSON.stringify(scene).includes(getLocation(s.locationIds[i])!.title));
    s = { ...s, phase: "match_complete" };
    const again = reduce(s, { type: "REMATCH", seed: 6, now: now + 1 });
    assert.equal(again.streetView, true);
    assert.ok(again.locationIds.some((id) => id.startsWith("st_")));
  });
  describe("a Street View place that cannot load", () => {
    const streetMatch = () => {
      const s = reduce(createLobbyState(), {
        type: "CREATE_SOLO",
        playerId: "p1",
        name: "Ada",
        seed: 5,
        now,
        matchLength: "full",
        streetView: true,
      });
      const i = s.locationIds.findIndex((id) => id.startsWith("st_"));
      return { ...s, questionIndex: i, truth: undefined, phase: "round_intro" as const };
    };
    it("is swapped for a photo place from the same country before anyone answers", () => {
      const s = streetMatch();
      const was = getLocation(s.locationIds[s.questionIndex])!;
      assert.ok(canSwapPlace(s));
      const next = reduce(s, { type: "SWAP_PLACE", now: now + 5 });
      const stand = getLocation(next.locationIds[next.questionIndex])!;
      assert.notEqual(stand.id, was.id);
      assert.equal(stand.country, was.country);
      assert.equal(needsStreetView(stand), false);
      assert.equal(new Set(next.locationIds).size, next.locationIds.length, "no repeat");
      assert.deepEqual(next.truth, { latitude: stand.latitude, longitude: stand.longitude });
      assert.equal(next.phase, "round_intro");
      assert.equal(sceneInfoFor(next)!.kind, "photo");
      // Deterministic: the same match swaps to the same place.
      assert.equal(reduce(s, { type: "SWAP_PLACE", now: now + 9 }).locationIds[s.questionIndex], stand.id);
    });
    it("restarts the clock when the round was already running", () => {
      const s = reduce(streetMatch(), { type: "INTRO_DONE", now: now + 10 });
      const next = reduce(s, { type: "SWAP_PLACE", now: now + 4000 });
      assert.equal(next.phase, "round_active");
      assert.equal(next.roundStartedAtMs, now + 4000);
    });
    it("never swaps after a lock, or a place that has a photo", () => {
      let s = reduce(streetMatch(), { type: "INTRO_DONE", now: now + 10 });
      s = reduce(s, { type: "PLACE_PIN", playerId: "p1", guess: { latitude: 0, longitude: 0 }, now: now + 20 });
      s = reduce(s, { type: "LOCK", playerId: "p1", now: now + 30 });
      assert.equal(canSwapPlace(s), false);
      assert.equal(reduce(s, { type: "SWAP_PLACE", now: now + 40 }), s);
      const photo = reduce(createLobbyState(), { type: "CREATE_SOLO", playerId: "p1", name: "Ada", seed: 7, now });
      assert.equal(canSwapPlace(photo), false);
    });
  });
});
