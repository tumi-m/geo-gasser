import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLocation, ROUND4_LOCATIONS } from "./locations.ts";
import {
  MATCH_QUOTA,
  PHOTO_QUESTIONS,
  planMatch,
  ROUND4_QUESTIONS,
  TOTAL_QUESTIONS,
} from "./selection.ts";

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
  it("standard match is 15 ZA + 15 NL stills then 10 reconstructions", () => {
    const plan = planMatch(7);
    const photos = plan.locationIds.slice(0, PHOTO_QUESTIONS);
    const tail = plan.locationIds.slice(PHOTO_QUESTIONS);
    assert.deepEqual(counts(photos), MATCH_QUOTA.standard);
    assert.equal(tail.length, ROUND4_QUESTIONS);
    const reserved = new Set(ROUND4_LOCATIONS.map((l) => l.id));
    assert.ok(tail.every((id) => reserved.has(id)));
    assert.ok(photos.every((id) => !reserved.has(id)));
    assert.equal(plan.envIds.length, 10);
    assert.ok(plan.locationIds.every((id) => getLocation(id)));
  });
  it("extended match uses 60 unique stills plus the 10 reconstructions", () => {
    const plan = planMatch(11, "extended");
    assert.equal(plan.locationIds.length, 70);
    assert.equal(new Set(plan.locationIds).size, 70);
    assert.deepEqual(counts(plan.locationIds.slice(0, 60)), MATCH_QUOTA.extended);
    assert.equal(plan.envIds.length, 10);
  });
  it("full game uses 90 unique stills plus the 10 reconstructions", () => {
    const plan = planMatch(3, "full");
    assert.equal(plan.locationIds.length, 100);
    assert.equal(new Set(plan.locationIds).size, 100);
    assert.equal(plan.totalRounds, 10);
    assert.deepEqual(counts(plan.locationIds.slice(0, 90)), MATCH_QUOTA.full);
  });
  it("varies across seeds so the photo pool is hard to memorise", () => {
    const plans = Array.from({ length: 12 }, (_, i) => planMatch(i + 1).locationIds.slice(0, 30).join(","));
    assert.ok(new Set(plans).size > 3);
    const first = planMatch(1).locationIds[0];
    const others = Array.from({ length: 8 }, (_, i) => planMatch(i + 2).locationIds[0]);
    assert.ok(others.some((id) => id !== first));
  });
});
