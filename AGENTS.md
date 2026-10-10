# Working on Atlas Duel

How a change is planned, checked and handed over in this repo, whoever (or
whatever) makes it. The ideas are adapted from Andrej Karpathy's autoresearch
loop (github.com/karpathy/autoresearch) and a graph-workflow prompt by
@hanakoxbt: establish a baseline, change one thing, measure it against a fixed
check, keep what helps. The wording and the repo rules here are this
project's own.

## Done means

- `npm run verify -- --build` passes (tests, both type checks, lint, build).
- `npm run smoke` passes: the production build plays a whole match in a real
  browser.
- UI changes are looked at in a browser at phone (390 px) and desktop
  (1280 px) width.
- The task's `checks.md` has a row for every requirement, each with evidence.
- User-visible changes get a release note in `docs/release-YYYY-MM-DD.md`.
- Committed, pushed to `main`, and the Vercel deploy for that commit is green.

## 1. Baseline first

Run `npm run verify` before editing and record the result as the first rows of
the task's `checks.md`. A failure that was already there is recorded as
already there: not silently fixed inside an unrelated change, and not blamed
on it.

## 2. Split the work into nodes

Anything bigger than one sitting gets a folder `work/YYYY-MM-DD-slug/` with
`graph.md` (template: `docs/workflow/graph.md`). Write the graph and agree on
it before building.

- A node is one bounded job: one input, one output, one check.
- Split by what a node must read, not by folder.
- Draw an edge only where a node consumes another node's output. Nodes with
  no edge between them may run in parallel.
- Two nodes never edit the same file.
- Prefer fewer nodes when the results are comparable.

A small fix skips the graph and keeps only `checks.md`.

## 3. Code nodes

If a step has exactly one correct answer (counting places, deduping a deck,
sorting, comparing, checking quotas) it is code with a test, not judgment.
Examples already in the repo: `playableLocations()`, `planMatch()`,
`npm run locations:validate`, `scripts/verify.mjs`, `scripts/smoke.mjs`.
Judgment is for what code cannot decide: whether a photo shows the place, or
whether a screen reads well.

## 4. Gates

Every node's output passes a gate before it is merged. Evidence comes in
this order:

1. Deterministic checks: `npm run verify`, the node's own tests,
   `npm run smoke`.
2. The node's report: screenshots, measurements, axe results, file paths.
3. Judgment, last.

Verdicts are `pass`, `fail` or `unresolved`; unresolved stays visible in
`checks.md`. Never weaken a test, skip a check or loosen a threshold to get a
pass.

## 5. Return paths

- **Correction:** a failed gate sends the work back to the node that made
  it, with the reason, the evidence, and the scope "fix this node only". At
  most three attempts; after that, stop and report the blocker.
- **Learning:** when a result proves a rule, add it to *Lessons* below so the
  next change starts from it.

## 6. Boundaries

- Ask before bulk deletions, publishing somewhere new, or anything that
  spends money or uses a paid key.
- Work within the environment's network policy. Photo hosts may be
  unreachable from a cloud session; fetch scripts (`scripts/fetch-new-photos.mjs`)
  run where they are reachable.
- Keep a recoverable version (a commit) before a risky merge.
- Commits are authored as `Tumi <Tumeloxmalebo@gmail.com>`, with no
  co-author, generator or tool attribution lines. No assistant or tool names
  in code, docs or commit messages.
- Push to `main`.

## 7. Handoff

After each stage, update `progress.md` in the task folder (template:
`docs/workflow/progress.md`):

- **Graph:** nodes done, running and blocked.
- **Outputs:** exact paths to the current saved files.
- **Decisions:** what changed in `graph.md`, and why.
- **Open issues:** failures, uncertainties and blockers.
- **Next action:** the next ready node.

A new session reads `graph.md` and `progress.md` first and continues from the
recorded next action. Cloud sessions are thrown away, so commit the task
folder.

## Lessons

Rules this repo has already paid for:

- **Gates chain with `&&`, or run as `npm run verify`.** A gate chained with
  `;` once pushed failing tests.
- **Browser tests seed settings with `addInitScript`.** The home page saves
  default settings on load and overwrites a write made after navigation.
- **Failure state belongs to what failed.** Street View failure is keyed to
  the scene. A plain boolean outlived its place and swapped the next one
  before it had even tried to load.
- **Menus and the dealer read one pool** (`playableLocations`). Counting from
  a different list made the UI promise places a match could never deal.
- **Scroll reveals use a small fixed inset.** A percentage inset hid the last
  card on a short page for good.
- **A Mercator fit's centre is not its latitude midpoint.** Check map framing
  at the minimum zoom on the smallest panel.
- **Online, a guest's action that changes the host's screen is a request.**
  The host accepts it.
- **Photos are judged by eye before they are dealt.** File titles mislead:
  birds, plaques, guards and AI renders have all been filed as landmarks.
- **The clock waits for the scene.** The intro holds until the photo,
  panorama or Street View is on screen (8 s at most). Test slow loads by
  delaying `/locations/**`: a stub that answers at once hides the dark,
  empty scene a slow connection shows.
- **Report why Street View gave up.** A silent fallback looked like a broken
  game. The console now names the cause, and Google's own error names a
  refused key.
- **Test clicks where a person clicks, in the tallest layout.** A
  transparent header strip covered the Street View / Photo switch only in a
  duel, whose two-row score card makes the header taller. A solo test and a
  role-based click both missed it; `elementFromPoint` at the button's centre
  catches it.
- **A control that switches the scene never disappears; its unready side
  says why.** The Street View / Photo switch once cancelled the panorama
  search, so it was held back until a panorama was found. That left whole
  rounds without it: during the search, where there was no panorama, and on
  places with no photo. The search now runs once per place behind the
  photo, so the switch shows from the first second, Photo first, with
  Street View greyed and explained until it exists. A place with no photo
  shows its starting Street View frame, frozen, as its photo.
- **Temporary test hooks never reach a commit.** Remove them, and grep the
  diff before committing.
- **State set outside React goes in an attribute, not a class.** The scroll
  reveal added `is-in` with `classList`; React rewrote `className` when a
  map card was picked and the card faded out for good. React leaves
  attributes it does not render alone (`data-shown`).
- **When a role or element changes, grep the CSS for the old selector.**
  The phone tally's tighter rows targeted `[role=row]` long after the rows
  became `listitem`, and nothing failed.
- **Test landscape as a phone.** A desktop browser at 844×390 hovers and
  expands the map; a phone does not. Emulate touch (`isMobile`,
  `hasTouch`), and measure what sits over what. The final-seconds number
  and the duel card's second row were both hidden behind the map.
- **A celebration can depend on data that arrives one render late.** The
  results mount before the match's stats are recorded, so the confetti
  starts when its condition turns true, not from the first render's state.
- **Thresholds are shares of the maximum, and saved records carry a
  version.** Moving from 20,000 to 5,000 a round touched stars, streaks,
  share squares, map colours, moods and a solo win test, each written as a
  raw number. They now read `ROUND_MAX`. Saved bests from the old scale are
  set aside by `SCORING_VERSION`, not compared.
