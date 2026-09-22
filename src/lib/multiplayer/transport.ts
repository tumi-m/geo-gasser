import type { ClientMessage } from "./wire.ts";

/**
 * Transport plumbing for the server-authoritative room, kept apart from the
 * React hook so both halves can be tested without a DOM.
 */

export interface MatchIdentity {
  playerId: string;
  name: string;
  avatarId?: string;
  difficulty?: string;
  matchLength?: string;
  atlas?: unknown;
}

/**
 * `VITE_MATCH_SERVER_URL` is documented as an `https://` origin, but `wss://`
 * is the other natural way to write a WebSocket endpoint — and mapping it to
 * `ws:` would hand the browser a mixed-content URL it refuses to open on an
 * HTTPS page. Each scheme keeps its own security level.
 */
const WS_SCHEME: Record<string, string> = {
  "https:": "wss:",
  "wss:": "wss:",
  "http:": "ws:",
  "ws:": "ws:",
};

/** The room socket URL for a configured match-server base. */
export function matchSocketUrl(base: string, room: string, identity: MatchIdentity): string {
  const url = new URL(`${base.replace(/\/+$/, "")}/room/${encodeURIComponent(room.toUpperCase())}`);
  // An unknown scheme is assumed secure: a downgrade is the failure that is
  // both silent and unfixable from the browser.
  url.protocol = WS_SCHEME[url.protocol] ?? "wss:";
  url.searchParams.set("playerId", identity.playerId);
  url.searchParams.set("name", identity.name);
  if (identity.avatarId) url.searchParams.set("avatarId", identity.avatarId);
  if (identity.difficulty) url.searchParams.set("difficulty", identity.difficulty);
  if (identity.matchLength) url.searchParams.set("matchLength", identity.matchLength);
  if (identity.atlas) {
    try {
      url.searchParams.set("atlas", JSON.stringify(identity.atlas));
    } catch {
      /* An unserialisable atlas just falls back to the room default. */
    }
  }
  return url.toString();
}

/**
 * Commands worth replaying once the socket comes back. `ping` is meaningless
 * on a replaced socket and `hello` identity rides the upgrade query string, so
 * neither is kept.
 */
const REPLAYABLE = new Set<ClientMessage["t"]>([
  "start",
  "intro",
  "pin",
  "lock",
  "continue",
  "rematch",
]);

/**
 * Hold a command the socket could not carry, so a reconnect does not silently
 * swallow a lock — the round would then expire and score zero. Bounded by
 * construction: at most one entry per replayable kind.
 *
 * Replay is safe because every scoped command names its question, and the
 * server drops the ones the round has moved past.
 */
export function queueCommand(outbox: ClientMessage[], msg: ClientMessage): ClientMessage[] {
  if (!REPLAYABLE.has(msg.t)) return outbox;
  // The newest of a kind supersedes the older one, but the order distinct
  // kinds were issued in still matters: a pin has to precede the lock on it.
  return [...outbox.filter((queued) => queued.t !== msg.t), msg];
}
