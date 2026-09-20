import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLocation } from "./locations.ts";
import { MATCH_QUOTA, PHOTO_QUESTIONS, planMatch, ROUND4_QUESTIONS, TOTAL_QUESTIONS } from "./selection.ts";

function counts(ids: string[]) {
  const locs = ids.map((id) => getLocation(id)!);
  return {
    ZA: locs.filter((l) => l.country === "ZA").length,
    NL: locs.filter((l) => l.country === "NL").length,
    WORLD: locs.filter((l) => l.country === "WORLD").length,
  };
}

describe("planMatch", () => {
  it("is deterministic and deals 40 unique questions by default", () => {
    const a = planMatch(99);
    const b = planMatch(99);
    assert.deepEqual(a, b);
    assert.equal(a.locationIds.length, TOTAL_QUESTIONS);
    assert.equal(new Set(a.locationIds).size, TOTAL_QUESTIONS);
    assert.equal(a.envIds.length, ROUND4_QUESTIONS);
    assert.equal(a.photoQuestions, PHOTO_QUESTIONS);
  });
  it("deals a shuffled 13/13/14 mix on standard with no 3D tail", () => {
    const plan = planMatch(7);
    assert.deepEqual(counts(plan.locationIds), MATCH_QUOTA.standard);
    assert.ok(plan.locationIds.every((id) => getLocation(id)));
    assert.equal(plan.envIds.length, 0);
  });
  it("extended match uses 70 unique sites at 23/23/24", () => {
    const plan = planMatch(11, "extended");
    assert.equal(plan.locationIds.length, 70);
    assert.equal(new Set(plan.locationIds).size, 70);
    assert.deepEqual(counts(plan.locationIds), MATCH_QUOTA.extended);
  });
  it("full game uses 100 unique sites at 33/33/34", () => {
    const plan = planMatch(3, "full");
    assert.equal(plan.locationIds.length, 100);
    assert.equal(new Set(plan.locationIds).size, 100);
    assert.equal(plan.totalRounds, 10);
    assert.deepEqual(counts(plan.locationIds), MATCH_QUOTA.full);
  });
  it("varies across seeds so the 149-site pool is hard to memorise", () => {
    const plans = Array.from({ length: 12 }, (_, i) => planMatch(i + 1).locationIds.join(","));
    assert.ok(new Set(plans).size > 3);
    const first = planMatch(1).locationIds[0];
    const others = Array.from({ length: 8 }, (_, i) => planMatch(i + 2).locationIds[0]);
    assert.ok(others.some((id) => id !== first));
  });
});
