# Architecture

ATLAS DUEL is a TanStack Start + React client with a framework-free game engine in `src/lib/game`.

## Engine

Scoring, geodesic math, timers, location selection and the match state machine live in `src/lib/game` and are covered by unit tests. UI never computes points; it only dispatches events into `reduce()`.

## Modes

- **Solo** — the local client is the clock. `performance.now()` starts the round and stamps locks.
- **Duel** — WebRTC P2P via `/api/rtc` signaling. In-memory on a single instance (live preview); Postgres when `DATABASE_URL` is set (deployed Neon). The room creator is host-authoritative: they own the timer, hide answers until reveal, and compute scores from host receipt time. Guests send pins/locks; they never receive truth coordinates before reveal.

There is no dedicated multiplayer game server in this deployment target. Ranked play would need one.

## Atlas

Matches deal from a chosen atlas: SA × NL (default), South Africa, the Netherlands, world, mix, or a custom country list. Tiny maps shrink to unique places instead of repeating. Round 4 reconstructions only appear when the atlas includes SA and/or NL.

## Round 4 (parked — OpenCode / GPT-6 Astra)

3D reconstructions stay in the repo (`round4-scene.tsx`, `environments.ts`, `ROUND4_LOCATIONS`). Do not delete them. Flip `ROUND4_3D_LIVE` in `src/lib/game/selection.ts` when their renderer is ready. Until then the last 10 questions of a standard match are labelled reconstruction plates. See `docs/round4-later.md`.

Look-around for photo questions is `SceneExplorer` (drag / WASD / zoom on the still).

## Imagery

Questions use Wikimedia/Wikipedia-sourced plates (or clearly labelled reconstructions when a Commons file was unavailable). The guessing map is Leaflet with a bundled Natural Earth country layer so it never depends on live tiles. No Google Maps scraping. No map-provider API keys. The World chip frames the true globe; SA and NL chips jump to those countries.

