/**
 * The daily sweep over trials.
 *
 * Checked on the boundary rather than through the clock: a trial that ran out
 * yesterday must be read-only this morning, and one running out in two days
 * must not be touched.
 *
 * In its own file rather than alongside the back-office tests, because each
 * database-backed suite owns the connection pool it closes.
 *
 * Set TEST_DATABASE_URL to run it; without one it skips.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { eq as Eq } from "drizzle-orm";
import type { app as App } from "./app";
import type { platformDb as PlatformDb } from "./db/client";
import type { organizations as OrganizationsTable } from "./db/platform-schema";

const url = process.env.TEST_DATABASE_URL;

process.env.DATABASE_URL = url ?? "postgres://unused";
process.env.DATABASE_ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? url ?? "postgres://unused";
process.env.ENABLE_CRON = "false";
process.env.NODE_ENV = "test";

const suite = url ? describe : describe.skip;

suite("scadenza dei trial", () => {
  let app: typeof App;
  let close: () => Promise<void>;
  let platformDb: typeof PlatformDb;
  let organizations: typeof OrganizationsTable;
  let eq: typeof Eq;
  let expireLapsedTrials: () => Promise<{ expired: number; warned: number }>;

  const signup = async (label: string) => {
    const suffix = randomUUID().slice(0, 8);
    const response = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationName: `${label} ${suffix}`,
        name: "Admin",
        email: `${label.toLowerCase()}-${suffix}@example.com`,
        password: "Password1!",
      }),
    });
    return {
      cookie: response.headers.get("set-cookie")!.split(";")[0]!,
      id: (await response.json()).organization.id as string,
    };
  };

  beforeAll(async () => {
    const client = await import("./db/client");
    const platform = await import("./db/platform-schema");
    const orm = await import("drizzle-orm");
    await (await import("./db/migrate")).migrateDatabase("src/server/db/migrations");

    app = (await import("./app")).app;
    platformDb = client.platformDb;
    organizations = platform.organizations;
    eq = orm.eq;
    close = client.closeDatabase;
    expireLapsedTrials = (await import("./services/trials")).expireLapsedTrials;
  }, 60_000);

  afterAll(async () => {
    await close?.();
  });

  it("sospende un trial scaduto e lascia in pace quello ancora valido", async () => {
    const lapsed = await signup("Scaduta");
    const running = await signup("Corrente");

    await platformDb
      .update(organizations)
      .set({ trialEndsAt: new Date(Date.now() - 86_400_000) })
      .where(eq(organizations.id, lapsed.id));
    await platformDb
      .update(organizations)
      .set({ trialEndsAt: new Date(Date.now() + 10 * 86_400_000) })
      .where(eq(organizations.id, running.id));

    const result = await expireLapsedTrials();
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const [after] = await platformDb
      .select()
      .from(organizations)
      .where(eq(organizations.id, lapsed.id))
      .limit(1);
    expect(after!.status).toBe("SUSPENDED");

    // Its sessions are gone: nobody spends the morning typing into a form that
    // will refuse to save.
    expect((await app.request("/api/auth/me", { headers: { cookie: lapsed.cookie } })).status).toBe(401);

    // The company whose trial is still running is untouched, and can still work.
    const [untouched] = await platformDb
      .select()
      .from(organizations)
      .where(eq(organizations.id, running.id))
      .limit(1);
    expect(untouched!.status).toBe("TRIAL");

    const write = await app.request("/api/hours", {
      method: "POST",
      headers: { cookie: running.cookie, "content-type": "application/json" },
      body: JSON.stringify({
        date: "2026-05-12",
        kind: "work",
        morning: { start: "09:00", end: "13:00" },
      }),
    });
    expect(write.status).toBe(201);
  });
});
