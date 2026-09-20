import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectCountry, formatDistance, geodesicPoints, haversineKm } from "./geo.ts";

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    const p = { latitude: 52.3731, longitude: 4.8928 };
    assert.equal(haversineKm(p, p), 0);
  });
  it("Amsterdam Dam to Rotterdam Erasmusbrug is ~58 km", () => {
    const dam = { latitude: 52.3731, longitude: 4.8928 };
    const erasmus = { latitude: 51.909167, longitude: 4.486667 };
    const d = haversineKm(dam, erasmus);
    assert.ok(d > 55 && d < 62, `got ${d}`);
  });
  it("Cape Town to Johannesburg is ~1260 km", () => {
    const ct = { latitude: -33.925, longitude: 18.424 };
    const jb = { latitude: -26.204, longitude: 28.047 };
    const d = haversineKm(ct, jb);
    assert.ok(d > 1250 && d < 1285, `got ${d}`);
  });
  it("is symmetric", () => {
    const a = { latitude: -33.96218, longitude: 18.409883 };
    const b = { latitude: 52.3731, longitude: 4.8928 };
    assert.ok(Math.abs(haversineKm(a, b) - haversineKm(b, a)) < 1e-9);
  });
});

describe("detectCountry", () => {
  it("classifies launch cities", () => {
    assert.equal(detectCountry({ latitude: -33.96218, longitude: 18.409883 }), "ZA");
    assert.equal(detectCountry({ latitude: 52.3731, longitude: 4.8928 }), "NL");
    assert.equal(detectCountry({ latitude: 40.4, longitude: -3.7 }), null);
  });
  it("does not treat Lesotho or Eswatini interiors as South Africa", () => {
    assert.equal(detectCountry({ latitude: -29.31, longitude: 27.72 }), null); // Lesotho interior
    assert.equal(detectCountry({ latitude: -26.5, longitude: 31.5 }), null); // Eswatini interior
    assert.equal(detectCountry({ latitude: -26.2, longitude: 28.05 }), "ZA"); // Johannesburg
  });
});

describe("geodesicPoints", () => {
  it("includes endpoints and a mid sample", () => {
    const a = { latitude: 52.37, longitude: 4.89 };
    const b = { latitude: 51.91, longitude: 4.49 };
    const pts = geodesicPoints(a, b, 8);
    assert.equal(pts.length, 9);
    assert.equal(pts[0].latitude, a.latitude);
    assert.ok(Math.abs(pts.at(-1)!.latitude - b.latitude) < 1e-6);
  });
});

describe("formatDistance", () => {
  it("renders a dash for missing pins", () => {
    assert.equal(formatDistance(Number.POSITIVE_INFINITY), "—");
    assert.equal(formatDistance(Number.NaN), "—");
  });
});
