#!/usr/bin/env node
// The deterministic gate every change passes before it is pushed.
//
//   npm run verify            tests, type checks, lint
//   npm run verify -- --build  …and the production build
//   npm run verify -- --out work/<task>/checks-verify.md
//
// Each check runs as its own process; the first failure stops the run and the
// exit code is non-zero, so `npm run verify && git push` can never push red.
// The table it prints is the evidence row format used in checks.md
// (docs/workflow/checks.md): requirement | verdict | evidence.

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const withBuild = args.includes("--build");
const outAt = args.indexOf("--out");
const outPath = outAt >= 0 ? args[outAt + 1] : undefined;

const checks = [
  { name: "tests", cmd: ["npm", "run", "-s", "test:game"], evidence: summariseTests },
  { name: "typecheck", cmd: ["npm", "run", "-s", "typecheck"] },
  { name: "typecheck:worker", cmd: ["npm", "run", "-s", "typecheck:worker"] },
  { name: "lint", cmd: ["npm", "run", "-s", "lint"] },
  ...(withBuild ? [{ name: "build", cmd: ["npm", "run", "-s", "build"] }] : []),
];

function summariseTests(out) {
  const pass = out.match(/^# pass (\d+)/m)?.[1];
  const fail = out.match(/^# fail (\d+)/m)?.[1];
  return pass != null ? `${pass} pass, ${fail ?? "?"} fail` : "no test summary";
}

// The lines that name what failed: each "not ok" test with its error, or,
// for tools without that marker, the end of the output.
function failureDetail(out) {
  const lines = out.split("\n");
  const hits = [];
  lines.forEach((line, i) => {
    if (/^\s*not ok\b/.test(line)) hits.push(lines.slice(Math.max(0, i - 1), i + 8).join("\n"));
  });
  return hits.length ? hits.slice(0, 5).join("\n\n") : lines.slice(-30).join("\n").trim();
}

const rows = [];
let failed = false;
for (const check of checks) {
  if (failed) {
    rows.push({ name: check.name, verdict: "unresolved", evidence: "not run: an earlier check failed" });
    continue;
  }
  const started = Date.now();
  const run = spawnSync(check.cmd[0], check.cmd.slice(1), { encoding: "utf8", shell: false });
  const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const ok = run.status === 0;
  const detail = check.evidence ? check.evidence(out) : ok ? "clean" : "failed";
  rows.push({ name: check.name, verdict: ok ? "pass" : "fail", evidence: `${detail} (${secs}s)` });
  if (!ok) {
    failed = true;
    console.error(`\n✗ ${check.name} failed:\n${failureDetail(out)}\n`);
  }
}

const table = [
  "| requirement | verdict | evidence |",
  "| --- | --- | --- |",
  ...rows.map((r) => `| ${r.name} | ${r.verdict} | ${r.evidence} |`),
].join("\n");
console.log(table);

if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${table}\n`);
}
process.exit(failed ? 1 : 0);
