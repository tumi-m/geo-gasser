import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AVATAR_COLOR_IDS,
  AVATAR_SHAPES,
  avatarIdFor,
  avatarParts,
  avatarSeed,
  DEFAULT_AVATAR,
  isAvatarId,
  sanitizeAvatar,
} from "./avatars.ts";

describe("avatars", () => {
  it("accepts every shape and colour combination, and fits the wire limit", () => {
    for (const s of AVATAR_SHAPES)
      for (const c of AVATAR_COLOR_IDS) {
        const id = avatarIdFor(s, c);
        assert.equal(isAvatarId(id), true, id);
        assert.ok(id.length <= 24, `${id} is longer than the 24-char wire field`);
      }
    assert.equal(AVATAR_SHAPES.length * AVATAR_COLOR_IDS.length, 96);
  });

  it("maps first-generation ids so stored settings and old peers still render", () => {
    assert.equal(sanitizeAvatar("atlas"), "circle-teal");
    assert.equal(sanitizeAvatar("canal"), "square-blue");
    assert.equal(sanitizeAvatar("grok"), "grok");
  });

  it("rejects anything else, falling back to the default", () => {
    for (const bad of [undefined, "", "hexagon", "hexagon-mauve", "blob-lime-x", "<svg>", "__proto__-red"])
      assert.equal(sanitizeAvatar(bad), DEFAULT_AVATAR, String(bad));
    assert.equal(isAvatarId("circle-constructor"), false);
  });

  it("draws Grok as its own ink hexagon", () => {
    assert.deepEqual(avatarParts("grok"), { shape: "hexagon", color: "ink", body: "#1d1d21", grok: true });
    assert.equal(avatarParts("drop-pink").shape, "drop");
  });

  it("gives each bot a stable rhythm seed in [0, 1]", () => {
    const a = avatarSeed("blob-lime:Tumi");
    assert.equal(a, avatarSeed("blob-lime:Tumi"));
    assert.notEqual(a, avatarSeed("blob-lime:Grok"));
    assert.ok(a >= 0 && a <= 1);
  });
});
