# Graph: eight rounds of fixes, UI/UX and motion

## Goal

Every step of the journey has fun, purposeful motion, and each round ends
with a proper "player wins" moment. Every round: audit, fix what is found,
check in a browser at 390 px and 1280 px, `npm run verify -- --build`,
`npm run smoke`, push, Vercel green. Reduced motion is respected throughout.

## Inputs

- **Task:** 8 rounds of bug checks and fixes, UI/UX improvements and motion
  graphics; a winner celebration after each round.
- **Output:** game code and styles; a release note; lessons in AGENTS.md.
- **Acceptance checks:** checks.md.
- **Sources:** the current screens; audit scripts.
- **Allowed changes:** src/, docs/, AGENTS.md, this folder.
- **Limit:** three attempts per node; one push per round.

## Nodes

| node | reads | writes | check | kind |
| --- | --- | --- | --- | --- |
| 1 Winner moment | round splashes | winner celebration after each round | frames at 390/1280; duel win, loss, draw, solo; reduced motion | judgment |
| 2 Live round motion | in-round screen | pin drop ripple, lock shockwave, final-seconds countdown | frames; no layout shift | judgment |
| 3 Reveal motion | reveal card, HUD | points fly into the score, streaks | frames; totals still correct | judgment |
| 4 Match finale | results | trophy, confetti, personal best | frames; axe clean | judgment |
| 5 Home and menus | home, settings, atlas | entrance and interaction motion | frames; no overflow | judgment |
| 6 Duel lobby | lobby, online | opponent-joined moment, waiting motion | two-browser run | judgment |
| 7 Sweep | all screens | fixes from audits, axe, keyboard | audit scripts clean | code + judgment |
| 8 Ship | everything | release note, lessons | gates, smoke, deploy green | code |

## Edges

Each round is pushed before the next starts; 7 audits the work of 1–6.

## Rules learned while running it

(filled in as the rounds run)
