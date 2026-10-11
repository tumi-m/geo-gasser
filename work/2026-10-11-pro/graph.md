# Graph: a finished, paid-game feel

## Goal

The user asked for the UI and UX to feel like a professional game people
would pay for, plus two fixes: no town dots on the map (they hint at where
places are) and no quote-mark styling.

The look stays as it is: Classic and the Mono skin keep their layouts,
landing page and motion (see the redesign lessons). What is added is what
paid games have and this one lacked:

- **Progression:** experience from every match, levels with titles, and a
  level badge on the player's avatar.
- **Medals:** achievements for moments worth remembering, announced on the
  results screen.
- **A Career page:** level, records, medals and the countries seen.
- **Pause:** solo modes stop the clock and cover the scene; Esc toggles it.

## Numbers (ours)

- XP: 10 a place; 1 per 100 points (Country Streak: 25 a right country);
  100 for a duel win; +10% on No move, +25% on NMPZ.
- Levels: 300 XP to level 2, then 100 more each level. Titles: Tourist (1),
  Backpacker (3), Explorer (6), Navigator (10), Pathfinder (15),
  Cartographer (20), Globetrotter (30), Atlas (40).
- 19 medals, listed in `src/lib/game/career.ts`.
- Pass and play earns nothing, like its records: it shares one device.

## Nodes

| node | reads | writes | check | kind |
| --- | --- | --- | --- | --- |
| 1 Fair map, plain type | layers.ts, guess-map, mono quotes | no dot layer; no `quoted` | browser: reveal map, Mono buttons | code + judgment |
| 2 Career engine | stats.ts, rules.ts | career.ts, stats fields | unit tests | code |
| 3 Results | match-app stats effect, final-results | XP bar, level up, medals | browser frames, axe | judgment |
| 4 Career page | career.ts, stats, home nav, router | /career, nav link, level badge | browser frames, axe | judgment |
| 5 Pause | machine.ts, match-app clock and HUD | PAUSE/RESUME, pause menu | unit tests; browser: clock holds | code + judgment |
| 6 Verify and ship | everything | release note, lessons | gates, smoke, axe/keyboard/reduced motion ×2 looks | code + judgment |

## Edges

- 2 → 3, 2 → 4; 1, 3, 4, 5 → 6
