import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enabledLocations, nationOf } from "../game/index.ts";
import { haversineKm } from "../game/geo.ts";
import { normalize, PLACES, searchPlaces } from "./places.ts";

describe("map places", () => {
  it("covers both home countries densely, with unique names per country", () => {
    assert.ok(PLACES.filter((p) => p.country === "ZA").length >= 150);
    assert.ok(PLACES.filter((p) => p.country === "NL").length >= 150);
    const keys = PLACES.map((p) => `${p.nation}:${p.name}`);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("gives every answer country plenty of dots, so none points at the answer", () => {
    // The old list reused answer coordinates (Agra sat on the Taj Mahal) and
    // had one dot in most world countries, so the answer was the dot. Town
    // centres can sit near an answer that is itself in a town, but a country
    // never has so few dots that one gives the answer away.
    const CITY_STATES = new Set(["SG", "HK", "MO", "VA", "MC"]);
    for (const nation of new Set(enabledLocations().map(nationOf))) {
      if (CITY_STATES.has(nation)) continue;
      const n = PLACES.filter((p) => p.nation === nation).length;
      assert.ok(n >= 8, `${nation} has only ${n} places`);
    }
  });

  it("never marks a world landmark with a dot", () => {
    // A dot within a kilometre of a world answer is only allowed when the
    // answer is that town itself (a street scene in Tromsø), never a
    // landmark the dot would point at.
    for (const loc of enabledLocations().filter((l) => l.country === "WORLD")) {
      for (const p of PLACES) {
        if (haversineKm(loc, p) > 1) continue;
        const ownCity = PLACES.find((q) => q.name === loc.city && q.nation === p.nation);
        assert.ok(
          p.name === loc.city || p.name === loc.title || (ownCity && haversineKm(ownCity, p) < 15),
          `${p.name} sits ${Math.round(haversineKm(loc, p) * 1000)} m from ${loc.id} ${loc.title}`,
        );
      }
    }
  });

  it("finds towns by name, nickname and old name", () => {
    assert.equal(searchPlaces("den haag")[0]?.name, "The Hague");
    assert.equal(searchPlaces("port elizabeth")[0]?.name, "Gqeberha");
    assert.equal(searchPlaces("joburg")[0]?.name, "Johannesburg");
    assert.equal(searchPlaces("ams")[0]?.name, "Amsterdam");
    assert.ok(searchPlaces("ams").some((p) => p.name === "Amstelveen"));
    assert.equal(searchPlaces("cape")[0]?.name, "Cape Town");
    assert.equal(searchPlaces("tokyo")[0]?.name, "Tokyo");
    assert.equal(searchPlaces("tromso")[0]?.name, "Tromsø");
    assert.equal(searchPlaces("agra")[0]?.nation, "IN");
  });

  it("does not answer landmark names", () => {
    for (const q of [
      "taj mahal",
      "eiffel",
      "golden gate",
      "colosseum",
      "muiderslot",
      "howick falls",
    ]) {
      assert.deepEqual(searchPlaces(q), [], q);
    }
    assert.deepEqual(searchPlaces(""), []);
    assert.deepEqual(searchPlaces("xyzzy"), []);
  });

  it("folds letters NFD leaves alone", () => {
    assert.equal(normalize("Tromsø"), "tromso");
    assert.equal(normalize("Reykjavík"), "reykjavik");
  });
});
