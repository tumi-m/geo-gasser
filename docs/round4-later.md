# Round 4 — 3D reconstructions (parked)

Parked 21 Sep 2026. **OpenCode / GPT-6 Astra own this work.** Do not delete these files while they work:

- `src/components/game/round4-scene.tsx` — procedural Three.js look-around
- `src/lib/game/environments.ts` — ten labelled reconstructions
- `src/lib/game/locations.ts` → `ROUND4_LOCATIONS` (`loc_31`–`loc_40`)
- `public/generated/round4-*.jpg` and home plates used as skies
- `docs/round4-provenance.md`

The match still **reserves round 4** as ten reconstruction questions (5 ZA + 5 NL). Until 3D is live those play as labelled stills through `SceneExplorer`. The 1.25× score multiplier is off.

## How to turn the 3D renderer on

1. Keep `MATCH_LENGTH` so the last round is reconstructions (`photoRounds = totalRounds - 1`, `ROUND4_QUESTIONS = 10`). Already true.
2. `planMatch` already appends shuffled `ROUND4_LOCATIONS` after the photo questions and fills `envIds` from `ROUND4_ENVIRONMENTS`.
3. In `src/lib/game/selection.ts` set `ROUND4_3D_LIVE = true`.
4. `match-app.tsx` mounts `Round4Scene` when that flag is on and `isRound4(state)`.
5. Keep the HUD disclosure: “3D reconstruction, not a live photograph.”
6. Prefer Higgsfield / Imagine generated environments over wallpaper reuse.

## Do not

- Delete `round4-scene.tsx`, `environments.ts`, or the generated plates.
- Mix undisclosed fakes into photo rounds.
- Apply the 1.25× multiplier to ordinary stills (gated on `ROUND4_3D_LIVE`).
