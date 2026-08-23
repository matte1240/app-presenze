import { Hono } from "hono";
import { requireAdmin } from "../auth/guards";
import type { AppEnv } from "../http/app-env";
import { invalid } from "../http/errors";
import { createBackup, listBackups, pruneBackups, readBackup, restoreBackup } from "../services/backup";

const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

/**
 * Maintenance. Every route here is behind `requireAdmin` — including restore,
 * which in the previous build was listed as a public path in the middleware
 * while its handler checked only that someone was logged in, so any employee
 * could overwrite the database.
 */
export const adminRoutes = new Hono<AppEnv>()
  .use("*", requireAdmin)

  .get("/backups", (c) => c.json({ backups: listBackups() }))

  .post("/backups", (c) => c.json({ backup: createBackup(), pruned: pruneBackups() }, 201))

  .get("/backups/:filename", (c) => {
    const filename = c.req.param("filename");
    const buffer = readBackup(filename);
    return c.body(new Uint8Array(buffer), 200, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
  })

  .post("/backups/restore", async (c) => {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw invalid("Nessun file caricato");
    if (file.size === 0) throw invalid("Il file caricato è vuoto");
    if (file.size > MAX_UPLOAD_BYTES) throw invalid("Il file caricato è troppo grande");

    const result = restoreBackup(Buffer.from(await file.arrayBuffer()));
    return c.json({ ok: true, ...result });
  });
