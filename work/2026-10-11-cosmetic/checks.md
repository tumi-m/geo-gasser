# Checks: roll back the redesign, keep a cosmetic pass

| node | requirement | verdict | evidence |
| --- | --- | --- | --- |
| baseline | `npm run verify -- --build` before any edit | pass | 251 pass; type checks, lint, build clean (commit 3cd93ed) |
| 1 Roll back | Layout, animations and map colours as before the redesign | pass | `git revert` of 3cd93ed; frames show the old home hero, round intro globe, splashes with confetti, results rays; South Africa green and Netherlands orange on the map |
| 1 Roll back | Scoring, countdown and Street View switch kept | pass | 251 tests pass; the countdown under the clock; the switch on every round, Photo first |
| 1 Roll back | Bug fixes kept | pass | desktop reveal map stops the old fly and checks its zoom; reduced-motion splash fades each piece once |
| 2 Cosmetic | No lime green; neutral darks; orange accent | pass | grep: no #d8f36a left in src or public; blue-green greys converted to neutral greys of the same lightness |
| 2 Cosmetic | The two players never share a colour | pass | player two (pins, rival arc, splash banner, summary pips, rival-locked chip, lobby orbit) uses `--color-rival` blue |
| 2 Cosmetic | Contrast | pass | axe7.mjs at 390 and 1280, match7.mjs, lobby7.mjs: clean everywhere |
| 3 Ship | Keyboard | pass | kb7.mjs: map focused after every splash; Rematch 2 Tabs away |
| 3 Ship | Reduced motion | pass | rm7.mjs (setting and OS): home 0 running (fixed an endless landing ping), splash 0 or settling, confetti hidden |
