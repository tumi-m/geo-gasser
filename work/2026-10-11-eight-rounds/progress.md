# Progress: eight rounds of fixes, polish and motion

## Graph

- **Done:** 1 Home and first run, 2 Intro and live round, 3 Round win celebration, 4 Reveal, 5 Results and career, 6 Duels, 7 Modes, 8 Final sweep
- **Running:** none
- **Blocked:** none

## Outputs

- `src/lib/game/round-moment.ts` (+ tests): rounds won and callouts after each round
- `src/components/game/vs-faceoff.tsx`, `tutorial.tsx` (animated How to play), `use-more-below.ts`
- `RoundTally` and `CalloutStamps` in `winner-moment.tsx`; the floating results bar in `final-results.tsx`
- Release note: `docs/release-2026-10-10.md`

## Decisions

- Each round was committed and pushed on its own after the gates.
- The round-end moment takes the whole screen: it did not fit above the map on phones.
- Reveal headlines keep their ids; only the words moved, so nothing else changed meaning.

## Open issues

- 7d9d50c was pushed with the smoke failing (a second Rematch button); fixed in f057aa8. Gates now run from a script that checks exit codes.

## Next action

None.
