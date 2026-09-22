import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchSocketUrl, queueCommand } from "./transport.ts";
import type { ClientMessage } from "./wire.ts";

const identity = { playerId: "p-1", name: "Traveler" };

describe("match socket url", () => {
  it("upgrades http origins to the matching websocket scheme", () => {
    assert.match(matchSocketUrl("https://match.example.dev", "abc123", identity), /^wss:/);
    assert.match(matchSocketUrl("http://127.0.0.1:8787", "abc123", identity), /^ws:/);
  });

  it("keeps a websocket origin at its own security level", () => {
    // Mapping wss: to ws: hands the browser a mixed-content URL it refuses to
    // open from an HTTPS page, and online play never connects.
    assert.match(matchSocketUrl("wss://match.example.dev", "abc123", identity), /^wss:/);
    assert.match(matchSocketUrl("ws://127.0.0.1:8787", "abc123", identity), /^ws:/);
  });

  it("uppercases the room, trims trailing slashes and carries the identity", () => {
    const url = new URL(
      matchSocketUrl("https://match.example.dev//", "abc123", {
        playerId: "p-1",
        name: "Traveler",
        avatarId: "grok",
        difficulty: "hard",
        matchLength: "escape",
        atlas: { preset: "za", nations: ["ZA"] },
      }),
    );
    assert.equal(url.pathname, "/room/ABC123");
    assert.equal(url.searchParams.get("playerId"), "p-1");
    assert.equal(url.searchParams.get("avatarId"), "grok");
    assert.equal(url.searchParams.get("difficulty"), "hard");
    assert.equal(url.searchParams.get("matchLength"), "escape");
    assert.equal(url.searchParams.get("atlas"), '{"preset":"za","nations":["ZA"]}');
  });

  it("omits identity fields that were not set", () => {
    const url = new URL(matchSocketUrl("https://match.example.dev", "abc123", identity));
    assert.equal(url.searchParams.get("avatarId"), null);
    assert.equal(url.searchParams.get("atlas"), null);
  });
});

describe("reconnect outbox", () => {
  const lock = (questionIndex: number): ClientMessage => ({
    t: "lock",
    lat: 1,
    lng: 2,
    questionIndex,
  });

  it("holds the commands a dropped socket could not carry", () => {
    let outbox: ClientMessage[] = [];
    outbox = queueCommand(outbox, { t: "pin", lat: 1, lng: 2, questionIndex: 0 });
    outbox = queueCommand(outbox, lock(0));
    assert.deepEqual(
      outbox.map((m) => m.t),
      ["pin", "lock"],
    );
  });

  it("keeps only the newest of a kind, in the order the kinds were issued", () => {
    let outbox: ClientMessage[] = [];
    outbox = queueCommand(outbox, lock(0));
    outbox = queueCommand(outbox, { t: "pin", lat: 3, lng: 4, questionIndex: 1 });
    outbox = queueCommand(outbox, lock(1));
    assert.deepEqual(outbox, [
      { t: "pin", lat: 3, lng: 4, questionIndex: 1 },
      lock(1),
    ]);
  });

  it("never queues a heartbeat or an identity announcement", () => {
    let outbox: ClientMessage[] = [];
    outbox = queueCommand(outbox, { t: "ping" });
    outbox = queueCommand(outbox, { t: "hello", name: "Traveler" });
    assert.deepEqual(outbox, []);
  });
});
