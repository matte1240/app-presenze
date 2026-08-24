/**
 * Database backup and restore.
 *
 * `VACUUM INTO` writes a consistent, defragmented copy while the application
 * keeps serving, so there is no external tooling and no downtime. It refuses
 * to overwrite an existing file, hence the timestamped names.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { databaseFile, reopenDatabase, sqlite } from "../db/client";
import { env } from "../env";
import { invalid } from "../http/errors";
import { sendBackupNotice } from "./email";

export const BACKUP_EXTENSION = ".db";
const SQLITE_MAGIC = Buffer.from("SQLite format 3\0", "utf8");

const backupDir = resolve(env.BACKUP_DIR);

export interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

function ensureDir() {
  mkdirSync(backupDir, { recursive: true });
}

/** Rejects anything that could escape the backup directory. */
export function backupPath(filename: string): string {
  const safe = basename(filename);
  if (!safe.endsWith(BACKUP_EXTENSION) || safe.startsWith(".")) {
    throw invalid("Nome del backup non valido");
  }
  return join(backupDir, safe);
}

export function listBackups(): BackupFile[] {
  ensureDir();
  return readdirSync(backupDir)
    .filter((f) => f.endsWith(BACKUP_EXTENSION))
    .map((filename) => {
      const stat = statSync(join(backupDir, filename));
      return { filename, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createBackup(): BackupFile {
  ensureDir();
  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}${BACKUP_EXTENSION}`;
  const target = join(backupDir, filename);

  sqlite.prepare(`VACUUM INTO ?`).run(target);

  const stat = statSync(target);
  if (stat.size === 0) throw new Error("Backup vuoto");
  return { filename, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
}

/**
 * Age alone is not enough to delete by: a machine that was off for a month
 * would wake up and throw away every copy it had.
 */
export function pruneBackups(): string[] {
  const cutoff = Date.now() - env.BACKUP_RETENTION_DAYS * 86_400_000;
  const backups = listBackups();
  const removed: string[] = [];

  for (const backup of backups.slice(env.BACKUP_MIN_COUNT)) {
    if (Date.parse(backup.createdAt) < cutoff) {
      rmSync(join(backupDir, backup.filename), { force: true });
      removed.push(backup.filename);
    }
  }
  return removed;
}

export async function runScheduledBackup(): Promise<void> {
  const backup = createBackup();
  const pruned = pruneBackups();
  console.info(`Backup ${backup.filename} creato; rimossi ${pruned.length} backup obsoleti`);

  if (env.BACKUP_EMAIL_TO) {
    await sendBackupNotice(env.BACKUP_EMAIL_TO, backup.filename, backup.sizeBytes, join(backupDir, backup.filename));
  }
}

export function readBackup(filename: string): Buffer {
  const path = backupPath(filename);
  if (!existsSync(path)) throw invalid("Backup inesistente");
  return readFileSync(path);
}

/**
 * Swaps the live database for an uploaded one.
 *
 * The upload is verified as a readable SQLite file carrying our own tables
 * before anything is touched, and the current database is copied aside first —
 * a restore that turns out to be the wrong file should not also be the end of
 * the data that was there.
 */
export function restoreBackup(upload: Buffer): { restoredFrom: string; safetyCopy: string } {
  if (!upload.subarray(0, SQLITE_MAGIC.length).equals(SQLITE_MAGIC)) {
    throw invalid("Il file caricato non è un database SQLite");
  }

  ensureDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const incoming = `${databaseFile}.incoming`;
  writeFileSync(incoming, upload);

  try {
    const probe = new Database(incoming, { readonly: true });
    try {
      const tables = probe
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
        .all()
        .map((r) => (r as { name: string }).name);
      for (const required of ["users", "time_entries"]) {
        if (!tables.includes(required)) {
          throw invalid(`Il backup non contiene la tabella "${required}"`);
        }
      }
      probe.pragma("integrity_check");
    } finally {
      probe.close();
    }
  } catch (error) {
    rmSync(incoming, { force: true });
    throw error;
  }

  const safetyCopy = join(backupDir, `pre-restore-${stamp}${BACKUP_EXTENSION}`);
  sqlite.prepare(`VACUUM INTO ?`).run(safetyCopy);
  sqlite.close();

  for (const suffix of ["-wal", "-shm"]) rmSync(`${databaseFile}${suffix}`, { force: true });
  renameSync(incoming, databaseFile);
  reopenDatabase();

  return {
    restoredFrom: createHash("sha256").update(upload).digest("hex").slice(0, 12),
    safetyCopy: basename(safetyCopy),
  };
}
