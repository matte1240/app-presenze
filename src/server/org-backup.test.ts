/**
 * Backup and restore for one organization, proven end to end.
 *
 * Unlike `backup.test.ts`, this never runs `pg_restore --clean` — the restore
 * here is ordinary scoped SQL inside `runInTenant`, deleting and reinserting
 * rows for one `organization_id` and nothing else. That is exactly what the
 * other multi-tenant suites already assume is safe to do next to them, so
 * this file runs as part of `npm run test:db`, on the shared test database,
 * rather than needing one of its own.
 *
 * It still needs an S3-compatible bucket, so it brings its own `s3rver` (a
 * pure-JS mock) rather than depending on MinIO or real Hetzner credentials —
 * same approach as `backup.test.ts`, for the same reason.
 *
 * Set TEST_DATABASE_URL to run it; without one it skips.
 */
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import S3rver from "s3rver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { app as App } from "./app";

const url = process.env.TEST_DATABASE_URL;

process.env.DATABASE_URL = url ?? "postgres://unused";
process.env.DATABASE_ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? url ?? "postgres://unused";
process.env.ENABLE_CRON = "false";
process.env.NODE_ENV = "test";

const suite = url ? describe : describe.skip;

const PLATFORM_ADMIN = { email: `org-backup-admin-${randomUUID().slice(0, 8)}@example.com`, password: "Platform1!" };

suite("backup e ripristino per organizzazione", () => {
  let app: typeof App;
  let close: () => Promise<void>;
  let s3: InstanceType<typeof S3rver>;
  let dataDir: string;

  let platformCookie: string;
  let platformAdminId: string;
  let deletePlatformAdmin: () => Promise<unknown>;
  let organizationId: string;
  let organizationName: string;
  let adminCookie: string;
  let adminEmail: string;
  let employeeEmail: string;
  let employeeId: string;

  // A second, untouched organization — proof that restoring the first one
  // never reaches across.
  let otherOrgName: string;

  const asPlatform = (path: string, init: RequestInit = {}) =>
    app.request(`/api/platform${path}`, {
      ...init,
      headers: { cookie: platformCookie, "content-type": "application/json", ...init.headers },
    });

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "presenze-s3rver-org-"));
    s3 = new S3rver({
      port: 0,
      address: "localhost",
      silent: true,
      directory: dataDir,
      vhostBuckets: false,
      configureBuckets: [{ name: "presenze-org-backups-test" }],
    });
    const { port } = await s3.run();

    process.env.S3_ENDPOINT = `http://localhost:${port}`;
    process.env.S3_BUCKET = "presenze-org-backups-test";
    process.env.S3_ACCESS_KEY_ID = "S3RVER";
    process.env.S3_SECRET_ACCESS_KEY = "S3RVER";
    process.env.S3_FORCE_PATH_STYLE = "true";
    process.env.S3_REGION = "us-east-1";

    const client = await import("./db/client");
    await (await import("./db/migrate")).migrateDatabase("src/server/db/migrations");
    app = (await import("./app")).app;
    close = client.closeDatabase;

    const platformSchema = await import("./db/platform-schema");
    const { eq } = await import("drizzle-orm");
    const { hashPassword } = await import("./auth/password");
    platformAdminId = randomUUID();
    // `platformAdmins` has no organization to scope it by — it is what
    // `ensurePlatformAdmin()` in platform.test.ts counts globally to decide
    // whether to create its own. Left behind on the database this suite
    // shares with that one, it would make that count wrong for however runs
    // after this file, so it comes back out in `afterAll`.
    deletePlatformAdmin = () =>
      client.platformDb.delete(platformSchema.platformAdmins).where(eq(platformSchema.platformAdmins.id, platformAdminId));
    await client.platformDb.insert(platformSchema.platformAdmins).values({
      id: platformAdminId,
      email: PLATFORM_ADMIN.email,
      name: "Org Backup Admin",
      passwordHash: await hashPassword(PLATFORM_ADMIN.password),
    });

    const login = await app.request("/api/platform/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(PLATFORM_ADMIN),
    });
    expect(login.status).toBe(200);
    platformCookie = login.headers.get("set-cookie")!.split(";")[0]!;

    const suffix = randomUUID().slice(0, 8);
    organizationName = `Org da ripristinare ${suffix}`;
    adminEmail = `admin-${suffix}@example.com`;
    const signup = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationName,
        name: "Admin",
        email: adminEmail,
        password: "Password1!",
      }),
    });
    expect(signup.status).toBe(201);
    adminCookie = signup.headers.get("set-cookie")!.split(";")[0]!;
    const me = await (await app.request("/api/organization", { headers: { cookie: adminCookie } })).json();
    organizationId = me.organization.id;

    employeeEmail = `dipendente-${suffix}@example.com`;
    const createEmployee = await app.request("/api/users", {
      method: "POST",
      headers: { cookie: adminCookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Dipendente", email: employeeEmail, password: "Password1!", role: "EMPLOYEE" }),
    });
    expect(createEmployee.status).toBe(201);
    employeeId = (await createEmployee.json()).user.id;

    // A second organization, left alone for the whole suite.
    const otherSuffix = randomUUID().slice(0, 8);
    otherOrgName = `Org intatta ${otherSuffix}`;
    const otherSignup = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationName: otherOrgName,
        name: "Admin",
        email: `altro-admin-${otherSuffix}@example.com`,
        password: "Password1!",
      }),
    });
    expect(otherSignup.status).toBe(201);
  }, 60_000);

  afterAll(async () => {
    await deletePlatformAdmin?.().catch(() => {});
    await close?.();
    await s3?.close();
    await rm(dataDir, { recursive: true, force: true }).catch(() => {});
  }, 30_000);

  let backupFilename: string;

  it("crea un backup di una sola organizzazione, non della piattaforma", async () => {
    const response = await asPlatform(`/organizations/${organizationId}/backups`, { method: "POST" });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.backup.filename).toMatch(/^backup-.+\.json$/);
    backupFilename = body.backup.filename;

    const listed = await (await asPlatform(`/organizations/${organizationId}/backups`)).json();
    expect(listed.enabled).toBe(true);
    expect(listed.backups.some((b: { filename: string }) => b.filename === backupFilename)).toBe(true);

    // The whole-database listing must never see it: different namespace.
    const wholeDb = await (await asPlatform("/backups")).json();
    expect(wholeDb.backups.some((b: { filename: string }) => b.filename === backupFilename)).toBe(false);
  }, 30_000);

  it("il download rimanda al bucket, non attraverso il server applicativo", async () => {
    const response = await asPlatform(`/organizations/${organizationId}/backups/${backupFilename}/download`, {
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location") ?? "").toContain(backupFilename);
  });

  it("rifiuta un nome di conferma sbagliato, e non tocca nulla", async () => {
    const deactivate = await app.request(`/api/users/${employeeId}/deactivate`, {
      method: "POST",
      headers: { cookie: adminCookie },
    });
    expect(deactivate.status).toBe(200);

    const wrongConfirm = await asPlatform(`/organizations/${organizationId}/backups/${backupFilename}/restore`, {
      method: "POST",
      body: JSON.stringify({ confirm: "qualcosa-di-sbagliato.json" }),
    });
    expect(wrongConfirm.status).toBe(422);

    const stillDeactivated = await (await asPlatform(`/organizations/${organizationId}`)).json();
    expect(
      stillDeactivated.users.find((u: { email: string }) => u.email === employeeEmail).deactivatedAt,
    ).not.toBeNull();
  });

  it("ripristina solo questa organizzazione: il dipendente torna attivo, l'altra azienda non si accorge di nulla", async () => {
    const restore = await asPlatform(`/organizations/${organizationId}/backups/${backupFilename}/restore`, {
      method: "POST",
      body: JSON.stringify({ confirm: backupFilename }),
    });
    expect(restore.status).toBe(200);
    const body = await restore.json();
    expect(body.safetyBackup).toMatch(/^pre-restore-.+\.json$/);
    expect(body.usersRestored).toBe(2);

    // The old session is gone — the user row it pointed at was deleted and
    // recreated with a new id underneath it.
    const withOldCookie = await app.request("/api/organization", { headers: { cookie: adminCookie } });
    expect(withOldCookie.status).toBe(401);

    // Nobody can sign back in with the old password either: the export never
    // carried the hash, so restoring rotated it to something nobody knows.
    const loginAttempt = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: "Password1!" }),
    });
    expect(loginAttempt.status).toBe(401);

    // But the data itself is back, provably from outside the database: the
    // back office's own view shows the employee active again, from before
    // the deactivation this test undid.
    const detail = await (await asPlatform(`/organizations/${organizationId}`)).json();
    expect(detail.organization.name).toBe(organizationName);
    expect(detail.users.map((u: { email: string }) => u.email).sort()).toEqual(
      [adminEmail, employeeEmail].sort(),
    );
    expect(
      detail.users.find((u: { email: string }) => u.email === employeeEmail).deactivatedAt,
    ).toBeNull();

    // The second organization was never in this transaction's scope.
    const organizations = await (await asPlatform("/organizations")).json();
    expect(
      organizations.organizations.some((o: { name: string }) => o.name === otherOrgName),
    ).toBe(true);

    const audit = await (await asPlatform(`/audit?organizationId=${organizationId}`)).json();
    expect(audit.entries.some((e: { action: string }) => e.action === "organization.restored")).toBe(true);

    const listed = await (await asPlatform(`/organizations/${organizationId}/backups`)).json();
    expect(listed.backups.some((b: { filename: string }) => b.filename === body.safetyBackup)).toBe(true);
  }, 30_000);

  it("elimina un backup su richiesta", async () => {
    const response = await asPlatform(`/organizations/${organizationId}/backups/${backupFilename}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(200);

    const listed = await (await asPlatform(`/organizations/${organizationId}/backups`)).json();
    expect(listed.backups.some((b: { filename: string }) => b.filename === backupFilename)).toBe(false);
  });
});
