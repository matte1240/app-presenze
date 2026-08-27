/**
 * Leaving a company, without taking the payroll records along.
 *
 * Deleting a user cascades to their timesheets and leave requests — the foreign
 * keys say so — and a timesheet is a payroll record that Italian law expects to
 * still exist years later. Deactivation is the ordinary way out: the account
 * stops, the seat is freed, the history stays. The destructive path survives
 * for the account created by mistake and for a request to be forgotten, and it
 * is deliberately reachable only through the other one.
 *
 * Set TEST_DATABASE_URL to run it; without one it skips.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { app as App } from "./app";

const url = process.env.TEST_DATABASE_URL;

process.env.DATABASE_URL = url ?? "postgres://unused";
process.env.DATABASE_ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? url ?? "postgres://unused";
process.env.ENABLE_CRON = "false";
process.env.NODE_ENV = "test";

const suite = url ? describe : describe.skip;

suite("disattivazione", () => {
  let app: typeof App;
  let close: () => Promise<void>;

  let adminCookie: string;
  let employeeId: string;
  let employeeEmail: string;
  let employeeCookie: string;

  const EMPLOYEE_PASSWORD = "Password1!";

  const asAdmin = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { cookie: adminCookie, "content-type": "application/json", ...init.headers },
    });

  const signIn = async (email: string, password: string) =>
    app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

  const seats = async () =>
    (await (await asAdmin("/api/auth/me")).json()).organization.seatsUsed as number;

  beforeAll(async () => {
    const client = await import("./db/client");
    await (await import("./db/migrate")).migrateDatabase("src/server/db/migrations");
    app = (await import("./app")).app;
    close = client.closeDatabase;

    const suffix = randomUUID().slice(0, 8);
    const signup = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationName: `Uscente ${suffix}`,
        name: "Admin",
        email: `admin-${suffix}@example.com`,
        password: EMPLOYEE_PASSWORD,
      }),
    });
    adminCookie = signup.headers.get("set-cookie")!.split(";")[0]!;

    employeeEmail = `dip-${suffix}@example.com`;
    const created = await (
      await asAdmin("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: "Dipendente",
          email: employeeEmail,
          password: EMPLOYEE_PASSWORD,
          role: "EMPLOYEE",
        }),
      })
    ).json();
    employeeId = created.user.id;

    // Something worth keeping, so the deletion preview has a number to report.
    const entry = await asAdmin("/api/hours", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-02-10",
        kind: "work",
        morning: { start: "09:00", end: "13:00" },
        userId: employeeId,
      }),
    });
    expect(entry.status).toBe(201);

    employeeCookie = (await signIn(employeeEmail, EMPLOYEE_PASSWORD)).headers
      .get("set-cookie")!
      .split(";")[0]!;
  }, 60_000);

  afterAll(async () => {
    await close?.();
  });

  it("rifiuta di eliminare qualcuno che è ancora attivo", async () => {
    const response = await asAdmin(`/api/users/${employeeId}`, { method: "DELETE" });
    expect(response.status).toBe(409);
  });

  it("disattiva, libera il posto e chiude la sessione già aperta", async () => {
    const before = await seats();
    expect((await app.request("/api/auth/me", { headers: { cookie: employeeCookie } })).status).toBe(200);

    const response = await asAdmin(`/api/users/${employeeId}/deactivate`, { method: "POST" });
    expect(response.status).toBe(200);

    // The seat is genuinely free, otherwise deactivating solves nothing for a
    // company that has hit its plan's limit.
    expect(await seats()).toBe(before - 1);

    // And whatever they had open stops working now, not at the next sign-in.
    expect((await app.request("/api/auth/me", { headers: { cookie: employeeCookie } })).status).toBe(401);
    expect((await signIn(employeeEmail, EMPLOYEE_PASSWORD)).status).toBe(401);
  });

  it("conserva il cartellino, che resta nei report", async () => {
    const hours = await (
      await asAdmin("/api/hours?from=2026-02-01&to=2026-02-28&userId=all")
    ).json();
    expect(hours.entries.some((e: { userId: string }) => e.userId === employeeId)).toBe(true);

    // Still in the list too: an administrator has to be able to find them.
    const users = await (await asAdmin("/api/users")).json();
    const row = users.users.find((u: { id: string }) => u.id === employeeId);
    expect(row.deactivatedAt).not.toBeNull();
  });

  it("non accetta nuove ore né solleciti per chi è disattivato", async () => {
    const write = await asAdmin("/api/hours", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-02-11",
        kind: "work",
        morning: { start: "09:00", end: "13:00" },
        userId: employeeId,
      }),
    });
    expect(write.status).toBe(403);

    const remind = await asAdmin(`/api/users/${employeeId}/remind`, { method: "POST" });
    expect(remind.status).toBe(409);
  });

  it("dice quante giornate l'eliminazione distruggerebbe", async () => {
    const preview = await (await asAdmin(`/api/users/${employeeId}/deletion-preview`)).json();
    expect(preview.deactivated).toBe(true);
    expect(preview.timeEntries).toBe(1);
  });

  it("riattiva, e allora il posto torna occupato", async () => {
    const before = await seats();
    expect((await asAdmin(`/api/users/${employeeId}/reactivate`, { method: "POST" })).status).toBe(200);
    expect(await seats()).toBe(before + 1);
    expect((await signIn(employeeEmail, EMPLOYEE_PASSWORD)).status).toBe(200);
  });

  it("elimina davvero solo dopo la disattivazione, portandosi via il cartellino", async () => {
    expect((await asAdmin(`/api/users/${employeeId}/deactivate`, { method: "POST" })).status).toBe(200);
    expect((await asAdmin(`/api/users/${employeeId}`, { method: "DELETE" })).status).toBe(200);

    const hours = await (
      await asAdmin("/api/hours?from=2026-02-01&to=2026-02-28&userId=all")
    ).json();
    expect(hours.entries.some((e: { userId: string }) => e.userId === employeeId)).toBe(false);
  });
});
