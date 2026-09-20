import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLocation } from "./locations.ts";
import { PHOTO_QUESTIONS, planMatch, ROUND4_QUESTIONS, TOTAL_QUESTIONS } from "./selection.ts";

describe("planMatch", () => {
  it("is deterministic and deals 40 unique questions", () => {
    const a = planMatch(99);
    const b = planMatch(99);
    assert.deepEqual(a, b);
    assert.equal(a.locationIds.length, TOTAL_QUESTIONS);
    assert.equal(new Set(a.locationIds).size, TOTAL_QUESTIONS);
    assert.equal(a.envIds.length, ROUND4_QUESTIONS);
  });
  it("uses 15 ZA + 15 NL photos then 10 reconstructions", () => {
    const plan = planMatch(7);
    const photos = plan.locationIds.slice(0, PHOTO_QUESTIONS).map((id) => getLocation(id)!);
    const r4 = plan.locationIds.slice(PHOTO_QUESTIONS).map((id) => getLocation(id)!);
    assert.equal(photos.filter((l) => l.country === "ZA").length, 15);
    assert.equal(photos.filter((l) => l.country === "NL").length, 15);
    assert.equal(r4.length, 10);
    assert.ok(r4.every((l) => l.sceneKind === "generated-reconstruction"));
    assert.equal(r4.filter((l) => l.country === "ZA").length, 5);
    assert.equal(r4.filter((l) => l.country === "NL").length, 5);
  });
  it("varies across seeds", () => {
    const plans = Array.from({ length: 12 }, (_, i) => planMatch(i + 1).locationIds.join(","));
    assert.ok(new Set(plans).size > 3);
  });
});