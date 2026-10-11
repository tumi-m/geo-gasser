import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLobbyState, reduce } from "./machine.ts";
import { remainingSeconds } from "./timer.ts";
import type { MatchState } from "./types.ts";

const now = 5_000_000;

function soloRound(): MatchState {
  const s = reduce(createLobbyState(), { type: "CREATE_SOLO", playerId: "p1", name: "Ada", seed: 3, now });
  return reduce(s, { type: "INTRO_DONE", now: now + 1 });
}

describe("pause", () => {
  it("stops a solo round's clock and gives the time back on resume", () => {
    let s = soloRound();
    const started = s.roundStartedAtMs!;
    const t = started + 10_000;
    s = reduce(s, { type: "PAUSE", now: t });
    assert.equal(s.pausedAtMs, t);
    s = reduce(s, { type: "RESUME", now: t + 120_000 });
    assert.equal(s.pausedAtMs, undefined);
    assert.equal(s.roundStartedAtMs, started + 120_000);
    // Ten seconds have counted, not two minutes and ten.
    assert.equal(
      Math.round(remainingSeconds(s.roundStartedAtMs!, t + 120_000, s.durationSec)),
      s.durationSec - 10,
    );
  });

  it("ignores pins, locks and the timeout while paused", () => {
    let s = soloRound();
    const t = s.roundStartedAtMs! + 5_000;
    s = reduce(s, { type: "PAUSE", now: t });
    const paused = s;
    s = reduce(s, { type: "PLACE_PIN", playerId: "p1", guess: { latitude: 1, longitude: 1 }, now: t + 1 });
    assert.equal(s, paused);
    s = reduce(s, { type: "LOCK", playerId: "p1", now: t + 2 });
    assert.equal(s, paused);
    s = reduce(s, { type: "TIMEOUT", now: t + s.durationSec * 1000 * 3 });
    assert.equal(s, paused);
    assert.equal(s.phase, "round_active");
  });

  it("scores the response time without the pause", () => {
    let s = soloRound();
    const started = s.roundStartedAtMs!;
    s = reduce(s, { type: "PAUSE", now: started + 4_000 });
    s = reduce(s, { type: "RESUME", now: started + 64_000 });
    s = reduce(s, { type: "PLACE_PIN", playerId: "p1", guess: s.truth!, now: started + 66_000 });
    s = reduce(s, { type: "LOCK", playerId: "p1", now: started + 66_000 });
    const me = s.players.find((p) => p.id === "p1")!;
    assert.equal(me.responseMs, 6_000);
  });

  it("never pauses a duel, the intro or a spent clock", () => {
    const duel = reduce(createLobbyState(), {
      type: "CREATE_LOCAL_DUEL",
      seed: 2,
      now,
      seats: [
        { id: "p1", name: "Ada" },
        { id: "bot", name: "Grok", kind: "bot" },
      ],
    });
    assert.equal(reduce(duel, { type: "PAUSE", now: now + 1 }).pausedAtMs, undefined);
    const intro = reduce(createLobbyState(), { type: "CREATE_SOLO", playerId: "p1", name: "Ada", seed: 3, now });
    assert.equal(reduce(intro, { type: "PAUSE", now: now + 1 }).pausedAtMs, undefined);
    const s = soloRound();
    const spent = s.roundStartedAtMs! + s.durationSec * 1000 + 1;
    assert.equal(reduce(s, { type: "PAUSE", now: spent }).pausedAtMs, undefined);
  });

  it("clears the pause when the next place begins", () => {
    let s = soloRound();
    s = { ...s, pausedAtMs: s.roundStartedAtMs! + 1 };
    s = reduce(s, { type: "RESUME", now: s.pausedAtMs! + 10 });
    s = reduce(s, { type: "PLACE_PIN", playerId: "p1", guess: s.truth!, now: s.roundStartedAtMs! + 2_000 });
    s = reduce(s, { type: "LOCK", playerId: "p1", now: s.roundStartedAtMs! + 2_000 });
    s = reduce(s, { type: "REVEAL_DONE", now: s.roundStartedAtMs! + 9_000 });
    s = reduce(s, { type: "CONTINUE", now: s.roundStartedAtMs! + 10_000 });
    assert.equal(s.pausedAtMs, undefined);
  });
});
