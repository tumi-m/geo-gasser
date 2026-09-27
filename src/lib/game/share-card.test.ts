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
    assert.equal(scoreMark(19000), "🟩");
    assert.equal(scoreMark(9000), "🟨");
    assert.equal(scoreMark(1200), "🟧");
    assert.equal(scoreMark(0), "⬛");
    assert.equal(scoreMark(undefined), "⬛");
  });

  it("wraps marks ten to a line and ends with the link", () => {
    const history = Array.from({ length: 12 }, (_, i) => record(i, { a: [16000, 3.2 + i] }));
    const text = shareCard(
      {
        mode: "solo",
        atlas: sanitizeAtlas({ preset: "sa-nl" }),
        players: [player("a", "Tumi", 192000)],
        roundHistory: history,
      },
      "a",
      "https://example.test/",
    );
    const lines = text.split("\n");
    assert.equal(lines[0], "Atlas Duel · South Africa × Netherlands");
    assert.equal([...lines[1]].length, 10);
    assert.equal([...lines[2]].length, 2);
    assert.equal(lines[3], "192,000 pts · closest 3.2 km");
    assert.equal(lines[4], "https://example.test/");
  });

  it("names both players in a duel and never leaks places", () => {
    const text = shareCard(
      {
        mode: "duel",
        atlas: sanitizeAtlas({ preset: "za" }),
        players: [player("a", "Tumi", 30000), player("b", "Grok", 21000)],
        roundHistory: [
          record(0, { a: [18000, 1], b: [12000, 40] }),
          record(1, { a: [12000, 80], b: [9000, 90] }),
        ],
      },
      "a",
    );
    assert.match(text, /Tumi 30,000 · Grok 21,000/);
    assert.doesNotMatch(text, /loc-/);
  });
});
