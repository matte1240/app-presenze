/**
 * Stripe's side of the conversation.
 *
 * Mounted before `loadSession` and outside the JSON validator, because the
 * signature is computed over the raw body: parsing it first would make it
 * unverifiable. There is no session here and no tenant — the event says which
 * company it concerns, and nothing else may.
 */
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type Stripe from "stripe";
import { platformDb } from "../db/client";
import { stripeEvents } from "../db/platform-schema";
import { env, stripeEnabled } from "../env";
import type { AppEnv } from "../http/app-env";
import { applySubscription, organizationIdFrom, stripe } from "../services/stripe";

/**
 * Stripe redelivers, so every handler below has to be safe to run twice. The
 * cheapest way to guarantee that is not to run it twice: the event id is the
 * primary key, and a duplicate insert means we have already seen it.
 */
async function firstTime(event: Stripe.Event): Promise<boolean> {
  const inserted = await platformDb
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });
  return inserted.length > 0;
}

async function handle(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const organizationId = session.client_reference_id ?? (await organizationIdFrom(session));
      if (!organizationId || !session.subscription) break;

      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      // The checkout session carries an id, not the subscription itself, and
      // the subscription is where the price and the period live.
      await applySubscription(organizationId, await stripe().subscriptions.retrieve(subscriptionId));
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const organizationId = await organizationIdFrom(subscription);
      if (organizationId) await applySubscription(organizationId, subscription);
      break;
    }

    case "invoice.payment_failed": {
      // Nothing is written here: Stripe follows this with a subscription
      // update carrying `past_due`, and one writer for one column is what keeps
      // the grace period from being restarted by a redelivery.
      const invoice = event.data.object;
      const organizationId = await organizationIdFrom(invoice);
      console.warn(`Pagamento fallito per l'organizzazione ${organizationId ?? "sconosciuta"}`);
      break;
    }

    default:
      break;
  }
}

export const webhookRoutes = new Hono<AppEnv>().post("/stripe", async (c) => {
  if (!stripeEnabled) return c.json({ received: false, reason: "stripe-disabled" }, 503);

  const signature = c.req.header("stripe-signature");
  if (!signature) return c.json({ error: "firma mancante" }, 400);

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(
      await c.req.text(),
      signature,
      env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    // An unverifiable event is not an error on our side to report in detail.
    console.warn("Webhook Stripe rifiutato:", error instanceof Error ? error.message : error);
    return c.json({ error: "firma non valida" }, 400);
  }

  if (!(await firstTime(event))) return c.json({ received: true, duplicate: true });

  try {
    await handle(event);
  } catch (error) {
    // Deleting the marker lets Stripe's retry actually retry: leaving it would
    // make a transient failure permanent.
    await platformDb.delete(stripeEvents).where(eq(stripeEvents.id, event.id));
    throw error;
  }

  return c.json({ received: true });
});
