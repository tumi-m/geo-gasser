# Graph: GeoGuessr scoring with a tiered points countdown

## Goal

Every round scores the way GeoGuessr scores a guess: up to 5,000 points,
falling off exponentially with distance relative to the map's size. On top
of that, the points a round can still pay step down as the clock runs, and a
countdown in the header shows the pot falling tier by tier. The new surfaces
follow the "system is the content" manifesto the user supplied: hairline
borders, caps, tabular digits, one accent, mechanical 100–180 ms steps.
Limit: three attempts per node.

## Inputs

- **Task:** GeoGuessr-aligned scoring plus a descending points countdown
  tiered to the timer.
- **Output:** scoring in `src/lib/game/`; the countdown and reveal breakdown
  in `src/components/game/`; a release note.
- **Acceptance checks:** checks.md.
- **Sources:** `scoring.ts`, `timer.ts`, `machine.ts`, the reveal card, the
  HUD, everything that read the 20,000-point scale.
- **Allowed changes:** src/, docs/, AGENTS.md, this folder.
- **Limit:** three attempts per node; one push when every check passes.

## Decisions

- **Distance score (GeoGuessr):** `5000 × e^(−10 × d / size)`; 5,000 within
  25 m. `size` is the map's bounding-box diagonal: South Africa 2,135 km and
  the Netherlands 411 km (computed from `COUNTRY_BOUNDS`), the world
  14,916.862 km (GeoGuessr's own world map). Each place is scored on its
  own country's map, as before, so a mixed SA × NL map stays fair.
- **Clock tiers:** the round splits into five equal slices. The distance
  score is multiplied by ×1.0, ×0.9, ×0.8, ×0.7, ×0.6, so the pot reads
  5,000, 4,500, 4,000, 3,500, 3,000. The clock scales every guess in
  proportion, so a far guess can't be rescued by speed, and a perfect
  last-second guess still earns 3,000.
- **Round maximum 5,000.** The dormant round-4 ×1.25 is removed: GeoGuessr
  pays no round more than 5,000.
- **Duels** keep "highest total wins". GeoGuessr's health-bar duels would
  change how a match ends; that is a separate decision.
- **Records:** bests set under the 20,000 scale can't be compared; stats
  carry a scoring version, and old bests are set aside.
- **Manifesto scope:** the countdown and the reveal's score breakdown, the
  surfaces this change touches. A whole-app restyle is a separate decision.

## Nodes

| node | reads | writes | check | kind |
| --- | --- | --- | --- | --- |
| 1 Scoring core | scoring.ts, timer.ts, geo.ts | distance score, map sizes, clock tiers | unit tests | code |
| 2 Rescale | every 20,000-scale threshold | stars, streak, share tiers, splash, stats migration | unit tests; grep finds no old thresholds | code |
| 3 Countdown UI | HUD, reveal card | tiered points countdown; reveal breakdown | frames at 390/1280/landscape; axe | judgment |
| 4 Ship | everything | copy, release note, lessons | gates, smoke, deploy | code |

## Edges

- 1 → 2, 1 → 3, 2 → 4, 3 → 4
