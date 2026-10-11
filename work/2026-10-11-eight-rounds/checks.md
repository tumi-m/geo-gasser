# Checks: eight rounds of fixes, polish and motion

| node | requirement | verdict | evidence |
| --- | --- | --- | --- |
| baseline | `npm run verify` before any edit | pass | 289 pass; type checks and lint clean (commit edb1005, deploy green) |
| 1 | Home has no sideways scroll on phones | pass | ovf.mjs: page was 401 px wide at 390 and 339 at 320 (the Career badge added last release pushed the avatar off-screen); the header is icons only under 480 px, now 390/390 and 320/320 |
| 1 | How to play opens at the top | pass | tut.mjs: scrollTop 0, focus on Close (touch) or Next (mouse); it used to open scrolled to "Got it" at the bottom on phones |
| 1 | How to play is a short animated guide, rules up to date | pass | five steps with looping art (look, pin drop, lock stamp, score count-up, ways to win); the rules in full now cover health duels, Country Streak, movement and pause; axe clean at 390 (Classic) and 1280 (Mono) |
| 1 | No developer text in Settings | pass | "This build has no Maps key (VITE_GOOGLE_MAPS_KEY)" → "Not available right now, so every round uses photographs." |
| 1 | Home motion | pass | the Country Streak flame flickers; the level badge glints; both off with reduced motion |
| 1 | Home, help, maps, settings, name prompt | pass | b1.mjs at 390, 320 (first run) and 1280 (Mono): axe clean, no page errors (certificate errors are the sandbox proxy blocking outside images) |
| 2 | Live round at 390, 320×568, 844×390 and 1280 | pass | b2.mjs: nothing covers a control in the live round, nothing off-screen; the clock counts from the start (clk.mjs: 45, 44, 43 …) |
| 2 | The panorama's controls reach screen readers | pass | axe at 320×568 flagged `nested-interactive`: the viewer was `role="img"` around its buttons; it is a labelled group now |
| 2 | The map hint fits small phones | pass | "Tap the map to…" was cut at 320; under 360 px it reads "Tap the map" |
| 2 | Motion: points falling off the pot | pass | potdrop.mjs: each step down drops "−500" beside the pot; hidden with reduced motion |
