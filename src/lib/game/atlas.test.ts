import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  atlasPoolSize,
  DEFAULT_ATLAS,
  inferPreset,
  sanitizeAtlas,
  toggleNation,
} from "./atlas.ts";
import { getLocation } from "./locations.ts";
import { planMatch } from "./selection.ts";

describe("atlas", () => {
  it("defaults to South Africa × Netherlands", () => {
    assert.equal(sanitizeAtlas(undefined).preset, "sa-nl");
    assert.deepEqual(DEFAULT_ATLAS.nations, ["NL", "ZA"]);
  });
  it("infers presets from nation sets", () => {
    assert.equal(inferPreset(["ZA"]), "za");
    assert.equal(inferPreset(["NL"]), "nl");
    assert.equal(inferPreset(["ZA", "NL"]), "sa-nl");
    assert.equal(inferPreset(["JP", "US"]), "custom");
  });
  it("toggles nations into a custom map", () => {
    const next = toggleNation({ preset: "za", nations: ["ZA"] }, "JP");
    assert.equal(next.preset, "custom");
    assert.ok(next.nations.includes("ZA"));
    assert.ok(next.nations.includes("JP"));
  });
  it("SA only deals only South African sites", () => {
    const plan = planMatch(4, "standard", { preset: "za", nations: ["ZA"] });
    assert.ok(plan.locationIds.length >= 10);
    assert.ok(plan.locationIds.every((id) => getLocation(id)?.country === "ZA"));
    assert.equal(plan.atlas.preset, "za");
  });
  it("world atlas excludes SA and NL", () => {
    const plan = planMatch(9, "standard", { preset: "world", nations: [] });
    assert.ok(plan.locationIds.length >= 10);
    assert.ok(plan.locationIds.every((id) => getLocation(id)?.country === "WORLD"));
    assert.equal(plan.envIds.length, 0);
  });
  it("custom Japan + United States stays inside those nations", () => {
    const plan = planMatch(2, "standard", { preset: "custom", nations: ["JP", "US"] });
    assert.ok(plan.locationIds.length <= atlasPoolSize({ preset: "custom", nations: ["JP", "US"] }));
    for (const id of plan.locationIds) {
      const loc = getLocation(id)!;
      const code = loc.country === "WORLD" ? loc.nation : loc.country;
      assert.ok(code === "JP" || code === "US");
    }
  });
  it("tiny maps shrink instead of repeating", () => {
    const plan = planMatch(1, "full", { preset: "custom", nations: ["SG"] });
    assert.equal(plan.locationIds.length, 1);
    assert.equal(new Set(plan.locationIds).size, 1);
  });
});

describe("empty atlas filters", () => {
  it("deals a playable deck when a custom city filter matches nothing", () => {
    const plan = planMatch(4, "standard", { preset: "custom", nations: ["ZA"], cities: ["Atlantis"] });
    assert.ok(plan.locationIds.length >= 10);
    assert.ok(plan.totalQuestions >= 10);
  });
});
