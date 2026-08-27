/**
 * Whole-database backups.
 *
 * A per-tenant JSON export (`services/export.ts`) is what a customer takes
 * with them if they leave; this is what brings the whole installation back
 * after losing the machine it runs on. It shells out to `pg_dump`/`pg_restore`
 * rather than reimplementing either — those are the tools Postgres itself
 * ships for exactly this, exercised far more than anything written here could
 * be — and streams straight to object storage, so a database of any real size
 * never has to fit on the container's own disk.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env, s3Enabled } from "../env";
import { sendBackupNotice } from "./email";
import {
  backupInfo,
  deleteBackups,
  downloadBackupToFile,
  listBackups,
  uploadBackup,
  type StoredBackup,
} from "./s3";

const connectionString = (): string => env.DATABASE_ADMIN_URL ?? env.DATABASE_URL;

/** `pre-restore-` backups are never named this way, so pruning can tell them apart. */
function backupFilename(prefix: "backup" | "pre-restore"): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${stamp}.dump`;
}

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function exitCodeOf(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code !== null) resolve(code);
      else reject(new Error(`Processo terminato dal segnale ${signal}`));
    });
  });
}

/**
 * Custom format rather than a plain SQL script: it compresses on its own, and
 * it is what makes `pg_restore` able to filter or reorder objects later
 * instead of only ever replaying the whole thing verbatim.
 */
function spawnDump() {
  return spawn("pg_dump", ["--format=custom", "--no-owner", "--dbname", connectionString()], {
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Creates one backup and uploads it. `prefix` is "pre-restore" for the safety
 * copy a restore takes of itself before touching anything.
 */
export async function createBackup(prefix: "backup" | "pre-restore" = "backup"): Promise<StoredBackup> {
  if (!s3Enabled) throw new Error("Lo storage S3 non è configurato: impossibile creare un backup");

  const filename = backupFilename(prefix);
  const child = spawnDump();
  const stderr = readAll(child.stderr!);
  // Attached before the upload starts, not after it finishes: `pg_dump`'s own
  // output is small enough to fit in the OS pipe buffer, so the process can
  // exit — and fire `close` — before the upload ever awaits anything. A
  // listener attached too late simply misses an event that already happened,
  // which is indistinguishable from a hang.
  const exitPromise = exitCodeOf(child);

  try {
    await uploadBackup(filename, child.stdout!);
  } catch (error) {
    await exitPromise.catch(() => {});
    await deleteBackups([filename]).catch(() => {});
    throw new Error(`Caricamento del backup fallito: ${(error as Error).message}`, { cause: error });
  }

  const exitCode = await exitPromise;
  if (exitCode !== 0) {
    await deleteBackups([filename]).catch(() => {});
    throw new Error(`pg_dump ha restituito il codice ${exitCode}: ${(await stderr).slice(0, 2000)}`);
  }

  const info = await backupInfo(filename);
  if (!info) throw new Error("Il backup è stato caricato ma non risulta nello storage");
  return info;
}

/**
 * Age alone is not enough to prune by: an installation left quiet for a month
 * should not wake up and delete every recovery point it had. Pure and
 * dependency-free on purpose, so the selection itself is easy to test without
 * any storage behind it.
 */
export function selectBackupsToPrune(
  backups: readonly StoredBackup[],
  options: { retentionDays: number; minCount: number; now?: Date },
): StoredBackup[] {
  const now = options.now ?? new Date();
  const cutoff = now.getTime() - options.retentionDays * 86_400_000;
  const sorted = [...backups].sort((a, b) => b.lastModified.localeCompare(a.lastModified));
  return sorted.slice(options.minCount).filter((b) => new Date(b.lastModified).getTime() < cutoff);
}

/** Safety copies document what the database looked like right before an operator changed it; retention leaves them alone. */
const isSafetyCopy = (b: StoredBackup) => b.filename.startsWith("pre-restore-");

export async function pruneBackups(): Promise<string[]> {
  const backups = await listBackups();
  const toRemove = selectBackupsToPrune(
    backups.filter((b) => !isSafetyCopy(b)),
    { retentionDays: env.BACKUP_RETENTION_DAYS, minCount: env.BACKUP_MIN_COUNT },
  );
  if (toRemove.length > 0) await deleteBackups(toRemove.map((b) => b.filename));
  return toRemove.map((b) => b.filename);
}

export async function runScheduledBackup(): Promise<void> {
  const backup = await createBackup();
  const pruned = await pruneBackups();
  console.info(`Backup ${backup.filename} creato (${backup.sizeBytes} byte); rimossi ${pruned.length} backup obsoleti`);

  if (env.BACKUP_EMAIL_TO) {
    await sendBackupNotice(env.BACKUP_EMAIL_TO, backup.filename, backup.sizeBytes);
  }
}

/**
 * Replaces the contents of the database with a backup's, in place.
 *
 * `--clean --if-exists` makes `pg_restore` drop each object before recreating
 * it, which is what lets this run against the very database the application is
 * connected to without needing the privilege to drop and recreate the database
 * itself — a privilege the application's own role deliberately does not have.
 *
 * This is disruptive by nature: tables disappear and reappear one by one while
 * it runs, and anything reading or writing through the live connection pool at
 * that moment can see a brief, ordinary-looking error. There is no way around
 * that short of taking the application offline first, which is why it belongs
 * in a maintenance window, not why it is refused here.
 */
export async function restoreBackup(filename: string): Promise<{ safetyBackup: string }> {
  if (!s3Enabled) throw new Error("Lo storage S3 non è configurato: impossibile ripristinare un backup");

  const safety = await createBackup("pre-restore");

  const dir = await mkdtemp(join(tmpdir(), "presenze-restore-"));
  const dumpPath = join(dir, filename);
  try {
    await downloadBackupToFile(filename, dumpPath);

    const child = spawn(
      "pg_restore",
      ["--clean", "--if-exists", "--no-owner", "--dbname", connectionString(), dumpPath],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    const stderr = readAll(child.stderr!);
    const exitCode = await exitCodeOf(child);

    if (exitCode !== 0) {
      // pg_restore exits non-zero even for warnings alone — a role or
      // extension already owned differently, say — so this is surfaced for a
      // human to read rather than trusted as proof that nothing was restored.
      // The safety copy above is what makes that judgement call affordable.
      throw new Error(
        `pg_restore ha segnalato degli errori o degli avvisi (codice ${exitCode}); verifica i dati prima di continuare a lavorare:\n${(await stderr).slice(0, 4000)}`,
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  return { safetyBackup: safety.filename };
}
