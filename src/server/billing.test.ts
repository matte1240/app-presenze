/**
 * Billing, exercised where it can actually go wrong.
 *
 * Not Stripe's API — that is Stripe's to test — but the three things on our
 * side that decide whether a company can use the product: that an unverifiable
 * webhook is refused, that a redelivered one changes nothing, and that the
 * subscription state maps onto access the way the pricing page promises.
 *
 * The webhook signatures below are real ones, generated with Stripe's own
 * helper against a test secret, so the verification path is the production path
 * and not a stub.
 *
 * Set TEST_DATABASE_URL to run it; without one it skips.
 */
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { app as App } from "./app";
import type { platformDb as PlatformDb } from "./db/client";
import type { organizations as OrganizationsTable } from "./db/platform-schema";
import type { eq as Eq } from "drizzle-orm";

const url = process.env.TEST_DATABASE_URL;
const WEBHOOK_SECRET = "whsec_test_secret_for_signature_verification";

process.env.DATABASE_URL = url ?? "postgres://unused";
process.env.DATABASE_ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? url ?? "postgres://unused";
process.env.STRIPE_SECRET_KEY = "sk_test_notused";
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.STRIPE_PRICE_PRO = "price_pro_test";
process.env.ENABLE_CRON = "false";
process.env.NODE_ENV = "test";

const suite = url ? describe : describe.skip;

/** A subscription as Stripe would send it, with only the fields we read. */
function subscriptionEvent(args: {
  type: "customer.subscription.updated" | "customer.subscription.deleted";
  organizationId: string;
  status: Stripe.Subscription.Status;
  priceId?: string;
  eventId?: string;
}) {
  return {
    id: args.eventId ?? `evt_${randomUUID()}`,
    object: "event",
    api_version: "2025-01-01",
    created: Math.floor(Date.now() / 1000),
    type: args.type,
    data: {
      object: {
        id: "sub_test_1",
        object: "subscription",
        customer: "cus_test_1",
        status: args.status,
        cancel_at_period_end: false,
        metadata: { organizationId: args.organizationId },
        items: {
          object: "list",
          data: [
            {
              id: "si_test_1",
              object: "subscription_item",
              price: { id: args.priceId ?? "price_pro_test", object: "price" },
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 86_400,
            },
          ],
        },
      },
    },
  };
}

suite("fatturazione", () => {
  let app: typeof App;
  let close: () => Promise<void>;
  let platformDb: typeof PlatformDb;
  let organizations: typeof OrganizationsTable;
  let eq: typeof Eq;

  let organizationId: string;
  let cookie: string;
  let employeeId: string;

  /** Signs the body the way Stripe does, so verification is the real path. */
  const post = (body: unknown) => {
    const payload = JSON.stringify(body);
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });
    return app.request("/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      body: payload,
    });
  };

  const organizationRow = async () =>
    (
      await platformDb.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1)
    )[0]!;

  beforeAll(async () => {
    const client = await import("./db/client");
    const platform = await import("./db/platform-schema");
    const orm = await import("drizzle-orm");
    // Both database-backed suites migrate the same schema; the advisory lock
    // inside is what lets them run in parallel without racing each other.
    await (await import("./db/migrate")).migrateDatabase("src/server/db/migrations");

    app = (await import("./app")).app;
    platformDb = client.platformDb;
    organizations = platform.organizations;
    eq = orm.eq;
    close = client.closeDatabase;

    const suffix = randomUUID().slice(0, 8);
    const signup = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationName: `Pagante ${suffix}`,
        name: "Admin",
        email: `pagante-${suffix}@example.com`,
        password: "Password1!",
      }),
    });
    cookie = signup.headers.get("set-cookie")!.split(";")[0]!;
    organizationId = (await signup.json()).organization.id;

    const employee = await (
      await app.request("/api/users", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          name: "Dipendente",
          email: `dip-${suffix}@example.com`,
          password: "Password1!",
          role: "EMPLOYEE",
        }),
      })
    ).json();
    employeeId = employee.user.id;
  }, 60_000);

  afterAll(async () => {
    await close?.();
  });

  it("rifiuta un webhook senza firma valida", async () => {
    const response = await app.request("/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=falsa", "content-type": "application/json" },
      body: JSON.stringify(subscriptionEvent({
        type: "customer.subscription.updated",
        organizationId,
        status: "active",
      })),
    });

    expect(response.status).toBe(400);
    // And, crucially, changed nothing.
    expect((await organizationRow()).status).toBe("TRIAL");
  });

  it("attiva l'abbonamento e chiude il periodo di prova", async () => {
    const response = await post(
      subscriptionEvent({ type: "customer.subscription.updated", organizationId, status: "active" }),
    );
    expect(response.status).toBe(200);

    const organization = await organizationRow();
    expect(organization.status).toBe("ACTIVE");
    expect(organization.plan).toBe("PRO");
    // A company that pays is no longer on a trial clock.
    expect(organization.trialEndsAt).toBeNull();
  });

  it("ignora una riconsegna dello stesso evento", async () => {
    const eventId = `evt_${randomUUID()}`;
    const event = subscriptionEvent({
      type: "customer.subscription.updated",
      organizationId,
      status: "past_due",
      eventId,
    });

    const first = await post(event);
    expect(await first.json()).toMatchObject({ received: true });
    const after = await organizationRow();
    expect(after.status).toBe("PAST_DUE");
    expect(after.pastDueSince).not.toBeNull();

    const replay = await post(event);
    expect(await replay.json()).toMatchObject({ duplicate: true });

    // The grace period must not restart: a redelivery that pushed the clock
    // forward would mean it never ran out at all.
    expect((await organizationRow()).pastDueSince?.getTime()).toBe(after.pastDueSince?.getTime());
  });

  it("blocca le scritture ma non le letture quando l'abbonamento non è attivo", async () => {
    await platformDb
      .update(organizations)
      .set({ status: "SUSPENDED", pastDueSince: null })
      .where(eq(organizations.id, organizationId));

    const write = await app.request("/api/hours", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        date: "2026-04-14",
        kind: "work",
        morning: { start: "09:00", end: "13:00" },
        userId: employeeId,
      }),
    });
    expect(write.status).toBe(403);

    // Reading and exporting keep working: the leverage is that today's work
    // cannot be recorded, never that the data is held hostage.
    expect((await app.request("/api/hours?from=2026-04-01&to=2026-04-30", { headers: { cookie } })).status).toBe(200);
    expect((await app.request("/api/admin/export", { headers: { cookie } })).status).toBe(200);
    // And the one screen where they can fix it stays reachable.
    expect((await app.request("/api/billing", { headers: { cookie } })).status).toBe(200);
  });

  it("torna scrivibile quando il pagamento va a buon fine", async () => {
    const response = await post(
      subscriptionEvent({ type: "customer.subscription.updated", organizationId, status: "active" }),
    );
    expect(response.status).toBe(200);

    const organization = await organizationRow();
    expect(organization.status).toBe("ACTIVE");
    expect(organization.pastDueSince).toBeNull();

    const write = await app.request("/api/hours", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        date: "2026-04-14",
        kind: "work",
        morning: { start: "09:00", end: "13:00" },
        userId: employeeId,
      }),
    });
    expect(write.status).toBe(201);
  });

  it("mette in stato disdetto una sottoscrizione cancellata", async () => {
    const response = await post(
      subscriptionEvent({ type: "customer.subscription.deleted", organizationId, status: "canceled" }),
    );
    expect(response.status).toBe(200);
    expect((await organizationRow()).status).toBe("CANCELLED");
  });
});
