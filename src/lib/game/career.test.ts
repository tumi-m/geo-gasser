import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  levelOf,
  matchXp,
  MEDALS,
  recordCareer,
  titleFor,
  totalXp,
  xpForLevel,
  xpToNext,
  type MatchSummary,
} from "./career.ts";
import { START_HEALTH } from "./rules.ts";
import { EMPTY_STATS, type PlayerStats } from "./stats.ts";

const solo = (over: Partial<MatchSummary> = {}): MatchSummary => ({
  kind: "solo",
  score: 12_000,
  won: false,
  places: 5,
  rightCountries: 3,
  perfect: 0,
  closestKm: 40,
  fastestAccurateMs: null,
  movement: "moving",
  nations: ["ZA", "NL"],
  ...over,
});

describe("career experience", () => {
  it("pays 10 a place and 1 per 100 points", () => {
    const lines = matchXp(solo());
    assert.deepEqual(lines, [
      { label: "5 places", xp: 50 },
      { label: "Points", xp: 120 },
    ]);
    assert.equal(totalXp(lines), 170);
  });

  it("pays 100 for a duel win, and nothing extra for a loss", () => {
    assert.equal(totalXp(matchXp(solo({ kind: "duel", opponent: "bot", won: true }))), 270);
    assert.equal(totalXp(matchXp(solo({ kind: "duel", opponent: "bot", won: false }))), 170);
  });

  it("pays a streak per right country, not per point", () => {
    const lines = matchXp(solo({ kind: "streak", places: 8, run: 7, score: 30_000 }));
    assert.deepEqual(lines, [
      { label: "8 places", xp: 80 },
      { label: "7 countries", xp: 175 },
    ]);
  });

  it("adds 10% on No move and 25% on NMPZ", () => {
    assert.deepEqual(matchXp(solo({ movement: "no-move" })).at(-1), { label: "No move", xp: 17 });
    assert.deepEqual(matchXp(solo({ movement: "nmpz" })).at(-1), { label: "NMPZ", xp: 43 });
  });
});

describe("career levels", () => {
  it("takes 300 XP to reach level 2, then 100 more each level", () => {
    assert.equal(xpForLevel(1), 0);
    assert.equal(xpForLevel(2), 300);
    assert.equal(xpForLevel(3), 700);
    assert.equal(xpToNext(3), 500);
    assert.equal(xpForLevel(4) - xpForLevel(3), xpToNext(3));
  });

  it("knows where an XP total sits", () => {
    assert.deepEqual(levelOf(0), { level: 1, title: "Tourist", into: 0, need: 300, progress: 0 });
    const l = levelOf(850);
    assert.equal(l.level, 3);
    assert.equal(l.into, 150);
    assert.equal(l.need, 500);
    assert.equal(levelOf(xpForLevel(10)).level, 10);
    assert.equal(levelOf(xpForLevel(10) - 1).level, 9);
  });

  it("names the levels", () => {
    assert.equal(titleFor(1), "Tourist");
    assert.equal(titleFor(3), "Backpacker");
    assert.equal(titleFor(9), "Explorer");
    assert.equal(titleFor(10), "Navigator");
    assert.equal(titleFor(45), "Atlas");
  });
});

describe("career medals", () => {
  it("has unique ids and a hint for each", () => {
    assert.equal(new Set(MEDALS.map((m) => m.id)).size, MEDALS.length);
    assert.ok(MEDALS.every((m) => m.hint.endsWith(".")));
  });

  it("gives First steps for the first match, once", () => {
    const first = recordCareer(EMPTY_STATS, solo(), 1);
    assert.deepEqual(
      first.award.medals.map((m) => m.id),
      ["first-steps"],
    );
    assert.equal(first.stats.medals?.["first-steps"], 1);
    const second = recordCareer(first.stats, solo(), 2);
    assert.deepEqual(second.award.medals, []);
    assert.equal(second.stats.medals?.["first-steps"], 1);
  });

  it("gives match medals from what the match did", () => {
    const { award } = recordCareer(
      EMPTY_STATS,
      solo({ score: 21_000, perfect: 1, closestKm: 0.4, rightCountries: 5, fastestAccurateMs: 8000, movement: "nmpz" }),
    );
    const ids = award.medals.map((m) => m.id);
    for (const id of ["sharpshooter", "perfect-read", "clean-sweep", "twenty-thousand", "quick-draw", "purist"])
      assert.ok(ids.includes(id), id);
  });

  it("knows a health duel won untouched", () => {
    const won = solo({ kind: "duel", opponent: "bot", health: true, won: true, healthLeft: START_HEALTH });
    const ids = recordCareer(EMPTY_STATS, won).award.medals.map((m) => m.id);
    assert.ok(ids.includes("knockout") && ids.includes("untouched") && ids.includes("beat-grok"));
    const scraped = recordCareer(EMPTY_STATS, { ...won, healthLeft: 1200 }).award.medals.map((m) => m.id);
    assert.ok(scraped.includes("knockout") && !scraped.includes("untouched"));
  });

  it("counts duels won in a row, ignoring solo matches between", () => {
    let stats: PlayerStats = EMPTY_STATS;
    const win = solo({ kind: "duel", opponent: "online", won: true });
    stats = recordCareer(stats, win).stats;
    stats = recordCareer(stats, solo()).stats;
    stats = recordCareer(stats, win).stats;
    const third = recordCareer(stats, win);
    assert.equal(third.stats.duelRun, 3);
    assert.ok(third.award.medals.some((m) => m.id === "hat-trick"));
    assert.equal(recordCareer(third.stats, { ...win, won: false }).stats.duelRun, 0);
  });

  it("collects countries seen without repeats", () => {
    let stats: PlayerStats = EMPTY_STATS;
    stats = recordCareer(stats, solo({ nations: ["za", "NL", "FR"] })).stats;
    stats = recordCareer(stats, solo({ nations: ["FR", "JP"] })).stats;
    assert.deepEqual(stats.nations, ["FR", "JP", "NL", "ZA"]);
    const many = recordCareer(stats, solo({ nations: ["A1", "A2", "A3", "A4", "A5", "A6"] }));
    assert.ok(many.award.medals.some((m) => m.id === "stamped"));
  });

  it("reports levels gained", () => {
    const { award } = recordCareer({ ...EMPTY_STATS, xp: 290 }, solo());
    assert.equal(award.before, 290);
    assert.equal(award.after, 460);
    assert.equal(award.levelsUp, 1);
  });
});
