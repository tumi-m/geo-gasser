import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_STATS, isNewBest, migrateStats, previousBest, recordMatch, SCORING_VERSION } from "./stats.ts";

const match = (score: number, length?: string) => ({
  score,
  length,
  won: false,
  distances: [],
  countryHits: { ZA: { n: 0, hits: 0 }, NL: { n: 0, hits: 0 } },
  fastestAccurateMs: null,
});

describe("personal bests", () => {
  it("has nothing to beat before the first match of a length", () => {
    assert.equal(previousBest(EMPTY_STATS, "quick"), null);
    assert.equal(isNewBest(EMPTY_STATS, "quick", 40000), false);
  });

  it("keeps one best per match length", () => {
    let stats = recordMatch(EMPTY_STATS, match(30000, "quick"));
    stats = recordMatch(stats, match(150000, "classic"));
    stats = recordMatch(stats, match(20000, "quick"));
    assert.equal(previousBest(stats, "quick"), 30000);
    assert.equal(previousBest(stats, "classic"), 150000);
    // A Quick is not measured against a Classic's total.
    assert.equal(isNewBest(stats, "quick", 31000), true);
    assert.equal(isNewBest(stats, "classic", 31000), false);
  });

  it("needs a higher score, not an equal one", () => {
    const stats = recordMatch(EMPTY_STATS, match(30000, "quick"));
    assert.equal(isNewBest(stats, "quick", 30000), false);
    assert.equal(isNewBest(stats, "quick", 30001), true);
  });

  it("still keeps the overall best, and old saves without lengths", () => {
    const stats = recordMatch({ ...EMPTY_STATS, personalBest: 90000, bests: undefined }, match(30000));
    assert.equal(stats.personalBest, 90000);
    assert.equal(stats.bests, undefined);
    assert.equal(previousBest(stats, "quick"), null);
  });
});

describe("scoring version", () => {
  it("sets aside points records from the 20,000 scale, keeps the rest", () => {
    const old = { matchesPlayed: 12, matchesWon: 5, personalBest: 310000, bests: { quick: 160000 }, closestKm: 0.4 };
    const stats = migrateStats(old);
    assert.equal(stats.scoring, SCORING_VERSION);
    assert.equal(stats.personalBest, 0);
    assert.equal(stats.bests, undefined);
    assert.equal(previousBest(stats, "quick"), null);
    assert.equal(stats.matchesPlayed, 12);
    assert.equal(stats.matchesWon, 5);
    assert.equal(stats.closestKm, 0.4);
  });
  it("keeps records set under the current scoring, and saves the version", () => {
    const now = migrateStats({ scoring: SCORING_VERSION, personalBest: 40000, bests: { quick: 30000 } });
    assert.equal(now.personalBest, 40000);
    assert.equal(previousBest(now, "quick"), 30000);
    assert.equal(recordMatch(now, match(1000, "quick")).scoring, SCORING_VERSION);
  });
});
