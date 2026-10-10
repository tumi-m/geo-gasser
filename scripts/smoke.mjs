#!/usr/bin/env node
// Browser gate: serve the production build the way Vercel does (files first,
// then index.html) and play a whole solo Escape in a real browser, at phone
// size, from the home page to the results.
//
//   npm run build && npm run smoke
//   CHROMIUM_PATH=/path/to/chrome npm run smoke   (when Playwright's own
//                                                   browser is not installed)
//
// Exit code is non-zero on any failed step or page error. It needs no network:
// photos and map data ship with the build; Street View stays off without a key.

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const ROOT = new URL("../.vercel/output/static/", import.meta.url).pathname;
if (!existsSync(join(ROOT, "index.html"))) {
  console.error("No production build in .vercel/output. Run `npm run build` first.");
  process.exit(1);
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2",
};

const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  let file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(ROOT, "index.html");
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const rows = [];
const record = (name, ok, evidence) => rows.push({ name, verdict: ok ? "pass" : "fail", evidence });

let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
} catch (error) {
  server.close();
  console.error(`Could not start a browser: ${error.message.split("\n")[0]}`);
  console.error("Install one with `npx playwright install chromium`, or set CHROMIUM_PATH.");
  process.exit(1);
}

const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
// Seeded before any script runs, so the home page's first save keeps it.
await page.addInitScript(() => {
  if (sessionStorage.getItem("smoke-seeded")) return;
  localStorage.setItem(
    "atlas-duel-settings-v3",
    JSON.stringify({ displayName: "Smoke", namePrompted: true, avatarId: "atlas", matchLength: "escape" }),
  );
  sessionStorage.setItem("smoke-seeded", "1");
});

async function step(name, fn) {
  const started = Date.now();
  try {
    const evidence = await fn();
    record(name, true, `${evidence ?? "ok"} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    return true;
  } catch (error) {
    record(name, false, String(error.message ?? error).split("\n")[0].slice(0, 140));
    return false;
  }
}

const ok =
  (await step("home renders", async () => {
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Let.s explore/ }).waitFor({ timeout: 15000 });
    const footer = await page.locator(".expedition-footer span").first().textContent();
    return footer?.trim();
  })) &&
  (await step("Escape plays to the results", async () => {
    await page.getByRole("button", { name: /Let.s explore/ }).click();
    await page.waitForURL("**/play");
    for (let stop = 0; stop < 5; stop++) {
      await page.locator(".round-intro").waitFor({ timeout: 20000 });
      await page.locator(".round-intro").click();
      const map = page.locator(".leaflet-container").first();
      await map.waitFor({ timeout: 15000 });
      const box = await map.boundingBox();
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
      await page.getByRole("button", { name: "Lock guess" }).click();
      await page.locator(".round-splash").waitFor({ timeout: 15000 });
      for (let i = 0; i < 3 && (await page.locator(".round-splash").count()); i++) {
        await page.locator(".round-splash").click().catch(() => {});
        await page.waitForTimeout(500);
      }
      await page.getByRole("button", { name: /Continue|See results/ }).first().click();
    }
    await page.locator(".result-shell").waitFor({ timeout: 20000 });
    const stops = await page.locator(".result-shell section li li").count();
    return `results shown, ${stops} stop rows`;
  })) &&
  (await step("results offer a rematch", async () => {
    await page.getByRole("button", { name: "Rematch" }).click();
    await page.locator(".round-intro").waitFor({ timeout: 15000 });
    return "a new match starts";
  }));

record("no page errors", pageErrors.length === 0, pageErrors.length ? pageErrors[0].slice(0, 140) : "none");

await browser.close();
server.close();

console.log(
  ["| requirement | verdict | evidence |", "| --- | --- | --- |"]
    .concat(rows.map((r) => `| ${r.name} | ${r.verdict} | ${r.evidence} |`))
    .join("\n"),
);
process.exit(ok && pageErrors.length === 0 ? 0 : 1);
