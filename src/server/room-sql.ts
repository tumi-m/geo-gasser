import { databaseConnectionUrl } from "../lib/database-config.ts";

/** The slice of Postgres the room signaling needs: parameterised queries. */
export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

const OID_INT8 = 20;

let pending: Promise<Sql> | undefined;

/**
 * A pooled Postgres connection (DATABASE_URL or POSTGRES_URL), created on
 * first use. Only the online-duel signaling uses it, and only when a database
 * is configured; without one, rooms live in the server's memory.
 */
export function getSql(): Promise<Sql> {
  pending ??= (async () => {
    const url = databaseConnectionUrl(process.env);
    if (!url) throw new Error("No DATABASE_URL or POSTGRES_URL configured");
    const { default: pg } = await import("pg");
    pg.types.setTypeParser(OID_INT8, Number);
    const pool = new pg.Pool({ connectionString: url });
    return {
      async query<T>(text: string, params: unknown[] = []) {
        const res = await pool.query(text, params);
        return res.rows as T[];
      },
    };
  })().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
