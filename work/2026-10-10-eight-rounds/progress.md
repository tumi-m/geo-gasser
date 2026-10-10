# Progress: eight rounds of fixes, UI/UX and motion

## Graph

- **Done:** 1 Winner moment, 2 Live round motion, 3 Reveal motion, 4 Match finale
- **Running:** 5 Home and menus
- **Blocked:** none

## Outputs

- `src/components/game/winner-moment.tsx` (WinFx, WinBanner, CrownDrop)
- `roundStars` in `src/lib/game/round-summary.ts`
- `previousBest`, `isNewBest` and per-length `bests` in `src/lib/game/stats.ts`
- `MATCH_LENGTH_NAME` in `src/lib/game/timer.ts`

## Decisions

- Personal bests compare like with like: one record per match length. The
  old overall `personalBest` stays for the home footer.

## Open issues

## Next action

Round 5: home and menus motion.
