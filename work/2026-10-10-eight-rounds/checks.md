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
