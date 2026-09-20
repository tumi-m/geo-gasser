import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLACES, searchPlaces } from "./gazetteer.ts";

describe("gazetteer", () => {
  it("covers both countries with unique names", () => {
    const za = PLACES.filter((p) => p.country === "ZA");
    const nl = PLACES.filter((p) => p.country === "NL");
    assert.ok(za.length >= 20);
    assert.ok(nl.length >= 20);
    assert.equal(new Set(PLACES.map((p) => p.name)).size, PLACES.length);
  });

  it("resolves aliases and prefixes", () => {
    assert.equal(searchPlaces("den haag")[0]?.name, "The Hague");
    assert.equal(searchPlaces("port elizabeth")[0]?.name, "Gqeberha");
    assert.equal(searchPlaces("joburg")[0]?.name, "Johannesburg");
    assert.equal(searchPlaces("ams")[0]?.name, "Amsterdam");
    assert.ok(searchPlaces("ams").some((p) => p.name === "Amstelveen"));
    assert.equal(searchPlaces("cape")[0]?.name, "Cape Town");
  });

  it("returns nothing for empty or unknown queries", () => {
    assert.deepEqual(searchPlaces(""), []);
    assert.deepEqual(searchPlaces("xyzzy"), []);
  });
});
