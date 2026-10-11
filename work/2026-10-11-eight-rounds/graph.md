# Graph: eight rounds of fixes, polish and motion

## Goal

Eight rounds over the whole journey. Each round looks for bugs, fixes
them, improves the screens it covers, and adds motion graphics. The user
asked especially for a motion graphic after every round: who won it in a
duel, how good it was in solo.

The look and the journey stay as they are (Classic by default, Mono as a
skin); motion is added to what is there, never swapped for something new.
Every new motion has a reduced-motion rule.

Each round is committed and pushed on its own, after the gates.

## Nodes

| node | reads | writes | check | kind |
| --- | --- | --- | --- | --- |
| 1 Home and first run | home-screen, tutorial, atlas picker, name prompt | fixes, motion | browser 320/390/1280 × 2 looks, axe | judgment |
| 2 Intro and live round | round-intro, match-app HUD, guess-map | fixes, pin and lock motion | browser, axe | judgment |
| 3 Round win celebration | round-splash, winner-moment, verdict | a celebration after every round | browser frames, reduced motion, axe | judgment |
| 4 Reveal and summary | reveal-sequence, round-summary-splash, map | fixes, reveal motion | browser, axe | judgment |
| 5 Results and career | final-results, career-bits, career-page | fixes, finale motion | browser, axe | judgment |
| 6 Duels | duel-lobby, match-app lobby/hotseat/online | fixes, VS face-off | browser, axe, room tests | code + judgment |
| 7 Modes and settings | streak, health, pause, settings | fixes, streak and damage motion | browser, axe | judgment |
| 8 Final sweep | everything | release note, lessons | gates, smoke, axe/keyboard/reduced motion × 2 looks | code + judgment |

## Edges

- Rounds run in order: each starts from the last one's commit.
