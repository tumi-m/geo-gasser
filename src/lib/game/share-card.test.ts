import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeAtlas } from "./atlas.ts";
import { scoreMark, shareCard } from "./share-card.ts";
import type { PlayerState, RoundRecord, RoundScore } from "./types.ts";

const player = (id: string, name: string, total: number): PlayerState => ({
  id,
  name,
  avatarId: "blob-lime",
  kind: "human",
  connected: true,
  totalScore: total,
  totalDistanceKm: 0,
  totalResponseMs: 0,
  locked: true,
});
const record = (index: number, scores: Record<string, [number, number]>): RoundRecord => ({
  index,
  locationId: `loc-${index}`,
  isRound4: false,
  truth: { latitude: 0, longitude: 0 },
  guesses: Object.fromEntries(
    Object.entries(scores).map(([id, [roundScore, distanceKm]]) => [
      id,
      { guess: { latitude: 0, longitude: 0 }, score: { roundScore, distanceKm } as RoundScore },
    ]),
  ),
});

describe("share card", () => {
  it("grades each question by its share of the maximum", () => {
    assert.equal(scoreMark(4750), "🟩");
    assert.equal(scoreMark(2250), "🟨");
    assert.equal(scoreMark(300), "🟧");
    assert.equal(scoreMark(0), "⬛");
    assert.equal(scoreMark(undefined), "⬛");
  });

  it("wraps marks ten to a line and ends with the link", () => {
    const history = Array.from({ length: 12 }, (_, i) => record(i, { a: [4000, 3.2 + i] }));
    const text = shareCard(
      {
        mode: "solo",
        atlas: sanitizeAtlas({ preset: "sa-nl" }),
        players: [player("a", "Tumi", 48000)],
        roundHistory: history,
      },
      "a",
      "https://example.test/",
    );
    const lines = text.split("\n");
    assert.equal(lines[0], "Atlas Duel · South Africa × Netherlands");
    assert.equal([...lines[1]].length, 10);
    assert.equal([...lines[2]].length, 2);
    assert.equal(lines[3], "48,000 pts · closest 3.2 km");
    assert.equal(lines[4], "https://example.test/");
  });

  it("names both players in a duel and never leaks places", () => {
    const text = shareCard(
      {
        mode: "duel",
        atlas: sanitizeAtlas({ preset: "za" }),
        players: [player("a", "Tumi", 7500), player("b", "Grok", 5250)],
        roundHistory: [
          record(0, { a: [4500, 1], b: [3000, 40] }),
          record(1, { a: [3000, 80], b: [2250, 90] }),
        ],
      },
      "a",
    );
    assert.match(text, /Tumi 7,500 · Grok 5,250/);
    assert.doesNotMatch(text, /loc-/);
  });
});
