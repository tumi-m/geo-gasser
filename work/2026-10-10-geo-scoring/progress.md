# Progress: GeoGuessr scoring with a tiered points countdown

## Graph

- **Done:** 1 Scoring core, 2 Rescale, 3 Countdown UI, 4 Ship
- **Running:** none
- **Blocked:** none

## Outputs

- `geoScore`, `MAP_SIZE_KM`, `PERFECT_KM` in `src/lib/game/scoring.ts`
- `CLOCK_TIERS`, `clockTier`, `clockFactor`, `secondsToNextTier` in `src/lib/game/timer.ts`
- `migrateStats`, `SCORING_VERSION` in `src/lib/game/stats.ts`
- `src/components/game/points-pot.tsx`; `MatchMeta` in `timer-ring.tsx`
- Release note: `docs/release-2026-10-10.md`

## Decisions

- The clock multiplies the distance score (rather than capping it), so
  every guess pays for time in proportion.
- Duels keep "highest total wins"; GeoGuessr's health-bar duels are a
  separate decision.
- The manifesto styling covers the countdown, the reveal ledger and the
  metadata line; the rest of the app is unchanged.

## Open issues

- None from this task.

## Next action

None.
