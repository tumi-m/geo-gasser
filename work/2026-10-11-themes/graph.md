# Graph: Classic by default, Mono as a theme in Settings

## Goal

The user liked the redesign's map and wants the redesign kept as an
option: Classic (the current look, with the orange cosmetic pass) stays
the default, and Mono (the "System Is the Content" redesign from 3cd93ed,
map included) is a theme chosen in Settings. Limit: three attempts per
node.

## Decisions

- **One theme's stylesheet on the page at a time.**
  - `src/styles.css` keeps what both share: Tailwind, the tokens (with
    Classic's values) and the utilities.
  - `src/themes/classic.css` and `src/themes/mono.css` hold everything
    else.
  - `src/lib/theme.ts` puts the chosen one in a `<style>` tag.
  - So the two never fight over a selector, and keyframes can share names.
  - Mono overrides the tokens on `:root`.
- **Mono loads only when picked.** It is a separate chunk of about 19 KB
  gzipped. Classic ships with the app, so default players wait for
  nothing. The first paint waits for the chosen theme, so a Mono player
  never sees Classic flash first.
- **Markup branches on `useMono()`.** Where the redesign changed markup
  (the home layout, the round-intro slate, the winner grid, the results
  eyebrow and quotes, buttons, the HUD line), the component renders
  either version. Both are the code of their own commits.
- **The map has a palette per theme** (`MAP_PALETTES`). MatchApp remounts
  the map when the theme changes, so switching mid-round redraws it.
- **Picker:** Settings → Picture → Look, with Classic and Mono.

## Nodes

| node | reads | writes | check | kind |
| --- | --- | --- | --- | --- |
| 1 Plumbing | settings, main, screens | `theme` setting, `lib/theme.ts`, picker | switch, reload, mid-match | code |
| 2 Split CSS | styles.css, 3cd93ed styles.css | entry + `themes/*.css` | both render | code |
| 3 Components | the redesign's diff | `useMono()` branches, map palettes | frames in both | code + judgment |
| 4 Verify and ship | everything | tests, smoke step, notes | gates, axe/keyboard/reduced motion ×2, prod build | code + judgment |

## Edges

- 1 → 3, 2 → 3, 3 → 4

## Revision: Mono becomes a skin (same day)

- **Why:** the user liked the original landing page and wants the motion
  graphics throughout the journey in both looks.
- **What changed:**
  - Mono now loads on top of Classic's stylesheet;
  - it changes looks only: tokens, square corners, the paper map, the black
    HUD, settings, music, duel, the countdown, ledger and results details;
  - the redesign's own layouts (index home, slate intro, grid winner
    moment) are gone;
  - its look-only rules were carried over without their motion, so
    Classic's animations and timing stay in charge.
