import { offsetKm } from "./geo.ts";
import { mulberry32 } from "./rng.ts";
import type { GeoLocation, LatLng } from "./types.ts";

export const GROK_BOT_ID = "grok-bot";
export const GROK_BOT_NAME = "Grok";

const ZA_SCALE = [18, 55, 140, 280, 620];
const NL_SCALE = [3.5, 9, 18, 36, 85];
const WORLD_SCALE = [40, 120, 350, 800, 1600];

/** Deterministic Grok guess: usually the right country, with skill that tracks difficulty. */
export function grokGuess(loc: GeoLocation, seed: number, roundIndex: number): LatLng {
  const rand = mulberry32(seed ^ ((roundIndex + 1) * 0x9e3779b9));
  const mixup = rand() < 0.1 + loc.difficulty * 0.02;
  if (mixup) {
    if (loc.country === "ZA") return offsetKm({ latitude: 52.09, longitude: 5.12 }, 8 + rand() * 70, rand() * 360);
    if (loc.country === "NL") return offsetKm({ latitude: -28.7, longitude: 24.8 }, 40 + rand() * 400, rand() * 360);
    return offsetKm({ latitude: 20 - rand() * 50, longitude: -40 + rand() * 160 }, 80 + rand() * 900, rand() * 360);
  }
  const table = loc.country === "NL" ? NL_SCALE : loc.country === "WORLD" ? WORLD_SCALE : ZA_SCALE;
  const base = table[Math.max(0, Math.min(4, loc.difficulty - 1))];
  const km = base * (0.35 + rand() * 1.5);
  return offsetKm(loc, km, rand() * 360);
}

export function grokThinkMs(difficulty: number, seed: number, roundIndex: number): number {
  const rand = mulberry32((seed + 17) ^ (roundIndex * 0x85ebca6b));
  const base = 4200 + difficulty * 1800;
  return Math.round(base + rand() * 9000);
}