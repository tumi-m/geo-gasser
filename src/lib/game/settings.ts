const KEY = "atlas-duel-settings-v1";

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
};

export function loadSettings(): GameSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const prefers = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      return { ...DEFAULT_SETTINGS, reducedMotion: !!prefers, cameraShake: !prefers };
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: GameSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(settings));
}
