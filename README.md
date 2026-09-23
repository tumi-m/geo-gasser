# ATLAS DUEL

Quick Escape, longer expeditions, and private duels across South Africa, the Netherlands, and the world. Choose countries or cities, inspect a scene, and lock your pin.

See [release notes and verification](docs/release-2026-09-23.md) for the latest changes and known limitations. Run `npm run test:game` for the gameplay and multiplayer regression suite.


A geo-guessing duel. Pick an atlas, study a scene, drop a pin, lock in. Accuracy and speed both score.

- **Atlas** — South Africa, the Netherlands, SA × NL, world, mix, or a custom country list
- **Standard** — 4 rounds / 40 questions (shrinks if your map is smaller)
- **Extended** — 7 rounds / 70 questions
- **Full game** — 10 rounds / 100 questions

Timer: Easy 60s, Medium 45s, Hard 30s.

Round 4 is reserved for 3D reconstructions. OpenCode / GPT-6 Astra own that work — the files stay in the repo (`docs/round4-later.md`). Until they land, those ten sites play as labelled stills.

## Play

- **Play solo** — personal best stored on this device.
- **Two player duel** — Grok, pass-and-play, or a private room.

Drag the scene to look around, WASD to inspect, scroll to zoom. Unsubmitted pins score zero when the timer ends. South Africa uses a wider distance curve than the Netherlands; world sites are wider still.

## Setup

```
npm install
npm run dev
npm test
npm run locations:validate
npm run typecheck
npm run build
```

## Architecture

See `docs/architecture.md`. Game rules live in `src/lib/game` so they can be tested without the UI.

## Providers

See `docs/providers.md`. Map: bundled Natural Earth countries (no live tile API). Location plates: Wikimedia Commons (CC BY-SA) or labelled reconstructions.

## Testing

```
npm test
npm run locations:validate
```

Unit tests cover the timer contract, haversine pairs, country-aware scoring, the 149-site pool, shuffled match deals, and the match state machine (including hidden answers before reveal).

## Deployment

The app builds with the workspace Vite / Vercel pipeline. Optional `VITE_STUN_URLS` is documented in `docs/env.template.md`. No provider API keys are required for launch.

## Known limitations

- Duel is host-authoritative P2P, not a dedicated game server. Private rooms only.
- The 3D reconstruction round is parked for OpenCode / GPT-6 Astra (`docs/round4-later.md`). Files are kept; `ROUND4_3D_LIVE` is false.
- A few launch plates are cinematic reconstructions where a Commons file could not be fetched at pack time.
- External map lookup cannot be fully prevented in a browser client.

## Roadmap

See `docs/roadmap.md`.
