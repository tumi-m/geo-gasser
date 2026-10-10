import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLOCK_TIERS, clockFactor, clockTier, remainingSeconds, secondsToNextTier } from "./timer.ts";

describe("clock tiers", () => {
  it("pays in five equal slices of the round: 100, 90, 80, 70, 60%", () => {
    assert.deepEqual([...CLOCK_TIERS], [1, 0.9, 0.8, 0.7, 0.6]);
    // 45 s round: slices of 9 s.
    assert.equal(clockFactor(45, 45), 1);
    assert.equal(clockFactor(36.01, 45), 1);
    assert.equal(clockFactor(36, 45), 0.9);
    assert.equal(clockFactor(27, 45), 0.8);
    assert.equal(clockFactor(18, 45), 0.7);
    assert.equal(clockFactor(9, 45), 0.6);
    assert.equal(clockFactor(0.5, 45), 0.6);
  });
  it("holds the last tier at the buzzer and past it", () => {
    assert.equal(clockTier(0, 45), 4);
    assert.equal(clockTier(-3, 45), 4);
  });
  it("never pays more than the first tier for time above the clock", () => {
    assert.equal(clockTier(60, 45), 0);
  });
  it("scales to the round's duration", () => {
    assert.equal(clockFactor(48, 60), 0.9);
    assert.equal(clockFactor(24.1, 30), 1);
    assert.equal(clockFactor(6, 30), 0.6);
  });
  it("counts down to the next step, and stops in the last tier", () => {
    assert.equal(secondsToNextTier(45, 45), 9);
    assert.equal(secondsToNextTier(40, 45), 4);
    assert.equal(secondsToNextTier(20, 45), 2);
    assert.equal(secondsToNextTier(8, 45), null);
  });
});

describe("remainingSeconds", () => {
  it("counts down from a start timestamp", () => {
    assert.equal(remainingSeconds(1000, 1000), 45);
    assert.equal(remainingSeconds(1000, 1000 + 44_000), 1);
    assert.equal(remainingSeconds(1000, 1000 + 45_000), 0);
    assert.equal(remainingSeconds(1000, 1000 + 50_000), 0);
  });
});
