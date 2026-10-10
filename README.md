# ATLAS DUEL

Quick Escape, longer expeditions, and private duels across South Africa, the Netherlands, and the world. Choose countries or cities, inspect a scene, and lock your pin.

See the [latest release note](docs/release-2026-10-10.md) for recent changes. Before changing anything, read [AGENTS.md](AGENTS.md): how work is split, checked and handed over in this repo.


A geo-guessing duel. Pick an atlas, study a scene, drop a pin, lock in. Accuracy and speed both score.

- **Atlas** — South Africa, the Netherlands, SA × NL, world, mix, or a custom country list
- **Standard** — 4 rounds / 40 questions (shrinks if your map is smaller)
- **Extended** — 7 rounds / 70 questions
- **Full game** — 10 rounds / 100 questions

Timer: Easy 60s, Medium 45s, Hard 30s.

The final round is real places, in the same country mix as the rest of the match. The 3D reconstruction round is parked behind `ROUND4_3D_LIVE`; its files stay in the repo (`docs/round4-later.md`) and its plates are never dealt.

## Play

- **Play solo** — personal best stored on this device.
- **Two player duel** — Grok, pass-and-play, or a private room.

**Your music** — play your own Spotify or Apple Music while you play, from the music button in any header or Settings → Sound. It keeps going between rounds and matches. Paste any playlist, album or track link, or connect an account (see `docs/env.template.md`).

Every reveal shows who took the round, by name, with both players' points racing and the totals rolling over. Locations do not repeat between games until you have seen the whole pool; then the ones seen longest ago come back first.

Drag the scene to look around, WASD to inspect, scroll to zoom. Unsubmitted pins score zero when the timer ends. South Africa uses a wider distance curve than the Netherlands; world sites are wider still.

## Setup

```
npm install
npm run dev          # http://localhost:8080
npm run verify       # tests, type checks, lint (add -- --build for the build)
npm run build
npm run smoke        # plays a whole match on the production build
```

`npm run smoke` needs a Chromium. Install Playwright's with
`npx playwright install chromium`, or point `CHROMIUM_PATH` at one.

## Architecture

See `docs/architecture.md`. Game rules live in `src/lib/game` so they can be tested without the UI.

## Providers

See `docs/providers.md`. Map: bundled Natural Earth countries (no live tile API). Location plates: Wikimedia Commons (CC BY-SA), checked by eye; optional Google Street View with `VITE_GOOGLE_MAPS_KEY`.

## Testing

```
npm run verify
npm run locations:validate
npm run build && npm run smoke
```

Unit tests cover the timer contract, haversine pairs, country-aware scoring, the playable pool and what the menus count, shuffled match deals with no repeats, the Street View swap, and the match state machine (including hidden answers before reveal). The smoke test plays a solo Escape from the home page to the results and a rematch, and fails on any page error.

## Deployment

The app builds with the workspace Vite / Vercel pipeline. Optional `VITE_STUN_URLS` is documented in `docs/env.template.md`. No provider API keys are required for launch.

## Known limitations

- Duel is host-authoritative P2P, not a dedicated game server. Private rooms only.
- The 3D reconstruction round is parked for OpenCode / GPT-6 Astra (`docs/round4-later.md`). Files are kept; `ROUND4_3D_LIVE` is false.
- A few launch plates are cinematic reconstructions where a Commons file could not be fetched at pack time.
- External map lookup cannot be fully prevented in a browser client.

## Roadmap

See `docs/roadmap.md`.
