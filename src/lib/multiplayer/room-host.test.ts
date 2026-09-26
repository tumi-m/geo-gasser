import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { CLAIM_HOST_SQL, HOST_TABLE_SQL } from "./room-host.ts";

test("Postgres host claim is atomic, preserves refresh ownership and recovers expired rooms", async () => {
  const db = new PGlite();
  try {
    await db.exec(HOST_TABLE_SQL);
    const claim = async (peer: string) => {
      const { rows } = await db.query<{ peer_id: string }>(CLAIM_HOST_SQL, ["ROOM26", peer]);
      return rows[0].peer_id;
    };
    const owners = await Promise.all([claim("a"), claim("b"), claim("c")]);
    assert.equal(new Set(owners).size, 1);
    const owner = owners[0];
    const guest = owner === "a" ? "b" : "a";
    assert.equal(await claim(guest), owner);
    assert.equal(await claim(owner), owner);
    await db.exec("UPDATE webrtc_room_hosts SET last_seen = now() - interval '121 seconds'");
    assert.equal(await claim(guest), guest);
    assert.equal(await claim(owner), guest);
    const rows = await db.query("SELECT * FROM webrtc_room_hosts");
    assert.equal(rows.rows.length, 1);
  } finally {
    await db.close();
  }
});
