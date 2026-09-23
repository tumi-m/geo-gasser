# Providers and attribution

| Surface | Provider | Notes |
| --- | --- | --- |
| Guessing map | Leaflet + bundled Natural Earth countries (`src/data/world.json`, `detail.json`) | No live tile dependency. External raster/vector hosts (OpenFreeMap, Esri, OSM) were blank on mobile/Vercel. |
| Location plates | Wikimedia Commons / Wikipedia page images | CC BY-SA. Per-location credit in the location record. |
| 360 panoramas | Commons equirectangular files (Poly Haven CC0 uploads, Commons CC0/CC BY-SA) | Rendered by `PanoViewer`; per-site credit in the location record. |
| Street-level | Mapillary API v4 (`VITE_MAPILLARY_TOKEN`) | CC BY-SA 4.0. Credit Mapillary and the contributor. Public client token; unset = bundled stills only. Requests `thumb_original_url`, `thumb_2048_url` and `thumb_1024_url` and shows the widest that came back. |
| Pack building | `scripts/build-locations.mjs` | Commons geosearch and Mapillary radius search; writes credited JSON packs. |
| Generated plates | Imagine cinematic reconstructions | Used only where a live Commons file was unavailable. Labelled as reconstructions. |
| Earth globe | NASA Blue Marble (`land_shallow_topo_2048`) | Public domain. |
| Round 4 scene | Procedural Three.js + generated plates | Not a photograph. Higgsfield MCP adapter exists but is unused. |
| Signaling | App database (PGLite preview / Neon deploy) | Roster + SDP/ICE only (P2P fallback). |
| Match server | Cloudflare Durable Objects (`workers/match`) | Server-authoritative rooms over WebSockets. |
| Multiplayer data (fallback) | WebRTC data channels | Browser to browser. |
| Player's music (links) | Spotify and Apple Music official embeds | `open.spotify.com/embed/…`, `embed.music.apple.com/…`. URLs are rebuilt from validated ids on those two hosts only (`src/lib/music/links.ts`). No keys. |
| Player's music (Spotify account) | Spotify Web API + Web Playback SDK | Authorization Code with PKCE (`VITE_SPOTIFY_CLIENT_ID`), no client secret. In-page playback needs Premium. The SDK loads only after sign-in. |
| Player's music (Apple account) | Apple MusicKit JS v3 | Developer token signed server-side by `/api/apple-music-token` (ES256, `APPLE_MUSIC_*`). MusicKit loads only when the Apple tab is opened on a configured deployment. |

Do not ship provider API keys in the client beyond public client tokens
(Mapillary). Google Street View is not used: its terms forbid Street View
content beside a non-Google map and forbid caching, which conflicts with the
Leaflet guessing map.
