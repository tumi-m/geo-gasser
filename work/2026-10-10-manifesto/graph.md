# Graph: restyle the whole app to "The System Is the Content"

## Goal

Every screen follows the manifesto the user supplied: structure as
ornament (visible 1 px hairlines, square corners, no shadows, no blur, no
decorative gradients), Helvetica Bold caps for labels and headings,
monospaced tabular figures, black / white / #F4F4F4 with exactly one accent
(Safety Orange #FF5500) for active states, straight quotes framing primary
actions, metadata in plain sight, and mechanical 100–180 ms motion with no
springs. Limit: three attempts per node.

## Decisions

- **Two programs, one system.** Pages are documents on white (home, menus,
  duel lobby and room, results). The playing screen is an instrument in
  black that frames the photo. Both share tokens, type, hairlines and the
  accent; the instrument redefines the colour tokens in its own scope.
- **The map is a technical drawing:** white land, #F4F4F4 water, black
  borders and an exposed graticule, inside the black instrument.
- **Motion keeps its moments, not its springs.** Winner moments, the final
  count, points flying home and the finale stay, re-cut as mechanical
  steps: shutter flashes, hairline grids drawing in, hard type slams.
  Confetti, rays, glows and shimmer go.
- **Player identity colours stay** (the bot builder's colour is data the
  player chose), flattened: no shine, a hairline edge.
- **Accent contrast:** #FF5500 carries black text, or sits on black; never
  small orange text on white.
- **Quotes** are drawn by CSS with empty alt text, so screen readers and
  accessible names are unchanged.

## Nodes

| node | reads | writes | check | kind |
| --- | --- | --- | --- | --- |
| 1 Foundation | styles.css tokens, base, ui/ | tokens, type, radius, shadow, motion, buttons, inputs, modal, metadata strip | gates; screens still render | code + judgment |
| 2 Documents | home, tutorial, settings, atlas, name prompt, duel picker, room | document layouts | frames 320/390/1280; axe | judgment |
| 3 Instrument | match HUD, scene, map, reveal, splashes, intro | instrument layout; mechanical motion | frames incl. landscape; axe | judgment |
| 4 Finale | results, route, passport | document results; mechanical finale | frames; axe | judgment |
| 5 Sweep and ship | everything | fixes, release note, lessons | gates, smoke, axe, keyboard, reduced motion, deploy | code + judgment |

## Edges

- 1 → 2, 1 → 3, 1 → 4; 2, 3, 4 → 5
