import { DEFAULT_ATLAS, sanitizeAtlas, type AtlasSpec } from "./atlas.ts";
import { isMatchLengthId, isTimeDifficulty, type MatchLengthId, type TimeDifficulty } from "./timer.ts";

const KEY = "atlas-duel-settings-v3";

export interface GameSettings {
  displayName: string;
  avatarId: string;
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  reducedMotion: boolean;
  cameraShake: boolean;
  highContrast: boolean;
  difficulty: TimeDifficulty;
  matchLength: MatchLengthId;
  atlas: AtlasSpec;
}

export const DEFAULT_SETTINGS: GameSettings = {
  displayName: "Traveler",
  avatarId: "atlas",
  master: 0.8,
  music: 0.35,
  sfx: 0.8,
  muted: false,
  reducedMotion: false,
  cameraShake: true,
  highContrast: false,
  difficulty: "medium",
  matchLength: "standard",
  atlas: DEFAULT_ATLAS,
};

export function loadSettings(): GameSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw =
      localStorage.getItem(KEY) ??
      localStorage.getItem("atlas-duel-settings-v2") ??
      localStorage.getItem("atlas-duel-settings-v1");
    if (!raw) {
      const prefers = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      return { ...DEFAULT_SETTINGS, reducedMotion: !!prefers, cameraShake: !prefers };
    }
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      difficulty: isTimeDifficulty(parsed.difficulty) ? parsed.difficulty : DEFAULT_SETTINGS.difficulty,
      matchLength: isMatchLengthId(parsed.matchLength) ? parsed.matchLength : DEFAULT_SETTINGS.matchLength,
      atlas: sanitizeAtlas(parsed.atlas),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: GameSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(settings));
}
