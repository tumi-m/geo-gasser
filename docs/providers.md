# Providers and attribution

| Surface | Provider | Notes |
| --- | --- | --- |
| Guessing map | MapLibre GL JS + bundled Natural Earth 110m countries (`/maps/world.json`) | No live tile dependency. External raster/vector hosts (OpenFreeMap, Esri, OSM) were blank on mobile/Vercel. |
| Location plates | Wikimedia Commons / Wikipedia page images | CC BY-SA. Per-location credit in the location record and after reveal. |
| Generated plates | Imagine cinematic reconstructions | Used only where a live Commons file was unavailable. Labelled as reconstructions. |
| Earth globe | NASA Blue Marble (`land_shallow_topo_2048`) | Public domain. |
| Round 4 scene | Procedural Three.js + generated plates | Not a photograph. Higgsfield MCP adapter exists but is unused. |
| Signaling | App database (PGLite preview / Neon deploy) | Roster + SDP/ICE only. |
| Multiplayer data | WebRTC data channels | Browser to browser. |

Do not ship provider API keys in the client. None are required for the launch configuration above.
