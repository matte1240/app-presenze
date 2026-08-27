/**
 * Per-organization backups.
 *
 * The whole-database backup (`services/backup.ts`) restores every company at
 * once, which is the right tool for losing the machine and the wrong one for
 * "we overwrote last Tuesday's calendar, can we have it back" — that should
 * never mean touching anyone else's data. This reuses the same JSON one
 * company can already download from its own Manutenzione screen
 * (`services/export.ts`), keeps a copy of it on S3 under a namespace of its
 * own, and adds the restore that export never had: replacing this one
 * organization's users, schedules, timesheet and requests with what a past
 * export says they were. Plan, status and subscription are untouched — they
 * are not part of what the export ever carried.
 *
 * Every function here runs inside `runInTenant`, same as `exportData` — the
 * back-office route opens that context, this module just uses it.
 */
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { hashPassword } from "../auth/password";
import { db } from "../db/client";
import { currentOrgId } from "../db/context";
import { leaveRequests, timeEntries, users, workSchedules } from "../db/schema";
import { exportData, type DataExport } from "./export";
import {
  backupInfo,
  deleteBackup,
  downloadBackupText,
  listBackups,
  presignedDownloadUrl,
  uploadBackup,
  type StoredBackup,
} from "./s3";

/**
 * A namespace of its own, independent of `BACKUP_PREFIX`: nesting under it
 * would mean the whole-database listing and retention sweep — which read
 * everything under that prefix — would also see, and could prune, backups
 * that belong to a single organization.
 */
const prefixFor = (organizationId: string) => `org-backups/${organizationId}/`;

function backupFilename(prefix: "backup" | "pre-restore"): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${stamp}.json`;
}

export async function listOrgBackups(organizationId: string): Promise<StoredBackup[]> {
  return listBackups(prefixFor(organizationId));
}

export async function orgBackupInfo(organizationId: string, filename: string): Promise<StoredBackup | null> {
  return backupInfo(filename, prefixFor(organizationId));
}

export async function presignedOrgBackupDownloadUrl(organizationId: string, filename: string): Promise<string> {
  return presignedDownloadUrl(filename, 300, prefixFor(organizationId));
}

export async function deleteOrgBackup(organizationId: string, filename: string): Promise<void> {
  await deleteBackup(filename, prefixFor(organizationId));
}

/** `prefix` is "pre-restore" for the safety copy a restore takes of itself before touching anything. */
export async function createOrgBackup(prefix: "backup" | "pre-restore" = "backup"): Promise<StoredBackup> {
  const organizationId = currentOrgId();
  const data = await exportData();
  const filename = backupFilename(prefix);

  await uploadBackup(filename, Readable.from(Buffer.from(JSON.stringify(data))), prefixFor(organizationId));

  const info = await backupInfo(filename, prefixFor(organizationId));
  if (!info) throw new Error("Il backup è stato caricato ma non risulta nello storage");
  return info;
}

/** `JSON.parse` hands back plain strings; the timestamp columns need `Date` back before an insert will accept them. */
function reviveDates<T extends Record<string, unknown>>(row: T, keys: readonly string[]): T {
  const copy: Record<string, unknown> = { ...row };
  for (const key of keys) {
    if (typeof copy[key] === "string") copy[key] = new Date(copy[key] as string);
  }
  return copy as T;
}

/**
 * Replaces this organization's users, schedules, timesheet and leave requests
 * with what the chosen export says they were. Deleting `users` is enough on
 * its own: sessions, password resets, schedules, timesheet entries and leave
 * requests all cascade from it.
 *
 * The export never carries password hashes, so every restored user comes
 * back with one nobody knows — the same posture as inviting someone new. The
 * caller is expected to send each of them a password-reset link, which is why
 * their ids and emails come back here rather than being emailed from inside a
 * transaction.
 */
export async function restoreOrgBackup(
  filename: string,
): Promise<{ safetyBackup: string; users: Array<{ id: string; email: string }> }> {
  const organizationId = currentOrgId();

  const safety = await createOrgBackup("pre-restore");

  const raw = await downloadBackupText(filename, prefixFor(organizationId));
  const data = JSON.parse(raw) as DataExport;
  if (data.organization.id !== organizationId) {
    throw new Error("Questo backup appartiene a un'altra organizzazione");
  }

  await db.delete(users).where(eq(users.organizationId, organizationId));

  const restoredUsers = await Promise.all(
    data.users.map(async (row) => ({
      ...reviveDates(row as Record<string, unknown>, ["createdAt", "updatedAt", "deactivatedAt"]),
      // Unusable without the plaintext, which is never kept anywhere.
      passwordHash: await hashPassword(randomUUID()),
    })),
  );
  if (restoredUsers.length > 0) {
    await db.insert(users).values(restoredUsers as unknown as (typeof users.$inferInsert)[]);
  }

  if (data.workSchedules.length > 0) {
    await db.insert(workSchedules).values(data.workSchedules as (typeof workSchedules.$inferInsert)[]);
  }
  if (data.timeEntries.length > 0) {
    const revived = data.timeEntries.map((row) =>
      reviveDates(row as Record<string, unknown>, ["createdAt", "updatedAt"]),
    );
    await db.insert(timeEntries).values(revived as unknown as (typeof timeEntries.$inferInsert)[]);
  }
  if (data.leaveRequests.length > 0) {
    const revived = data.leaveRequests.map((row) =>
      reviveDates(row as Record<string, unknown>, ["createdAt", "reviewedAt"]),
    );
    await db.insert(leaveRequests).values(revived as unknown as (typeof leaveRequests.$inferInsert)[]);
  }

  return {
    safetyBackup: safety.filename,
    users: (restoredUsers as unknown as Array<{ id: string; email: string }>).map(({ id, email }) => ({
      id,
      email,
    })),
  };
}
