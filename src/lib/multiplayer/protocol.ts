import type { MatchState, PublicSnapshot } from "@/lib/game";

export type WireMessage =
  | { t: "hello"; peerId: string; name: string; avatarId?: string }
  | { t: "snapshot"; state: PublicSnapshot }
  | { t: "event"; seq: number; payload: unknown }
  | { t: "lock"; lat: number; lng: number }
  | { t: "pin"; lat: number; lng: number }
  | { t: "ready" }
  | { t: "start" }
  | { t: "continue" }
  | { t: "rematch"; seed: number }
  | { t: "intro-done" }
  | { t: "reveal-done" }
  | { t: "handoff" };

export function isWireMessage(value: unknown): value is WireMessage {
  return !!value && typeof value === "object" && "t" in value && typeof (value as { t: unknown }).t === "string";
}

export function sanitizeName(raw: string): string {
  return raw.replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 24) || "Traveler";
}

export function makeRoomCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function isHost(selfId: string, state: MatchState | PublicSnapshot): boolean {
  return state.hostId === selfId;
}
