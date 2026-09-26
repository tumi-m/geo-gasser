/** Vercel Postgres integrations can expose POSTGRES_URL instead of DATABASE_URL. */
export function databaseConnectionUrl(env: Record<string, string | undefined>): string | undefined {
  return env.DATABASE_URL?.trim() || env.POSTGRES_URL?.trim() || undefined;
}

export function requiresSharedRoomStorage(env: Record<string, string | undefined>): boolean {
  return env.VERCEL === "1" && !databaseConnectionUrl(env);
}
