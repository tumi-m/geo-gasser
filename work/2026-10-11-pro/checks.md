# Checks: a finished, paid-game feel

| node | requirement | verdict | evidence |
| --- | --- | --- | --- |
| baseline | `npm run verify -- --build` before any edit | pass | 270 pass; type checks, lint, build clean (commit 48cd696, deploy green) |
| 1 | No town dots on the map, live or at the reveal | pass | dots.mjs: no dot pane during a round (390, 1280, both looks); reveal frames show town names only, centred; the white blocks during the fly-to are gone |
| 1 | No quote marks anywhere | pass | `quoted` utility and its uses removed; grep finds no `quoted`/`--quote-pull`; Mono buttons and the reveal tier read plain |
| 1 | Nothing in a live round names the place | pass | leak.mjs over 5 rounds: image alt "Location to identify", file names `loc_###`, no aria label or title with the place |
| 2 | XP, levels and medals follow the written numbers | pass | `career.test.ts`: 14 tests |
| 3 | Results show XP gained, the bar filling and a level up | pass | car.mjs at 1280 (Classic) and 390 (Mono): "+299 XP", "Level 2 reached", "Level 3 · you are now a Backpacker" when the title changes |
| 3 | Results list new medals | pass | car.mjs: six medals pop in after the bar; two columns on wide screens |
| 3 | Pass and play earns nothing | pass | the stats effect skips the career for hotseat, like its records |
| 3 | Health duel and Country Streak results carry XP | pass | hd-axe.mjs: "+210 XP … Win +100", 7 medals; st.mjs (Mono 390): "+45 XP … 1 country +25" |
| 4 | Career page: level, XP, records, medals, countries | pass | cp.mjs at 1280 (Classic) and 390 (Mono), seeded and empty; no horizontal scroll |
| 4 | Home header links to the Career with the level | pass | "Career, level 5"; on phones the badge alone, labelled |
| 5 | Pause stops the clock and gives the time back | pass | `pause.test.ts`: 5 tests; pz.mjs: 43 s held for 3 s, 41 s two seconds after resuming |
| 5 | The scene stays hidden while paused, Settings included | pass | pz.mjs: cover present with the pause menu and with Settings open from it |
| 5 | Esc pauses and resumes; leaving the tab pauses | pass | pz.mjs: Esc twice; hidden tab returns to "Welcome back" |
| 5 | Duels never pause | pass | duelhud.mjs: Settings button, no Pause; Esc opens nothing |
| 6 | axe on the new screens in both looks | pass | results (390 Classic, 1280 Mono), Career (both), pause menu (both): clean after two Mono contrast fixes (orange on white → #c24000 or ink) |
| 6 | Reduced motion | pass | car.mjs with the setting on: the final level shows at once; bar, level pop, medal spin and pause fade have reduced-motion rules |
| 6 | Gates | pass | `npm run verify -- --build`: 289 pass; `npm run smoke` with a new "career counts the match" step |
