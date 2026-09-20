# Round 4 — 3D reconstructions (parked)

Parked 21 Sep 2026. Re-enable when 3D generation credits are available.

## What was built

- Ten labelled reconstructions (5 ZA + 5 NL) in `src/lib/game/environments.ts`
  and `ROUND4_LOCATIONS` (`loc_31`–`loc_40`).
- `Round4Scene` (`src/components/game/round4-scene.tsx`) — R3F look-around.
- 1.25× score multiplier (`ROUND4_MULTIPLIER` in `scoring.ts`).
- Provenance: `docs/round4-provenance.md`.

Those ten sites are still in the **photo pool** as regular questions (disclosed
as reconstructions). They are no longer a separate final round.

Look-around for every still is `SceneExplorer` (drag to look, WASD inspect,
scroll/pinch zoom). That is not Street View and not the parked 3D round.

## How to turn it back on

1. Restore `MATCH_LENGTH` so the last round is reconstructions only
   (`photoRounds = totalRounds - 1`, `ROUND4_QUESTIONS = 10`).
2. `planMatch` should append shuffled `ROUND4_LOCATIONS` after photo questions
   and fill `envIds` from `ROUND4_ENVIRONMENTS`.
3. `isRound4Question(q, photoQuestions)` already exists — wire `Round4Scene`
   in `match-app.tsx` when `isRound4(state)`.
4. Keep the HUD disclosure: “3D reconstruction, not a live photograph.”
5. Generate remaining environments with the Higgsfield / Imagine pipeline
   rather than wallpaper reuse.

## Do not

- Mix undisclosed fakes into photo rounds.
- Apply the 1.25× multiplier to ordinary stills.
