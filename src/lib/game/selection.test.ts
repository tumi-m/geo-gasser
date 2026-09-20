import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLocation } from "./locations.ts";
import { planMatch } from "./selection.ts";

describe("planMatch", () => {
  it("is deterministic for a seed and unique across the three real rounds", () => {
    const a = planMatch(99);
    const b = planMatch(99);
    assert.deepEqual(a, b);
    assert.equal(new Set(a.locationIds).size, 3);
    const cities = a.locationIds.map((id) => getLocation(id)?.city);
    assert.equal(new Set(cities).size, cities.length);
  });
  it("varies across seeds", () => {
    const plans = Array.from({ length: 12 }, (_, i) => planMatch(i + 1).locationIds.join(","));
    assert.ok(new Set(plans).size > 3);
  });
});
