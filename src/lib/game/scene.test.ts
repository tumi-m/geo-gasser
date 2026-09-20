import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sceneCandidates, wikiTitleFrom } from "./scene.ts";

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
