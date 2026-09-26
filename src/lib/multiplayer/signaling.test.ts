import assert from "node:assert/strict";
import { test } from "node:test";
import { handleSignaling } from "./signaling.server.ts";
import { createLobbyState, reduce, toPublicSnapshot } from "../game/machine.ts";
import { mergeHostSnapshot } from "./sync.ts";

const poll = async (room: string, peer: string, since = 0) => {
  const response = await handleSignaling(
    new Request(`http://localhost/api/rtc?room=${room}&peer=${peer}&since=${since}`),
  );
  assert.equal(response.status, 200);
  return response.json();
};
const post = async (body: object) => {
  const response = await handleSignaling(
    new Request("http://localhost/api/rtc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  assert.equal(response.status, 200);
};

test("two invite-only players elect one host and exchange a playable match without router state", async () => {
  const room = `test-${crypto.randomUUID()}`;
  const [a, b] = await Promise.all([poll(room, "a"), poll(room, "b")]);
  assert.equal(a.hostId, b.hostId);
  const host = a.hostId;
  const guest = host === "a" ? "b" : "a";
  let state = reduce(createLobbyState(), {
    type: "CREATE_DUEL",
    playerId: host,
    name: "Host",
    roomCode: room,
    seed: 9,
    now: 1,
  });
  await post({
    op: "mail",
    room,
    from: guest,
    to: host,
    payload: { t: "hello", peerId: guest, name: "Guest" },
  });
  const hello = (await poll(room, host)).mail[0].payload;
  state = reduce(state, { type: "PLAYER_JOIN", playerId: hello.peerId, name: hello.name, now: 2 });
  assert.equal(state.players.length, 2);
  state = reduce(state, { type: "START_MATCH", now: 3 });
  state = reduce(state, { type: "INTRO_DONE", now: 4 });
  await post({
    op: "mail",
    room,
    from: host,
    to: guest,
    payload: { t: "snapshot", state: toPublicSnapshot(state), sentAt: 4 },
  });
  const snapshot = (await poll(room, guest)).mail[0].payload.state;
  const guestState = mergeHostSnapshot(createLobbyState(), snapshot, guest);
  assert.equal(guestState.phase, "round_active");
  assert.equal(guestState.hostId, host);
  assert.equal(guestState.players.length, 2);
});

test("refresh keeps host ownership while a guest polls between leave and rejoin", async () => {
  const room = `test-${crypto.randomUUID()}`;
  await poll(room, "host");
  await post({ op: "leave", room, peer: "host" });
  assert.equal((await poll(room, "guest")).hostId, "host");
  assert.equal((await poll(room, "host")).hostId, "host");
});

test("guest polling cannot keep an abandoned host lease alive forever", async (t) => {
  const room = `test-${crypto.randomUUID()}`;
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  await poll(room, "old-host");
  now += 119_000;
  assert.equal((await poll(room, "guest")).hostId, "old-host");
  now += 1_001;
  assert.equal((await poll(room, "guest")).hostId, "guest");
  assert.equal((await poll(room, "old-host")).hostId, "guest");
});

test("active hosts retain their lease across many refresh windows", async (t) => {
  const room = `test-${crypto.randomUUID()}`;
  let now = 2_000_000;
  t.mock.method(Date, "now", () => now);
  for (let i = 0; i < 5; i++) {
    assert.equal((await poll(room, "host")).hostId, "host");
    now += 60_000;
    assert.equal((await poll(room, "guest")).hostId, "host");
  }
});
