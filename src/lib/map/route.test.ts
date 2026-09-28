import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hopPath, landPath, routeAspect, routeFrame } from "./route.ts";

const cape = { latitude: -33.92, longitude: 18.42 };
const amsterdam = { latitude: 52.37, longitude: 4.9 };

describe("expedition route geometry", () => {
  it("frames every stop inside the box with room to spare", () => {
    const frame = routeFrame([cape, amsterdam], 320, 180);
    for (const p of [cape, amsterdam]) {
      const [x, y] = frame.project(p.longitude, p.latitude);
      assert.ok(x > 16 && x < 304, `x ${x}`);
      assert.ok(y > 8 && y < 172, `y ${y}`);
    }
  });

  it("keeps one city from zooming to street level", () => {
    const frame = routeFrame([amsterdam], 320, 180);
    const [w, s, e, n] = frame.bounds;
    assert.ok(n - s >= 14 && e - w >= 14);
  });

  it("draws land in view and skips land outside it", () => {
    const frame = routeFrame([amsterdam], 320, 180);
    const square = (lng: number, lat: number) => ({
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [lng, lat],
            [lng + 1, lat],
            [lng + 1, lat + 1],
            [lng, lat + 1],
            [lng, lat],
          ],
        ],
      },
    });
    assert.match(landPath([square(5, 52)], frame), /^M[\d.-]+ [\d.-]+L/);
    assert.equal(landPath([square(140, -30)], frame), "");
  });

  it("breaks rings at the date line instead of streaking across", () => {
    const frame = routeFrame([{ latitude: -17, longitude: 178 }], 320, 180, 60);
    const fiji = {
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [179, -16],
            [-179.9, -16],
            [-179.9, -17],
            [179, -17],
            [179, -16],
          ],
        ],
      },
    };
    const d = landPath([fiji], frame);
    assert.equal((d.match(/M/g) ?? []).length, 3);
  });

  it("shapes the box to the route", () => {
    assert.equal(routeAspect([cape, amsterdam]), 1.2);
    assert.equal(routeAspect([amsterdam, { latitude: 35.68, longitude: 139.77 }]), 2.2);
    assert.equal(routeAspect([amsterdam]), 2.2);
  });

  it("bows hops into a curve", () => {
    assert.match(hopPath([0, 100], [100, 100]), /^M0\.0 100\.0Q50\.0 82\.0 100\.0 100\.0$/);
  });
});
