import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LAUNCH_LOCATIONS } from "./locations.ts";
import { validateLaunchPool } from "./validation.ts";

describe("launch pool", () => {
  it("contains 30 validated locations with a 15/15 split", () => {
    const issues = validateLaunchPool(LAUNCH_LOCATIONS);
    assert.deepEqual(issues, []);
    assert.equal(LAUNCH_LOCATIONS.length, 30);
  });
});
