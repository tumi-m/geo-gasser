import type { IncomingMessage, ServerResponse } from "node:http";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Dev only: answer /api/* with the same handler Vercel runs in production
 * (src/server/api.ts), so local play matches the deploy.
 */
function apiDevServer(): Plugin {
  return {
    name: "atlas:api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === "string") headers.set(key, value);
            else if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
          }
          const method = req.method ?? "GET";
          const request = new Request(`http://${req.headers.host ?? "localhost"}${req.url}`, {
            method,
            headers,
            body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks),
          });
          const { handleApi } = (await server.ssrLoadModule("/src/server/api.ts")) as typeof import("./src/server/api");
          const response = await handleApi(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          console.error("[api]", error);
          res.statusCode = 500;
          res.end("api error");
        }
      });
    },
  };
}

/** Absolute link-preview image URLs need the production origin, known at build. */
function siteUrl(): Plugin {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return {
    name: "atlas:site-url",
    transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", host ? `https://${host}` : ""),
  };
}

// `0.0.0.0:8080` is the live-preview port.
export default defineConfig({
  server: { host: "0.0.0.0", port: 8080, strictPort: true },
  preview: { host: "127.0.0.1", port: 8081, strictPort: true },
  resolve: { tsconfigPaths: true },
  optimizeDeps: { include: ["leaflet"] },
  plugins: [apiDevServer(), siteUrl(), tailwindcss(), viteReact()],
});
