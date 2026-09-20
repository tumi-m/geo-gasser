import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyRoomCommand, roundDeadlineMs, type RoomCommand } from "./room.ts";
import { createLobbyState, reduce } from "../game/machine.ts";

const now = 5_000_000;

function hostRoom() {
  return reduce(createLobbyState(), {
    type: "CREATE_DUEL",
    playerId: "host",
    name: "Host",
    roomCode: "ABC123",
    seed: 77,
    now,
  });
}

function cmd(partial: Partial<RoomCommand> & Pick<RoomCommand, "t">): RoomCommand {
  return { playerId: "p", now, ...partial } as RoomCommand;
}

describe("server-authoritative room", () => {
  it("bootstraps a fresh room from the first join", () => {
    let s = createLobbyState();
    s = applyRoomCommand(s, {
      t: "join",
      playerId: "creator",
      name: "Creator",
      roomCode: "ZZZ999",
      seed: 5,
      difficulty: "hard",
      matchLength: "standard",
      atlas: { preset: "za", nations: ["ZA"] },
      now,
    });
    assert.equal(s.phase, "waiting_for_players");
    assert.equal(s.mode, "duel");
    assert.equal(s.roomCode, "ZZZ999");
    assert.equal(s.hostId, "creator");
    assert.equal(s.durationSec, 30);
    assert.equal(s.players.length, 1);
  });

  it("starts the match as soon as the second player joins", () => {
    let s = hostRoom();
    assert.equal(s.phase, "waiting_for_players");
    s = applyRoomCommand(s, cmd({ t: "join", playerId: "guest", name: "Guest" }));
    assert.equal(s.phase, "round_intro");
    assert.equal(s.players.length, 2);
  });

  it("reveals only after both players lock, scoring from server time", () => {
    let s = hostRoom();
    s = applyRoomCommand(s, cmd({ t: "join", playerId: "guest", name: "Guest" }));
    s = applyRoomCommand(s, cmd({ t: "intro", playerId: "host" }));
    assert.equal(s.phase, "round_active");
    const truth = s.truth!;
    s = applyRoomCommand(s, cmd({ t: "lock", playerId: "host", guess: truth, now: now + 1_000 }));
    assert.equal(s.phase, "waiting_for_opponent");
    s = applyRoomCommand(s, cmd({ t: "lock", playerId: "guest", guess: truth, now: now + 2_000 }));
    assert.equal(s.phase, "round_reveal");
    assert.ok((s.players.find((p) => p.id === "host")?.roundScore?.roundScore ?? 0) > 9_000);
  });

  it("force-reveals on the alarm deadline and clears it afterwards", () => {
    let s = hostRoom();
    s = applyRoomCommand(s, cmd({ t: "join", playerId: "guest", name: "Guest" }));
    s = applyRoomCommand(s, cmd({ t: "intro", playerId: "host" }));
    const deadline = roundDeadlineMs(s);
    assert.equal(deadline, s.roundStartedAtMs! + s.durationSec * 1000);
    s = applyRoomCommand(s, cmd({ t: "timeout", now: deadline! }));
    assert.equal(s.phase, "round_expired");
    assert.equal(roundDeadlineMs(s), null);
    assert.equal(s.players.find((p) => p.id === "host")?.roundScore?.roundScore, 0);
  });

  it("ends the match when a player leaves mid-round", () => {
    let s = hostRoom();
    s = applyRoomCommand(s, cmd({ t: "join", playerId: "guest", name: "Guest" }));
    s = applyRoomCommand(s, cmd({ t: "intro", playerId: "host" }));
    s = applyRoomCommand(s, cmd({ t: "leave", playerId: "guest", now: now + 500 }));
    assert.equal(s.phase, "match_complete");
    assert.deepEqual(s.winnerIds, ["host"]);
  });

  it("rematch auto-starts when both players are still connected", () => {
    let s = hostRoom();
    s = applyRoomCommand(s, cmd({ t: "join", playerId: "guest", name: "Guest" }));
    s = applyRoomCommand(s, cmd({ t: "intro", playerId: "host" }));
    s = applyRoomCommand(s, cmd({ t: "timeout", now: now + 45_000 }));
    s = applyRoomCommand(s, cmd({ t: "rematch", playerId: "host", seed: 99 }));
    assert.equal(s.phase, "round_intro");
    assert.equal(s.seed, 99);
    assert.equal(s.roundHistory.length, 0);
  });

  it("ignores commands from players who are not in the room", () => {
    let s = hostRoom();
    s = applyRoomCommand(s, cmd({ t: "join", playerId: "guest", name: "Guest" }));
    const before = s;
    s = applyRoomCommand(s, cmd({ t: "lock", playerId: "stranger", guess: { latitude: 0, longitude: 0 } }));
    assert.equal(s.seq, before.seq);
  });
});
