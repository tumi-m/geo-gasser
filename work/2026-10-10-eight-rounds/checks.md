# Checks: eight rounds of fixes, UI/UX and motion

| node | requirement | verdict | evidence |
| --- | --- | --- | --- |
| baseline | `npm run verify` before any edit | pass | 242 pass, 0 fail; type checks and lint clean (commit 6c98fcf) |
| 1 | Escape duel round end shows the winner moment | pass | "YOU WIN ROUND 1" / "GROK WINS ROUND 1", crown, 46 confetti pieces (frames esc-youwin, esc-duel) |
| 1 | Classic round summary shows it (win, loss) | pass | summary "YOU WIN ROUND 1", "GROK WINS ROUND 1" with crown and confetti |
| 1 | Solo rounds earn stars; text fits at 360 px | pass | "OUTSTANDING · ROUND 1" ★★★, "GOOD JOB · ROUND 1 COMPLETE" at 360 px |
| 1 | Reduced motion: words only, no confetti or rays | pass | sum-reduced: banner shown, 0 confetti |
| 1 | star thresholds | pass | roundStars test (243 pass) |
| 1 | gates | pass | verify --build and smoke green |
| 2 | Rival locks first: "GROK LOCKED IN!" pop, also in the rival-first phase | pass | live-rival-390; bug found and fixed: phase "waiting_for_opponent" was not counted as live |
| 2 | Final five seconds: one number a beat over the scene | pass | live-count-390 shows "5" with the red edge |
| 2 | Lock shockwave in duel and solo; rings removed after | pass | shock.mjs: 2 rings on lock, 0 after 1.2 s, both modes |
| 2 | gates | pass | verify --build and smoke green |
| 3 | Solo: points fly from the reveal card into the header; the total waits for them | pass | fly.mjs: header 0 → 19,657 and 19,657 → 38,9xx only after the flight; fly-mid-390 |
| 3 | Streak badge from two good guesses in a row | pass | "2 IN A ROW" on the second; scoreStreak tests |
| 3 | Close guesses no longer stack the distance label on the answer | pass | sheet-dist: close guess shows no label, far guess keeps "2,422 km" |
| 3 | gates | pass | verify --build and smoke green |
| 4 | Duel win: confetti and rays behind the results, crown on your avatar; gone after 4.2 s | pass | fin-duelbot-you: fx on, crown on, fx removed after; 390 and 1280 px |
| 4 | Duel loss: crown on the winner, no confetti | pass | fin-duelbot-bot: crown on Grok, fx off |
| 4 | Solo new best for the match length: stamp "New personal best · Quick record was 20,000" plus confetti | pass | fin-play-you-20000; no stamp and no confetti without an earlier record |
| 4 | Bests are kept per match length; equal is not a new best; old saves still load | pass | stats tests (4 new) |
| 4 | Pass-and-play neither sets nor beats a record | pass | rearm.mjs: bests unchanged, no stamp |
| 4 | Bug: an online guest whose host started the rematch never had the next match recorded | pass | fixed by re-arming when the results close; rearm.mjs: matchesPlayed 3 → 4 → 5 without pressing Rematch |
| 4 | Reduced motion: stamp shown still, no confetti | pass | fin-play-you-20000-rm |
| 5 | Bug: picking a map card faded it (and the old pick) out for good | pass | packs.mjs: opacity 0.40 → 0 after the click before; 1 / 1 / 1 after. The reveal marker is now an attribute React leaves alone |
| 5 | Results reveals still work with the attribute | pass | revchk.mjs: 7 of 7 shown and visible; passport stamps animate |
| 5 | Bug: at 320 px the header pushed Settings half off screen | pass | w320.mjs: bot was at 302–346 px, now 260–304 |
| 5 | Settings tabs: one highlight slides to the chosen tab; labels clear the edge at 320–390 px | pass | menu5.mjs: highlight matches the tab to the pixel at 320, 390, 1280; tabs.mjs: "Picture" had 0 px right padding at 360, now 3.2 px, icons drop below 340 px |
| 5 | Picks pop: map card ring and tick, settings option tick | pass | e5-choice-390 |
| 5 | "Let's explore" catches the light; the bot perks up and bobs as you type its name | pass | e5-cta-390, e5-cta-1280, e5-name-390 |
| 5 | No horizontal overflow or page errors on home, name prompt, map cards, settings tabs, help, duel | pass | menus.mjs at 320, 360, 390, 1280 |
| 6 | Room code flips in a letter at a time; still reads as one code | pass | l6-code-390 mid-flip; h1 text "BFJ4AH" |
| 6 | Opponent joins: row slides in with a ring, VS stamp lands between the rows, Start pulses | pass | lobby6.mjs, two browsers: l6-join150, l6-join650, l6-joined at 320, 390, 1280; `start-ready` on Start |
| 6 | Screen readers hear who sat down | pass | host status "Guesty is here", guest status "Tumz is here" (there was no announcement before) |
| 6 | Copy invite: the tick pops | pass | `.is-copied` while "Copied" shows |
| 6 | No page errors in either browser | pass | lobby6.mjs at three widths |
| 7 | axe on every screen with the new motion: home, name prompt, settings (4 tabs), duel picker, room (waiting, joined: host and guest), live round, final five seconds, rival locked, round splashes, reveals, results during and after confetti | pass | axe7.mjs, match7.mjs, lobby7.mjs: no violations |
| 7 | Keyboard only: solo and bot duel from intro to Rematch | pass | kb7.mjs: 5 rounds each, results focused, Rematch 2 Tabs away, new match starts |
| 7 | Keyboard start puts focus on the map | pass | kb7.mjs: the map was 15 Tabs away every round, now 0; mouse and touch starts unchanged |
| 7 | Reduced motion (setting, or the OS alone): no confetti, rays or shake; stamp and crown stay | pass | rm7.mjs: 0 confetti with the setting; with the OS setting alone confetti is in the page but hidden, rays 0 |
| 7 | Bug: in landscape the final-seconds number sat behind the map | pass | m7-count-844: now centred in the scene strip left of the map |
| 7 | Bug: on landscape phones the map covered Grok's score in the duel card | pass | hudmap.mjs: card bottom 102 vs map top 78 before; rows now side by side, clear at 844×390, 667×375, 740×360, 932×430 and in portrait |
| 7 | Bug: the phone tally's tighter-row rule never applied (it targeted `role=row`; the rows are `listitem`) | pass | selector fixed; portrait card unchanged in size (88 px bottom) |
| 7 | 740×360 landscape: the map stops below the header (288 px instead of 300) | pass | hudmap.mjs: map top 60, header 56 |
| 7 | 740×360 landscape: the "SOUTH AFRICA" label is clipped at the map's lower edge; the country itself is in view | unresolved | hudmap-740 frame; the framing was left alone this round |
| 7 | Finale, room and live round in landscape and at 360 px | pass | fin.mjs 844×390 and 360×740, lobby6.mjs 844×390, match7.mjs 844×390 |
