# Progress: a finished, paid-game feel

## Graph

- **Done:** 1 Fair map and plain type, 2 Career engine, 3 Results, 4 Career page, 5 Pause, 6 Verify and ship
- **Running:** none
- **Blocked:** none

## Outputs

- `src/lib/game/career.ts` (XP, levels, medals) and `career.test.ts`
- `pausedAtMs`, `PAUSE` and `RESUME` in `types.ts` and `machine.ts`; `pause.test.ts`
- `src/components/game/career-bits.tsx` (level badge, medal disc, results card),
  `career-page.tsx` (`/career`), `pause-menu.tsx`
- `cityLabels` in `src/lib/map/layers.ts` (no dots)
- Release note: `docs/release-2026-10-10.md`

## Decisions

- The look and journey stay as they were; the additions follow each look's existing style.
- Pause is solo only: a duel's rival keeps playing.
- In solo, the header's Settings button becomes Pause during a round; Settings sits in the pause menu.
- Pass and play earns no XP or medals, as it sets no records.

## Open issues

- The career lives on this device, like the records; there are no accounts.

## Next action

None.
