/**
 * The test that defends the product.
 *
 * Everything else in this suite checks that a feature works. This one checks
 * that one customer cannot see or touch another, which is the promise that
 * makes the application sellable at all — and the one that a forgotten `WHERE`
 * in a future refactor would quietly break. It drives the real HTTP app against
 * a real Postgres, because the isolation is enforced in three places (the
 * queries, the guards and the row-level security policies) and only the whole
 * stack exercises all three.
 *
 * Set TEST_DATABASE_URL to run it; without one it skips rather than failing, so
 * `npm test` still works on a machine with no database. TEST_DATABASE_ADMIN_URL
 * should name the table owner — with a single URL the policies are inert and
 * the test would prove only that the query filters are present.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { app as App } from "./app";

const url = process.env.TEST_DATABASE_URL;
const adminUrl = process.env.TEST_DATABASE_ADMIN_URL ?? url;

process.env.DATABASE_URL = url ?? "postgres://unused";
process.env.DATABASE_ADMIN_URL = adminUrl ?? "postgres://unused";
process.env.ENABLE_CRON = "false";
process.env.NODE_ENV = "test";

const suite = url ? describe : describe.skip;

interface Company {
  name: string;
  cookie: string;
  adminId: string;
  employeeId: string;
  entryId: string;
  requestId: string;
}

suite("isolamento fra organizzazioni", () => {
  let app: typeof App;
  let close: () => Promise<void>;
  const companies: Company[] = [];

  /** Signs a company up through the public API and gives it something to lose. */
  async function makeCompany(label: string): Promise<Company> {
    const suffix = randomUUID().slice(0, 8);
    const email = `admin-${suffix}@example.com`;

    const signup = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationName: `${label} ${suffix}`,
        name: `Admin ${label}`,
        email,
        password: "Password1!",
      }),
    });
    expect(signup.status).toBe(201);
    const cookie = signup.headers.get("set-cookie")!.split(";")[0]!;

    const asCompany = (path: string, init: RequestInit = {}) =>
      app.request(path, { ...init, headers: { cookie, "content-type": "application/json", ...init.headers } });

    const me = await (await asCompany("/api/auth/me")).json();
    const adminId = me.user.id as string;

    const employee = await (
      await asCompany("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: `Dipendente ${label}`,
          email: `dip-${suffix}@example.com`,
          password: "Password1!",
          role: "EMPLOYEE",
        }),
      })
    ).json();

    const entry = await (
      await asCompany("/api/hours", {
        method: "POST",
        body: JSON.stringify({
          date: "2026-03-10",
          kind: "work",
          morning: { start: "09:00", end: "13:00" },
          afternoon: { start: "14:00", end: "18:00" },
          userId: employee.user.id,
        }),
      })
    ).json();

    const request = await (
      await asCompany("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          type: "VACATION",
          startDate: "2026-07-06",
          endDate: "2026-07-10",
          reason: label,
        }),
      })
    ).json();

    return {
      name: `${label} ${suffix}`,
      cookie,
      adminId,
      employeeId: employee.user.id,
      entryId: entry.entry.id,
      requestId: request.request.id,
    };
  }

  beforeAll(async () => {
    const client = await import("./db/client");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(client.platformDb, { migrationsFolder: "src/server/db/migrations" });

    app = (await import("./app")).app;
    close = client.closeDatabase;

    companies.push(await makeCompany("Alfa"), await makeCompany("Zeta"));
  }, 60_000);

  afterAll(async () => {
    await close?.();
  });

  const alfa = () => companies[0]!;
  const zeta = () => companies[1]!;

  const asAlfa = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { cookie: alfa().cookie, "content-type": "application/json", ...init.headers },
    });

  it("elenca solo le proprie persone", async () => {
    const body = await (await asAlfa("/api/users")).json();
    const ids = body.users.map((u: { id: string }) => u.id);

    expect(ids).toContain(alfa().employeeId);
    expect(ids).not.toContain(zeta().employeeId);
    expect(ids).not.toContain(zeta().adminId);
  });

  /**
   * 404 rather than 403 throughout. A 403 would confirm that the id names
   * something real, which is a fact about another company's data that this
   * caller is not entitled to.
   */
  it.each([
    ["GET", () => `/api/users/${zeta().employeeId}/schedule`, undefined],
    ["POST", () => `/api/users/${zeta().employeeId}/remind`, undefined],
    ["DELETE", () => `/api/users/${zeta().employeeId}`, undefined],
    ["DELETE", () => `/api/hours/${zeta().entryId}`, undefined],
  ])("risponde 404 a %s su una risorsa altrui", async (method, path) => {
    const response = await asAlfa(path(), { method });
    expect(response.status).toBe(404);
  });

  it("non modifica l'utente di un'altra organizzazione", async () => {
    const response = await asAlfa(`/api/users/${zeta().employeeId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Dirottato" }),
    });
    expect(response.status).toBe(404);

    const stillThere = await (
      await app.request("/api/users", { headers: { cookie: zeta().cookie } })
    ).json();
    expect(stillThere.users.map((u: { name: string }) => u.name)).not.toContain("Dirottato");
  });

  it("non approva la richiesta di un'altra organizzazione", async () => {
    const response = await asAlfa(`/api/requests/${zeta().requestId}/review`, {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED" }),
    });
    expect(response.status).toBe(404);

    const theirs = await (
      await app.request("/api/requests", { headers: { cookie: zeta().cookie } })
    ).json();
    expect(theirs.requests.find((r: { id: string }) => r.id === zeta().requestId).status).toBe("PENDING");
  });

  it("non legge le ore di un'altra organizzazione, nemmeno chiedendole per id", async () => {
    const byUser = await (
      await asAlfa(`/api/hours?from=2026-03-01&to=2026-03-31&userId=${zeta().employeeId}`)
    ).json();
    expect(byUser.entries).toHaveLength(0);

    const all = await (await asAlfa("/api/hours?from=2026-03-01&to=2026-03-31&userId=all")).json();
    const ids = all.entries.map((e: { id: string }) => e.id);
    expect(ids).toContain(alfa().entryId);
    expect(ids).not.toContain(zeta().entryId);
  });

  it("non esporta le persone di un'altra organizzazione", async () => {
    const response = await asAlfa("/api/reports/excel", {
      method: "POST",
      body: JSON.stringify({ userIds: [zeta().employeeId], month: "2026-03" }),
    });
    // The workbook comes back empty rather than refused: the caller was never
    // told the id existed, so there is nothing to refuse them.
    expect(response.status).toBe(200);
    const workbook = Buffer.from(await response.arrayBuffer());
    expect(workbook.includes(Buffer.from(zeta().name))).toBe(false);
  });

  it("esporta soltanto i propri dati", async () => {
    const body = await (await asAlfa("/api/admin/export")).json();
    expect(body.organization.name).toBe(alfa().name);
    expect(body.users.every((u: { organizationId: string }) => u.organizationId)).toBe(true);

    const organizationIds = new Set(body.users.map((u: { organizationId: string }) => u.organizationId));
    expect(organizationIds.size).toBe(1);
    // An export is the one place a password hash could plausibly slip out.
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("tiene separate due persone con lo stesso indirizzo", async () => {
    const shared = `condiviso-${randomUUID().slice(0, 8)}@example.com`;

    for (const company of companies) {
      const response = await app.request("/api/users", {
        method: "POST",
        headers: { cookie: company.cookie, "content-type": "application/json" },
        body: JSON.stringify({
          name: "Consulente",
          email: shared,
          password: "Password1!",
          role: "EMPLOYEE",
        }),
      });
      expect(response.status).toBe(201);
    }

    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: shared, password: "Password1!" }),
    });
    const body = await login.json();

    expect(body.needsOrganizationChoice).toBe(true);
    expect(body.organizations.map((o: { name: string }) => o.name).sort()).toEqual(
      companies.map((c) => c.name).sort(),
    );
  });
});
