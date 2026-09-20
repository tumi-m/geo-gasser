import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enabledLocations, LAUNCH_LOCATIONS, ROUND4_LOCATIONS } from "./locations.ts";
import { POOL_TARGET, validateFullPool, validateLaunchPool, validateRound4Pool } from "./validation.ts";

describe("launch pool", () => {
  it("contains 60 validated locations with a 30/30 split", () => {
    const issues = validateLaunchPool(LAUNCH_LOCATIONS);
    assert.deepEqual(issues, []);
    assert.equal(LAUNCH_LOCATIONS.length, 60);
  });
  it("contains 10 labelled reconstructions with a 5/5 split", () => {
    const issues = validateRound4Pool(ROUND4_LOCATIONS);
    assert.deepEqual(issues, []);
    assert.equal(ROUND4_LOCATIONS.length, 10);
  });
});

describe("full pool", () => {
  it("contains 149 unique sites at 50/50/49", () => {
    const pool = enabledLocations();
    const issues = validateFullPool(pool);
    assert.deepEqual(issues, []);
    assert.equal(pool.length, POOL_TARGET.total);
    assert.equal(pool.filter((l) => l.country === "ZA").length, POOL_TARGET.ZA);
    assert.equal(pool.filter((l) => l.country === "NL").length, POOL_TARGET.NL);
    assert.equal(pool.filter((l) => l.country === "WORLD").length, POOL_TARGET.WORLD);
    assert.ok(pool.every((l) => /^loc_\d{2,3}$/.test(l.id)));
    assert.ok(pool.filter((l) => l.country === "WORLD").every((l) => l.nation));
  });
});
