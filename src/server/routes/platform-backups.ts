/**
 * Backup management for the back office.
 *
 * No guard of its own: mounted inside `platformRoutes` after its
 * `requirePlatformAdmin`, the same way `/organizations` and `/admins` are.
 * Every route here reaches every customer's data at once, which is exactly
 * why it belongs in the back office and nowhere near a tenant's own
 * "maintenance" screen.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { PlatformAdminRow } from "../db/platform-schema";
import { backupPrefix, env, s3Enabled } from "../env";
import type { AppEnv } from "../http/app-env";
import { invalid, notFound } from "../http/errors";
import { validate } from "../http/validate";
import { record } from "../services/audit";
import { createBackup, pruneBackups, restoreBackup } from "../services/backup";
import { backupInfo, deleteBackup, listBackups, presignedDownloadUrl } from "../services/s3";

/** `backup-<timestamp>.dump` or `pre-restore-<timestamp>.dump` — never anything a client made up. */
const FILENAME_PATTERN = /^(backup|pre-restore)-[0-9TZ-]+\.dump$/;

function assertKnownFilename(filename: string): void {
  if (!FILENAME_PATTERN.test(filename)) throw invalid("Nome del backup non valido");
}

function adminOf(c: { get: (k: "platformAdmin") => PlatformAdminRow | null }): PlatformAdminRow {
  const admin = c.get("platformAdmin");
  if (!admin) throw invalid("Sessione non valida");
  return admin;
}

const restoreSchema = z.object({
  /** Must equal the filename in the URL — the one place in the app that asks an operator to type out what they are about to destroy. */
  confirm: z.string(),
});

export const platformBackupRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const backups = s3Enabled ? await listBackups() : [];
    return c.json({
      enabled: s3Enabled,
      bucket: s3Enabled ? env.S3_BUCKET : null,
      prefix: backupPrefix,
      cronExpression: env.BACKUP_CRON,
      retentionDays: env.BACKUP_RETENTION_DAYS,
      minCount: env.BACKUP_MIN_COUNT,
      backups,
    });
  })

  .post("/", async (c) => {
    const admin = adminOf(c);
    const backup = await createBackup();

    await record({
      organizationId: null,
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      actorLabel: admin.email,
      action: "backup.created",
      detail: { filename: backup.filename, sizeBytes: backup.sizeBytes },
    });

    return c.json({ backup }, 201);
  })

  /** Applies the retention policy on demand, between two scheduled runs. */
  .post("/prune", async (c) => {
    const removed = await pruneBackups();
    return c.json({ removed });
  })

  .get("/:filename/download", async (c) => {
    const filename = c.req.param("filename");
    assertKnownFilename(filename);
    if (!(await backupInfo(filename))) throw notFound("Backup inesistente");

    // A signed link straight to the bucket: a multi-gigabyte dump has no
    // business passing through this process on its way to the browser.
    const url = await presignedDownloadUrl(filename);
    return c.redirect(url, 302);
  })

  .post("/:filename/restore", validate("json", restoreSchema), async (c) => {
    const admin = adminOf(c);
    const filename = c.req.param("filename");
    assertKnownFilename(filename);

    const { confirm } = c.req.valid("json");
    if (confirm !== filename) {
      throw invalid("Il nome digitato non corrisponde al backup da ripristinare");
    }
    if (!(await backupInfo(filename))) throw notFound("Backup inesistente");

    const result = await restoreBackup(filename);

    await record({
      organizationId: null,
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      actorLabel: admin.email,
      action: "backup.restored",
      detail: { filename, safetyBackup: result.safetyBackup },
    });

    return c.json({ ok: true, ...result });
  })

  .delete("/:filename", async (c) => {
    const admin = adminOf(c);
    const filename = c.req.param("filename");
    assertKnownFilename(filename);
    if (!(await backupInfo(filename))) throw notFound("Backup inesistente");

    await deleteBackup(filename);

    await record({
      organizationId: null,
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      actorLabel: admin.email,
      action: "backup.deleted",
      detail: { filename },
    });

    return c.json({ ok: true });
  });
