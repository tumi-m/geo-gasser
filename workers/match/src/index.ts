import { DurableObject } from "cloudflare:workers";
import { sanitizeAtlas, type AtlasSpec } from "../../../src/lib/game/atlas.ts";
import { createLobbyState } from "../../../src/lib/game/machine.ts";
import type { MatchLengthId, TimeDifficulty } from "../../../src/lib/game/timer.ts";
import type { MatchState } from "../../../src/lib/game/types.ts";
import {
  applyRoomCommand,
  roomSnapshot,
  roundDeadlineMs,
  type RoomCommand,
} from "../../../src/lib/multiplayer/room.ts";
import { parseClientMessage, type ServerMessage } from "../../../src/lib/multiplayer/wire.ts";

interface Env {
  MATCH_ROOM: DurableObjectNamespace<MatchRoom>;
  ALLOWED_ORIGIN: string;
}

interface Attachment {
  playerId: string;
  name: string;
  avatarId?: string;
}

function serverMessage(msg: ServerMessage): string {
  return JSON.stringify(msg);
}

function parseDifficulty(raw: string | null): TimeDifficulty | undefined {
  return raw === "easy" || raw === "medium" || raw === "hard" ? raw : undefined;
}

function parseMatchLength(raw: string | null): MatchLengthId | undefined {
  return raw === "escape" || raw === "quick" || raw === "standard" || raw === "extended" || raw === "full" ? raw : undefined;
}

function parseAtlas(raw: string | null): AtlasSpec | undefined {
  if (!raw) return undefined;
  try {
    return sanitizeAtlas(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/**
 * One Durable Object per room. It owns the deck, the clock and the scores, so
 * a ranked match cannot be won by editing client state or reading the wire.
 */
export class MatchRoom extends DurableObject<Env> {
  private state: MatchState | null = null;

  private async hydrate(): Promise<MatchState> {
    if (this.state) return this.state;
    const stored = await this.ctx.storage.get<MatchState>("state");
    this.state = stored ?? createLobbyState();
    return this.state;
  }

  private async persist(next: MatchState): Promise<void> {
    this.state = next;
    await this.ctx.storage.put("state", next);
  }

  private broadcast(): void {
    if (!this.state) return;
    const payload = serverMessage({ t: "snapshot", state: roomSnapshot(this.state) });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Socket closed between the loop and the send; the close handler tidies up.
      }
    }
  }

  private async armAlarm(): Promise<void> {
    const deadline = this.state ? roundDeadlineMs(this.state) : null;
    if (deadline === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(deadline);
  }

  private async apply(command: RoomCommand): Promise<void> {
    const state = await this.hydrate();
    const next = applyRoomCommand(state, command);
    if (next === state) return;
    await this.persist(next);
    this.broadcast();
    await this.armAlarm();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      const state = await this.hydrate();
      return Response.json({
        ok: true,
        phase: state.phase,
        players: state.players.length,
        seq: state.seq,
      });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const playerId = url.searchParams.get("playerId")?.slice(0, 64) || crypto.randomUUID();
    const name = (url.searchParams.get("name") || "Traveler").slice(0, 24);
    const avatarId = url.searchParams.get("avatarId")?.slice(0, 24) || undefined;

    this.ctx.acceptWebSocket(server, [playerId]);
    server.serializeAttachment({ playerId, name, avatarId } satisfies Attachment);

    await this.apply({
      t: "join",
      playerId,
      name,
      avatarId,
      roomCode: url.pathname.split("/").pop() ?? "ROOM",
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
      difficulty: parseDifficulty(url.searchParams.get("difficulty")),
      matchLength: parseMatchLength(url.searchParams.get("matchLength")),
      atlas: parseAtlas(url.searchParams.get("atlas")),
      now: Date.now(),
    });
    const state = await this.hydrate();
    server.send(
      serverMessage({ t: "welcome", selfId: playerId, state: roomSnapshot(state) }),
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    let raw: unknown;
    try {
      raw = JSON.parse(message);
    } catch {
      return;
    }
    const msg = parseClientMessage(raw);
    if (!msg) {
      ws.send(serverMessage({ t: "error", message: "bad message" }));
      return;
    }
    const att = (ws.deserializeAttachment() as Attachment | null) ?? {
      playerId: "unknown",
      name: "?",
    };
    const now = Date.now();
    switch (msg.t) {
      case "hello":
        return;
      case "start":
        return this.apply({ t: "start", playerId: att.playerId, now });
      case "intro":
        return this.apply({ t: "intro", playerId: att.playerId, now });
      case "pin":
        return this.apply({
          t: "pin",
          playerId: att.playerId,
          guess: { latitude: msg.lat, longitude: msg.lng },
          now,
        });
      case "lock":
        return this.apply({
          t: "lock",
          playerId: att.playerId,
          guess: { latitude: msg.lat, longitude: msg.lng },
          now,
        });
      case "continue":
        return this.apply({ t: "continue", playerId: att.playerId, now });
      case "rematch":
        return this.apply({
          t: "rematch",
          playerId: att.playerId,
          seed: crypto.getRandomValues(new Uint32Array(1))[0],
          now,
        });
      case "ping":
        ws.send(serverMessage({ t: "pong" }));
        return;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;
    await this.apply({ t: "leave", playerId: att.playerId, now: Date.now() });
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  async alarm(): Promise<void> {
    const state = await this.hydrate();
    const deadline = roundDeadlineMs(state);
    if (deadline === null) return;
    const now = Date.now();
    if (now >= deadline) await this.apply({ t: "timeout", now });
    else await this.armAlarm();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true });

    const match = url.pathname.match(/^\/room\/([A-Za-z0-9]{4,12})$/);
    if (!match) return new Response("Not found", { status: 404 });

    const id = env.MATCH_ROOM.idFromName(match[1].toUpperCase());
    return env.MATCH_ROOM.get(id).fetch(request);
  },
} satisfies ExportedHandler<Env>;
