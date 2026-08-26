/**
 * A company's own settings, its people's own accounts.
 *
 * The timezone and the patron-saint days were environment variables when the
 * deployment was the company. Making the organization a row moved them onto it
 * and left nothing able to write them, so a customer was stuck with whatever
 * they had at signup — including a working day that rolled over at the wrong
 * hour. These tests hold that door open.
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

const PASSWORD = "Password1!";

suite("organizzazione e profilo", () => {
  let app: typeof App;
  let close: () => Promise<void>;
  let cookie: string;
  let email: string;

  const as = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { cookie, "content-type": "application/json", ...init.headers },
    });

  const settings = () =>
    as("/api/organization", {
      method: "PATCH",
      body: JSON.stringify({
        name: "Nome Nuovo",
        companyName: "Nome Nuovo S.r.l.",
        timezone: "Europe/Rome",
        holidayPatronDays: "",
      }),
    });

  beforeAll(async () => {
    const client = await import("./db/client");
    await (await import("./db/migrate")).migrateDatabase("src/server/db/migrations");
    app = (await import("./app")).app;
    close = client.closeDatabase;

    const suffix = randomUUID().slice(0, 8);
    email = `admin-${suffix}@example.com`;
    const signup = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationName: `Impostazioni ${suffix}`,
        name: "Admin",
        email,
        password: PASSWORD,
      }),
    });
    cookie = signup.headers.get("set-cookie")!.split(";")[0]!;
  }, 60_000);

  afterAll(async () => {
    await close?.();
  });

  it("salva nome, ragione sociale, fuso e patronali", async () => {
    const response = await as("/api/organization", {
      method: "PATCH",
      body: JSON.stringify({
        name: "Officina Rossi",
        companyName: "Officina Rossi S.r.l.",
        timezone: "Europe/Madrid",
        holidayPatronDays: "06-24,12-07",
      }),
    });
    expect(response.status).toBe(200);

    const saved = await (await as("/api/organization")).json();
    expect(saved.organization.timezone).toBe("Europe/Madrid");
    expect(saved.organization.holidayPatronDays).toBe("06-24,12-07");
  });

  it("rifiuta un fuso inesistente e un patronale malscritto", async () => {
    const badZone = await as("/api/organization", {
      method: "PATCH",
      body: JSON.stringify({
        name: "X",
        companyName: null,
        timezone: "Europa/Roma",
        holidayPatronDays: "",
      }),
    });
    expect(badZone.status).toBe(422);

    const badDay = await as("/api/organization", {
      method: "PATCH",
      body: JSON.stringify({
        name: "X",
        companyName: null,
        timezone: "Europe/Rome",
        holidayPatronDays: "24/06",
      }),
    });
    expect(badDay.status).toBe(422);
  });

  /**
   * The point of the setting: a patron saint's day is a holiday, and a holiday
   * books entirely as overtime rather than as ordinary hours.
   */
  it("il calendario salvato cambia davvero come si classifica una giornata", async () => {
    await settings();
    const before = await (
      await as("/api/hours", {
        method: "POST",
        body: JSON.stringify({
          date: "2026-06-24",
          kind: "work",
          morning: { start: "09:00", end: "13:00" },
        }),
      })
    ).json();
    expect(before.entry.regularHours).toBeGreaterThan(0);
    expect(before.entry.overtimeHours).toBe(0);

    await as("/api/organization", {
      method: "PATCH",
      body: JSON.stringify({
        name: "Nome Nuovo",
        companyName: null,
        timezone: "Europe/Rome",
        holidayPatronDays: "06-24",
      }),
    });

    const after = await (
      await as("/api/hours", {
        method: "POST",
        body: JSON.stringify({
          date: "2026-06-24",
          kind: "work",
          morning: { start: "09:00", end: "13:00" },
        }),
      })
    ).json();
    expect(after.entry.regularHours).toBe(0);
    expect(after.entry.overtimeHours).toBeGreaterThan(0);
  });

  it("cambia il proprio nome senza password, l'email solo con", async () => {
    expect((await as("/api/me", { method: "PATCH", body: JSON.stringify({ name: "Nome Corretto", email }) })).status).toBe(200);

    const withoutPassword = await as("/api/me", {
      method: "PATCH",
      body: JSON.stringify({ name: "Nome Corretto", email: `nuova-${randomUUID().slice(0, 6)}@example.com` }),
    });
    expect(withoutPassword.status).toBe(422);

    const nextEmail = `nuova-${randomUUID().slice(0, 6)}@example.com`;
    const withPassword = await as("/api/me", {
      method: "PATCH",
      body: JSON.stringify({ name: "Nome Corretto", email: nextEmail, currentPassword: PASSWORD }),
    });
    expect(withPassword.status).toBe(200);

    // And the new address is the one that signs in.
    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: nextEmail, password: PASSWORD }),
    });
    expect(login.status).toBe(200);
    email = nextEmail;
  });

  it("rifiuta un'anagrafica fiscale che non permetterebbe di fatturare", async () => {
    const base = {
      legalName: "Officina Rossi S.r.l.",
      addressLine: "Via Roma 1",
      postalCode: "10100",
      city: "Torino",
      province: "TO",
      country: "IT",
      vatNumber: "00743110157",
      taxCode: null,
      sdiCode: "ABC1234",
      pec: null,
      billingEmail: null,
    };

    // A transposed digit: the length is right, the check character is not.
    const badVat = await as("/api/organization/billing-profile", {
      method: "PUT",
      body: JSON.stringify({ ...base, vatNumber: "00743110175" }),
    });
    expect(badVat.status).toBe(422);

    // Italian, and nowhere for the exchange system to deliver the invoice.
    const noDelivery = await as("/api/organization/billing-profile", {
      method: "PUT",
      body: JSON.stringify({ ...base, sdiCode: null, pec: null }),
    });
    expect(noDelivery.status).toBe(422);

    // Nobody to invoice at all.
    const noIdentity = await as("/api/organization/billing-profile", {
      method: "PUT",
      body: JSON.stringify({ ...base, vatNumber: null, taxCode: null }),
    });
    expect(noIdentity.status).toBe(422);
  });

  it("salva l'anagrafica e la restituisce normalizzata", async () => {
    const response = await as("/api/organization/billing-profile", {
      method: "PUT",
      body: JSON.stringify({
        legalName: "Officina Rossi S.r.l.",
        addressLine: "Via Roma 1",
        postalCode: "10100",
        city: "Torino",
        province: "TO",
        country: "it",
        vatNumber: "00743110157",
        taxCode: "rssmra85t10a562s",
        sdiCode: "abc1234",
        pec: null,
        billingEmail: "amministrazione@example.com",
      }),
    });
    expect(response.status).toBe(200);

    const saved = await (await as("/api/organization/billing-profile")).json();
    expect(saved.profile.country).toBe("IT");
    // Identifiers are stored the way they are printed.
    expect(saved.profile.taxCode).toBe("RSSMRA85T10A562S");
    expect(saved.profile.sdiCode).toBe("ABC1234");
  });

  it("elenca gli accessi attivi e chiude gli altri", async () => {
    // A second sign-in, so there is something to close.
    const second = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    const secondCookie = second.headers.get("set-cookie")!.split(";")[0]!;

    const listed = await (await as("/api/me/sessions")).json();
    expect(listed.sessions.length).toBeGreaterThanOrEqual(2);
    expect(listed.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
    // The stored id is the digest of a live cookie and must not come back whole.
    expect(listed.sessions.every((s: { id: string }) => s.id.length === 8)).toBe(true);

    const closed = await (await as("/api/me/sessions", { method: "DELETE" })).json();
    expect(closed.closed).toBeGreaterThanOrEqual(1);

    // The other one is gone; the one that asked still works.
    expect((await app.request("/api/auth/me", { headers: { cookie: secondCookie } })).status).toBe(401);
    expect((await as("/api/auth/me")).status).toBe(200);
  });
});
