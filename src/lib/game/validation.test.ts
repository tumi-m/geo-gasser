import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LAUNCH_LOCATIONS, ROUND4_LOCATIONS } from "./locations.ts";
import { validateLaunchPool, validateRound4Pool } from "./validation.ts";

describe("launch pool", () => {
  it("contains 30 validated locations with a 15/15 split", () => {
    const issues = validateLaunchPool(LAUNCH_LOCATIONS);
    assert.deepEqual(issues, []);
    assert.equal(LAUNCH_LOCATIONS.length, 30);
  });
  it("contains 10 3D reconstructions with a 5/5 split", () => {
    const issues = validateRound4Pool(ROUND4_LOCATIONS);
    assert.deepEqual(issues, []);
    assert.equal(ROUND4_LOCATIONS.length, 10);
  });
});
