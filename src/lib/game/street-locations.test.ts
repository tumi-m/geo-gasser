import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isInsideCountry, isInsideNation } from "./geo.ts";
import { enabledLocations, getLocation, needsStreetView } from "./locations.ts";
import { UNFIT_PHOTOS } from "./photo-review.ts";
import { STREET_LOCATIONS } from "./street-locations.ts";
import { explainMapsError, streetViewStatus, streetViewTarget, streetViewUsable } from "./street-view.ts";

describe("Street View places", () => {
  it("are thirty unique places: ten in SA, ten in NL, ten abroad", () => {
    assert.equal(STREET_LOCATIONS.length, 30);
    assert.equal(new Set(STREET_LOCATIONS.map((l) => l.id)).size, 30);
    const count = (c: string) => STREET_LOCATIONS.filter((l) => l.country === c).length;
    assert.deepEqual([count("ZA"), count("NL"), count("WORLD")], [10, 10, 10]);
  });
  it("sit inside their own country", () => {
    for (const l of STREET_LOCATIONS) {
      const p = { latitude: l.latitude, longitude: l.longitude };
      const inside = l.country === "WORLD" ? isInsideNation(p, l.nation!) : isInsideCountry(p, l.country);
      assert.ok(inside, `${l.id} ${l.title}`);
    }
  });
  it("do not repeat a photo place", () => {
    const photos = enabledLocations();
    for (const s of STREET_LOCATIONS) {
      const twin = photos.find((p) => p.title === s.title && p.city === s.city);
      assert.equal(twin, undefined, s.title);
    }
  });
  it("need Street View, as do the unfit photo places, and nothing else does", () => {
    for (const l of STREET_LOCATIONS) assert.ok(needsStreetView(l));
    for (const id of Object.keys(UNFIT_PHOTOS)) assert.ok(needsStreetView(getLocation(id)!), id);
    const others = enabledLocations().filter((l) => !(l.id in UNFIT_PHOTOS));
    assert.ok(others.every((l) => !needsStreetView(l)));
  });
  it("can be found by a guest from the scene's neutral path", () => {
    const l = STREET_LOCATIONS[20];
    const target = streetViewTarget({ kind: "street", src: `street:${l.id}`, fallbacks: [] });
    assert.deepEqual(target, { latitude: l.latitude, longitude: l.longitude });
  });
});

describe("Street View status", () => {
  it("is off with no key, and never deals Street View places then", () => {
    assert.deepEqual(streetViewStatus(), { state: "no-key" });
    assert.equal(streetViewUsable(), false);
  });
  it("explains Google's refusal codes with the fix", () => {
    assert.match(explainMapsError("RefererNotAllowedMapError", "geo-gasser.vercel.app"), /https:\/\/geo-gasser\.vercel\.app\/\*/);
    assert.match(explainMapsError("BillingNotEnabledMapError", "x"), /Billing/);
    assert.match(explainMapsError("ApiNotActivatedMapError", "x"), /Maps JavaScript API/);
    assert.match(explainMapsError("InvalidKeyMapError", "x"), /VITE_GOOGLE_MAPS_KEY/);
    assert.match(explainMapsError("", "x"), /without saying why/);
    assert.match(explainMapsError("SomethingNewMapError", "x"), /SomethingNewMapError/);
  });
});
