import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sceneOffset, sceneOverhang, type SceneFrame } from "./scene-transform.ts";

/** loc_103.jpg is 1600 x 3191; the desktop scene frame is about 1280 x 800. */
const tallPlate: SceneFrame = {
  naturalWidth: 1600,
  naturalHeight: 3191,
  boxWidth: 1280,
  boxHeight: 800,
  fit: "cover",
  zoom: 1,
};

/** Push the look direction far past any bound and see where it settles. */
const extreme = (frame: SceneFrame) => ({
  top: sceneOffset(frame, 0, 50),
  bottom: sceneOffset(frame, 0, -50),
  left: sceneOffset(frame, 50, 0),
  right: sceneOffset(frame, -50, 0),
});

describe("scene transform", () => {
  it("reaches the top and bottom of a tall plate", () => {
    // Regression: a fixed +/-0.7 pitch cap reached only 25% of this, so the
    // top and bottom of every portrait photo were unreachable.
    // 1600x3191 filled to a 1280-wide frame is 2553px tall: 876px of overhang.
    const { maxY } = sceneOverhang(tallPlate);
    assert.equal(Math.round(maxY), 876);
    const { top, bottom } = extreme(tallPlate);
    assert.equal(Math.round(top.y), Math.round(maxY));
    assert.equal(Math.round(bottom.y), -Math.round(maxY));
  });

  it("bounds both axes by the plate's own overhang, never past the edge", () => {
    const wide: SceneFrame = { ...tallPlate, naturalWidth: 4000, naturalHeight: 1000 };
    const { maxX, maxY } = sceneOverhang(wide);
    const { left, right, top } = extreme(wide);
    assert.equal(Math.round(left.x), Math.round(maxX));
    assert.equal(Math.round(right.x), -Math.round(maxX));
    assert.ok(Math.abs(top.y) <= maxY + 0.5);
  });

  it("pins a plate that does not overhang, so it cannot drift", () => {
    // `contain` at zoom 1 always fits, so there is nothing to look around.
    const fitted: SceneFrame = { ...tallPlate, fit: "contain" };
    assert.deepEqual(sceneOverhang(fitted), { maxX: 0, maxY: 0 });
    const { top, left } = extreme(fitted);
    assert.deepEqual([top.x, top.y, left.x, left.y], [0, 0, 0, 0]);
  });

  it("renormalises the look direction so holding a drag cannot run away", () => {
    const held = sceneOffset(tallPlate, 0, 999);
    // The returned pitch must map back to the same bounded offset.
    const again = sceneOffset(tallPlate, held.yaw, held.pitch);
    assert.equal(Math.round(again.y), Math.round(held.y));
    assert.ok(Math.abs(held.pitch) < 999);
  });

  it("opens up more of the plate as the player zooms in", () => {
    const out = sceneOverhang({ ...tallPlate, fit: "contain", zoom: 1 });
    const inn = sceneOverhang({ ...tallPlate, fit: "contain", zoom: 2.8 });
    assert.equal(out.maxY, 0);
    assert.ok(inn.maxY > 0, "zooming past fit should create something to pan over");
  });

  it("survives a frame with no measured image yet", () => {
    const empty: SceneFrame = { ...tallPlate, naturalWidth: 0, naturalHeight: 0 };
    const { x, y } = sceneOffset(empty, 1, 1);
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
  });
});
