# Checks: manifesto restyle

| node | requirement | verdict | evidence |
| --- | --- | --- | --- |
| baseline | `npm run verify` before any edit | pass | 251 pass, 0 fail; type checks and lint clean (commit e90b6c7) |
| 1 Foundation | Tokens: black, white, #F4F4F4, one accent #FF5500; square corners; no shadows, blur or decorative gradients | pass | `@theme` tokens; `--radius-*: 0`, `--shadow-panel: none`; legacy navy and lime hex swept from styles.css, globe presets and results (grep clean) |
| 1 Foundation | Helvetica Bold caps for labels, mono for figures, straight quotes on primary titles and actions | pass | `ui/button.tsx` base and `quoted` variant; `@utility quoted`; only IBM Plex Mono is loaded |
| 1 Foundation | Motion 100–180 ms, linear or mechanical, no springs | pass | motion sweep over styles.css; buttons 120 ms; panels 140 ms |
| 1 Foundation | Metadata in plain sight | pass | `system-meta.tsx`: build hash, build date, time zone, in the home footer |
| 2 Documents | Home, tutorial, settings, atlas, name prompt, duel picker, room, music panel | pass | frames at 320, 390, 1280; no horizontal overflow; tutorial as a ruled index; music tabs as a hairline switch |
| 3 Instrument | Match HUD, scene, map, intro slate, splashes, reveal | pass | inst.mjs at 320×568, 390×844, 740×360, 1280×800; reveal card and HUD chips solid, no translucency |
| 3 Instrument | Short screens | pass | 320×568: the gesture hint gives way so the photo strip stays clear; 740×360: the intro slate shrinks to fit |
| 4 Finale | Results as a document; finale re-cut as shutter and hairline grid | pass | res2.mjs at 320 and 1280; the grid fades at 1.8 s so it never runs through text for long; stat labels mono caps |
| 5 Sweep | axe | pass | axe7.mjs at 390 and 1280 (home, name prompt, four settings tabs, duel picker, results during and after the fanfare); match7.mjs (live round, final seconds, splashes, reveals); lobby7.mjs (room waiting, host, guest): all clean |
| 5 Sweep | Keyboard | pass | kb7.mjs: map focused after every splash, Continue in 4 tabs, results focused, rematch in 2 tabs |
| 5 Sweep | Reduced motion | pass | rm7.mjs (setting) and rm7.mjs os: home 0 running, splash settles to 0; fixed a pre-existing loop where avatar idles blinked on the reduced splash |
| 5 Sweep | Gates | pass | `npm run verify -- --build`: 251 pass, type checks, lint, build clean; `npm run smoke`: home, Escape to results, rematch, no page errors |
| 5 Sweep | Temporary test hooks out of the diff | pass | grep of the staged diff: none |
