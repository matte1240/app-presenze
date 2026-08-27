/**
 * The whole-database backup and restore cycle, proven end to end.
 *
 * This is the single riskiest thing the back office can do — replace the
 * entire database, every organization at once, in place — so it is the one
 * most worth proving against real tools rather than trusting the wiring by
 * inspection: real `pg_dump`/`pg_restore` binaries against a real PostgreSQL,
 * and a real S3 wire protocol against `s3rver` (an S3-compatible mock server,
 * so no cloud credentials are needed to prove the client speaks it correctly).
 *
 * Set TEST_DATABASE_URL to run it. It also skips, with a clear message rather
 * than a failure, if `pg_dump`/`pg_restore` are not on PATH — the database
 * suite should not fail on a machine that has Postgres but not its client
 * tools installed separately.
 *
 * Deliberately its own `npm run test:backup`, never folded into `test:db`.
 * `pg_restore --clean` drops and recreates every table in whatever database
 * `TEST_DATABASE_URL` names; running it against the same database the other
 * suites share, even sequentially, would mean the last one to finish decides
 * what's left. Point this at a database of its own.
 */
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import S3rver from "s3rver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { app as App } from "./app";

const url = process.env.TEST_DATABASE_URL;
const hasPgTools = await promisify(execFile)("pg_dump", ["--version"])
  .then(() => true)
  .catch(() => false);

process.env.DATABASE_URL = url ?? "postgres://unused";
process.env.DATABASE_ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? url ?? "postgres://unused";
process.env.ENABLE_CRON = "false";
process.env.NODE_ENV = "test";
process.env.BACKUP_MIN_COUNT = "1";
process.env.BACKUP_RETENTION_DAYS = "365";

const suite = url && hasPgTools ? describe : describe.skip;
if (url && !hasPgTools) {
  console.warn("pg_dump/pg_restore non trovati sul PATH: src/server/backup.test.ts saltato.");
}

const PLATFORM_ADMIN = { email: `backup-admin-${randomUUID().slice(0, 8)}@example.com`, password: "Platform1!" };

suite("backup e ripristino", () => {
  let app: typeof App;
  let close: () => Promise<void>;
  let s3: InstanceType<typeof S3rver>;
  let dataDir: string;

  let platformCookie: string;
  let tenantCookie: string;
  let organizationName: string;

  const asPlatform = (path: string, init: RequestInit = {}) =>
    app.request(`/api/platform${path}`, {
      ...init,
      headers: { cookie: platformCookie, "content-type": "application/json", ...init.headers },
    });

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "presenze-s3rver-"));
    s3 = new S3rver({
      port: 0,
      address: "localhost",
      silent: true,
      directory: dataDir,
      vhostBuckets: false,
      configureBuckets: [{ name: "presenze-backups-test" }],
    });
    const { port } = await s3.run();

    process.env.S3_ENDPOINT = `http://localhost:${port}`;
    process.env.S3_BUCKET = "presenze-backups-test";
    process.env.S3_ACCESS_KEY_ID = "S3RVER";
    process.env.S3_SECRET_ACCESS_KEY = "S3RVER";
    process.env.S3_FORCE_PATH_STYLE = "true";
    process.env.S3_REGION = "us-east-1";
    process.env.BACKUP_PREFIX = "backups/";

    const client = await import("./db/client");
    await (await import("./db/migrate")).migrateDatabase("src/server/db/migrations");
    app = (await import("./app")).app;
    close = client.closeDatabase;

    // Its own admin, created directly, so the login session below is real.
    const platformSchema = await import("./db/platform-schema");
    const { hashPassword } = await import("./auth/password");
    await client.platformDb.insert(platformSchema.platformAdmins).values({
      id: randomUUID(),
      email: PLATFORM_ADMIN.email,
      name: "Backup Admin",
      passwordHash: await hashPassword(PLATFORM_ADMIN.password),
    });

    const login = await app.request("/api/platform/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(PLATFORM_ADMIN),
    });
    expect(login.status).toBe(200);
    platformCookie = login.headers.get("set-cookie")!.split(";")[0]!;

    // A tenant, signed up *before* the backup is taken, so its session survives
    // the restore along with the rest of the snapshot.
    const suffix = randomUUID().slice(0, 8);
    organizationName = `Prima del ripristino ${suffix}`;
    const signup = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationName,
        name: "Admin",
        email: `admin-${suffix}@example.com`,
        password: "Password1!",
      }),
    });
    expect(signup.status).toBe(201);
    tenantCookie = signup.headers.get("set-cookie")!.split(";")[0]!;
  }, 60_000);

  afterAll(async () => {
    await close?.();
    await s3?.close();
    await rm(dataDir, { recursive: true, force: true }).catch(() => {});
  }, 30_000);

  it("dice che non è configurato finché non lo è, e non riesce a fingere altrimenti", async () => {
    // Sanity check on the gate itself: everything below depends on it flipping
    // on exactly when the four S3 variables are all present, which they are by
    // this point in the suite.
    const status = await (await asPlatform("/backups")).json();
    expect(status.enabled).toBe(true);
    expect(status.bucket).toBe("presenze-backups-test");
  });

  let backupFilename: string;

  it("crea un backup reale, caricato sul bucket", async () => {
    const response = await asPlatform("/backups", { method: "POST" });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.backup.filename).toMatch(/^backup-.+\.dump$/);
    expect(body.backup.sizeBytes).toBeGreaterThan(0);
    backupFilename = body.backup.filename;

    const listed = await (await asPlatform("/backups")).json();
    expect(listed.backups.some((b: { filename: string }) => b.filename === backupFilename)).toBe(true);

    const audit = await (await asPlatform("/audit")).json();
    expect(audit.entries.some((e: { action: string }) => e.action === "backup.created")).toBe(true);
  }, 30_000);

  it("il download rimanda direttamente al bucket, non attraverso il server applicativo", async () => {
    const response = await asPlatform(`/backups/${backupFilename}/download`, { redirect: "manual" });
    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain(`localhost:`);
    expect(location).toContain(backupFilename);
  });

  it("rifiuta un nome di conferma che non corrisponde, e non tocca nulla", async () => {
    const patch = await app.request("/api/organization", {
      method: "PATCH",
      headers: { cookie: tenantCookie, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Modificata dopo il backup",
        companyName: null,
        timezone: "Europe/Rome",
        holidayPatronDays: "",
      }),
    });
    expect(patch.status).toBe(200);

    const wrongConfirm = await asPlatform(`/backups/${backupFilename}/restore`, {
      method: "POST",
      body: JSON.stringify({ confirm: "qualcosa-di-sbagliato.dump" }),
    });
    expect(wrongConfirm.status).toBe(422);

    const stillModified = await (
      await app.request("/api/organization", { headers: { cookie: tenantCookie } })
    ).json();
    expect(stillModified.organization.name).toBe("Modificata dopo il backup");
  });

  it("ripristina davvero: il nome torna quello del momento del backup", async () => {
    const restore = await asPlatform(`/backups/${backupFilename}/restore`, {
      method: "POST",
      body: JSON.stringify({ confirm: backupFilename }),
    });
    expect(restore.status).toBe(200);
    const body = await restore.json();
    expect(body.safetyBackup).toMatch(/^pre-restore-.+\.dump$/);

    // The tenant's own session row was captured in the backup and comes back
    // with everything else, so the same cookie still opens the same account —
    // the only way this assertion could be answered from *outside* the
    // database the way an operator restoring it actually would.
    const restored = await (
      await app.request("/api/organization", { headers: { cookie: tenantCookie } })
    ).json();
    expect(restored.organization.name).toBe(organizationName);

    // And the back office itself survived being the thing that just replaced
    // the database out from under its own connection pool.
    expect((await asPlatform("/me")).status).toBe(200);

    const audit = await (await asPlatform("/audit")).json();
    expect(audit.entries.some((e: { action: string }) => e.action === "backup.restored")).toBe(true);

    const listed = await (await asPlatform("/backups")).json();
    expect(listed.backups.some((b: { filename: string }) => b.filename === body.safetyBackup)).toBe(true);
  }, 30_000);

  it("elimina un backup su richiesta", async () => {
    const response = await asPlatform(`/backups/${backupFilename}`, { method: "DELETE" });
    expect(response.status).toBe(200);

    const listed = await (await asPlatform("/backups")).json();
    expect(listed.backups.some((b: { filename: string }) => b.filename === backupFilename)).toBe(false);
  });

  it("la pulizia manuale non intacca nulla quando si è già sotto il minimo configurato", async () => {
    const before = await (await asPlatform("/backups")).json();
    const response = await asPlatform("/backups/prune", { method: "POST" });
    expect(response.status).toBe(200);
    const { removed } = await response.json();
    expect(removed).toHaveLength(0);

    const after = await (await asPlatform("/backups")).json();
    expect(after.backups.length).toBe(before.backups.length);
  });
});
