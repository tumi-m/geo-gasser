import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { remainingSeconds, timePoints } from "./timer.ts";

describe("timePoints", () => {
  it("returns 10000 at 45 seconds", () => {
    assert.equal(timePoints(45), 10_000);
  });
  it("returns 10000 if remaining is above the cap", () => {
    assert.equal(timePoints(60), 10_000);
  });
  it("returns 1000 at 1 second", () => {
    assert.equal(timePoints(1), 1_000);
  });
  it("returns 0 at 0 and below", () => {
    assert.equal(timePoints(0), 0);
    assert.equal(timePoints(-4), 0);
  });
  it("interpolates the midpoint", () => {
    assert.equal(timePoints(23), 5_500);
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
