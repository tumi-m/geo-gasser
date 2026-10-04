#!/usr/bin/env node
/**
 * Package the built site for Vercel (Build Output API v3), after `vite build`:
 *
 *   .vercel/output/static/        the site from dist/
 *   .vercel/output/functions/api.func/index.mjs
 *                                 src/server/api.ts bundled into one file
 *   .vercel/output/config.json    /api/* → the function, everything else →
 *                                 a file if one exists, else index.html
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { build } from "vite";

const OUT = ".vercel/output";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync("dist", `${OUT}/static`, { recursive: true });

const FUNC = `${OUT}/functions/api.func`;
await build({
  configFile: false,
  logLevel: "warn",
  resolve: { tsconfigPaths: true },
  ssr: { noExternal: true, target: "node" },
  build: {
    ssr: "src/server/api.ts",
    outDir: FUNC,
    emptyOutDir: true,
    target: "node22",
    minify: false,
    copyPublicDir: false,
    rollupOptions: {
      // pg's optional native binding; pg only loads it on request.
      external: ["pg-native"],
      output: { format: "es", entryFileNames: "index.mjs", codeSplitting: false },
    },
  },
});
writeFileSync(
  `${FUNC}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
);

writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: "/assets/(.*)",
          headers: { "cache-control": "public, max-age=31536000, immutable" },
          continue: true,
        },
        { handle: "filesystem" },
        { src: "/api/(.*)", dest: "/api" },
        { src: "/(.*)", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);
console.log("vercel output ready: static site + /api function");
