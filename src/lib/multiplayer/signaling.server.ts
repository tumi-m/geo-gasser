import { z } from "zod";
import type { PeerRow, RtcPollResponse, SignalRow } from "./p2p";

const ID = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const signalSchema = z.object({
  op: z.literal("signal"),
  room: ID,
  from: ID,
  to: ID,
  kind: z.enum(["offer", "answer", "ice"]),
  payload: z.unknown().refine((v) => v !== undefined && JSON.stringify(v).length <= 32_768, {
    message: "payload too large",
  }),
});
const leaveSchema = z.object({ op: z.literal("leave"), room: ID, peer: ID });
const mailSchema = z.object({
  op: z.literal("mail"),
  room: ID,
  from: ID,
  to: z.string().regex(/^[a-zA-Z0-9_*-]{1,64}$/),
  payload: z.unknown().refine((v) => v !== undefined && JSON.stringify(v).length <= 256_000, {
    message: "payload too large",
  }),
});
const postSchema = z.discriminatedUnion("op", [signalSchema, leaveSchema, mailSchema]);

const PEER_TTL_MS = 30_000;
const SIGNAL_TTL_MS = 60_000;

type MemPeer = { room: string; id: string; name: string; lastSeen: number };
type MemSignal = { id: number; room: string; to: string; from: string; kind: SignalRow["kind"] | "mail"; payload: unknown; createdAt: number };

const mem = globalThis as typeof globalThis & {
  __atlasRtc__?: { peers: Map<string, MemPeer>; signals: MemSignal[]; seq: number };
};
function store() {
  mem.__atlasRtc__ ??= { peers: new Map(), signals: [], seq: 1 };
  return mem.__atlasRtc__;
}

function pruneMem() {
  const s = store();
  const now = Date.now();
  for (const [k, p] of s.peers) if (now - p.lastSeen > PEER_TTL_MS) s.peers.delete(k);
  s.signals = s.signals.filter((sig) => now - sig.createdAt < SIGNAL_TTL_MS);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function useSql(): boolean {
  return Boolean(typeof process !== "undefined" && process.env.DATABASE_URL?.trim());
}

async function handleGet(url: URL): Promise<Response> {
  const parsed = z
    .object({
      room: ID,
      peer: ID,
      name: z.string().max(64).default(""),
      since: z.coerce.number().int().min(0).default(0),
    })
    .safeParse({
      room: url.searchParams.get("room"),
      peer: url.searchParams.get("peer"),
      name: url.searchParams.get("name") ?? "",
      since: url.searchParams.get("since") ?? 0,
    });
  if (!parsed.success) return json({ error: "invalid query" }, 400);
  const { room, peer, name, since } = parsed.data;

  if (useSql()) return sqlGet(room, peer, name, since);

  pruneMem();
  const s = store();
  s.peers.set(`${room}:${peer}`, { room, id: peer, name, lastSeen: Date.now() });
  const peers: PeerRow[] = [...s.peers.values()]
    .filter((p) => p.room === room)
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 32)
    .map((p) => ({ id: p.id, name: p.name }));
  // One ordered page for both channels: separate limits can skip older mail.
  const page = s.signals.filter(sig => sig.room === room && sig.id > since && sig.from !== peer &&
    (sig.to === peer || sig.kind === "mail" && sig.to === "*")).slice(0,200);
  const signals = page.filter(sig=>sig.kind !== "mail").map(sig=>({id:sig.id,from:sig.from,kind:sig.kind as SignalRow["kind"],payload:sig.payload}));
  const mail = page.filter(sig=>sig.kind === "mail").map(sig=>({id:sig.id,from:sig.from,payload:sig.payload}));
  const body: RtcPollResponse = { peers, signals, mail };
  return json(body);
}

async function handlePost(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid request" }, 400);
  const msg = parsed.data;
  if (useSql()) return sqlPost(msg);

  pruneMem();
  const s = store();
  if (msg.op === "signal") {
    s.signals.push({
      id: s.seq++,
      room: msg.room,
      to: msg.to,
      from: msg.from,
      kind: msg.kind,
      payload: msg.payload,
      createdAt: Date.now(),
    });
  } else if (msg.op === "mail") {
    s.signals.push({
      id: s.seq++,
      room: msg.room,
      to: msg.to,
      from: msg.from,
      kind: "mail",
      payload: msg.payload,
      createdAt: Date.now(),
    });
  } else {
    s.peers.delete(`${msg.room}:${msg.peer}`);
  }
  return json({ ok: true });
}

let tableSetup: Promise<void> | undefined;
function ensureTables(sql: import("../db").Sql): Promise<void> {
  tableSetup ??= (async () => {
  await sql.query(
    `CREATE TABLE IF NOT EXISTS webrtc_peers (
       room TEXT NOT NULL, peer_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
       last_seen TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (room, peer_id))`,
  );
  await sql.query(
    `CREATE TABLE IF NOT EXISTS webrtc_signals (
       id BIGSERIAL PRIMARY KEY, room TEXT NOT NULL, to_peer TEXT NOT NULL,
       from_peer TEXT NOT NULL, kind TEXT NOT NULL, payload JSONB NOT NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  );
  await sql.query(`CREATE INDEX IF NOT EXISTS webrtc_signals_delivery ON webrtc_signals (room, id)`);
  })().catch(error => {tableSetup=undefined; throw error;});
  return tableSetup;
}

async function sqlGet(room: string, peer: string, name: string, since: number): Promise<Response> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await ensureTables(sql);
  await sql.query(
    `INSERT INTO webrtc_peers (room, peer_id, name, last_seen) VALUES ($1,$2,$3,now())
     ON CONFLICT (room, peer_id) DO UPDATE SET last_seen = now(), name = EXCLUDED.name`,
    [room, peer, name],
  );
  const rows = await sql.query<{ id: number; from_peer: string; kind: string; payload: unknown }>(
    `SELECT id, from_peer, kind, payload FROM webrtc_signals
     WHERE room = $1 AND (to_peer = $2 OR (kind = 'mail' AND to_peer = '*')) AND from_peer <> $2 AND created_at > now() - interval '60 seconds' AND id > $3 ORDER BY id LIMIT 200`,
    [room, peer, since],
  );
  const roster = await sql.query<{ peer_id: string; name: string }>(
    `SELECT peer_id, name FROM webrtc_peers
     WHERE room = $1 AND last_seen > now() - make_interval(secs => 30)
     ORDER BY peer_id LIMIT 32`,
    [room],
  );
  const body: RtcPollResponse = {
    peers: roster.map((r) => ({ id: r.peer_id, name: r.name })),
    signals: rows
      .filter((r) => r.kind === "offer" || r.kind === "answer" || r.kind === "ice")
      .map((r) => ({ id: r.id, from: r.from_peer, kind: r.kind as SignalRow["kind"], payload: r.payload })),
    mail: rows
      .filter((r) => r.kind === "mail" && r.from_peer !== peer)
      .map((r) => ({ id: r.id, from: r.from_peer, payload: r.payload })),
  };
  return json(body);
}

async function sqlPost(
  msg:
    | z.infer<typeof signalSchema>
    | z.infer<typeof leaveSchema>
    | z.infer<typeof mailSchema>,
): Promise<Response> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await ensureTables(sql);
  // Bound transient signaling storage. Never keep game payloads indefinitely.
  await sql.query(`DELETE FROM webrtc_signals WHERE created_at < now() - interval '2 minutes'`);
  await sql.query(`DELETE FROM webrtc_peers WHERE last_seen < now() - interval '2 minutes'`);
  if (msg.op === "signal") {
    await sql.query(
      `INSERT INTO webrtc_signals (room, to_peer, from_peer, kind, payload) VALUES ($1,$2,$3,$4,$5)`,
      [msg.room, msg.to, msg.from, msg.kind, JSON.stringify(msg.payload)],
    );
  } else if (msg.op === "mail") {
    await sql.query(
      `INSERT INTO webrtc_signals (room, to_peer, from_peer, kind, payload) VALUES ($1,$2,$3,$4,$5)`,
      [msg.room, msg.to, msg.from, "mail", JSON.stringify(msg.payload)],
    );
  } else {
    await sql.query(`DELETE FROM webrtc_peers WHERE room = $1 AND peer_id = $2`, [msg.room, msg.peer]);
  }
  return json({ ok: true });
}

export async function handleSignaling(request: Request): Promise<Response> {
  try {
    if (request.method === "GET") return await handleGet(new URL(request.url));
    if (request.method === "POST") return await handlePost(request);
    return json({ error: "method not allowed" }, 405);
  } catch (error) {
    console.error("[rtc] signaling error:", error);
    return json({ error: "signaling failed" }, 500);
  }
}
