import { START_HEALTH } from "./rules.ts";
import { saveStats, type PlayerStats } from "./stats.ts";
import type { MovementRule } from "./types.ts";

/**
 * The career: experience from every match, levels with titles, and medals
 * for things worth remembering. It lives in the player's stats, on this
 * device, like the records.
 */

/** What a finished match is worth to the career. */
export interface MatchSummary {
  kind: "solo" | "duel" | "streak";
  /** Duels only. Pass and play earns nothing: it shares one device. */
  opponent?: "bot" | "online";
  health?: boolean;
  score: number;
  won: boolean;
  /** Places on Earth played this match. */
  places: number;
  /** Places where the pin was in the right country. */
  rightCountries: number;
  /** Places that scored the full 5,000 for distance. */
  perfect: number;
  closestKm: number | null;
  /** Fastest guess within 5 km, in milliseconds. */
  fastestAccurateMs: number | null;
  /** Country Streak: the run. */
  run?: number;
  /** Health duels: your health at the end. */
  healthLeft?: number;
  movement: MovementRule;
  /** ISO codes of the places played. */
  nations: string[];
}

// ── experience ────────────────────────────────────────────────────────────

export interface XpLine {
  label: string;
  xp: number;
}

/** Harder movement rules pay more. */
export const MOVEMENT_XP_BONUS: Record<MovementRule, number> = { moving: 1, "no-move": 1.1, nmpz: 1.25 };

/**
 * Experience for a match, line by line:
 *  - 10 for each place played;
 *  - 1 for every 100 points (a Country Streak pays 25 for each right country);
 *  - 100 for winning a duel;
 *  - +10% on No move, +25% on NMPZ.
 */
export function matchXp(m: MatchSummary): XpLine[] {
  const lines: XpLine[] = [{ label: m.places === 1 ? "1 place" : `${m.places} places`, xp: m.places * 10 }];
  if (m.kind === "streak") {
    const run = m.run ?? 0;
    if (run > 0) lines.push({ label: run === 1 ? "1 country" : `${run} countries`, xp: run * 25 });
  } else if (m.score > 0) {
    lines.push({ label: "Points", xp: Math.floor(m.score / 100) });
  }
  if (m.kind === "duel" && m.won) lines.push({ label: "Win", xp: 100 });
  const bonus = MOVEMENT_XP_BONUS[m.movement] ?? 1;
  if (bonus > 1) {
    const base = lines.reduce((sum, line) => sum + line.xp, 0);
    lines.push({
      label: m.movement === "nmpz" ? "NMPZ" : "No move",
      xp: Math.round(base * (bonus - 1)),
    });
  }
  return lines.filter((line) => line.xp > 0);
}

export function totalXp(lines: XpLine[]): number {
  return lines.reduce((sum, line) => sum + line.xp, 0);
}

// ── levels ────────────────────────────────────────────────────────────────

/** XP from level n to n + 1: 300, then 100 more each level. */
export function xpToNext(level: number): number {
  return 300 + 100 * (level - 1);
}

/** Total XP at which `level` starts (level 1 starts at 0). */
export function xpForLevel(level: number): number {
  const n = Math.max(0, level - 1);
  return n * 300 + (100 * n * (n - 1)) / 2;
}

const TITLES: [number, string][] = [
  [40, "Atlas"],
  [30, "Globetrotter"],
  [20, "Cartographer"],
  [15, "Pathfinder"],
  [10, "Navigator"],
  [6, "Explorer"],
  [3, "Backpacker"],
  [1, "Tourist"],
];

export function titleFor(level: number): string {
  return TITLES.find(([from]) => level >= from)?.[1] ?? "Tourist";
}

export interface Level {
  level: number;
  title: string;
  /** XP earned inside this level. */
  into: number;
  /** XP this level takes in all. */
  need: number;
  /** 0–1 through this level. */
  progress: number;
}

export function levelOf(xp: number): Level {
  const total = Math.max(0, Math.floor(xp));
  let level = 1;
  while (total >= xpForLevel(level + 1)) level += 1;
  const into = total - xpForLevel(level);
  const need = xpToNext(level);
  return { level, title: titleFor(level), into, need, progress: into / need };
}

// ── medals ────────────────────────────────────────────────────────────────

/** Icons are named here and drawn by the screens. */
export type MedalIcon =
  | "flag"
  | "crosshair"
  | "target"
  | "check"
  | "trophy"
  | "zap"
  | "bot"
  | "globe"
  | "swords"
  | "heart"
  | "shield"
  | "flame"
  | "rocket"
  | "eye"
  | "home"
  | "waves"
  | "stamp"
  | "plane"
  | "calendar";

export interface Medal {
  id: string;
  name: string;
  /** How to earn it, shown while it is locked and after. */
  hint: string;
  icon: MedalIcon;
  /** Earned by this match, given the stats after it. */
  earned: (m: MatchSummary, s: PlayerStats) => boolean;
}

const points = (m: MatchSummary) => m.kind !== "streak";

export const MEDALS: Medal[] = [
  { id: "first-steps", name: "First steps", hint: "Finish a match.", icon: "flag", earned: () => true },
  {
    id: "sharpshooter",
    name: "Sharpshooter",
    hint: "Land a guess within 1 km.",
    icon: "crosshair",
    earned: (m) => m.closestKm != null && m.closestKm <= 1,
  },
  {
    id: "perfect-read",
    name: "Perfect read",
    hint: "Score the full 5,000 for distance on a place.",
    icon: "target",
    earned: (m) => m.perfect > 0,
  },
  {
    id: "clean-sweep",
    name: "Clean sweep",
    hint: "Name the right country on every place of a match of five or more.",
    icon: "check",
    earned: (m) => points(m) && m.places >= 5 && m.rightCountries === m.places,
  },
  {
    id: "twenty-thousand",
    name: "Twenty thousand",
    hint: "Score 20,000 points in one match.",
    icon: "trophy",
    earned: (m) => points(m) && m.score >= 20000,
  },
  {
    id: "quick-draw",
    name: "Quick draw",
    hint: "Guess within 5 km in under 10 seconds.",
    icon: "zap",
    earned: (m) => m.fastestAccurateMs != null && m.fastestAccurateMs <= 10000,
  },
  {
    id: "beat-grok",
    name: "Grok who?",
    hint: "Beat Grok in a duel.",
    icon: "bot",
    earned: (m) => m.kind === "duel" && m.opponent === "bot" && m.won,
  },
  {
    id: "head-to-head",
    name: "Head to head",
    hint: "Win an online duel.",
    icon: "globe",
    earned: (m) => m.kind === "duel" && m.opponent === "online" && m.won,
  },
  {
    id: "hat-trick",
    name: "Hat-trick",
    hint: "Win three duels in a row.",
    icon: "swords",
    earned: (_m, s) => (s.duelRun ?? 0) >= 3,
  },
  {
    id: "knockout",
    name: "Knockout",
    hint: "Win a health duel.",
    icon: "heart",
    earned: (m) => m.kind === "duel" && Boolean(m.health) && m.won,
  },
  {
    id: "untouched",
    name: "Untouched",
    hint: "Win a health duel without losing any health.",
    icon: "shield",
    earned: (m) => m.kind === "duel" && Boolean(m.health) && m.won && m.healthLeft === START_HEALTH,
  },
  {
    id: "on-a-roll",
    name: "On a roll",
    hint: "Name 5 countries in a row in Country Streak.",
    icon: "flame",
    earned: (m) => m.kind === "streak" && (m.run ?? 0) >= 5,
  },
  {
    id: "unstoppable",
    name: "Unstoppable",
    hint: "Name 15 countries in a row in Country Streak.",
    icon: "rocket",
    earned: (m) => m.kind === "streak" && (m.run ?? 0) >= 15,
  },
  {
    id: "purist",
    name: "Purist",
    hint: "Finish a match on NMPZ: no move, no pan, no zoom.",
    icon: "eye",
    earned: (m) => m.movement === "nmpz",
  },
  {
    id: "home-ground",
    name: "Home ground",
    hint: "Name South Africa right on 10 places.",
    icon: "home",
    earned: (_m, s) => s.zaCountryHits >= 10,
  },
  {
    id: "lowlands",
    name: "Lowlands",
    hint: "Name the Netherlands right on 10 places.",
    icon: "waves",
    earned: (_m, s) => s.nlCountryHits >= 10,
  },
  {
    id: "stamped",
    name: "Stamped",
    hint: "See places in 10 countries.",
    icon: "stamp",
    earned: (_m, s) => (s.nations?.length ?? 0) >= 10,
  },
  {
    id: "well-travelled",
    name: "Well travelled",
    hint: "See places in 25 countries.",
    icon: "plane",
    earned: (_m, s) => (s.nations?.length ?? 0) >= 25,
  },
  {
    id: "regular",
    name: "Regular",
    hint: "Finish 25 matches.",
    icon: "calendar",
    earned: (_m, s) => s.matchesPlayed + (s.streakRuns ?? 0) >= 25,
  },
];

export function medalById(id: string): Medal | undefined {
  return MEDALS.find((m) => m.id === id);
}

// ── recording ─────────────────────────────────────────────────────────────

export interface CareerAward {
  xp: XpLine[];
  gained: number;
  before: number;
  after: number;
  /** Levels gained by this match (0 most of the time). */
  levelsUp: number;
  medals: Medal[];
}

/**
 * Adds a finished match to the career: experience, countries seen, the
 * duel run and any medals newly earned. Call it after the match's stats are
 * recorded (medals read those totals). Saves and returns the new stats.
 */
export function recordCareer(
  stats: PlayerStats,
  m: MatchSummary,
  now = Date.now(),
): { stats: PlayerStats; award: CareerAward } {
  const xp = matchXp(m);
  const gained = totalXp(xp);
  const before = stats.xp ?? 0;
  const after = before + gained;
  const nations = [...new Set([...(stats.nations ?? []), ...m.nations.map((n) => n.toUpperCase())])].sort();
  const duelRun = m.kind === "duel" ? (m.won ? (stats.duelRun ?? 0) + 1 : 0) : (stats.duelRun ?? 0);
  const next: PlayerStats = { ...stats, xp: after, nations, duelRun };
  const owned = stats.medals ?? {};
  const fresh = MEDALS.filter((medal) => !owned[medal.id] && medal.earned(m, next));
  if (fresh.length) next.medals = { ...owned, ...Object.fromEntries(fresh.map((medal) => [medal.id, now])) };
  saveStats(next);
  return {
    stats: next,
    award: {
      xp,
      gained,
      before,
      after,
      levelsUp: levelOf(after).level - levelOf(before).level,
      medals: fresh,
    },
  };
}
