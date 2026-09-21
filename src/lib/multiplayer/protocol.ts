import type { MatchState, PublicSnapshot } from "../game/types.ts";

type Question = { roundStartedAtMs?: number; questionIndex: number };
export type WireMessage =
  | { t: "hello"; peerId: string; name: string; avatarId?: string }
  | { t: "snapshot"; state: PublicSnapshot; sentAt: number }
  | ({ t: "lock" | "pin"; lat: number; lng: number } & Question)
  | ({ t: "continue" | "intro-done" | "reveal-done" | "start" | "handoff" } & Question)
  | ({ t: "rematch"; nextSeed: number } & Question);

const phases = new Set(["lobby", "waiting_for_players", "match_starting", "round_intro", "round_active", "player_locked", "waiting_for_opponent", "round_expired", "round_reveal", "round_results", "next_round", "final_reveal", "match_complete", "rematch_pending"]);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function isWireMessage(value: unknown): value is WireMessage {
  if (!record(value)) return false;
  if (value.t === "hello") return typeof value.peerId === "string" && typeof value.name === "string" && value.name.length <= 64 && (value.avatarId === undefined || typeof value.avatarId === "string");
  if (value.t === "snapshot") {
    const s = value.state;
    return finite(value.sentAt) && record(s) && finite(s.seq) && Number.isInteger(s.seq) && s.seq >= 0 &&
      typeof s.hostId === "string" && (s.seed === undefined || finite(s.seed)) && finite(s.questionIndex) && finite(s.roundIndex) &&
      typeof s.phase === "string" && phases.has(s.phase) && finite(s.durationSec) && s.durationSec > 0 &&
      finite(s.totalQuestions) && Array.isArray(s.locationIds) && s.locationIds.length <= 100 && s.locationIds.every(id => typeof id === "string") &&
      Array.isArray(s.players) && s.players.length <= 2 && s.players.every(p => record(p) && typeof p.id === "string" && typeof p.name === "string" && finite(p.totalScore) && typeof p.locked === "boolean") &&
      Array.isArray(s.roundHistory) && Array.isArray(s.envIds) && Array.isArray(s.winnerIds) && record(s.atlas) && Array.isArray(s.atlas.nations);
  }
  if ((value.roundStartedAtMs !== undefined && !finite(value.roundStartedAtMs)) || !finite(value.questionIndex) || !Number.isInteger(value.questionIndex) || value.questionIndex < 0) return false;
  if (value.t === "pin" || value.t === "lock") return finite(value.lat) && Math.abs(value.lat) <= 90 && finite(value.lng) && Math.abs(value.lng) <= 180;
  if (value.t === "rematch") return finite(value.nextSeed) && Number.isInteger(value.nextSeed);
  return ["continue", "intro-done", "reveal-done", "start", "handoff"].includes(String(value.t));
}
export function sanitizeName(raw: string): string {
  return raw.replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 24) || "Traveler";
}
export function makeRoomCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const random = crypto.getRandomValues(new Uint8Array(6));
  return [...random].map(n => alphabet[n % alphabet.length]).join("");
}
export function isHost(selfId: string, state: MatchState | PublicSnapshot): boolean { return state.hostId === selfId; }
