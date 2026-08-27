/**
 * The company's own settings.
 *
 * These used to be environment variables, back when the deployment was the
 * company: `TZ` decided when a day rolled over and `HOLIDAY_PATRON_DAYS` which
 * local saint's day was a holiday. Making the organization a row moved them
 * onto it, and for a while nothing could write them — a company was stuck with
 * whatever it had at signup. This is that regression closed.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { billingProfileSchema, organizationSettingsSchema } from "@core/contracts";
import { orgOf, requireActiveSubscription, requireAdmin } from "../auth/guards";
import { platformDb } from "../db/client";
import {
  billingProfiles,
  organizations,
  type BillingProfileRow,
} from "../db/platform-schema";
import type { AppEnv } from "../http/app-env";
import { validate } from "../http/validate";
import { syncBillingProfile } from "../services/stripe";

const settingsOf = (organization: {
  id: string;
  name: string;
  slug: string;
  companyName: string | null;
  timezone: string;
  holidayPatronDays: string;
}) => ({
  id: organization.id,
  slug: organization.slug,
  name: organization.name,
  companyName: organization.companyName,
  timezone: organization.timezone,
  holidayPatronDays: organization.holidayPatronDays,
});

async function profileOf(organizationId: string) {
  const [row] = await platformDb
    .select()
    .from(billingProfiles)
    .where(eq(billingProfiles.organizationId, organizationId))
    .limit(1);
  return row ?? null;
}

const publicProfile = (row: BillingProfileRow | null) =>
  row
    ? {
        legalName: row.legalName,
        addressLine: row.addressLine,
        postalCode: row.postalCode,
        city: row.city,
        province: row.province,
        country: row.country,
        vatNumber: row.vatNumber,
        taxCode: row.taxCode,
        sdiCode: row.sdiCode,
        pec: row.pec,
        billingEmail: row.billingEmail,
      }
    : null;

export const organizationRoutes = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .use("*", requireActiveSubscription)

  .get("/", (c) => c.json({ organization: settingsOf(orgOf(c)) }))

  .patch("/", validate("json", organizationSettingsSchema), async (c) => {
    const organization = orgOf(c);
    const input = c.req.valid("json");

    // `organizations` is control-plane and carries no isolation policy, so the
    // predicate on the id is the only thing scoping this write. It comes from
    // the session, never from the request body.
    const [updated] = await platformDb
      .update(organizations)
      .set({
        name: input.name,
        companyName: input.companyName?.trim() || null,
        timezone: input.timezone,
        holidayPatronDays: input.holidayPatronDays,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organization.id))
      .returning();

    return c.json({ organization: settingsOf(updated!) });
  })

  .get("/billing-profile", async (c) =>
    c.json({ profile: publicProfile(await profileOf(orgOf(c).id)) }),
  )

  /**
   * The invoicing details. Saved here whatever Stripe thinks: the accounting
   * data is ours to hold, and a customer correcting their own VAT number must
   * not depend on a third party being reachable.
   */
  .put("/billing-profile", validate("json", billingProfileSchema), async (c) => {
    const organization = orgOf(c);
    const input = c.req.valid("json");
    const blank = (v: string | null) => (v && v.trim() !== "" ? v.trim() : null);

    const values = {
      legalName: input.legalName,
      addressLine: input.addressLine,
      postalCode: input.postalCode,
      city: input.city,
      province: blank(input.province),
      country: input.country,
      vatNumber: blank(input.vatNumber),
      taxCode: blank(input.taxCode)?.toUpperCase() ?? null,
      sdiCode: blank(input.sdiCode)?.toUpperCase() ?? null,
      pec: blank(input.pec),
      billingEmail: blank(input.billingEmail),
      updatedAt: new Date(),
    };

    const [saved] = await platformDb
      .insert(billingProfiles)
      .values({ id: randomUUID(), organizationId: organization.id, ...values })
      .onConflictDoUpdate({ target: billingProfiles.organizationId, set: values })
      .returning();

    const synced = await syncBillingProfile(organization, saved!);
    return c.json({ profile: publicProfile(saved!), synced });
  });
