# Progress: eight rounds of fixes, UI/UX and motion

## Graph

- **Done:** 1 Winner moment, 2 Live round motion, 3 Reveal motion, 4 Match finale, 5 Home and menus, 6 Duel room, 7 Sweep
- **Running:** 8 Ship
- **Blocked:** none

## Outputs

- `src/components/game/winner-moment.tsx` (WinFx, WinBanner, CrownDrop)
- `roundStars` in `src/lib/game/round-summary.ts`
- `previousBest`, `isNewBest` and per-length `bests` in `src/lib/game/stats.ts`
- `MATCH_LENGTH_NAME` in `src/lib/game/timer.ts`

## Decisions

- Personal bests compare like with like: one record per match length. The
  old overall `personalBest` stays for the home footer.
- Scroll reveals mark elements with `data-shown`, not a class: React
  rewrites `className` and wiped the class.

## Open issues

- 740×360 landscape: the map's world view clips the "SOUTH AFRICA" label
  (the country is in view). Framing untouched.

## Next action

Round 8: release note, lessons, gates, deploy check.
