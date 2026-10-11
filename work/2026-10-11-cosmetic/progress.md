# Progress: roll back the redesign, keep a cosmetic pass

## Graph

- **Done:** 1 Roll back, 2 Cosmetic pass, 3 Verify and ship
- **Running:** none
- **Blocked:** none

## Outputs

- Revert of 3cd93ed; palette in `src/styles.css` (`@theme`, `--color-rival`)
- `src/components/game/points-pot.tsx` and the `.pot` / `.ledger` styles
- Release note: `docs/release-2026-10-10.md`

## Decisions

- Fonts, corner radii, shadows and motion are unchanged from before the
  redesign; only colour moved.
- The map's sea and land keep their old colours; only the rival's line
  turned blue.

## Open issues

- None.

## Next action

None.
