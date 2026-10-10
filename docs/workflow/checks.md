# Checks: <task>

Copy to `work/YYYY-MM-DD-slug/checks.md`. One row per requirement. The
verdict is `pass`, `fail` or `unresolved`. The evidence is a file path, a
command and its result, or a screenshot path; never "looks fine".

`npm run verify -- --out work/<task>/checks-verify.md` writes the
deterministic rows for you.

| node | requirement | verdict | evidence |
| --- | --- | --- | --- |
| baseline | `npm run verify` before any edit | | |
| A | <requirement> | | |
| final | `npm run verify -- --build` | | |
| final | `npm run smoke` | | |
| final | Vercel deploy for the pushed commit | | |
