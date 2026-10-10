# Graph: adopt a graph workflow for changes

## Goal

The repo carries its own way of working: a baseline, bounded nodes,
deterministic gates with evidence, capped retries, recorded lessons and a
resumable handoff. Done when both gates run from npm, prove they fail on a
broken test, and pass on main.

## Inputs

- **Task:** fold the useful parts of a graph-workflow prompt into the repo.
- **Output:** `AGENTS.md`, `docs/workflow/*.md`, `scripts/verify.mjs`,
  `scripts/smoke.mjs`, `npm run verify`, `npm run smoke`, README.
- **Acceptance checks:** see checks.md.
- **Sources:** the prompt; the release notes and mistakes from earlier work.
- **Allowed changes:** the files above and `package.json` scripts. No game
  code.
- **Limit:** three attempts per node.

## Nodes

| node | reads | writes | check | kind |
| --- | --- | --- | --- | --- |
| A verify gate | package.json scripts | scripts/verify.mjs | fails on a broken test, passes on main | code |
| B smoke gate | the production build | scripts/smoke.mjs | plays an Escape to the results with no page errors | code |
| C agreement | the prompt, past lessons | AGENTS.md, docs/workflow/* | names both gates; no tool names | judgment |
| D readme | README.md, A, B, C | README.md | setup and testing point at the gates | judgment |

## Edges

- A → C and B → C (the agreement names the gates).
- A → D, B → D, C → D.
- No edge between A and B: built in parallel.

## Rules learned while running it

- Playwright's bundled browser may be missing in a cloud session, so the
  smoke test takes `CHROMIUM_PATH`.
- A gate's failure output must name the failing test; the raw end of the
  test log does not.
