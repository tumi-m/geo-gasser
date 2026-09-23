const KEY = "atlas-duel-recent-v1";

/**
 * How many played sites are remembered, newest first. Larger than the whole
 * pool, so the dealer can work through every site before any repeats and then
 * start again from the ones seen longest ago.
 */
export const RECENT_LIMIT = 400;

/** Newest first, de-duplicated, capped. Pure, so it can be tested. */
export function mergeRecentIds(ids: readonly string[], previous: readonly string[]): string[] {
  return [...new Set([...ids, ...previous])].slice(0, RECENT_LIMIT);
}

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

/** Call as each site is shown, so a match left halfway still counts. */
export function rememberRecentIds(ids: string[]): void {
  if (typeof window === "undefined" || ids.length === 0) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(mergeRecentIds(ids, loadRecentIds())));
  } catch {
    /* storage full or blocked — recents are best effort */
  }
}
