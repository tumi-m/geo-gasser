# Checks: Classic by default, Mono as a theme

| node | requirement | verdict | evidence |
| --- | --- | --- | --- |
| baseline | `npm run verify -- --build` before any edit | pass | 251 pass; type checks, lint, build clean (commit 17354dd) |
| 1 | Classic is the default; saves from before themes open in Classic | pass | `settings.test.ts`: 4 tests |
| 1 | Picking Mono in Settings → Picture switches the whole app and is remembered | pass | th-switch.mjs on dev and on the production build: white page, `theme-mono`, saved, kept after reload |
| 1 | Switching mid-match redraws the map | pass | th-switch.mjs: map dock and land change palette after picking Classic during a round |
| 2 | Only one theme's stylesheet is on the page | pass | one `#atlas-theme` style tag; Mono is its own chunk (19 KB gzipped) |
| 3 | Classic looks as it did before | pass | frames at 390: home, intro globe, live round, splash, reveal, results match 17354dd; the intro globe's last lime glow is now orange |
| 3 | Mono looks as the redesign did | pass | frames at 390, 740×360 and 1280: home index, slate intro, black instrument, drawing-style map, ledger, results record |
| 4 | axe in both themes | pass | axe7 at 390 and 1280, match7, lobby7: clean in Classic and in Mono |
| 4 | Keyboard in both themes | pass | kb7: map focused after every splash, Rematch 2 Tabs away |
| 4 | Reduced motion in both themes | pass | rm7 (setting and OS): home 0 running; splash settles |
| 4 | Gates | pass | `npm run verify -- --build`; `npm run smoke` with a new "Mono theme loads" step |
| revision | Mono keeps Classic's landing page and every motion graphic | pass | frames at 390 and 1280: photo hero with flight path and brush underline, globe on the packs heading, compass intro, confetti and rays on the splash, crown and rays on results, lobby orbits; all in Mono's black, white and orange with the paper map |
| revision | Short screens | pass | 320×568: the gesture hint gives way in both looks; 740×360: the compass card shrinks to fit |
| revision | axe, keyboard, reduced motion in both looks | pass | axe7 at 390 and 1280, match7, lobby7: clean; kb7 and rm7 (setting and OS) as before |
| revision | Gates | pass | `npm run verify -- --build`: 255 pass; smoke incl. "Mono theme loads"; the Mono skin chunk is 31 KB |

