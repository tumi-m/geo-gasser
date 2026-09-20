# Architecture

ATLAS DUEL is a TanStack Start + React client with a framework-free game engine in `src/lib/game`.

## Engine

Scoring, geodesic math, timers, location selection and the match state machine live in `src/lib/game` and are covered by unit tests. UI never computes points; it only dispatches events into `reduce()`.

## Modes

- **Solo** — the local client is the clock. `performance.now()` starts the round and stamps locks.
- **Online duel** — two transports:
  - **Match server** (`workers/match`, preferred when `VITE_MATCH_SERVER_URL` is set) — one Cloudflare Durable Object per room owns the deck, clock and scores. Hibernating WebSockets carry commands in and `PublicSnapshot`s out; a DO alarm force-reveals timed-out rounds. Guests never receive the deck, seed, environment ids or truth coordinate before the reveal — only a `SceneInfo` descriptor for the plate on screen.
  - **P2P** (fallback) — WebRTC data channels via `/api/rtc` signaling. The room creator is host-authoritative. Private rooms only.
- **Bot / pass-and-play** — local only.

Both transports share `src/lib/multiplayer/room.ts`, which applies commands through the same reducer the browser uses.

## Atlas

Matches deal from a chosen atlas: SA × NL (default), South Africa, the Netherlands, world, mix, or a custom country list. Tiny maps shrink to unique places instead of repeating. Round 4 reconstructions only appear when the atlas includes SA and/or NL.

## Round 4 (parked — OpenCode / GPT-6 Astra)

3D reconstructions stay in the repo (`round4-scene.tsx`, `environments.ts`, `ROUND4_LOCATIONS`). Do not delete them. Flip `ROUND4_3D_LIVE` in `src/lib/game/selection.ts` when their renderer is ready. Until then the last 10 questions of a standard match are labelled reconstruction plates. See `docs/round4-later.md`.

## Scenes

- **Stills** — `SceneExplorer` (drag / WASD / zoom on the plate) with a local plate → stored URL → Wikipedia pageimage fallback chain.
- **360 panoramas** — `PanoViewer` (Three.js equirectangular sphere) with drag-look, wheel/pinch zoom and per-site heading/pitch. Any failure falls back to the flat still.
- **Mapillary** — `src/lib/game/mapillary.ts` resolves street-level and 360 image ids through API v4 (`VITE_MAPILLARY_TOKEN`, a public client token). Packs built by `scripts/build-locations.mjs` can mix Commons and Mapillary plates with per-photo credit.

## Imagery

Questions use Wikimedia/Wikipedia-sourced plates, Commons 360 panoramas and (when configured) Mapillary street-level imagery. The guessing map is Leaflet with a bundled Natural Earth country layer so it never depends on live tiles. No Google Maps scraping. No map-provider API keys. The World chip frames the true globe; SA and NL chips jump to those countries.

## Content packs

`scripts/build-locations.mjs` samples Commons geosearch or Mapillary radius search around coordinates, filters (bitmap, ≥1200px, sane aspect, 0.5 km dedupe), downloads display-size plates to `public/packs/<pack>/` and writes `src/data/packs/<pack>.json` with attribution and provider flags. The launch pool still ships in TypeScript; pack ingestion is the next content step.
