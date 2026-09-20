# Architecture

ATLAS DUEL is a TanStack Start + React client with a framework-free game engine in `src/lib/game`.

## Engine

Scoring, geodesic math, timers, location selection and the match state machine live in `src/lib/game` and are covered by unit tests. UI never computes points; it only dispatches events into `reduce()`.

## Modes

- **Solo** — the local client is the clock. `performance.now()` starts the round and stamps locks.
- **Duel** — WebRTC P2P via `/api/rtc` signaling. In-memory on a single instance (live preview); Postgres when `DATABASE_URL` is set (deployed Neon). The room creator is host-authoritative: they own the timer, hide answers until reveal, and compute scores from host receipt time. Guests send pins/locks; they never receive truth coordinates before reveal.

There is no dedicated multiplayer game server in this deployment target. Ranked play would need one.

## Round 4

`GeneratedEnvironmentProvider` is the extension point for Higgsfield MCP. That MCP is not available here, so `FallbackEnvironmentProvider` assembles a procedural Three.js scene around a generated cinematic plate. The HUD labels it as a reconstruction.

## Imagery

Rounds 1–3 use Wikimedia/Wikipedia-sourced plates (or clearly labelled reconstructions when a Commons file was unavailable). The guessing map is MapLibre with a bundled Natural Earth country layer so it never depends on live tiles. No Google Maps scraping. No map-provider API keys.
