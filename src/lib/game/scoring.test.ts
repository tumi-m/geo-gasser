import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accuracyPoints, COUNTRY_SCALE_KM, NO_GUESS_KM, rankPlayers, scoreGuess } from "./scoring.ts";

describe("accuracyPoints", () => {
  it("is 10000 on a perfect pin", () => {
    assert.equal(accuracyPoints(0, "ZA"), 10_000);
    assert.equal(accuracyPoints(0, "NL"), 10_000);
  });
  it("decays to ~3679 at one country scale", () => {
    assert.equal(accuracyPoints(COUNTRY_SCALE_KM.NL, "NL"), Math.round(10000 * Math.exp(-1)));
    assert.equal(accuracyPoints(COUNTRY_SCALE_KM.ZA, "ZA"), Math.round(10000 * Math.exp(-1)));
  });
  it("does not systematically reward Dutch distances on the ZA curve", () => {
    const nlAt30 = accuracyPoints(30, "NL");
    const zaAt30 = accuracyPoints(30, "ZA");
    assert.ok(zaAt30 > nlAt30, "ZA scale must be more generous at the same km");
  });
});

describe("scoreGuess", () => {
  const truth = { latitude: 52.3731, longitude: 4.8928 };
  it("combines accuracy and time, and applies the round 4 multiplier", () => {
    const base = scoreGuess({
      truth,
      guess: truth,
      country: "NL",
      remainingSec: 45,
      responseMs: 200,
    });
    assert.equal(base.accuracyPoints, 10_000);
    assert.equal(base.timePoints, 10_000);
    assert.equal(base.roundScore, 20_000);
    assert.ok(base.badges.includes("bullseye"));
    const r4 = scoreGuess({
      truth,
      guess: truth,
      country: "NL",
      remainingSec: 45,
      responseMs: 200,
      isRound4: true,
    });
    assert.equal(r4.roundScore, 25_000);
    assert.equal(r4.multiplier, 1.25);
  });
  it("scores an unsubmitted guess as zero", () => {
    const s = scoreGuess({
      truth,
      guess: null,
      country: "ZA",
      remainingSec: 20,
      responseMs: 45_000,
    });
    assert.equal(s.roundScore, 0);
    assert.equal(s.timePoints, 0);
    assert.equal(s.accuracyPoints, 0);
  });
});

describe("rankPlayers", () => {
  it("prefers higher score, then lower distance, then faster response", () => {
    const { winnerIds } = rankPlayers([
      { id: "a", totalScore: 10, totalDistanceKm: 3, totalResponseMs: 1000 },
      { id: "b", totalScore: 20, totalDistanceKm: 9, totalResponseMs: 4000 },
    ]);
    assert.deepEqual(winnerIds, ["b"]);
    const dist = rankPlayers([
      { id: "a", totalScore: 10, totalDistanceKm: 3, totalResponseMs: 1000 },
      { id: "b", totalScore: 10, totalDistanceKm: 1, totalResponseMs: 4000 },
    ]);
    assert.deepEqual(dist.winnerIds, ["b"]);
    const time = rankPlayers([
      { id: "a", totalScore: 10, totalDistanceKm: 1, totalResponseMs: 1000 },
      { id: "b", totalScore: 10, totalDistanceKm: 1, totalResponseMs: 4000 },
    ]);
    assert.deepEqual(time.winnerIds, ["a"]);
  });
  it("declares a shared victory when fully tied", () => {
    const { winnerIds } = rankPlayers([
      { id: "a", totalScore: 10, totalDistanceKm: 1, totalResponseMs: 1000 },
      { id: "b", totalScore: 10, totalDistanceKm: 1, totalResponseMs: 1000 },
    ]);
    assert.deepEqual(winnerIds.sort(), ["a", "b"]);
  });
  it("ranks a missed pin behind any finite guess at equal score", () => {
    const { winnerIds } = rankPlayers([
      { id: "miss", totalScore: 0, totalDistanceKm: NO_GUESS_KM, totalResponseMs: 45_000 },
      { id: "far", totalScore: 0, totalDistanceKm: 1_200, totalResponseMs: 45_000 },
    ]);
    assert.deepEqual(winnerIds, ["far"]);
  });
});
