# Progress: three modes from the big geo games

## Graph

- **Done:** 1 Rules engine, 2 Online, 3 Movement UI, 4 Health UI, 5 Streak UI, 6 Verify and ship
- **Running:** none
- **Blocked:** none

## Outputs

- `src/lib/game/rules.ts` (numbers and helpers), `src/lib/map/country-at.ts` (judging a pin)
- Plans in `src/lib/game/selection.ts`; the reducer in `machine.ts`; `bestCountryStreak` in `stats.ts`
- `movement` and `duelRule` in settings; the room URL and `CREATE_DUEL` carry them
- Screens: the duel lobby switch, health bars in `score-tally.tsx`, the reveal's rule line,
  the streak row on home, `/streak`, results for both modes
- Release note: `docs/release-2026-10-10.md`

## Decisions

- Decompiling a competitor's client was declined; the modes are rebuilt from public rules.
- Health duel numbers are ours: 6,000 health, ×1 for four places then +0.5 a place, 20-place deck.
- Country Streak counts a pin within 25 km of the answer, and a sea pin inside the country's box.

## Open issues

- No place has extra viewpoints yet, so on photos No move plays like Moving; it differs in Street View.

## Next action

None.
