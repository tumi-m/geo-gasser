import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nationOf } from "./atlas.ts";
import { getLocation, playableLocations } from "./locations.ts";
import { createLobbyState, matchOver, reduce, streakCount, toPublicSnapshot } from "./machine.ts";
import { damageMultiplier, duelDamage, placeByPlace, START_HEALTH } from "./rules.ts";
import { planHealthDuel, planStreak } from "./selection.ts";
import { pinInNation } from "../map/country-at.ts";
import type { LatLng, MatchState } from "./types.ts";

const now = 2_000_000;

function healthDuel(seed = 5): MatchState {
  return reduce(createLobbyState(), {
    type: "CREATE_LOCAL_DUEL",
    seed,
    now,
    duelRule: "health",
    seats: [
      { id: "p1", name: "Ada" },
      { id: "p2", name: "Bea", kind: "bot" },
    ],
  });
}

/** Both players answer the current place: p1 on the spot, p2 `offsetDeg` away. */
function playPlace(s: MatchState, t: number, offsetDeg: number): MatchState {
  s = reduce(s, { type: "INTRO_DONE", now: t });
  const truth = s.truth!;
  s = reduce(s, { type: "PLACE_PIN", playerId: "p1", guess: truth, now: t + 1_000 });
  s = reduce(s, { type: "LOCK", playerId: "p1", now: t + 1_000 });
  const far: LatLng = { latitude: Math.max(-80, truth.latitude - offsetDeg), longitude: truth.longitude };
  s = reduce(s, { type: "PLACE_PIN", playerId: "p2", guess: far, now: t + 1_000 });
  return reduce(s, { type: "LOCK", playerId: "p2", now: t + 1_000 });
}

describe("health duels", () => {
  it("hits ×1 for four places, then half a point more each place", () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(damageMultiplier), [1, 1, 1, 1, 1.5, 2, 2.5]);
  });

  it("takes the gap from the lower score, and nothing on a draw", () => {
    const score = (n: number) => ({ roundScore: n }) as never;
    assert.deepEqual(duelDamage([{ id: "a", roundScore: score(4000) }, { id: "b", roundScore: score(1000) }], 1), {
      playerId: "b",
      amount: 3000,
      multiplier: 1,
    });
    assert.deepEqual(duelDamage([{ id: "a", roundScore: score(1000) }, { id: "b", roundScore: score(2000) }], 6), {
      playerId: "a",
      amount: 2000,
      multiplier: 2,
    });
    assert.equal(duelDamage([{ id: "a", roundScore: score(3000) }, { id: "b", roundScore: score(3000) }], 3), null);
  });

  it("starts both at full health, place by place", () => {
    const s = healthDuel();
    assert.equal(s.duelRule, "health");
    assert.deepEqual(
      s.players.map((p) => p.health),
      [START_HEALTH, START_HEALTH],
    );
    assert.ok(placeByPlace(s));
    assert.ok(s.totalQuestions > 5 && s.totalQuestions <= 20);
    assert.equal(s.phase, "round_intro");
  });

  it("damages the loser after each place and ends at zero health", () => {
    let s = healthDuel(11);
    let t = now;
    for (let place = 0; place < 20 && s.phase !== "final_reveal"; place++) {
      s = playPlace(s, (t += 60_000), 20);
      assert.equal(s.phase, "round_reveal");
      const record = s.roundHistory.at(-1)!;
      assert.equal(record.damage?.playerId, "p2", "the far guess takes the damage");
      s = reduce(s, { type: "CONTINUE", now: t + 30_000 });
    }
    assert.equal(s.phase, "final_reveal");
    assert.equal(s.players.find((p) => p.id === "p2")!.health, 0);
    assert.ok(s.players.find((p) => p.id === "p1")!.health! > 0);
    assert.deepEqual(s.winnerIds, ["p1"]);
    assert.ok(s.roundHistory.length < s.totalQuestions, "ends before the deck runs out");
  });

  it("keeps the rule and full health through a rematch, and shows it in snapshots", () => {
    let s = healthDuel();
    s = playPlace(s, now + 10_000, 15);
    assert.equal(toPublicSnapshot(s).duelRule, "health");
    assert.ok(toPublicSnapshot(s).players.some((p) => p.health! < START_HEALTH));
    // Finish quickly: drop p2 to zero by hand, then end.
    s = { ...s, players: s.players.map((p) => (p.id === "p2" ? { ...p, health: 0 } : p)) };
    assert.ok(matchOver(s));
    s = reduce(s, { type: "CONTINUE", now: now + 50_000 });
    assert.equal(s.phase, "final_reveal");
    s = reduce(s, { type: "REMATCH", seed: 77, now: now + 60_000 });
    assert.equal(s.duelRule, "health");
    assert.deepEqual(
      s.players.map((p) => p.health),
      [START_HEALTH, START_HEALTH],
    );
  });

  it("a points duel carries no health and no damage", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_LOCAL_DUEL",
      seed: 3,
      now,
      seats: [
        { id: "p1", name: "Ada" },
        { id: "p2", name: "Bea", kind: "bot" },
      ],
    });
    assert.equal(s.duelRule, undefined);
    assert.equal(s.players[0].health, undefined);
    s = playPlace(s, now + 10_000, 10);
    assert.equal(s.roundHistory.at(-1)!.damage, undefined);
  });

  it("a health deck on SA × NL deals the two countries evenly", () => {
    const plan = planHealthDuel(9, "escape");
    const countries = plan.locationIds.map((id) => getLocation(id)!.country);
    assert.equal(plan.locationIds.length, 20);
    assert.equal(countries.filter((c) => c === "ZA").length, 10);
    assert.equal(countries.filter((c) => c === "NL").length, 10);
    assert.equal(new Set(plan.locationIds).size, plan.locationIds.length);
  });
});

describe("country streak", () => {
  it("deals every place once, a country at a time", () => {
    const plan = planStreak(21, "escape");
    const places = playableLocations(false).filter((l) => l.country !== "SPACE");
    assert.equal(plan.locationIds.length, places.length);
    assert.equal(new Set(plan.locationIds).size, plan.locationIds.length);
    const nations = plan.locationIds.map((id) => nationOf(getLocation(id)!));
    const all = new Set(nations).size;
    // The first lap visits every country once.
    assert.equal(new Set(nations.slice(0, all)).size, all);
    // Two in a row only once the smaller countries have run out.
    const firstRepeat = nations.findIndex((n, i) => i > 0 && n === nations[i - 1]);
    assert.ok(firstRepeat === -1 || firstRepeat >= all * 2 - 1, `repeat at ${firstRepeat}`);
    assert.deepEqual(planStreak(21, "escape").locationIds, plan.locationIds, "same seed, same run");
  });

  it("counts right countries and ends on the first wrong one", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 8,
      now,
      streak: true,
    });
    assert.equal(s.streak, true);
    assert.ok(placeByPlace(s));
    let t = now;
    for (let i = 0; i < 3; i++) {
      s = reduce(s, { type: "INTRO_DONE", now: (t += 60_000) });
      s = reduce(s, { type: "PLACE_PIN", playerId: "p1", guess: s.truth!, now: t + 500 });
      s = reduce(s, { type: "LOCK", playerId: "p1", now: t + 500 });
      assert.equal(s.roundHistory.at(-1)!.streak?.correct, true);
      assert.ok(!matchOver(s));
      s = reduce(s, { type: "CONTINUE", now: t + 5_000 });
    }
    assert.equal(streakCount(s), 3);
    // A pin on the far side of the planet.
    s = reduce(s, { type: "INTRO_DONE", now: (t += 60_000) });
    const truth = s.truth!;
    const wrong = { latitude: -truth.latitude, longitude: truth.longitude > 0 ? truth.longitude - 180 : truth.longitude + 180 };
    s = reduce(s, { type: "PLACE_PIN", playerId: "p1", guess: wrong, now: t + 500 });
    s = reduce(s, { type: "LOCK", playerId: "p1", now: t + 500 });
    assert.equal(s.roundHistory.at(-1)!.streak?.correct, false);
    assert.ok(matchOver(s));
    s = reduce(s, { type: "CONTINUE", now: t + 5_000 });
    assert.equal(s.phase, "final_reveal");
    assert.equal(streakCount(s), 3);
  });

  it("the clock running out breaks the streak", () => {
    let s = reduce(createLobbyState(), { type: "CREATE_SOLO", playerId: "p1", name: "Ada", seed: 4, now, streak: true });
    s = reduce(s, { type: "INTRO_DONE", now: now + 1 });
    s = reduce(s, { type: "TIMEOUT", now: now + 1 + s.durationSec * 1000 + 10 });
    assert.equal(s.roundHistory.at(-1)!.streak?.correct, false);
    assert.ok(matchOver(s));
  });

  it("judges pins by the country shapes, kindly at coasts and borders", () => {
    assert.ok(pinInNation({ latitude: 52.37, longitude: 4.89 }, "NL"), "Amsterdam");
    assert.ok(!pinInNation({ latitude: 50.85, longitude: 4.35 }, "NL"), "Brussels is not the Netherlands");
    assert.ok(pinInNation({ latitude: 50.85, longitude: 4.35 }, "BE"));
    assert.ok(pinInNation({ latitude: -34.1, longitude: 18.3 }, "ZA"), "just off the Cape");
    assert.ok(!pinInNation({ latitude: -29.3, longitude: 28.4 }, "ZA"), "Lesotho is not South Africa");
    assert.ok(pinInNation({ latitude: 22.3, longitude: 114.17 }, "HK"), "Hong Kong by its box");
    const falls = { latitude: -17.92, longitude: 25.86 };
    assert.ok(pinInNation(falls, "ZM", falls), "a pin on the answer is always right");
    for (const l of playableLocations(true)) {
      if (l.country === "SPACE") continue;
      assert.ok(pinInNation(l, nationOf(l), l), `${l.id} counts as ${nationOf(l)}`);
    }
  });
});

describe("movement rules", () => {
  it("travel with the match and through a rematch", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p1",
      name: "Ada",
      seed: 2,
      now,
      movement: "nmpz",
    });
    assert.equal(s.movement, "nmpz");
    assert.equal(toPublicSnapshot(s).movement, "nmpz");
    s = { ...s, phase: "match_complete" };
    s = reduce(s, { type: "REMATCH", seed: 3, now: now + 1 });
    assert.equal(s.movement, "nmpz");
  });

  it("moving is the default and is not stored", () => {
    const s = reduce(createLobbyState(), { type: "CREATE_SOLO", playerId: "p1", name: "Ada", seed: 2, now, movement: "moving" });
    assert.equal(s.movement, undefined);
  });
});
