import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describePoint, featureContains, findContaining, labelPoint, type RegionCollection, type RegionFeature } from "./lookup.ts";

const square = (name: string, c: string, x0: number, y0: number, x1: number, y1: number, hole?: number[][]): RegionFeature => ({
  type: "Feature",
  properties: { n: name, c, bb: [x0, y0, x1, y1] },
  geometry: {
    type: "Polygon",
    coordinates: hole
      ? [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], hole]
      : [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
  },
});

const provinces: RegionCollection = {
  type: "FeatureCollection",
  features: [square("Gauteng", "ZA", 27, -27, 29, -25)],
};
const countries: RegionCollection = {
  type: "FeatureCollection",
  features: [
    // ZA with a Lesotho-shaped hole.
    square("South Africa", "ZA", 16, -35, 33, -22, [[27.5, -30.5], [29.3, -30.5], [29.3, -28.8], [27.5, -28.8], [27.5, -30.5]]),
    square("Lesotho", "LS", 27.5, -30.5, 29.3, -28.8),
  ],
};
const world: RegionCollection = { type: "FeatureCollection", features: [square("Namibia", "NA", 11, -29, 16, -17)] };

describe("featureContains", () => {
  it("is inside a simple polygon", () => {
    assert.equal(featureContains(provinces.features[0], 28, -26), true);
  });
  it("rejects via bbox before scanning rings", () => {
    assert.equal(featureContains(provinces.features[0], 5, 52), false);
  });
  it("treats holes as outside", () => {
    assert.equal(featureContains(countries.features[0], 28.4, -29.6), false);
    assert.equal(featureContains(countries.features[1], 28.4, -29.6), true);
  });
});

describe("describePoint", () => {
  it("prefers the province and names the country", () => {
    assert.deepEqual(describePoint({ latitude: -26.1, longitude: 28.05 }, provinces, countries, world), {
      primary: "Gauteng",
      secondary: "South Africa",
      country: "ZA",
    });
  });
  it("falls back to a detailed country", () => {
    assert.deepEqual(describePoint({ latitude: -29.6, longitude: 28.4 }, provinces, countries, world), {
      primary: "Lesotho",
      country: "LS",
    });
  });
  it("falls back to the world layer, then open water", () => {
    assert.equal(describePoint({ latitude: -22, longitude: 14 }, provinces, countries, world).primary, "Namibia");
    assert.equal(describePoint({ latitude: -40, longitude: 5 }, provinces, countries, world).primary, "Open water");
  });
});

describe("labelPoint", () => {
  it("returns the centroid of a square", () => {
    const [lng, lat] = labelPoint(provinces.features[0]);
    assert.ok(Math.abs(lng - 28) < 1e-9 && Math.abs(lat + 26) < 1e-9);
  });
  it("uses the precomputed anchor when present", () => {
    const f: RegionFeature = { ...provinces.features[0], properties: { ...provinces.features[0].properties, lp: [1, 2] } };
    assert.deepEqual(labelPoint(f), [1, 2]);
  });
  it("findContaining returns null when nothing matches", () => {
    assert.equal(findContaining(provinces, 0, 0), null);
  });
});