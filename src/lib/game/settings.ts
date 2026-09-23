import { DEFAULT_ATLAS, sanitizeAtlas, type AtlasSpec } from "./atlas.ts";
import {
  isMatchLengthId,
  isTimeDifficulty,
  type MatchLengthId,
  type TimeDifficulty,
} from "./timer.ts";

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
  photoFit: "cover" | "contain";
  showHints: boolean;
  difficulty: TimeDifficulty;
  matchLength: MatchLengthId;
  atlas: AtlasSpec;
  /** The first-play "what should we call you?" prompt has been answered or skipped. */
  namePrompted: boolean;
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
  photoFit: "contain",
  showHints: true,
  difficulty: "medium",
  matchLength: "escape",
  atlas: DEFAULT_ATLAS,
  namePrompted: false,
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
      photoFit: parsed.photoFit === "cover" ? "cover" : "contain",
      showHints: typeof parsed.showHints === "boolean" ? parsed.showHints : true,
      difficulty: isTimeDifficulty(parsed.difficulty)
        ? parsed.difficulty
        : DEFAULT_SETTINGS.difficulty,
      matchLength: isMatchLengthId(parsed.matchLength)
        ? parsed.matchLength
        : DEFAULT_SETTINGS.matchLength,
      atlas: sanitizeAtlas(parsed.atlas),
      namePrompted:
        parsed.namePrompted === true ||
        (typeof parsed.displayName === "string" && parsed.displayName !== DEFAULT_SETTINGS.displayName),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: GameSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* Private browsing can disable storage. */
  }
}
