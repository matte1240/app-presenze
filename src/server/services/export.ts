/**
 * Data export.
 *
 * The SQLite build offered a file-level backup (`VACUUM INTO`) and a restore
 * that swapped the database out from under the running process. Neither
 * survives the move to Postgres, and neither should: a restore endpoint that
 * replaces the whole database is a loaded gun once more than one company's
 * data lives in it.
 *
 * What an administrator actually needs is their own data, in a form they can
 * keep. That is this: a plain JSON document, no file paths, nothing that
 * reaches past the rows the caller is allowed to read. Backing up the database
 * itself is an operator's job (`pg_dump`), documented in the README.
 */
import { db } from "../db/client";
import { leaveRequests, timeEntries, users, workSchedules } from "../db/schema";

export const EXPORT_FORMAT_VERSION = 1;

export interface DataExport {
  formatVersion: number;
  exportedAt: string;
  users: unknown[];
  workSchedules: unknown[];
  timeEntries: unknown[];
  leaveRequests: unknown[];
}

/**
 * Sessions and password resets are deliberately absent: they are credentials
 * with a shelf life, not records worth carrying anywhere.
 */
export async function exportData(): Promise<DataExport> {
  const [userRows, scheduleRows, entryRows, requestRows] = await Promise.all([
    db.select().from(users).orderBy(users.name),
    db.select().from(workSchedules),
    db.select().from(timeEntries).orderBy(timeEntries.workDate),
    db.select().from(leaveRequests).orderBy(leaveRequests.startDate),
  ]);

  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    // The hash never leaves the database, even in an export the administrator
    // asked for: it is the one field that would turn a leaked file into a set
    // of guessable passwords.
    users: userRows.map(({ passwordHash: _passwordHash, ...rest }) => rest),
    workSchedules: scheduleRows,
    timeEntries: entryRows,
    leaveRequests: requestRows,
  };
}

export function exportFilename(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = prefix.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "dati"}-${stamp}.json`;
}
