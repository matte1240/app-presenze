/**
 * The back-office, and the line it must not cross.
 *
 * Two things are being checked here. The first is that it works: creating a
 * company, changing its plan, suspending it, going in to look. The second
 * matters more — that the two authentication surfaces stay separate. A tenant
 * session must never open the back-office, and a back-office session must
 * never be mistaken for a tenant one, because either confusion is a way into
 * every customer at once.
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
const ADMIN_EMAIL = `piattaforma-${randomUUID().slice(0, 8)}@example.com`;
const ADMIN_PASSWORD = "Platform1!";

process.env.DATABASE_URL = url ?? "postgres://unused";
process.env.DATABASE_ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? url ?? "postgres://unused";
process.env.PLATFORM_ADMIN_EMAIL = ADMIN_EMAIL;
process.env.PLATFORM_ADMIN_PASSWORD = ADMIN_PASSWORD;
process.env.ENABLE_CRON = "false";
process.env.NODE_ENV = "test";

const suite = url ? describe : describe.skip;

suite("back-office", () => {
  let app: typeof App;
  let close: () => Promise<void>;
  let platformDb: typeof PlatformDb;
  let organizations: typeof OrganizationsTable;
  let eq: typeof Eq;

  let platformCookie: string;
  let tenantCookie: string;
  let organizationId: string;

  const asPlatform = (path: string, init: RequestInit = {}) =>
    app.request(`/api/platform${path}`, {
      ...init,
      headers: { cookie: platformCookie, "content-type": "application/json", ...init.headers },
    });

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

    await (await import("./services/platform-admin")).ensurePlatformAdmin();

    const login = await app.request("/api/platform/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    expect(login.status).toBe(200);
    platformCookie = login.headers.get("set-cookie")!.split(";")[0]!;

    // A company that signed up on its own, to act as the tenant side.
    const suffix = randomUUID().slice(0, 8);
    const signup = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationName: `Cliente ${suffix}`,
        name: "Admin",
        email: `cliente-${suffix}@example.com`,
        password: "Password1!",
      }),
    });
    tenantCookie = signup.headers.get("set-cookie")!.split(";")[0]!;
    organizationId = (await signup.json()).organization.id;
  }, 60_000);

  afterAll(async () => {
    await close?.();
  });

  it("non si apre senza una sessione di piattaforma", async () => {
    expect((await app.request("/api/platform/organizations")).status).toBe(401);
  });

  /** The whole reason the back-office has its own table and its own cookie. */
  it("non si apre con la sessione di un cliente", async () => {
    const response = await app.request("/api/platform/organizations", {
      headers: { cookie: tenantCookie },
    });
    expect(response.status).toBe(401);
  });

  it("non apre l'applicazione con la sessione di piattaforma", async () => {
    const response = await app.request("/api/users", { headers: { cookie: platformCookie } });
    expect(response.status).toBe(401);
  });

  it("elenca ogni organizzazione, con i posti occupati", async () => {
    const body = await (await asPlatform("/organizations")).json();
    const mine = body.organizations.find((o: { id: string }) => o.id === organizationId);

    expect(mine).toBeDefined();
    expect(mine.seatsUsed).toBe(1);
    expect(mine.status).toBe("TRIAL");
  });

  it("crea un'organizzazione senza impostare alcuna password", async () => {
    const suffix = randomUUID().slice(0, 8);
    const response = await asPlatform("/organizations", {
      method: "POST",
      body: JSON.stringify({
        organizationName: `Assistita ${suffix}`,
        adminName: "Anna Neri",
        adminEmail: `anna-${suffix}@example.com`,
        plan: "PRO",
      }),
    });
    expect(response.status).toBe(201);
    const created = await response.json();

    const [row] = await platformDb
      .select()
      .from(organizations)
      .where(eq(organizations.id, created.organization.id))
      .limit(1);
    expect(row!.plan).toBe("PRO");
    expect(row!.status).toBe("TRIAL");

    // The invited administrator has no usable password: the link is the only
    // way in. Signing in with anything must fail.
    const attempt = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `anna-${suffix}@example.com`, password: "Password1!" }),
    });
    expect(attempt.status).toBe(401);
  });

  it("sospende un'organizzazione e ne chiude subito le sessioni", async () => {
    const response = await asPlatform(`/organizations/${organizationId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "SUSPENDED" }),
    });
    expect(response.status).toBe(200);

    // Not merely read-only from the next sign-in: the tabs already open lose
    // their session there and then.
    expect((await app.request("/api/auth/me", { headers: { cookie: tenantCookie } })).status).toBe(401);
  });

  it("entra nell'organizzazione lasciando la sessione marcata e una riga di registro", async () => {
    await asPlatform(`/organizations/${organizationId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ACTIVE" }),
    });

    const response = await asPlatform(`/organizations/${organizationId}/impersonate`, {
      method: "POST",
    });
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!.split(";")[0]!;

    const me = await (await app.request("/api/auth/me", { headers: { cookie } })).json();
    expect(me.organization.id).toBe(organizationId);
    // The banner depends on this, and so does the customer's ability to know.
    expect(me.impersonated).toBe(true);

    const audit = await (await asPlatform("/audit")).json();
    expect(audit.entries.some((e: { action: string }) => e.action === "organization.impersonated")).toBe(true);
  });

  it("esporta i dati di una singola organizzazione", async () => {
    const response = await asPlatform(`/organizations/${organizationId}/export`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.organization.id).toBe(organizationId);
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });
});
