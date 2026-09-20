import { detectCountry, haversineKm } from "./geo.ts";
import { timePoints } from "./timer.ts";
import type { BadgeId, CountryCode, FeedbackId, LatLng, RoundScore } from "./types.ts";

export const ACCURACY_MAX = 10_000;
export const ROUND_MAX = 20_000;
export const ROUND4_MULTIPLIER = 1.25;

/** Country-aware exponential decay scales (km). Calibrated by simulation. */
export const COUNTRY_SCALE_KM: Record<CountryCode, number> = {
  ZA: 220,
  NL: 45,
};

export const REGION_KM: Record<CountryCode, number> = {
  ZA: 150,
  NL: 40,
};

export function accuracyPoints(distanceKm: number, country: CountryCode): number {
  const scale = COUNTRY_SCALE_KM[country];
  return Math.round(ACCURACY_MAX * Math.exp(-distanceKm / scale));
}

export function badgesFor(distanceKm: number, country: CountryCode, countryCorrect: boolean): BadgeId[] {
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
  good: "GOOD JOB",
  instincts: "NICE INSTINCTS",
  close: "SO CLOSE",
  country: "RIGHT COUNTRY",
  tough: "TOUGH ONE — NEXT ROUND",
};

export const BADGE_COPY: Record<BadgeId, string> = {
  bullseye: "Bullseye",
  sharpshooter: "Sharpshooter",
  excellent: "Excellent",
  great_read: "Great Read",
  right_region: "Right Region",
  country_locked: "Country Locked",
};

export function scoreGuess(opts: {
  truth: LatLng;
  guess: LatLng | null;
  country: CountryCode;
  remainingSec: number;
  responseMs: number;
  isRound4?: boolean;
}): RoundScore {
  const multiplier = opts.isRound4 ? ROUND4_MULTIPLIER : 1;
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
  const distanceKm = haversineKm(opts.truth, opts.guess);
  const countryCorrect = detectCountry(opts.guess) === opts.country;
  const acc = accuracyPoints(distanceKm, opts.country);
  const time = timePoints(opts.remainingSec);
  const roundScore = Math.round((acc + time) * multiplier);
  return {
    distanceKm,
    accuracyPoints: acc,
    timePoints: time,
    multiplier,
    roundScore,
    remainingSec: opts.remainingSec,
    responseMs: opts.responseMs,
    badges: badgesFor(distanceKm, opts.country, countryCorrect),
    feedback: feedbackFor(distanceKm, countryCorrect),
    countryCorrect,
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
