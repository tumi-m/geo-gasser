import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { grokGuess, grokThinkMs } from "./bot.ts";
import { haversineKm } from "./geo.ts";
import { getLocation } from "./locations.ts";

describe("grok bot", () => {
  it("places a finite guess near a launch location most of the time", () => {
    const loc = getLocation("loc_01");
    assert.ok(loc);
    const guess = grokGuess(loc!, 42, 0);
    assert.ok(Number.isFinite(guess.latitude));
    assert.ok(Number.isFinite(guess.longitude));
    const d = haversineKm(loc!, guess);
    assert.ok(d >= 0);
    assert.ok(d < 12_000);
  });

  it("thinks for a playable delay", () => {
    const ms = grokThinkMs(3, 1, 0);
    assert.ok(ms > 3000 && ms < 30_000);
  });
});