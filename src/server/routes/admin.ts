import { Hono } from "hono";
import { requireAdmin } from "../auth/guards";
import { env } from "../env";
import type { AppEnv } from "../http/app-env";
import { exportData, exportFilename } from "../services/export";

/**
 * Maintenance. Every route here is behind `requireAdmin` — including, in the
 * previous build, a restore endpoint that was listed as a public path in the
 * middleware while its handler checked only that someone was logged in, so any
 * employee could overwrite the database. That endpoint is gone entirely now:
 * see `services/export.ts` for why.
 */
export const adminRoutes = new Hono<AppEnv>()
  .use("*", requireAdmin)

  .get("/export", async (c) => {
    const data = await exportData();
    return c.body(JSON.stringify(data, null, 2), 200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(env.APP_NAME)}"`,
    });
  });
