import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectPairs } from "../../../scripts/build-hires-manifest.mjs";
import { HIRES_PLATES } from "./hires-plates.ts";
import { responsiveSceneSrcSet, sceneCandidates, wikiTitleFrom } from "./scene.ts";

describe("scene", () => {
  it("prefers the local plate then the stored remote url", () => {
    assert.deepEqual(sceneCandidates({ id: "loc_71", sceneUrl: "https://example.com/a.jpg" }), [
      "/locations/loc_71.jpg",
      "https://example.com/a.jpg",
    ]);
  });
  it("keeps generated reconstructions on the generated path", () => {
    assert.deepEqual(sceneCandidates({ id: "loc_31", sceneUrl: "/generated/round4-cape.jpg" }), [
      "/generated/round4-cape.jpg",
    ]);
  });
  it("reads a Wikipedia title from the source url", () => {
    assert.equal(wikiTitleFrom("https://en.wikipedia.org/wiki/Bo-Kaap"), "Bo-Kaap");
    assert.equal(wikiTitleFrom("https://en.wikipedia.org/wiki/V%26A_Waterfront"), "V&A Waterfront");
  });
});

describe("hires plates", () => {
  it("offers both widths for a plate that ships a hires companion", () => {
    assert.equal(
      responsiveSceneSrcSet("/locations/loc_02.jpg"),
      "/locations/loc_02.jpg 1280w, /locations/hires/loc_02.jpg 5844w",
    );
  });

  it("offers nothing for a plate without one, or for a remote url", () => {
    assert.equal(responsiveSceneSrcSet("/locations/loc_01.jpg"), undefined);
    assert.equal(responsiveSceneSrcSet("https://example.com/locations/loc_02.jpg"), undefined);
    assert.equal(responsiveSceneSrcSet("/generated/round4-cape.jpg"), undefined);
  });

  it("stays in sync with public/locations/hires", () => {
    // Regenerate with `node scripts/build-hires-manifest.mjs` when this fails.
    const onDisk = Object.fromEntries(
      collectPairs().map((p) => [p.id, { base: p.base, hires: p.wide }]),
    );
    assert.deepEqual(HIRES_PLATES, onDisk);
  });
});
