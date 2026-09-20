# Roadmap

## Shipped (Sep 2026)

- **Server-authoritative online play** — Cloudflare Durable Objects own the deck, clock and scores (`workers/match`). The client falls back to P2P when no match server is configured.
- **Answer hygiene** — snapshots ship no deck, seed, environment ids, truth coordinate, source URL or title before the reveal; only a `SceneInfo` plate descriptor.
- **360 panoramas** — `PanoViewer` renders equirectangular plates (Table Mountain, Scheveningen Pier, Rijksmuseum) with drag-look and zoom.
- **Mapillary provider** — API v4 image/radius/URL access behind `VITE_MAPILLARY_TOKEN`, ready for street-level packs.
- **Content factory** — `scripts/build-locations.mjs` builds credited Commons/Mapillary packs with dedupe and quality filters.

## Next

1. **Pack ingestion** — load `src/data/packs/*.json` into selection and grow the pool from 149 to 1,000+ sites.
2. **Ranked play** — server-authoritative matches, hidden MMR, divisions, seasons, matchmaking queue.
3. **Daily Challenge + Country Streak** — shared seeds, streaks, shareable results, top-100 boards.
4. **Profiles and leaderboards** — accounts (guest-first), match history, ratings, achievements.
5. **Social** — parties with chat/emotes, spectators, 2v2 team duels, tournaments.
6. **Map maker** — community maps over the existing atlas system.
7. **Higgsfield / generated 3D** — wire `HiggsfieldEnvironmentProvider` when the MCP is actually present; keep the procedural fallback.
