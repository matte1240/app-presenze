import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "./app";
import { platformDb } from "./db/client";
import { env } from "./env";
import { startScheduledJobs } from "./services/jobs";

process.env.TZ = env.TZ;

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = existsSync(join(here, "migrations"))
  ? join(here, "migrations")
  : resolve("src/server/db/migrations");

// Migrations run as the owner, not as the application: the role the app
// signs in with deliberately cannot create or alter a table, which is the
// same reason the isolation policies apply to it.
await migrate(platformDb, { migrationsFolder });

// The SPA is a static bundle; anything that is not a file on disk and not an
// API call is a client-side route and gets the shell.
const webRoot = resolve("dist/web");
if (existsSync(webRoot)) {
  const indexHtml = readFileSync(join(webRoot, "index.html"), "utf8");
  app.use("/*", serveStatic({ root: "./dist/web" }));
  app.notFound((c) => (c.req.path.startsWith("/api/") ? c.json({ error: { code: "not_found", message: "Endpoint inesistente" } }, 404) : c.html(indexHtml)));
}

if (env.ENABLE_CRON) startScheduledJobs();

serve({ fetch: app.fetch, port: env.PORT, hostname: "0.0.0.0" }, (info) => {
  console.info(`${env.APP_NAME} in ascolto su http://localhost:${info.port}`);
});
