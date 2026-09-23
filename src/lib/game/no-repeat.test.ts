import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeRecentIds, RECENT_LIMIT } from "./recent.ts";
import { enabledLocations } from "./locations.ts";
import { planMatch } from "./selection.ts";
import type { MatchLengthId } from "./timer.ts";
import type { AtlasSpec } from "./atlas.ts";

/** Play `games` matches back to back, feeding each one's sites into the next as seen. */
function session(games: number, length: MatchLengthId, atlas?: AtlasSpec, seed = 1) {
  let recent: string[] = [];
  const decks: string[][] = [];
  for (let g = 0; g < games; g++) {
    const deck = planMatch(seed * 7919 + g, length, atlas, recent).locationIds;
    decks.push(deck);
    // Shown one question at a time: the latest goes to the front.
    for (const id of deck) recent = mergeRecentIds([id], recent);
  }
  return { decks, recent };
}

describe("no repeats across games", () => {
  const saNl = enabledLocations().filter((l) => l.country !== "WORLD").length;

  it("remembers every site in the pool, not just the last few games", () => {
    assert.ok(RECENT_LIMIT >= enabledLocations().length, `limit ${RECENT_LIMIT}`);
  });

  for (const seed of [1, 2, 3]) {
    it(`5-round games never repeat until the pool is used up (seed ${seed})`, () => {
      // Each default game deals 4 SA/NL sites + 1 world finale.
      const games = Math.floor(saNl / 4);
      const { decks } = session(games, "escape", undefined, seed);
      const all = decks.flat();
      assert.equal(new Set(all).size, all.length, `${all.length - new Set(all).size} repeats`);
    });
  }

  it("once the pool is used up, replays the sites seen longest ago", () => {
    const games = Math.floor(saNl / 4);
    const { decks, recent } = session(games, "escape");
    const next = planMatch(424242, "escape", undefined, recent).locationIds;
    const playedLast = new Set(decks.slice(-5).flat());
    assert.equal(
      next.filter((id) => playedLast.has(id)).length,
      0,
      "dealt a site from the last five games while older ones were waiting",
    );
  });

  it("world-tour games cycle the whole world before repeating", () => {
    const world: AtlasSpec = { preset: "world", nations: [] };
    const { decks } = session(8, "escape", world);
    const all = decks.flat();
    assert.equal(new Set(all).size, all.length);
  });

  it("standard games do not repeat photo sites until the pool is used up", () => {
    const { decks } = session(3, "standard");
    const photos = decks.flatMap((d) => d.slice(0, 30));
    assert.equal(new Set(photos).size, photos.length);
  });

  it("never deals the same site twice in one match", () => {
    for (const length of ["escape", "quick", "standard", "extended", "full"] as const)
      for (let seed = 0; seed < 20; seed++) {
        const ids = planMatch(seed, length).locationIds;
        assert.equal(new Set(ids).size, ids.length, `${length} seed ${seed}`);
      }
  });
});

describe("recent list", () => {
  it("puts the newest first, de-duplicates and caps", () => {
    assert.deepEqual(mergeRecentIds(["b"], ["a", "b", "c"]), ["b", "a", "c"]);
    const long = Array.from({ length: RECENT_LIMIT + 10 }, (_, i) => `x${i}`);
    assert.equal(mergeRecentIds(["new"], long).length, RECENT_LIMIT);
    assert.equal(mergeRecentIds(["new"], long)[0], "new");
  });
});
