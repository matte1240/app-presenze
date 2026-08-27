/**
 * The pruning rule, isolated from any storage.
 *
 * `selectBackupsToPrune` is pure precisely so this can run with no S3 and no
 * Postgres behind it — the property that matters ("never below the minimum
 * count, regardless of age") should not need either to verify.
 */
import { describe, expect, it } from "vitest";
import type { StoredBackup } from "./services/s3";

// `services/backup` pulls in `../env`, which validates `process.env` at import
// time and requires `DATABASE_URL` even though nothing here touches a
// database. A placeholder is enough: this suite never opens a connection.
process.env.DATABASE_URL ??= "postgres://unused";

const { selectBackupsToPrune } = await import("./services/backup");

const backup = (daysAgo: number, filename = `backup-${daysAgo}.dump`): StoredBackup => ({
  filename,
  sizeBytes: 1024,
  lastModified: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
});

describe("selectBackupsToPrune", () => {
  it("non tocca nulla sotto il numero minimo, per quanto vecchio", () => {
    const backups = [backup(400), backup(300), backup(200)];
    expect(selectBackupsToPrune(backups, { retentionDays: 30, minCount: 3 })).toHaveLength(0);
  });

  it("rimuove solo ciò che è sia oltre il minimo sia oltre la scadenza", () => {
    const backups = [backup(1), backup(2), backup(40), backup(50)];
    const removed = selectBackupsToPrune(backups, { retentionDays: 30, minCount: 2 });
    expect(removed.map((b) => b.filename)).toEqual([backup(40).filename, backup(50).filename]);
  });

  it("lascia stare ciò che è oltre il minimo ma ancora dentro la finestra di conservazione", () => {
    const backups = [backup(1), backup(2), backup(10)];
    expect(selectBackupsToPrune(backups, { retentionDays: 30, minCount: 2 })).toHaveLength(0);
  });

  it("un'installazione ferma per un mese non perde tutto quello che aveva", () => {
    // Every backup is old, but there were only ever three of them.
    const backups = [backup(60), backup(61), backup(62)];
    expect(selectBackupsToPrune(backups, { retentionDays: 30, minCount: 7 })).toHaveLength(0);
  });
});
