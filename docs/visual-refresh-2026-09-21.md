# Photography and viewing refresh

- Real destination photography on the homepage, with manual destination previews.
- Settings separated into Game, Picture, Sound and You, with a bounded scrolling panel, persistent footer, keyboard tab navigation and dynamic focus trapping.
- Full-photograph and cinematic framing, direct photo framing/zoom/reset controls, optional control hints, desktop fullscreen, and Explore view to temporarily hide the map. Timers continue and the map returns for the result.
- Photos start without extra digital zoom. On phones the image fits the visible scene area above the map, rather than being hidden behind it.
- Panorama renderer callbacks no longer cause WebGL to be destroyed and recreated when the parent timer updates. Late texture loads are disposed safely; anisotropic filtering improves angled texture detail. Panorama failures use the flat-photo fallback.
- Table Mountain still upgraded from 1280 × 837 to its 2048 × 1340 original. V&A Waterfront keeps the 1280 × 768 mobile plate and adds its 5844 × 3506 original through responsive image selection. Both images were visually compared with the existing photos. Other catalog images are unchanged. Wikipedia fallback thumbnails request 1920px instead of 960px.

## Original image sources

The higher-resolution images are unchanged copies of the same photographs already in the game; existing location credits apply.

- Table Mountain: https://commons.wikimedia.org/wiki/File:Table_Mountain_DanieVDM.jpg
- V&A Waterfront: https://commons.wikimedia.org/wiki/File:Signal_Hill_and_Ferris_wheel_from_Victoria_Wharf_balcony,_Cape_Town.jpg

## Verification

App and worker TypeScript, all 103 game/map/multiplayer tests, and the production build pass. Browser checks covered desktop and 390 × 844 layouts, settings tabs, full-photo display, Explore view, visible countdown, and returning to the map at reveal. Integrated main through b64fd9c, preserving reconnects, ghost-seat handling, answer-deck protection and panel fixes. The Cloudflare worker was typechecked but not deployed or tested in production during this pass.
