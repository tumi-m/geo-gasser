import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlayerState, RoundScore } from "./types.ts";
import { roundVerdict } from "./verdict.ts";

const score = (roundScore: number) => ({ roundScore }) as RoundScore;
const player = (id: string, name: string, total: number, round?: number): PlayerState => ({
  id,
  name,
  avatarId: "canal",
  kind: "human",
  connected: true,
  totalScore: total,
  totalDistanceKm: 0,
  totalResponseMs: 0,
  locked: true,
  roundScore: round === undefined ? undefined : score(round),
});

describe("round verdict", () => {
  it("names the round winner and the match leader", () => {
    const v = roundVerdict(
      [player("a", "Tumi", 15000, 9000), player("b", "Grok", 18000, 6000)],
      "a",
    );
    assert.equal(v.winnerId, "a");
    assert.equal(v.tie, false);
    assert.equal(v.leaderId, "b");
    assert.equal(v.lead, 3000);
  });

  it("puts the viewer's own row first, with totals before and after", () => {
    const v = roundVerdict(
      [player("b", "Grok", 18000, 6000), player("a", "Tumi", 15000, 9000)],
      "a",
    );
    assert.deepEqual(
      v.rows.map((r) => [r.name, r.before, r.total]),
      [
        ["Tumi", 6000, 15000],
        ["Grok", 12000, 18000],
      ],
    );
    assert.equal(v.rows[0].share, 1);
    assert.ok(Math.abs(v.rows[1].share - 6000 / 9000) < 1e-9);
  });

  it("calls a dead heat and a level match", () => {
    const v = roundVerdict([player("a", "A", 10000, 5000), player("b", "B", 10000, 5000)]);
    assert.equal(v.winnerId, null);
    assert.equal(v.tie, true);
    assert.equal(v.leaderId, null);
  });

  it("handles a round nobody scored and a solo round", () => {
    const zero = roundVerdict([player("a", "A", 0, 0), player("b", "B", 0)]);
    assert.equal(zero.tie, true);
    assert.ok(zero.rows.every((r) => r.share === 0));
    const solo = roundVerdict([player("a", "A", 7000, 7000)], "a");
    assert.equal(solo.winnerId, null);
    assert.equal(solo.rows.length, 1);
  });
});
