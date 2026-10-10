# Progress: adopt a graph workflow for changes

## Graph

- **Done:** A verify gate, B smoke gate, C agreement, D readme.
- **Running:** none.
- **Blocked:** none.

## Outputs

- `AGENTS.md`
- `docs/workflow/graph.md`, `docs/workflow/checks.md`, `docs/workflow/progress.md`
- `scripts/verify.mjs` (`npm run verify`), `scripts/smoke.mjs` (`npm run smoke`)
- `work/2026-10-10-workflow/checks-verify.md`

## Decisions

- The agreement lives in `AGENTS.md`, a tool-neutral name, so the repo names
  no assistant.
- The smoke test serves the production build itself (files first, then
  index.html, as Vercel does), so it needs no running dev server and no
  network.
- Only the parts of the prompt that fit a one-person game repo were kept;
  there is no subagent orchestration, only nodes, gates and handoff.

## Open issues

- The smoke test covers solo play only. An online duel needs two browsers
  and signaling, and is still checked by hand.

## Next action

Push, then confirm the Vercel deploy and update the last row of checks.md.
