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
| 3 | Rounds won and callouts follow written rules | pass | `round-moment.test.ts`: 9 tests (wins, runs, lead change on points and on health, close call, shutout, perfect first, rounds of ten, solo hot streak, labels) |
| 3 | A celebration after every round in a duel | pass | splashrec2.mjs (bot duel, B-Y-Y): "Rounds won" Tumz 1→2 as a trophy flies in, then "2 in a row"; Mono (Y-B-Y): 2–1, no callout, as the rules say |
| 3 | Solo rounds celebrate too | pass | splashrec2.mjs (solo Y-Y-P): "+5,000 Perfect read", three stars, "Perfect" and "On fire · 3 great rounds" |
| 3 | Rounds of ten (Quick and longer) | pass | quick10.mjs: ten-place round summary keeps its crown, banner and confetti; the tally shows only when a match has more than one round |
| 3 | Country Streak milestones | pass | every fifth country in a row: confetti, "5 in a row", "streak milestone", "Keep it going" |
| 3 | The moment fits every screen | pass | it used to run under the header and over the map on phones; now it takes the whole screen (inner 265–627 of 844 at 390; 130–486 of 568 at 320×568); the map returns with the reveal |
| 3 | A stray rule no longer bends the splash | pass | `.splash-headline span` made every span inline-block (it had already stacked the stars); now `> span` |
| 3 | Reduced motion, axe, screen readers | pass | with the setting on: fades only, the tally shows its final count; axe clean; the status reads "…Tumz leads by 7,835. 2 in a row." |
| 4 | Reveal headlines rise with accuracy | pass | 2 km read "GOOD JOB" while 60 km read "SO CLOSE"; now SPOT ON (≤5 km), SO CLOSE (≤25), NICE INSTINCTS (≤80); `scoring.test.ts` "praise a closer guess more" |
| 4 | Reveal card at 390, 320×568, 844×390 and 1280, both looks | pass | b4.mjs: card on screen, Continue visible, the answer and your pin never under the card, nothing spills out of the card, axe clean |
| 4 | A scrolling reveal card says there is more | pass | on 320×568 the duel rows sit below the fold; the card's foot fades while there is more to scroll (`data-more`) |
| 4 | Motion: reveal badges | pass | badges pop in one after another; Bullseye glints gold (ink in Mono); off with reduced motion |
| 5 | Results after full matches (duel 390, solo 1280 Mono, duel 844×390) | pass | b5.mjs: no sideways scroll, every reveal fires, axe clean, Rematch two Tabs from the top |
| 5 | Rematch is always within reach | pass | after XP, medals, the route, passport and stats, Rematch sat ~1,500 px down on a phone; a Rematch/Home bar now floats at the foot until the buttons scroll into view (fab.mjs: shown at the top, gone with the buttons in view, Rematch from it starts a new match; both looks) |
| 5 | Motion: Career medals | pass | medals pop in one after another; earned discs glint; off with reduced motion; cp.mjs axe clean |
| 5 | Smoke after the floating bar | fail → pass | 7d9d50c was pushed with smoke failing ("results offer a rematch"): the floating bar adds a second Rematch button and the smoke's click matched two. The gate output was piped through grep, which hid the exit code. The smoke now clicks the first Rematch; gates run from a script that stops on a failure |
| 6 | A face-off opens every duel | pass | faceoff.mjs: bot duel at 390 (Classic) and 1280 (Mono): panels, VS, "Health duel · 6,000 each · NMPZ", "You · level 3 Backpacker" / "Bot rival"; axe clean; pass and play shows it too (b6.mjs) |
| 6 | The face-off never eats the round's time | pass | fotime.mjs: gone at 2.7 s, the title card then gets its full hold (round live at 5.1 s); Enter skips it in 0.4 s and leaves the title card |
| 6 | Mono face-off text reads on both halves | pass | the rule and hint crossed the white/black split on desktop; they sit on a black chip now |
| 6 | Lobby, pass and play, online room | pass | b6.mjs at 390 (Classic) and 1280 (Mono): axe clean, no sideways scroll; hotpin.mjs: player one's pin is gone at the handoff and on player two's turn |
| 7 | Health duels show the last hit | pass | b7.mjs: when the tally returns for the next place, "−2,314" floats off the hit player's bar (both looks); hidden with reduced motion |
| 7 | Country Streak's HUD flame | pass | b7.mjs: a flame on the streak counter jumps in on each country and glows hotter towards ten in a row (both looks) |
| 7 | Pause and settings | pass | pause re-checked in round 1's sweep and the last release (clock holds, scene covered); settings tabs axe clean at 320×568 (b1.mjs) |
| 8 | Short landscape screens | pass | the round-end moment ran 25 px past the foot at 844×390 and the face-off's desktop split crowded the names into the VS; both pack tighter under 500/560 px tall (moment inner 29–349 of 390) |
| 8 | Keyboard only | pass | t-kb8.mjs, bot duel at 1280 (Classic) and 390 (Mono): Enter skips the face-off and leaves the title card, map takes focus, Enter locks, Continue 4 Tabs away, Rematch 2 Tabs from the results' top |
| 8 | Reduced motion (OS setting) | pass | rm8.mjs: nothing loops on home or in How to play; the face-off is still and leaves on its own; the round-end moment is still and the tally shows its final count |
| 8 | Gates | pass | `npm run verify -- --build`: 299 pass (10 new this release); smoke passes |
