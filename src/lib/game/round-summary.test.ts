import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { endsRound, roundSummary } from "./round-summary.ts";
import type { PlayerState, RoundRecord, RoundScore } from "./types.ts";

const player = (id: string, name: string): PlayerState => ({
  id,
  name,
  avatarId: "canal",
  kind: "human",
  connected: true,
  totalScore: 0,
  totalDistanceKm: 0,
  totalResponseMs: 0,
  locked: true,
});
const rec = (index: number, scores: Record<string, number>): RoundRecord => ({
  index,
  locationId: `loc_${index}`,
  isRound4: false,
  truth: { latitude: 0, longitude: 0 },
  guesses: Object.fromEntries(
    Object.entries(scores).map(([id, s]) => [
      id,
      { guess: null, score: { roundScore: s } as RoundScore },
    ]),
  ),
});

describe("endsRound", () => {
  it("fires on the tenth question of each round and on the last question", () => {
    const q = (questionIndex: number, totalQuestions = 30) =>
      endsRound({ matchLength: "standard", questionIndex, totalQuestions });
    assert.deepEqual(
      [0, 8, 9, 10, 19, 29].map((i) => q(i)),
      [false, false, true, false, true, true],
    );
    assert.equal(endsRound({ matchLength: "quick", questionIndex: 9, totalQuestions: 10 }), true);
    assert.equal(endsRound({ matchLength: "quick", questionIndex: 4, totalQuestions: 5 }), true);
  });
  it("never fires in 5-round mode, where every question is a round", () => {
    for (let i = 0; i < 5; i++)
      assert.equal(
        endsRound({ matchLength: "escape", questionIndex: i, totalQuestions: 5 }),
        false,
      );
  });
});

describe("roundSummary", () => {
  const players = [player("b", "Grok"), player("a", "Tumi")];
  const history = [
    rec(0, { a: 9000, b: 5000 }),
    rec(1, { a: 3000, b: 8000 }),
    rec(2, { a: 7000, b: 7000 }),
    rec(10, { a: 1, b: 2 }), // next round: ignored
  ];
  it("totals the round per player, own row first", () => {
    const s = roundSummary(history, players, 0, "a");
    assert.deepEqual(
      s.rows.map((r) => [r.name, r.total, r.wins]),
      [
        ["Tumi", 19000, 1],
        ["Grok", 20000, 1],
      ],
    );
    assert.deepEqual(s.pips, ["a", "b", null]);
    assert.equal(s.winnerId, "b");
  });
  it("picks the viewer's best question", () => {
    assert.deepEqual(roundSummary(history, players, 0, "a").best, {
      question: 1,
      score: 9000,
      locationId: "loc_0",
    });
  });
  it("works solo", () => {
    const s = roundSummary(
      [rec(0, { a: 4000 }), rec(1, { a: 6000 })],
      [player("a", "Tumi")],
      0,
      "a",
    );
    assert.equal(s.rows[0].total, 10000);
    assert.deepEqual(s.pips, [null, null]);
    assert.equal(s.winnerId, null);
    assert.equal(s.best?.question, 2);
  });
});
