import { AU_KM, cosmosZone } from "./cosmos.ts";
import { COUNTRY_BOUNDS, detectCountry, haversineKm, isInsideNation } from "./geo.ts";
import { clockFactor } from "./timer.ts";
import type { BadgeId, CountryCode, EarthCountry, FeedbackId, LatLng, RoundScore } from "./types.ts";

/**
 * Scoring follows GeoGuessr: a round pays at most 5,000, falling off
 * exponentially with distance relative to the size of the map. The clock
 * then keeps a tiered share of it (timer.ts: 100% down to 60%).
 */
export const ROUND_MAX = 5_000;
/** The distance score's ceiling, before the clock takes its share. */
export const ACCURACY_MAX = ROUND_MAX;
/** GeoGuessr counts a guess within 25 m as perfect. */
export const PERFECT_KM = 0.025;
/** The size GeoGuessr gives its world map (km). */
export const WORLD_MAP_KM = 14_916.862;
/** Half WGS84 circumference. A missed pin must lose distance tie-breaks to any real guess. */
export const NO_GUESS_KM = 20_015.0868;

const diagonalKm = (b: { south: number; north: number; west: number; east: number }) =>
  haversineKm({ latitude: b.south, longitude: b.west }, { latitude: b.north, longitude: b.east });

/**
 * Each place is scored on its own country's map, sized the way GeoGuessr
 * sizes a map: the diagonal of its bounding box. South Africa comes to about
 * 2,135 km and the Netherlands 411 km, so a mixed map stays fair to both.
 */
export const MAP_SIZE_KM: Record<EarthCountry, number> = {
  ZA: diagonalKm(COUNTRY_BOUNDS.ZA),
  NL: diagonalKm(COUNTRY_BOUNDS.NL),
  WORLD: WORLD_MAP_KM,
};

/** GeoGuessr's curve: 5000 × e^(−10 × distance / map size); 5,000 within 25 m. */
export function geoScore(distanceKm: number, mapSizeKm: number): number {
  if (!Number.isFinite(distanceKm)) return 0;
  if (distanceKm <= PERFECT_KM) return ROUND_MAX;
  return Math.round(ROUND_MAX * Math.exp((-10 * distanceKm) / mapSizeKm));
}

export const REGION_KM: Record<EarthCountry, number> = {
  ZA: 150,
  NL: 40,
  WORLD: 250,
};

/**
 * Cosmos rounds score the miss in decades of distance from the Sun: a factor
 * of two (Jupiter for Saturn) keeps about a third of the points, a factor of
 * ten keeps almost none.
 */
export const COSMOS_SCALE_DECADES = 0.3;

export function cosmosAccuracy(decades: number): number {
  return Math.round(ACCURACY_MAX * Math.exp(-Math.abs(decades) / COSMOS_SCALE_DECADES));
}

export function accuracyPoints(distanceKm: number, country: EarthCountry): number {
  return geoScore(distanceKm, MAP_SIZE_KM[country]);
}

export function cosmosBadges(decades: number, zoneCorrect: boolean): BadgeId[] {
  const badges: BadgeId[] = [];
  if (decades <= 0.01) badges.push("bullseye");
  else if (decades <= 0.03) badges.push("sharpshooter");
  else if (decades <= 0.08) badges.push("excellent");
  else if (decades <= 0.18) badges.push("great_read");
  if (zoneCorrect) badges.push("right_zone");
  return badges;
}

export function cosmosFeedback(decades: number, zoneCorrect: boolean): FeedbackId {
  if (decades <= 0.01) return "perfect";
  if (decades <= 0.03) return "incredible";
  if (decades <= 0.08) return "good";
  if (decades <= 0.18) return "instincts";
  if (decades <= 0.4) return "close";
  if (zoneCorrect) return "country";
  return "tough";
}

export function badgesFor(distanceKm: number, country: EarthCountry, countryCorrect: boolean): BadgeId[] {
  const badges: BadgeId[] = [];
  if (distanceKm <= 0.1) badges.push("bullseye");
  else if (distanceKm <= 1) badges.push("sharpshooter");
  else if (distanceKm <= 5) badges.push("excellent");
  else if (distanceKm <= 25) badges.push("great_read");
  if (distanceKm <= REGION_KM[country]) badges.push("right_region");
  if (countryCorrect) badges.push("country_locked");
  return badges;
}

export function feedbackFor(distanceKm: number, countryCorrect: boolean): FeedbackId {
  if (distanceKm <= 0.1) return "perfect";
  if (distanceKm <= 1) return "incredible";
  if (distanceKm <= 5) return "good";
  if (distanceKm <= 25) return "instincts";
  if (distanceKm <= 80) return "close";
  if (countryCorrect) return "country";
  return "tough";
}

export const FEEDBACK_COPY: Record<FeedbackId, string> = {
  perfect: "PERFECT READ",
  incredible: "INCREDIBLE",
  // Closest first: within 5 km, 25 km, then 80 km (feedbackFor).
  good: "SPOT ON",
  instincts: "SO CLOSE",
  close: "NICE INSTINCTS",
  country: "RIGHT COUNTRY",
  tough: "TOUGH ONE",
};

/** The verdict line for a round: cosmic rounds have neighbourhoods, not countries. */
export function feedbackHeadline(score: Pick<RoundScore, "feedback" | "decades">): string {
  if (score.decades != null && score.feedback === "country") return "RIGHT NEIGHBOURHOOD";
  return FEEDBACK_COPY[score.feedback];
}

export const BADGE_COPY: Record<BadgeId, string> = {
  bullseye: "Bullseye",
  sharpshooter: "Sharpshooter",
  excellent: "Excellent",
  great_read: "Great Read",
  right_region: "Right Region",
  country_locked: "Country Locked",
  right_zone: "Right Neighbourhood",
};

export function scoreGuess(opts: {
  truth: LatLng;
  guess: LatLng | null;
  country: CountryCode;
  nation?: string;
  remainingSec: number;
  responseMs: number;
  durationSec?: number;
}): RoundScore {
  // GeoGuessr pays no round more than 5,000: no multipliers.
  const multiplier = 1;
  if (!opts.guess) {
    return {
      distanceKm: Number.POSITIVE_INFINITY,
      accuracyPoints: 0,
      timePoints: 0,
      multiplier,
      roundScore: 0,
      remainingSec: 0,
      responseMs: opts.responseMs,
      badges: [],
      feedback: "tough",
      countryCorrect: false,
    };
  }
  if (opts.country === "SPACE") return scoreCosmic(opts.truth, opts.guess, opts.remainingSec, opts.responseMs, multiplier, opts.durationSec);
  const distanceKm = haversineKm(opts.truth, opts.guess);
  const countryCorrect =
    opts.country === "WORLD" && opts.nation
      ? isInsideNation(opts.guess, opts.nation)
      : detectCountry(opts.guess) === opts.country;
  const acc = accuracyPoints(distanceKm, opts.country);
  const factor = clockFactor(opts.remainingSec, opts.durationSec);
  const roundScore = Math.round(acc * factor);
  return {
    distanceKm,
    accuracyPoints: acc,
    timePoints: acc - roundScore,
    clockFactor: factor,
    multiplier,
    roundScore,
    remainingSec: opts.remainingSec,
    responseMs: opts.responseMs,
    badges: badgesFor(distanceKm, opts.country, countryCorrect),
    feedback: feedbackFor(distanceKm, countryCorrect),
    countryCorrect,
  };
}

/** Truth and guess hold log10(AU from the Sun) in `latitude`. */
function scoreCosmic(
  truth: LatLng,
  guess: LatLng,
  remainingSec: number,
  responseMs: number,
  multiplier: number,
  durationSec?: number,
): RoundScore {
  const decades = Math.abs(guess.latitude - truth.latitude);
  const zoneCorrect = cosmosZone(guess.latitude) === cosmosZone(truth.latitude);
  const acc = cosmosAccuracy(decades);
  const factor = clockFactor(remainingSec, durationSec);
  const roundScore = Math.round(acc * factor);
  return {
    distanceKm: Math.abs(10 ** guess.latitude - 10 ** truth.latitude) * AU_KM,
    accuracyPoints: acc,
    timePoints: acc - roundScore,
    clockFactor: factor,
    multiplier,
    roundScore,
    remainingSec,
    responseMs,
    badges: cosmosBadges(decades, zoneCorrect),
    feedback: cosmosFeedback(decades, zoneCorrect),
    countryCorrect: zoneCorrect,
    decades,
  };
}

export interface RankablePlayer {
  id: string;
  totalScore: number;
  totalDistanceKm: number;
  totalResponseMs: number;
}

/** Highest score wins. Ties: lower distance, then lower response time, then shared victory. */
export function rankPlayers(players: RankablePlayer[]): { winnerIds: string[]; ranking: RankablePlayer[] } {
  const ranking = [...players].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (a.totalDistanceKm !== b.totalDistanceKm) return a.totalDistanceKm - b.totalDistanceKm;
    if (a.totalResponseMs !== b.totalResponseMs) return a.totalResponseMs - b.totalResponseMs;
    return a.id.localeCompare(b.id);
  });
  if (ranking.length === 0) return { winnerIds: [], ranking };
  const top = ranking[0];
  const winnerIds = ranking
    .filter(
      (p) =>
        p.totalScore === top.totalScore &&
        p.totalDistanceKm === top.totalDistanceKm &&
        p.totalResponseMs === top.totalResponseMs,
    )
    .map((p) => p.id);
  return { winnerIds, ranking };
}
