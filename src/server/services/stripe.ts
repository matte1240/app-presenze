/**
 * Stripe, and the small amount of state we keep on our side of it.
 *
 * The division of labour is deliberate: Stripe owns the money — prices, cards,
 * invoices, dunning, the whole billing portal — and we own one column,
 * `organizations.status`, that says what the application will let a company do.
 * Webhooks are the only thing that writes it. Nothing here ever asks Stripe a
 * question during a request that a customer is waiting on.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { isPlanId, type PlanId } from "@core/plans";
import { platformDb } from "../db/client";
import { organizations, subscriptions, type OrganizationRow } from "../db/platform-schema";
import { env, stripeEnabled, stripePrices } from "../env";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!stripeEnabled) throw new Error("Stripe non è configurato su questa installazione");
  client ??= new Stripe(env.STRIPE_SECRET_KEY!);
  return client;
}

export const planForPrice = (priceId: string | null | undefined): PlanId | null => {
  if (!priceId) return null;
  const found = Object.entries(stripePrices).find(([, id]) => id === priceId)?.[0];
  return found && isPlanId(found) ? found : null;
};

export async function subscriptionOf(organizationId: string) {
  const [row] = await platformDb
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);
  return row ?? null;
}

/**
 * The Stripe customer for this company, created on first need.
 *
 * `metadata.organizationId` is the load-bearing part: a webhook arrives naming
 * a customer and a subscription, and this is what ties either back to a company
 * without a lookup table that could go stale.
 */
export async function customerIdFor(organization: OrganizationRow): Promise<string> {
  const existing = await subscriptionOf(organization.id);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const customer = await stripe().customers.create({
    name: organization.name,
    metadata: { organizationId: organization.id },
  });

  if (existing) {
    await platformDb
      .update(subscriptions)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(subscriptions.organizationId, organization.id));
  } else {
    await platformDb.insert(subscriptions).values({
      id: randomUUID(),
      organizationId: organization.id,
      stripeCustomerId: customer.id,
    });
  }

  return customer.id;
}

export async function createCheckoutSession(
  organization: OrganizationRow,
  plan: PlanId,
): Promise<string> {
  const price = stripePrices[plan];
  if (!price) throw new Error(`Nessun prezzo Stripe configurato per il piano ${plan}`);

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: await customerIdFor(organization),
    line_items: [{ price, quantity: 1 }],
    client_reference_id: organization.id,
    // Both, on purpose: `client_reference_id` rides on the checkout session and
    // `metadata` rides on the subscription that outlives it.
    subscription_data: { metadata: { organizationId: organization.id } },
    success_url: `${env.APP_URL}/abbonamento?checkout=ok`,
    cancel_url: `${env.APP_URL}/abbonamento?checkout=annullato`,
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error("Stripe non ha restituito un URL di pagamento");
  return session.url;
}

/**
 * Changing plan, updating a card and cancelling all happen in Stripe's own
 * portal. Rebuilding any of that here would mean rebuilding PCI scope with it.
 */
export async function createPortalSession(organization: OrganizationRow): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({
    customer: await customerIdFor(organization),
    return_url: `${env.APP_URL}/abbonamento`,
  });
  return session.url;
}

/** Stripe's vocabulary for a subscription's health, mapped onto ours. */
export function statusFromStripe(
  stripeStatus: Stripe.Subscription.Status,
): OrganizationRow["status"] {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELLED";
    // `incomplete` and `paused` mean the subscription never started or is on
    // hold. Neither is a paying state, and neither is a failure to chase.
    default:
      return "SUSPENDED";
  }
}

/**
 * Writes what a subscription event means for the company.
 *
 * `pastDueSince` is set once and cleared on recovery rather than rewritten on
 * every event: Stripe redelivers, and a grace period that restarted with each
 * redelivery would never run out.
 */
export async function applySubscription(
  organizationId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const plan = planForPrice(priceId);
  const status = statusFromStripe(subscription.status);
  const periodEnd = subscription.items.data[0]?.current_period_end;
  const now = new Date();

  const [current] = await platformDb
    .select({ pastDueSince: organizations.pastDueSince })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  await platformDb
    .update(organizations)
    .set({
      status,
      ...(plan ? { plan } : {}),
      // A company that has paid is no longer on a trial clock.
      ...(status === "ACTIVE" ? { trialEndsAt: null } : {}),
      pastDueSince:
        status === "PAST_DUE" ? (current?.pastDueSince ?? now) : null,
      updatedAt: now,
    })
    .where(eq(organizations.id, organizationId));

  const values = {
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    stripeStatus: subscription.status,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end ? "true" : "false",
    updatedAt: now,
  };

  const existing = await subscriptionOf(organizationId);
  if (existing) {
    await platformDb
      .update(subscriptions)
      .set(values)
      .where(eq(subscriptions.organizationId, organizationId));
  } else {
    await platformDb
      .insert(subscriptions)
      .values({ id: randomUUID(), organizationId, ...values });
  }
}

/** Which company a Stripe object belongs to, by the metadata we set on it. */
export async function organizationIdFrom(
  object: { metadata?: Stripe.Metadata | null; customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null },
): Promise<string | null> {
  const fromMetadata = object.metadata?.organizationId;
  if (fromMetadata) return fromMetadata;

  const customerId = typeof object.customer === "string" ? object.customer : object.customer?.id;
  if (!customerId) return null;

  const [row] = await platformDb
    .select({ organizationId: subscriptions.organizationId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1);
  return row?.organizationId ?? null;
}
