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
  it("extended match stays on SA and NL plus reconstructions", () => {
    const plan = planMatch(11, "extended");
    assert.equal(plan.locationIds.length, 70);
    assert.equal(new Set(plan.locationIds).size, 70);
    assert.equal(counts(plan.locationIds.slice(0, 60)).WORLD, 0);
    assert.equal(plan.envIds.length, 10);
  });
  it("full game stays on SA and NL plus reconstructions", () => {
    const plan = planMatch(3, "full");
    assert.equal(plan.locationIds.length, 100);
    assert.equal(new Set(plan.locationIds).size, 100);
    assert.equal(plan.totalRounds, 10);
    assert.equal(counts(plan.locationIds.slice(0, 90)).WORLD, 0);
  });
  it("mix atlas pulls world sites into the photo rounds", () => {
    const plan = planMatch(8, "standard", { preset: "mix", nations: [] });
    assert.equal(plan.atlas.preset, "mix");
    assert.ok(counts(plan.locationIds.slice(0, plan.photoQuestions)).WORLD > 0);
  });
  it("varies across seeds so the photo pool is hard to memorise", () => {
    const plans = Array.from({ length: 12 }, (_, i) => planMatch(i + 1).locationIds.slice(0, 30).join(","));
    assert.ok(new Set(plans).size > 3);
    const first = planMatch(1).locationIds[0];
    const others = Array.from({ length: 8 }, (_, i) => planMatch(i + 2).locationIds[0]);
    assert.ok(others.some((id) => id !== first));
  });
  it("quick match is one round of ten stills with no reconstructions", () => {
    const plan = planMatch(5, "quick");
    assert.equal(plan.locationIds.length, 10);
    assert.equal(new Set(plan.locationIds).size, 10);
    assert.equal(plan.totalRounds, 1);
    assert.equal(plan.photoRounds, 1);
    assert.equal(plan.photoQuestions, 10);
    assert.deepEqual(counts(plan.locationIds), { ZA: 5, NL: 5, WORLD: 0 });
    assert.equal(plan.envIds.length, 0);
    assert.ok(plan.locationIds.every((id) => getLocation(id)));
  });
  it("avoids recently played sites when the fresh pool can fill the match", () => {
    const seen = planMatch(21).locationIds.slice(0, 30);
    const next = planMatch(22, "standard", undefined, seen);
    const photos = next.locationIds.slice(0, next.photoQuestions);
    assert.equal(photos.some((id) => seen.includes(id)), false);
  });
  it("falls back to recent sites only when the fresh pool runs out", () => {
    const pool = planMatch(23).locationIds;
    const next = planMatch(24, "standard", undefined, pool);
    assert.equal(next.locationIds.length, 40);
    assert.equal(new Set(next.locationIds).size, 40);
  });
  it("spreads the deal across cities so one place cannot dominate", () => {
    for (const seed of [1, 3, 7, 11]) {
      const photos = planMatch(seed)
        .locationIds.slice(0, PHOTO_QUESTIONS)
        .map((id) => getLocation(id)!);
      const capeTown = photos.filter((l) => l.city === "Cape Town").length;
      assert.ok(capeTown <= 2, `seed ${seed} dealt ${capeTown} Cape Town sites`);
    }
  });
});
