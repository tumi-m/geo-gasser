import { ROUND4_ENVIRONMENTS } from "./environments.ts";
import { enabledLocations } from "./locations.ts";
import { mulberry32, shuffle } from "./rng.ts";
import type { GeoLocation } from "./types.ts";

export const REAL_ROUNDS = 3;

export interface MatchPlan {
  seed: number;
  locationIds: string[];
  envId: string;
}

/**
 * Pick 3 real-world locations without replacement, mixing countries and
 * avoiding repeated cities / primary tags, then a Round 4 environment whose
 * underlying truth is not already in the first three if possible.
 */
export function planMatch(seed: number): MatchPlan {
  const rand = mulberry32(seed);
  const pool = enabledLocations();
  const za = shuffle(
    pool.filter((l) => l.country === "ZA"),
    rand,
  );
  const nl = shuffle(
    pool.filter((l) => l.country === "NL"),
    rand,
  );

  const picked: GeoLocation[] = [];
  const usedCities = new Set<string>();
  const usedPrimary = new Set<string>();

  const tryTake = (list: GeoLocation[]) => {
    const idx = list.findIndex((l) => {
      const city = (l.city ?? l.id).toLowerCase();
      const primary = l.tags[0];
      if (usedCities.has(city)) return false;
      if (usedPrimary.has(primary) && picked.length < 2) return false;
      return true;
    });
    const item = idx >= 0 ? list.splice(idx, 1)[0] : list.shift();
    if (!item) return;
    picked.push(item);
    usedCities.add((item.city ?? item.id).toLowerCase());
    if (item.tags[0]) usedPrimary.add(item.tags[0]);
  };

  const startZa = rand() < 0.5;
  const order = startZa ? [za, nl, za] : [nl, za, nl];
  if (rand() > 0.35) {
    // Occasional same-country closer (still unique city) for variety.
    order[2] = rand() < 0.5 ? za : nl;
  }
  for (const list of order) tryTake(list);

  while (picked.length < REAL_ROUNDS) {
    const rest = shuffle(
      pool.filter((l) => !picked.some((p) => p.id === l.id)),
      rand,
    );
    if (!rest[0]) break;
    picked.push(rest[0]);
  }

  const usedTruth = new Set(picked.map((p) => p.id));
  const envs = shuffle([...ROUND4_ENVIRONMENTS], rand);
  const env = envs.find((e) => !usedTruth.has(e.truthLocationId)) ?? envs[0];

  return {
    seed,
    locationIds: picked.slice(0, REAL_ROUNDS).map((l) => l.id),
    envId: env.id,
  };
}

export function currentLocationId(plan: MatchPlan, roundIndex: number): string {
  if (roundIndex < REAL_ROUNDS) return plan.locationIds[roundIndex];
  const env = ROUND4_ENVIRONMENTS.find((e) => e.id === plan.envId);
  return env?.truthLocationId ?? plan.locationIds[0];
}
