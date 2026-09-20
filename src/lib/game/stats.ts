const KEY = "atlas-duel-stats-v1";

export interface PlayerStats {
  matchesPlayed: number;
  matchesWon: number;
  personalBest: number;
  streak: number;
  bestStreak: number;
  totalDistanceKm: number;
  totalGuesses: number;
  zaGuesses: number;
  zaCountryHits: number;
  nlGuesses: number;
  nlCountryHits: number;
  worldGuesses: number;
  worldCountryHits: number;
  fastestAccurateMs: number | null;
  closestKm: number | null;
}

export const EMPTY_STATS: PlayerStats = {
  matchesPlayed: 0,
  matchesWon: 0,
  personalBest: 0,
  streak: 0,
  bestStreak: 0,
  totalDistanceKm: 0,
  totalGuesses: 0,
  zaGuesses: 0,
  zaCountryHits: 0,
  nlGuesses: 0,
  nlCountryHits: 0,
  worldGuesses: 0,
  worldCountryHits: 0,
  fastestAccurateMs: null,
  closestKm: null,
};

export function loadStats(): PlayerStats {
  if (typeof window === "undefined") return EMPTY_STATS;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY_STATS, ...JSON.parse(raw) } : EMPTY_STATS;
  } catch {
    return EMPTY_STATS;
  }
}

export function saveStats(stats: PlayerStats) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(stats)); } catch { /* Keep playing when storage is unavailable. */ }
}

export function recordMatch(stats: PlayerStats, input: {
  score: number;
  won: boolean;
  distances: number[];
  countryHits: {
    ZA: { n: number; hits: number };
    NL: { n: number; hits: number };
    WORLD?: { n: number; hits: number };
  };
  fastestAccurateMs: number | null;
}): PlayerStats {
  const closest = input.distances.filter((d) => Number.isFinite(d));
  const next: PlayerStats = {
    ...stats,
    matchesPlayed: stats.matchesPlayed + 1,
    matchesWon: stats.matchesWon + (input.won ? 1 : 0),
    personalBest: Math.max(stats.personalBest, input.score),
    streak: input.won ? stats.streak + 1 : 0,
    bestStreak: input.won ? Math.max(stats.bestStreak, stats.streak + 1) : stats.bestStreak,
    totalDistanceKm: stats.totalDistanceKm + closest.reduce((a, b) => a + b, 0),
    totalGuesses: stats.totalGuesses + input.distances.length,
    zaGuesses: stats.zaGuesses + input.countryHits.ZA.n,
    zaCountryHits: stats.zaCountryHits + input.countryHits.ZA.hits,
    nlGuesses: stats.nlGuesses + input.countryHits.NL.n,
    nlCountryHits: stats.nlCountryHits + input.countryHits.NL.hits,
    worldGuesses: (stats.worldGuesses ?? 0) + (input.countryHits.WORLD?.n ?? 0),
    worldCountryHits: (stats.worldCountryHits ?? 0) + (input.countryHits.WORLD?.hits ?? 0),
    fastestAccurateMs:
      input.fastestAccurateMs == null
        ? stats.fastestAccurateMs
        : stats.fastestAccurateMs == null
          ? input.fastestAccurateMs
          : Math.min(stats.fastestAccurateMs, input.fastestAccurateMs),
    closestKm:
      closest.length === 0
        ? stats.closestKm
        : stats.closestKm == null
          ? Math.min(...closest)
          : Math.min(stats.closestKm, ...closest),
  };
  saveStats(next);
  return next;
}
