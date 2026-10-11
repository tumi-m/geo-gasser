import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, isThemeId, loadSettings } from "./settings.ts";

/** Runs `fn` with a stand-in browser holding `stored` in localStorage. */
function withStorage(stored: Record<string, string>, fn: () => void) {
  const g = globalThis as unknown as { window?: unknown; localStorage?: unknown };
  const before = { window: g.window, localStorage: g.localStorage };
  g.localStorage = { getItem: (key: string) => stored[key] ?? null, setItem: () => {} };
  g.window = { matchMedia: () => ({ matches: false }) };
  try {
    fn();
  } finally {
    g.window = before.window;
    g.localStorage = before.localStorage;
  }
}

const KEY = "atlas-duel-settings-v3";

test("Classic is the default look", () => {
  assert.equal(DEFAULT_SETTINGS.theme, "classic");
  withStorage({}, () => assert.equal(loadSettings().theme, "classic"));
});

test("a saved Mono choice is kept", () => {
  withStorage({ [KEY]: JSON.stringify({ theme: "mono" }) }, () => {
    assert.equal(loadSettings().theme, "mono");
  });
});

test("saves from before themes, or with an unknown look, open in Classic", () => {
  withStorage({ [KEY]: JSON.stringify({ displayName: "Tumz" }) }, () => {
    assert.equal(loadSettings().theme, "classic");
  });
  withStorage({ [KEY]: JSON.stringify({ theme: "neon" }) }, () => {
    assert.equal(loadSettings().theme, "classic");
  });
});

test("isThemeId knows exactly the two looks", () => {
  assert.ok(isThemeId("classic"));
  assert.ok(isThemeId("mono"));
  assert.ok(!isThemeId("dark"));
  assert.ok(!isThemeId(undefined));
});
