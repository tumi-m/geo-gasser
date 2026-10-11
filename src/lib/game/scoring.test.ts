import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  feedbackFor,
  feedbackHeadline,
  accuracyPoints,
  geoScore,
  MAP_SIZE_KM,
  NO_GUESS_KM,
  PERFECT_KM,
  rankPlayers,
  ROUND_MAX,
  scoreGuess,
  WORLD_MAP_KM,
} from "./scoring.ts";

describe("geoScore (GeoGuessr's curve)", () => {
  it("pays 5,000 within 25 m", () => {
    assert.equal(ROUND_MAX, 5_000);
    assert.equal(geoScore(0, MAP_SIZE_KM.NL), 5_000);
    assert.equal(geoScore(PERFECT_KM, MAP_SIZE_KM.NL), 5_000);
    // Just outside, a small map already shows the miss.
    assert.ok(geoScore(0.2, MAP_SIZE_KM.NL) < 5_000);
  });
  it("is 5000 × e^(−10 × d / size)", () => {
    assert.equal(geoScore(1000, WORLD_MAP_KM), Math.round(5000 * Math.exp((-10 * 1000) / 14_916.862)));
    // A tenth of the map's size keeps 1/e of the points.
    assert.equal(geoScore(MAP_SIZE_KM.ZA / 10, MAP_SIZE_KM.ZA), Math.round(5000 / Math.E));
    assert.equal(geoScore(Number.POSITIVE_INFINITY, WORLD_MAP_KM), 0);
  });
  it("sizes each map by its bounding-box diagonal, and the world as GeoGuessr does", () => {
    assert.equal(MAP_SIZE_KM.WORLD, 14_916.862);
    assert.ok(Math.abs(MAP_SIZE_KM.ZA - 2_135) < 2, String(MAP_SIZE_KM.ZA));
    assert.ok(Math.abs(MAP_SIZE_KM.NL - 411) < 2, String(MAP_SIZE_KM.NL));
  });
  it("is kinder in a big country at the same distance", () => {
    assert.ok(accuracyPoints(30, "ZA") > accuracyPoints(30, "NL"));
    assert.ok(accuracyPoints(300, "WORLD") > accuracyPoints(300, "ZA"));
  });
});

describe("scoreGuess", () => {
  const truth = { latitude: 52.3731, longitude: 4.8928 };
  const at = (remainingSec: number, guess = truth) =>
    scoreGuess({ truth, guess, country: "NL", remainingSec, responseMs: (45 - remainingSec) * 1000, durationSec: 45 });
  it("pays a perfect guess 5,000 in the first tier, stepping down to 3,000", () => {
    const first = at(44);
    assert.equal(first.accuracyPoints, 5_000);
    assert.equal(first.clockFactor, 1);
    assert.equal(first.timePoints, 0);
    assert.equal(first.roundScore, 5_000);
    assert.ok(first.badges.includes("bullseye"));
    assert.deepEqual([at(30), at(20), at(12), at(3), at(0)].map((s) => s.roundScore), [4_500, 4_000, 3_500, 3_000, 3_000]);
  });
  it("scales every guess by the clock, not just close ones", () => {
    const near = { latitude: 52.1, longitude: 4.5 };
    const early = at(40, near);
    const late = at(15, near);
    assert.equal(early.accuracyPoints, late.accuracyPoints);
    assert.equal(late.clockFactor, 0.7);
    assert.equal(late.roundScore, Math.round(early.accuracyPoints * 0.7));
    assert.equal(late.timePoints, late.accuracyPoints - late.roundScore);
  });
  it("never pays more than 5,000, and a wild guess nothing", () => {
    const wild = at(44, { latitude: -33.92, longitude: 18.42 });
    assert.equal(wild.roundScore, 0);
    assert.equal(wild.multiplier, 1);
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
  it("treats WORLD country-correct as the site nation, not ZA/NL", () => {
    const fuji = { latitude: 35.3606, longitude: 138.7274 };
    const tokyo = scoreGuess({
      truth: fuji,
      guess: { latitude: 35.68, longitude: 139.77 },
      country: "WORLD",
      nation: "JP",
      remainingSec: 30,
      responseMs: 8000,
    });
    assert.equal(tokyo.countryCorrect, true);
    const cape = scoreGuess({
      truth: fuji,
      guess: { latitude: -33.92, longitude: 18.42 },
      country: "WORLD",
      nation: "JP",
      remainingSec: 30,
      responseMs: 8000,
    });
    assert.equal(cape.countryCorrect, false);
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

describe("reveal headlines", () => {
  it("praise a closer guess more", () => {
    const words = [0.05, 0.5, 2, 12, 60].map((km) => feedbackHeadline({ feedback: feedbackFor(km, true) }));
    assert.deepEqual(words, ["PERFECT READ", "INCREDIBLE", "SPOT ON", "SO CLOSE", "NICE INSTINCTS"]);
    assert.equal(feedbackHeadline({ feedback: feedbackFor(300, true) }), "RIGHT COUNTRY");
    assert.equal(feedbackHeadline({ feedback: feedbackFor(300, false) }), "TOUGH ONE");
  });
});
