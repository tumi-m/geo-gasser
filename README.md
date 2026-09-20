# ATLAS DUEL — South Africa × Netherlands

A four-round geo-guessing duel. Study a scene, drop a pin, lock in within 45 seconds. Accuracy and speed both score. Rounds 1–3 use real geography from a 30-location launch pack. Round 4 is a labelled 3D reconstruction.

## Play

- **Play solo** — four rounds, personal best stored on this device.
- **Two player duel** — create a room, share the code, host starts when both players are in.

Unsubmitted pins score zero when the timer ends. South Africa uses a wider distance curve than the Netherlands so a miss in the Karoo is not treated like a miss in Utrecht.

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

See `docs/providers.md`. Map tiles: Esri Canvas Dark Gray (no API key). Location plates: Wikimedia Commons (CC BY-SA) or labelled reconstructions. Round 4 is generated/procedural — never presented as a live photograph.

## Testing

```
npm test
npm run locations:validate
```

Unit tests cover the timer contract (10,000 points at 45s, 1,000 at 1s), haversine pairs, country-aware scoring, tie-breaks, launch-pool validation, round selection, and the match state machine (including hidden answers before reveal).

## Deployment

The app builds with the workspace Vite / Vercel pipeline. Optional `VITE_STUN_URLS` is documented in `docs/env.template.md`. No provider API keys are required for launch.

## Known limitations

- Duel is host-authoritative P2P, not a dedicated game server. Private rooms only.
- Higgsfield MCP is not available; Round 4 uses the procedural fallback.
- A few launch plates are cinematic reconstructions where a Commons file could not be fetched at pack time.
- External map lookup cannot be fully prevented in a browser client.

## Roadmap

See `docs/roadmap.md`.
