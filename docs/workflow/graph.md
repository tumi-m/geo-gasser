# Graph: <task>

Copy to `work/YYYY-MM-DD-slug/graph.md`. Agree on it before building.

## Goal

<What done looks like, and the limit: time, attempts or scope.>

## Inputs

- **Task:** <one sentence>
- **Output:** <files or behaviour, with paths>
- **Acceptance checks:** <the rows checks.md will hold>
- **Sources:** <files, data or screens a node must read>
- **Allowed changes:** <paths that may be edited; everything else is read-only>
- **Limit:** <attempts per node (max 3), or a time box>

## Nodes

| node | reads | writes | check | kind |
| --- | --- | --- | --- | --- |
| A | <input> | <one output> | <one check> | code / judgment |
| B | <input> | <one output> | <one check> | code / judgment |

`kind: code` means the step has one right answer: write it as code with a
test. Two nodes never write the same file.

## Edges

- A → B (B consumes A's output)
- No edge between A and C: they may run in parallel.

## Rules learned while running it

<Rules a result proved. Move the lasting ones into AGENTS.md › Lessons.>
