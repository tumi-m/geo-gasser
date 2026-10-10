import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nationCounts } from "./atlas.ts";
import { getLocation, placeCity, playableLocations, ROUND4_LOCATIONS } from "./locations.ts";
import { UNFIT_PHOTOS } from "./photo-review.ts";
import { STREET_LOCATIONS } from "./street-locations.ts";
import {
  atlasPoolSize,
  MATCH_QUOTA,
  PHOTO_QUESTIONS,
  planCounts,
  planMatch,
  playableCities,
  ROUND4_QUESTIONS,
  TOTAL_QUESTIONS,
} from "./selection.ts";

function counts(ids: string[]) {
  const locs = ids.map((id) => getLocation(id)!);
  return {
    ZA: locs.filter((l) => l.country === "ZA").length,
    NL: locs.filter((l) => l.country === "NL").length,
    WORLD: locs.filter((l) => l.country === "WORLD").length,
  };
}

describe("planMatch", () => {
  it("is deterministic and deals 40 unique real places by default", () => {
    const a = planMatch(99);
    const b = planMatch(99);
    assert.deepEqual(a, b);
    assert.equal(a.locationIds.length, TOTAL_QUESTIONS);
    assert.equal(new Set(a.locationIds).size, TOTAL_QUESTIONS);
    // The final round is real places, not reconstruction plates.
    assert.equal(a.envIds.length, 0);
    assert.equal(a.photoQuestions, TOTAL_QUESTIONS);
  });
  it("standard match is 15 ZA + 15 NL photos, then a final round of 5 + 5", () => {
    const plan = planMatch(7);
    const photos = plan.locationIds.slice(0, PHOTO_QUESTIONS);
    const final = plan.locationIds.slice(PHOTO_QUESTIONS);
    assert.deepEqual(counts(photos), MATCH_QUOTA.standard);
    assert.equal(final.length, ROUND4_QUESTIONS);
    assert.deepEqual(counts(final), { ZA: 5, NL: 5, WORLD: 0 });
    const reserved = new Set(ROUND4_LOCATIONS.map((l) => l.id));
    assert.ok(plan.locationIds.every((id) => !reserved.has(id)));
    assert.ok(plan.locationIds.every((id) => getLocation(id)?.sceneKind === "wikimedia"));
  });
  it("extended match stays on SA and NL around its cosmos round", () => {
    const plan = planMatch(11, "extended");
    assert.equal(plan.locationIds.length, 70);
    assert.equal(new Set(plan.locationIds).size, 70);
    assert.equal(counts(plan.locationIds).WORLD, 0);
    assert.equal(plan.envIds.length, 0);
  });
  it("full game is 100 places with Street View, and shrinks by whole rounds without it", () => {
    const plan = planMatch(3, "full", undefined, [], { streetView: true });
    assert.equal(plan.locationIds.length, 100);
    assert.equal(new Set(plan.locationIds).size, 100);
    assert.equal(plan.totalRounds, 10);
    assert.equal(counts(plan.locationIds).WORLD, 0);
    const photosOnly = planMatch(3, "full");
    assert.equal(new Set(photosOnly.locationIds).size, photosOnly.locationIds.length);
    assert.ok(photosOnly.locationIds.length <= 100);
    // Cosmos questions still come in whole rounds.
    const cosmosRounds = new Map<number, number>();
    photosOnly.locationIds.forEach((id, i) => {
      if (id.startsWith("cos_")) cosmosRounds.set(Math.floor(i / 10), (cosmosRounds.get(Math.floor(i / 10)) ?? 0) + 1);
    });
    assert.ok([...cosmosRounds.values()].every((n) => n === 10), JSON.stringify([...cosmosRounds]));
  });
  it("mix atlas pulls world sites into the photo rounds", () => {
    const plan = planMatch(8, "standard", { preset: "mix", nations: [] });
    assert.equal(plan.atlas.preset, "mix");
    assert.ok(counts(plan.locationIds.slice(0, plan.photoQuestions)).WORLD > 0);
  });
  it("varies across seeds so the photo pool is hard to memorise", () => {
    const plans = Array.from({ length: 12 }, (_, i) => planMatch(i + 1).locationIds.slice(0, 30).join(","));
    assert.ok(new Set(plans).size > 3);
    const first = planMatch(1).locationIds[0];
    const others = Array.from({ length: 8 }, (_, i) => planMatch(i + 2).locationIds[0]);
    assert.ok(others.some((id) => id !== first));
  });
  it("quick match is one round of ten stills with no reconstructions", () => {
    const plan = planMatch(5, "quick");
    assert.equal(plan.locationIds.length, 10);
    assert.equal(new Set(plan.locationIds).size, 10);
    assert.equal(plan.totalRounds, 1);
    assert.equal(plan.photoRounds, 1);
    assert.equal(plan.photoQuestions, 10);
    assert.deepEqual(counts(plan.locationIds), { ZA: 5, NL: 5, WORLD: 0 });
    assert.equal(plan.envIds.length, 0);
    assert.ok(plan.locationIds.every((id) => getLocation(id)));
  });
  it("avoids recently played sites when the fresh pool can fill the match", () => {
    const seen = planMatch(21).locationIds.slice(0, 20);
    const next = planMatch(22, "standard", undefined, seen);
    const photos = next.locationIds.slice(0, next.photoQuestions);
    assert.equal(photos.some((id) => seen.includes(id)), false);
  });
  it("falls back to recent sites only when the fresh pool runs out", () => {
    const pool = planMatch(23).locationIds;
    const next = planMatch(24, "standard", undefined, pool);
    assert.equal(next.locationIds.length, 40);
    assert.equal(new Set(next.locationIds).size, 40);
  });
  it("spreads the deal across cities so one place cannot dominate", () => {
    for (const seed of [1, 3, 7, 11]) {
      const photos = planMatch(seed)
        .locationIds.slice(0, PHOTO_QUESTIONS)
        .map((id) => getLocation(id)!);
      const capeTown = photos.filter((l) => l.city === "Cape Town").length;
      assert.ok(capeTown <= 2, `seed ${seed} dealt ${capeTown} Cape Town sites`);
    }
  });
});

describe("short matches", () => {
  it("Escape is dealt real photographs, never reconstruction plates", () => {
    const reserved = new Set(ROUND4_LOCATIONS.map((l) => l.id));
    for (let seed = 1; seed <= 300; seed++) {
      for (const atlas of [undefined, { preset: "mix" as const, nations: [] }, { preset: "nl" as const, nations: [] }]) {
        const plan = planMatch(seed, "escape", atlas);
        assert.ok(plan.locationIds.every((id) => !reserved.has(id)), `seed ${seed}`);
        assert.equal(plan.locationIds.length, 5);
      }
    }
  });
});

describe("photos that cannot be played, and Street View places", () => {
  const all = (opts?: { streetView?: boolean }) =>
    (["escape", "quick", "standard", "extended", "full"] as const).flatMap((len) =>
      [undefined, { preset: "mix" as const, nations: [] }, { preset: "world" as const, nations: [] }].flatMap((atlas) =>
        Array.from({ length: 40 }, (_, seed) => planMatch(seed, len, atlas, [], opts).locationIds),
      ),
    ).flat();
  it("never deals an unfit plate (a seagull, hornbills, an AI image) as a photo", () => {
    const dealt = new Set(all());
    for (const id of Object.keys(UNFIT_PHOTOS)) assert.ok(!dealt.has(id), id);
    for (const l of STREET_LOCATIONS) assert.ok(!dealt.has(l.id), l.id);
  });
  it("deals them in Street View when it is configured", () => {
    const dealt = new Set(all({ streetView: true }));
    assert.ok(STREET_LOCATIONS.filter((l) => dealt.has(l.id)).length >= 25);
    assert.ok(Object.keys(UNFIT_PHOTOS).filter((id) => dealt.has(id)).length >= 15);
  });
  it("never deals reconstruction plates while the 3D round is parked", () => {
    const reserved = new Set(ROUND4_LOCATIONS.map((l) => l.id));
    for (const id of all({ streetView: true })) assert.ok(!reserved.has(id), id);
  });
});

describe("what the menus count", () => {
  const SA_NL = { preset: "sa-nl" as const, nations: ["NL", "ZA"] };
  it("counts only places a match can deal", () => {
    const plain = playableLocations(false);
    const unfit = new Set(Object.keys(UNFIT_PHOTOS));
    const r4 = new Set(ROUND4_LOCATIONS.map((l) => l.id));
    assert.ok(plain.length > 0);
    assert.ok(plain.every((l) => !r4.has(l.id) && !unfit.has(l.id) && l.sceneKind !== "street"));
    const withStreet = playableLocations(true);
    assert.equal(withStreet.length, plain.length + unfit.size + STREET_LOCATIONS.length);
  });
  it("the pool size is what an Odyssey on that map deals", () => {
    for (const streetView of [false, true]) {
      const plan = planMatch(5, "full", SA_NL, [], { streetView });
      const earth = plan.locationIds.filter((id) => getLocation(id)?.country !== "SPACE");
      assert.ok(atlasPoolSize(SA_NL, streetView) >= earth.length);
    }
    assert.ok(atlasPoolSize(SA_NL, true) > atlasPoolSize(SA_NL, false));
    // A map smaller than the match deals every place on it, no more.
    const small = { preset: "custom" as const, nations: ["JP", "US"] };
    const plan = planMatch(2, "standard", small);
    assert.ok(atlasPoolSize(small) < 40);
    assert.equal(plan.locationIds.length, atlasPoolSize(small));
  });
  it("nation counts skip unplayable places", () => {
    // Assen's only plate is unfit; Australia's Uluru plate too.
    const plain = nationCounts(false);
    const withStreet = nationCounts(true);
    assert.ok((withStreet.NL ?? 0) > (plain.NL ?? 0));
    assert.ok((withStreet.ZA ?? 0) > (plain.ZA ?? 0));
  });
  it("lists only cities a match can reach", () => {
    const plain = playableCities(["NL", "ZA"], false);
    const withStreet = playableCities(["NL", "ZA"], true);
    assert.ok(!plain.includes("Assen"), "Assen has only an unfit plate");
    assert.ok(withStreet.includes("Assen"));
    assert.ok(withStreet.includes("Urk"), "Street View places add their towns");
    assert.ok(!plain.includes("Urk"));
    for (const city of plain) {
      const plan = planMatch(3, "escape", { preset: "sa-nl", nations: ["NL", "ZA"], cities: [city] });
      assert.ok(plan.locationIds.every((id) => getLocation(id)?.city === city), city);
    }
  });
});

describe("placeCity", () => {
  it("names the city unless the title already does", () => {
    assert.equal(placeCity({ title: "The Big Hole", city: "Kimberley" }), "Kimberley");
    assert.equal(placeCity({ title: "Grote Markt, Groningen", city: "Groningen" }), undefined);
    assert.equal(placeCity({ title: "Clarens", city: "Clarens" }), undefined);
    assert.equal(placeCity({ title: "Edersee dam", city: "Ede" }), "Ede");
    assert.equal(placeCity({ title: "Acropolis" }), undefined);
  });
});

describe("planCounts", () => {
  const MIX = { preset: "mix" as const, nations: [] };
  it("an Odyssey counts its space targets apart from the places on the map", () => {
    for (const streetView of [false, true]) {
      const plan = planMatch(1, "full", MIX, [], { streetView });
      const c = planCounts(plan, streetView);
      assert.equal(c.earth + c.space, plan.locationIds.length);
      assert.equal(c.space, 20);
      assert.equal(c.earth, 80);
      assert.equal(c.pool, atlasPoolSize(MIX, streetView));
      assert.ok(c.pool > c.earth);
    }
  });
  it("a short match has no space targets", () => {
    const c = planCounts(planMatch(1, "escape"));
    assert.deepEqual([c.earth, c.space], [5, 0]);
  });
  it("a small map is played in full", () => {
    const small = { preset: "custom" as const, nations: ["JP", "US"] };
    const c = planCounts(planMatch(2, "standard", small));
    assert.equal(c.earth, c.pool);
  });
});
