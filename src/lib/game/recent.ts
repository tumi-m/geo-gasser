const KEY = "atlas-duel-recent-v1";

/** How many recently played sites the dealer tries to avoid. */
export const RECENT_LIMIT = 60;

export function loadRecentIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function rememberRecentIds(ids: string[]): void {
  if (typeof window === "undefined" || ids.length === 0) return;
  const next = [...new Set([...ids, ...loadRecentIds()])].slice(0, RECENT_LIMIT);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked — recents are best effort */
  }
}
