import assert from "node:assert/strict";
import { test } from "node:test";
import { databaseConnectionUrl, requiresSharedRoomStorage } from "../database-config.ts";

test("shared storage supports Vercel's Postgres alias with explicit DATABASE_URL taking priority", () => {
  assert.equal(
    databaseConnectionUrl({ DATABASE_URL: "  ", POSTGRES_URL: " postgres://example/app " }),
    "postgres://example/app",
  );
  assert.equal(
    databaseConnectionUrl({
      DATABASE_URL: "postgres://primary/app",
      POSTGRES_URL: "postgres://fallback/app",
    }),
    "postgres://primary/app",
  );
  assert.equal(requiresSharedRoomStorage({ VERCEL: "1" }), true);
  assert.equal(
    requiresSharedRoomStorage({ VERCEL: "1", POSTGRES_URL: "postgres://example/app" }),
    false,
  );
  assert.equal(requiresSharedRoomStorage({}), false);
});
