import { Hono } from "hono";
import { z } from "zod";
import { PLAN_IDS, PLANS, isPlanId } from "@core/plans";
import { orgOf, requireAdmin } from "../auth/guards";
import { stripeEnabled, stripePrices } from "../env";
import type { AppEnv } from "../http/app-env";
import { invalid } from "../http/errors";
import { validate } from "../http/validate";
import { seatsUsed } from "../services/organizations";
import {
  createCheckoutSession,
  createPortalSession,
  invoicesFor,
  subscriptionOf,
} from "../services/stripe";
import { organizationSummary } from "./auth";

const checkoutSchema = z.object({
  plan: z.string().refine((value): boolean => isPlanId(value), "Piano inesistente"),
});

/**
 * Billing is an administrator's business, so the whole router is behind
 * `requireAdmin` — but deliberately *not* behind `requireActiveSubscription`.
 * The one screen a company must always be able to reach is the one where they
 * fix the reason they cannot reach the others.
 */
export const billingRoutes = new Hono<AppEnv>()
  .use("*", requireAdmin)

  .get("/", async (c) => {
    const organization = orgOf(c);
    const subscription = await subscriptionOf(organization.id);

    return c.json({
      organization: organizationSummary(organization, await seatsUsed()),
      stripeEnabled,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd === "true",
      plans: PLAN_IDS.map((id) => ({
        id,
        name: PLANS[id].name,
        maxEmployees: PLANS[id].maxEmployees,
        /** A plan with no price configured cannot be bought, only assigned. */
        purchasable: Boolean(stripePrices[id]),
      })),
    });
  })

  .get("/invoices", async (c) => c.json({ invoices: await invoicesFor(orgOf(c).id) }))

  .post("/checkout", validate("json", checkoutSchema), async (c) => {
    if (!stripeEnabled) throw invalid("I pagamenti non sono configurati su questa installazione");
    const { plan } = c.req.valid("json");
    if (!isPlanId(plan)) throw invalid("Piano inesistente");
    return c.json({ url: await createCheckoutSession(orgOf(c), plan) });
  })

  .post("/portal", async (c) => {
    if (!stripeEnabled) throw invalid("I pagamenti non sono configurati su questa installazione");
    return c.json({ url: await createPortalSession(orgOf(c)) });
  });
