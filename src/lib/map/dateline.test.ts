import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitAtDateLine } from "./dateline.ts";

describe("date-line rings", () => {
  it("splits a ring that crosses 180° into an east and a west half", () => {
    const ring = [
      [170, 60],
      [180, 60],
      [-180, 60],
      [-170, 60],
      [-170, 70],
      [-180, 70],
      [180, 70],
      [170, 70],
      [170, 60],
    ];
    const parts = splitAtDateLine(ring);
    assert.equal(parts.length, 2);
    for (const part of parts) {
      const xs = part.map((p) => p[0]);
      assert.ok(
        Math.max(...xs) - Math.min(...xs) <= 20,
        `part spans ${Math.min(...xs)}..${Math.max(...xs)}`,
      );
      assert.deepEqual(part[0], part[part.length - 1]);
    }
  });

  it("leaves ordinary rings and pole-circling rings alone", () => {
    const square = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    assert.deepEqual(splitAtDateLine(square), [square]);
    const polar = [
      [-180, -80],
      [0, -80],
      [180, -80],
      [180, -90],
      [-180, -90],
      [-180, -80],
    ];
    assert.deepEqual(splitAtDateLine(polar), [polar]);
  });
});
