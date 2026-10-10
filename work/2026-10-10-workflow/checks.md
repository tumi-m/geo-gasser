# Checks: adopt a graph workflow for changes

| node | requirement | verdict | evidence |
| --- | --- | --- | --- |
| baseline | gates before any edit | pass | 237 pass, 0 fail; type checks and lint clean |
| A | `npm run verify` stops at the first failure and exits non-zero | pass | a deliberate failing test in scoring.test.ts: exit 1, "tests: 237 pass, 1 fail", later checks "unresolved"; file restored |
| A | the failure output names the failing test | pass | printed "not ok 34 - gate must catch this", file and line, error 'deliberate' |
| A | `npm run verify -- --build` passes on the change | pass | checks-verify.md (237 pass, 0 fail; type checks, lint, build clean) |
| B | `npm run smoke` plays an Escape to the results on the production build | pass | home "114 places", 5 stop rows, a rematch starts, no page errors |
| C | AGENTS.md names no assistant or tool | pass | `git grep -i` for assistant names over the commit: no matches |
| D | README setup and testing point at verify and smoke | pass | README.md › Setup, Testing |
| final | Vercel deploy for the pushed commit | unresolved | checked after the push |
