# Graph: roll back the redesign, keep a cosmetic pass

## Goal

The user found the whole-app redesign (3cd93ed) too radical: they wanted a
cosmetic change. Put the app back as it was before the redesign (layout,
animations, the South Africa green and Netherlands orange on the map),
keep what they asked for since (GeoGuessr scoring and the points countdown,
the Street View / Photo switch), keep real bug fixes, and change the look
only cosmetically: no more lime green everywhere. Limit: three attempts per
node.

## Decisions

- **Revert, don't hand-restore:** `git revert` of 3cd93ed brings back every
  layout, animation and colour exactly.
- **The cosmetic pass is colour:**
  - the accent goes from lime (#d8f36a) to Safety Orange (#FF5500);
  - the blue-green darks go to neutral charcoal;
  - type, shapes, shadows and motion stay as they were.
- **Player two gets blue (#5aa9ff).** Player two used the Netherlands
  orange; with an orange accent both players would be orange. The map's
  country colours stay: South Africa green, the Netherlands orange.
- **The HUD keeps the old round pips and question line,** with the points
  countdown under the clock restyled as a glass pill like the other HUD
  chips.

## Nodes

| node | reads | writes | check | kind |
| --- | --- | --- | --- | --- |
| 1 Roll back | 3cd93ed | revert; re-applied fixes; pips | gates | code |
| 2 Cosmetic pass | styles.css, components, map layers | palette, rival colour, countdown and ledger | frames; axe | judgment |
| 3 Verify and ship | everything | release note, lessons | gates, smoke, axe, keyboard, reduced motion, deploy | code + judgment |

## Edges

- 1 → 2 → 3
