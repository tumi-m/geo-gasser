import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { grokGuess } from "./bot.ts";
import {
  COSMOS_LOCATIONS,
  COSMOS_MAX,
  COSMOS_MIN,
  COSMOS_TARGETS,
  cosmosZone,
  formatCosmicDistance,
  formatMiss,
  LY_AU,
} from "./cosmos.ts";
import { enabledLocations, getLocation } from "./locations.ts";
import { createLobbyState, reduce, sceneInfoFor, toPublicSnapshot } from "./machine.ts";
import { scoreGuess } from "./scoring.ts";
import { planMatch, QUESTIONS_PER_ROUND, roundOf } from "./selection.ts";
import type { MatchLengthId } from "./timer.ts";

const cosmicIds = (ids: string[]) => ids.filter((id) => getLocation(id)?.country === "SPACE");

describe("cosmos targets", () => {
  it("has thirty unique targets inside the ruler", () => {
    assert.equal(COSMOS_TARGETS.length, 30);
    assert.equal(new Set(COSMOS_TARGETS.map((t) => t.id)).size, 30);
    assert.equal(new Set(COSMOS_TARGETS.map((t) => t.title)).size, 30);
    for (const t of COSMOS_TARGETS) {
      const log = Math.log10(t.au);
      assert.ok(log > COSMOS_MIN && log < COSMOS_MAX, t.title);
    }
  });
  it("never deals into the photo pool and never names itself in its clue", () => {
    const pool = new Set(enabledLocations().map((l) => l.id));
    for (const l of COSMOS_LOCATIONS) {
      assert.ok(!pool.has(l.id));
      assert.equal(getLocation(l.id)?.country, "SPACE");
    }
    for (const t of COSMOS_TARGETS) {
      const name = t.title.replace(/^The /, "").replace(/'s.*$/, "").split(" ")[0].toLowerCase();
      assert.ok(!t.clue.toLowerCase().includes(name), `${t.title} clue names it`);
    }
  });
  it("formats cosmic distances", () => {
    assert.equal(formatCosmicDistance(5.2), "5.2 AU");
    assert.equal(formatCosmicDistance(39.5), "40 AU");
    assert.equal(formatCosmicDistance(4.246 * LY_AU), "4.2 light-years");
    assert.equal(formatCosmicDistance(2_537_000 * LY_AU), "2.5 million light-years");
    assert.equal(formatMiss({ distanceKm: 12.3 }), "12 km");
  });
  it("names the zones in order", () => {
    assert.equal(cosmosZone(0), "Inner Solar System");
    assert.equal(cosmosZone(Math.log10(9.58)), "Giant planets");
    assert.equal(cosmosZone(Math.log10(4.2 * LY_AU)), "Stellar neighbourhood");
    assert.equal(cosmosZone(11), "Other galaxies");
  });
});

describe("cosmic scoring", () => {
  const saturn = { latitude: Math.log10(9.58), longitude: 0 };
  const score = (guessAu: number) =>
    scoreGuess({
      truth: saturn,
      guess: { latitude: Math.log10(guessAu), longitude: 0 },
      country: "SPACE",
      remainingSec: 0,
      responseMs: 1000,
    });
  it("pays in proportion to the miss in decades", () => {
    assert.equal(score(9.58).accuracyPoints, 10_000);
    assert.equal(score(9.58).feedback, "perfect");
    const jupiter = score(5.2);
    assert.ok(jupiter.accuracyPoints > 3_500 && jupiter.accuracyPoints < 4_500, String(jupiter.accuracyPoints));
    assert.ok(score(950).accuracyPoints < 20);
    assert.ok(score(9).accuracyPoints > score(5.2).accuracyPoints);
  });
  it("reports the real gap and the zone", () => {
    const s = score(5.2);
    assert.equal(formatMiss(s), "4.4 AU");
    assert.ok(s.countryCorrect);
    assert.ok(s.badges.includes("right_zone"));
    assert.ok(!score(1).countryCorrect);
  });
});

describe("cosmos rounds in the deck", () => {
  const lengths: MatchLengthId[] = ["escape", "quick", "standard", "extended", "full"];
  it("only the long matches visit the cosmos", () => {
    for (const len of lengths) {
      const plan = planMatch(42, len);
      const want = len === "extended" ? 10 : len === "full" ? 20 : 0;
      assert.equal(cosmicIds(plan.locationIds).length, want, len);
      assert.equal(new Set(plan.locationIds).size, plan.locationIds.length);
    }
  });
  it("keeps match lengths and gives the cosmos whole rounds", () => {
    const ext = planMatch(5, "extended");
    assert.equal(ext.totalQuestions, 70);
    assert.equal(ext.totalRounds, 7);
    const extRounds = new Set(
      ext.locationIds.flatMap((id, i) => (getLocation(id)?.country === "SPACE" ? [roundOf(i)] : [])),
    );
    assert.deepEqual([...extRounds], [5]);
    const full = planMatch(5, "full");
    assert.equal(full.totalQuestions, 100);
    const fullRounds = new Set(
      full.locationIds.flatMap((id, i) => (getLocation(id)?.country === "SPACE" ? [roundOf(i)] : [])),
    );
    assert.deepEqual([...fullRounds], [3, 8]);
    // Reconstructions still close the match.
    assert.equal(full.photoQuestions, 90);
    assert.ok(full.locationIds.slice(90).every((id) => getLocation(id)?.country !== "SPACE"));
    assert.equal(QUESTIONS_PER_ROUND, 10);
  });
  it("deals unseen targets first", () => {
    const first = cosmicIds(planMatch(9, "extended").locationIds);
    const second = cosmicIds(planMatch(10, "extended", undefined, first).locationIds);
    assert.equal(second.filter((id) => first.includes(id)).length, 0);
  });
});

describe("a cosmos question in play", () => {
  it("scores through the machine, hides the answer and keeps map stats clean", () => {
    let s = reduce(createLobbyState(), {
      type: "CREATE_SOLO",
      playerId: "p",
      name: "P",
      seed: 5,
      now: 0,
      matchLength: "extended",
    });
    const index = s.locationIds.findIndex((id) => id.startsWith("cos_"));
    s = { ...s, questionIndex: index, phase: "round_active", roundStartedAtMs: 1000 };
    const loc = getLocation(s.locationIds[index])!;
    s = { ...s, truth: { latitude: loc.latitude, longitude: 0 } };
    const scene = sceneInfoFor(s)!;
    assert.equal(scene.kind, "cosmos");
    assert.ok(scene.cosmos && scene.clue);
    assert.ok(!JSON.stringify(scene).includes(loc.title));
    const pub = toPublicSnapshot(s);
    assert.equal(pub.truth, undefined);
    s = reduce(s, { type: "PLACE_PIN", playerId: "p", guess: { latitude: loc.latitude + 0.1, longitude: 0 }, now: 2000 });
    s = reduce(s, { type: "LOCK", playerId: "p", now: 3000 });
    const rec = s.roundHistory.at(-1)!;
    assert.equal(rec.cosmos, true);
    const sc = rec.guesses.p.score;
    assert.ok(sc.decades != null && Math.abs(sc.decades - 0.1) < 1e-9);
    assert.ok(s.players[0].totalDistanceKm < 1000);
  });
  it("Grok guesses on the ruler", () => {
    for (const loc of COSMOS_LOCATIONS) {
      const g = grokGuess(loc, 7, 3);
      assert.equal(g.longitude, 0);
      assert.ok(g.latitude >= COSMOS_MIN && g.latitude <= COSMOS_MAX);
    }
  });
});
