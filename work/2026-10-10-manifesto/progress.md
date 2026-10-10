# Progress: restyle the whole app to "The System Is the Content"

## Graph

- **Done:** 1 Foundation, 2 Documents, 3 Instrument, 4 Finale, 5 Sweep and ship
- **Running:** none
- **Blocked:** none

## Outputs

- Tokens, type, hairlines and motion in `src/styles.css`; buttons and inputs in `src/components/ui/`
- `src/components/game/system-meta.tsx`; `__BUILD_SHA__` and `__BUILD_DATE__` from `vite.config.ts`
- Map palette in `src/lib/map/layers.ts`
- Release note: `docs/release-2026-10-10.md`

## Decisions

- Pages are documents on white; the playing screen is an instrument in black.
- Winner moments stay, re-cut as a shutter flash and a hairline grid; confetti, rays and sparks are gone.
- Player avatar colours stay: they are the player's own choice, so they are data.
- Section numbers (01, 02, 03, FIN) are ornament and hidden from screen readers.

## Open issues

- At 740×360 the reveal map can clip a long country label such as "SOUTH AFRICA" at its edge.
- On the results the route still draws in under reduced motion (finite, under 2 s); it was like this before.

## Next action

None.
