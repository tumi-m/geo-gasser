# Graph: three modes from the big geo games

## Goal

Add three features the most popular geo-guessing games have and Atlas Duel
lacked, chosen by the user:

- **Health-bar duels**;
- **Moving / No move / NMPZ** movement rules;
- **Country Streak**.

Each is rebuilt from how these modes publicly work, not from anyone's code:
the user asked to decompile a competitor's client, and that was declined.
Limit: three attempts per node.

## The rules we play

- **Health duels** (a duel option next to "highest total wins"):
  - both players start with 6,000 health;
  - after each place, the lower round score loses the gap between the two
    scores, times the place's multiplier;
  - the multiplier is ×1 for places 1–4, then rises by 0.5 a place (×1.5,
    ×2, ×2.5…);
  - first to 0 loses;
  - if the deck runs out first, more health wins (then the usual
    tie-breaks);
  - every place is its own round, and a deck holds up to 20 places.
  - Public descriptions of the big game's duels disagree on the exact
    multipliers, so these numbers are ours, documented here.
- **Movement rules** (Settings, for every match; the host's rule applies
  online):
  - **Moving:** as now. Look around, zoom, step between viewpoints, walk in
    Street View.
  - **No move:** look around and zoom; no stepping between viewpoints, no
    walking.
  - **NMPZ** (no move, no pan, no zoom): one fixed view. Photos show whole,
    Street View holds its starting view, and 3D scenes hold their camera.
- **Country Streak** (a solo mode):
  - one place at a time, from every country in the game, dealt a country at
    a time;
  - drop a pin in the country you think it is;
  - the right country adds 1, and a wrong one (or the clock running out)
    ends the run;
  - your best streak is saved;
  - judged on the country shapes the map draws, with a box for places too
    small to have a shape (Hong Kong, Singapore).

## Nodes

| node | reads | writes | check | kind |
| --- | --- | --- | --- | --- |
| 1 Rules engine | types, machine, selection, scoring, stats, settings | rules.ts, country-at.ts, plans, reducer, stats, settings | unit tests | code |
| 2 Online | room.ts, worker, use-match-room, match-app create | rules in CREATE_DUEL and room params | room tests | code |
| 3 Movement UI | scene-explorer, street-view-scene, round4-scene, settings | rule enforcement, picker, HUD chip | browser: gestures blocked/allowed | code + judgment |
| 4 Health UI | duel-lobby, score-tally, splash, reveal, results | health bars, damage, winner by health | browser frames, axe | judgment |
| 5 Streak UI | home, router, match-app HUD, reveal, results, stats | entry, counter, verdict, end, best | browser frames, axe | judgment |
| 6 Verify and ship | everything | release note, lessons | gates, smoke, axe/keyboard/reduced motion ×2 looks | code + judgment |

## Edges

- 1 → 2, 1 → 3, 1 → 4, 1 → 5; 2, 3, 4, 5 → 6
