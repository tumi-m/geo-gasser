import { z } from "zod";

/**
 * Which question a command was made for. The server drops it when the round
 * has already moved on, so a packet delayed by a slow link — or replayed from
 * the client's outbox after a reconnect — can never land on the next round.
 * Optional: a client that omits it is taken at its word, as before.
 */
const questionIndex = z.number().int().min(0).optional();

/** Client → match server. Coordinates are only ever the player's own pin. */
export const clientMessageSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("hello"),
    playerId: z.string().min(1).max(64).optional(),
    name: z.string().min(1).max(24),
    avatarId: z.string().max(24).optional(),
  }),
  z.object({ t: z.literal("start") }),
  z.object({ t: z.literal("intro"), questionIndex }),
  z.object({
    t: z.literal("pin"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    questionIndex,
  }),
  z.object({
    t: z.literal("lock"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    questionIndex,
  }),
  z.object({ t: z.literal("continue"), questionIndex }),
  z.object({ t: z.literal("rematch") }),
  z.object({ t: z.literal("ping") }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

/** Match server → client. The state payload is server-built, so it is trusted. */
export const serverMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("welcome"), selfId: z.string(), state: z.unknown(), sentAt: z.number().optional() }),
  z.object({ t: z.literal("snapshot"), state: z.unknown(), sentAt: z.number().optional() }),
  z.object({ t: z.literal("pong") }),
  z.object({ t: z.literal("error"), message: z.string() }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;

export function parseClientMessage(raw: unknown): ClientMessage | null {
  const parsed = clientMessageSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseServerMessage(raw: unknown): ServerMessage | null {
  const parsed = serverMessageSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
