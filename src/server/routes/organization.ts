/**
 * The company's own settings.
 *
 * These used to be environment variables, back when the deployment was the
 * company: `TZ` decided when a day rolled over and `HOLIDAY_PATRON_DAYS` which
 * local saint's day was a holiday. Making the organization a row moved them
 * onto it, and for a while nothing could write them — a company was stuck with
 * whatever it had at signup. This is that regression closed.
 */
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { organizationSettingsSchema } from "@core/contracts";
import { orgOf, requireActiveSubscription, requireAdmin } from "../auth/guards";
import { platformDb } from "../db/client";
import { organizations } from "../db/platform-schema";
import type { AppEnv } from "../http/app-env";
import { validate } from "../http/validate";

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
  });
