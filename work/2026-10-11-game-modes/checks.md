# Checks: three modes from the big geo games

| node | requirement | verdict | evidence |
| --- | --- | --- | --- |
| baseline | `npm run verify -- --build` before any edit | pass | 255 pass; type checks, lint, build clean (commit 207fdf9) |
| 1 | Damage: the gap times ×1, ×1, ×1, ×1, ×1.5, ×2…; a draw does nothing | pass | `rules.test.ts`: multiplier and damage tests |
| 1 | A health duel ends at zero; more health wins if the deck runs out; a rematch keeps the rule | pass | `rules.test.ts`: knockout flow, rematch |
| 1 | South Africa × Netherlands health decks deal 10 places from each | pass | `rules.test.ts`: SA×NL deck 10/10 |
| 1 | A streak deck deals a country at a time and never opens a lap with the last lap's country | pass | `rules.test.ts`: streak deck laps |
| 1 | A streak ends on a wrong country or the clock; a pin near the answer counts | pass | `rules.test.ts`: counting, timeout, `pinInNation` cases |
| 2 | The creator's rules reach online rooms (p2p host and match server) | pass | `room.test.ts`, `transport.test.ts`: 28 multiplayer tests |
| 3 | Moving / No move / NMPZ on photos | pass | mv.mjs at 1280: NMPZ has no controls and the photo does not move; title card and header name the rule |
| 3 | The rules in the 3D scene | pass | r4.mjs with the 3D flag on in dev only: Moving has walk and orbit; No move has orbit only; NMPZ has no controls |
| 3 | Settings → Movement saves the rule | pass | axe-set.mjs: NMPZ saved; axe clean at 390 (Classic) and 1280 (Mono) |
| 4 | Health duel against Grok, to a knockout | pass | hd.mjs at 1280 (Classic) and 390 (Mono): lobby switch, bars, "Grok loses 3,922 health · 2,078 left", "knocked out", "won with 6,000 health left, in 2 rounds" |
| 5 | Country Streak from home, kept then lost | pass | st.mjs at 1280 (Classic) and 390 (Mono): "Right country · 1 in a row", "Your pin was in Libya. The streak ends at 1.", best saved and shown on home |
| 6 | axe on the new screens in both looks | pass | axe-gf.mjs and hd-axe.mjs: clean; the one finding (Mono wordmark orange on white, 3.2:1) fixed to 5.2:1 |
| 6 | Reduced motion | pass | axe-gf.mjs with the OS setting; the health shake, health bar and reveal line have reduced-motion rules |
| 6 | Phones | pass | Mono reveal ledger was clipped at 390 with a long miss; it now fits, and wraps as a fallback |
| 6 | Gates | pass | `npm run verify -- --build`: 270 pass; `npm run smoke` with two new steps |
