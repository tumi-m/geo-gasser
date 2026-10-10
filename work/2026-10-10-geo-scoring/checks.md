# Checks: GeoGuessr scoring with a tiered points countdown

| node | requirement | verdict | evidence |
| --- | --- | --- | --- |
| baseline | `npm run verify` before any edit | pass | 248 pass, 0 fail; type checks and lint clean (commit 2ceb273) |
| 1 | GeoGuessr curve: 5000 × e^(−10d/size), 5,000 within 25 m | pass | scoring.test.ts: geoScore tests |
| 1 | Map sizes: bounding-box diagonals (ZA 2,135 km, NL 411 km) and GeoGuessr's world 14,916.862 km | pass | scoring.test.ts; computed from COUNTRY_BOUNDS, not typed in |
| 1 | Clock tiers ×1.0/0.9/0.8/0.7/0.6 in five equal slices, at 30/45/60 s | pass | timer.test.ts; scoring.test.ts: perfect pin 5,000 → 4,500 → 4,000 → 3,500 → 3,000 |
| 1 | No round pays more than 5,000 (round-4 ×1.25 removed) | pass | scoring.test.ts |
| 2 | Stars, streak, share squares, route colours, summary bars, bot moods, solo win test rescaled | pass | round-summary and share-card tests; grep finds no 20,000-scale thresholds |
| 2 | Old records set aside, everything else kept | pass | stats.test.ts: migrateStats |
| 3 | Countdown strip steps 5,000 → 4,500 → 3,000; drains; freezes at lock | pass | pot.mjs at 320, 360, 390, 844×390, 1280: cells lnnnn → slnnn → ssssl; locked "4,500 LOCKED" |
| 3 | Fits the header at every width; landscape map still clears it | pass | pot.mjs gap ≥ 10 px; hudmap.mjs clear at 844×390, 740×360, 667×375 |
| 3 | Phone header height | pass | 107 px before, 137 px with the strip, 123 px after merging pips and question line |
| 3 | Reveal ledger arithmetic | pass | DISTANCE 4,368 · CLOCK ×0.9 · ROUND 3,931 |
| 3 | axe, keyboard, reduced motion | pass | match7.mjs clean; kb7.mjs reaches Rematch; rm7.mjs no confetti or rays |
