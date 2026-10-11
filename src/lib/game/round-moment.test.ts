import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calloutLabel, roundMoment } from "./round-moment.ts";
import type { RoundRecord } from "./types.ts";

/** A record where each player scored the given points (accuracy = points). */
function rec(index: number, scores: Record<string, number>, extra: Partial<RoundRecord> = {}): RoundRecord {
  return {
    index,
    locationId: `loc_${index}`,
    truth: { latitude: 0, longitude: 0 },
    guesses: Object.fromEntries(
      Object.entries(scores).map(([id, points]) => [
        id,
        { score: { roundScore: points, accuracyPoints: points, distanceKm: 1 } },
      ]),
    ),
    ...extra,
  } as unknown as RoundRecord;
}

const byPlace = (r: RoundRecord) => r.index;
const byTen = (r: RoundRecord) => Math.floor(r.index / 10);
const ids = ["a", "b"];

describe("round moment", () => {
  it("counts rounds won and names this round's winner", () => {
    const m = roundMoment([rec(0, { a: 3000, b: 1000 }), rec(1, { a: 1000, b: 4000 }), rec(2, { a: 4000, b: 2000 })], ids, byPlace);
    assert.deepEqual(m.wins, { a: 2, b: 1 });
    assert.equal(m.winnerId, "a");
  });

  it("calls a run of wins from two in a row", () => {
    const h = [rec(0, { a: 1000, b: 4000 }), rec(1, { a: 4000, b: 2000 }), rec(2, { a: 4000, b: 3000 })];
    assert.deepEqual(roundMoment(h, ids, byPlace).callouts.find((c) => c.kind === "run"), { kind: "run", count: 2 });
    const h3 = [...h, rec(3, { a: 4100, b: 3900 })];
    assert.deepEqual(roundMoment(h3, ids, byPlace).callouts[0], { kind: "run", count: 3 });
  });

  it("calls a lead change when the totals swap leaders", () => {
    const h = [rec(0, { a: 3000, b: 2000 }), rec(1, { a: 1000, b: 4000 })];
    assert.ok(roundMoment(h, ids, byPlace).callouts.some((c) => c.kind === "lead-change"));
    assert.ok(!roundMoment([rec(0, { a: 3000, b: 2000 })], ids, byPlace).callouts.some((c) => c.kind === "lead-change"));
  });

  it("leads a health duel on health, not points", () => {
    const h = [
      rec(0, { a: 4000, b: 1000 }, { damage: { playerId: "b", amount: 3000, multiplier: 1 } }),
      rec(1, { a: 0, b: 3500 }, { damage: { playerId: "a", amount: 1000, multiplier: 1 } }),
    ];
    // On points b now leads (4,500 v 4,000); on health a still does (5,000 v 3,000).
    assert.ok(roundMoment(h, ids, byPlace).callouts.some((c) => c.kind === "lead-change"));
    assert.ok(!roundMoment(h, ids, byPlace, { leadBy: "health" }).callouts.some((c) => c.kind === "lead-change"));
  });

  it("calls a close call within 2% and a shutout at zero", () => {
    const close = roundMoment([rec(0, { a: 3050, b: 3000 })], ids, byPlace).callouts;
    assert.deepEqual(close, [{ kind: "close-call", margin: 50 }]);
    assert.ok(!roundMoment([rec(0, { a: 3200, b: 3000 })], ids, byPlace).callouts.length);
    assert.equal(roundMoment([rec(0, { a: 2000, b: 0 })], ids, byPlace).callouts[0].kind, "shutout");
  });

  it("puts a perfect read first, and keeps two callouts at most", () => {
    const h = [rec(0, { a: 5000, b: 0 })];
    const m = roundMoment(h, ids, byPlace);
    assert.deepEqual(m.callouts.map((c) => c.kind), ["perfect", "shutout"]);
  });

  it("groups ten places to a round when asked", () => {
    const h = Array.from({ length: 12 }, (_, i) => rec(i, { a: i < 10 ? 3000 : 1000, b: 2000 }));
    const m = roundMoment(h, ids, byTen);
    assert.deepEqual(m.wins, { a: 1, b: 1 });
    assert.equal(m.winnerId, "b");
  });

  it("calls a solo hot streak and a perfect", () => {
    const h = [rec(0, { a: 1000 }), rec(1, { a: 4200 }), rec(2, { a: 5000 })];
    const m = roundMoment(h, ["a"], byPlace);
    assert.equal(m.winnerId, undefined);
    assert.deepEqual(m.callouts, [{ kind: "perfect" }, { kind: "hot-streak", count: 2 }]);
  });

  it("says each callout plainly", () => {
    assert.equal(calloutLabel({ kind: "run", count: 2 }), "2 in a row");
    assert.equal(calloutLabel({ kind: "run", count: 5 }), "Unstoppable · 5 in a row");
    assert.equal(calloutLabel({ kind: "close-call", margin: 1 }), "Close call · 1 point");
    assert.equal(calloutLabel({ kind: "hot-streak", count: 3 }), "On fire · 3 great rounds");
  });
});
