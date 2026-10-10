import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_STATS, isNewBest, previousBest, recordMatch } from "./stats.ts";

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
    const stats = recordMatch({ ...EMPTY_STATS, personalBest: 90000 }, match(30000));
    assert.equal(stats.personalBest, 90000);
    assert.equal(stats.bests, undefined);
    assert.equal(previousBest(stats, "quick"), null);
  });
});
