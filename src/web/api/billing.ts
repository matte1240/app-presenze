import { queryOptions, useMutation } from "@tanstack/react-query";
import type { CurrentOrganization } from "./session";
import { call, rpc } from "./client";

export interface PlanOption {
  id: "STARTER" | "PRO" | "BUSINESS";
  name: string;
  maxEmployees: number | null;
  /** False when no Stripe price is configured: assignable, but not buyable. */
  purchasable: boolean;
}

export interface BillingState {
  organization: CurrentOrganization;
  stripeEnabled: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  plans: PlanOption[];
}

export const billingQuery = queryOptions({
  queryKey: ["billing"],
  queryFn: () => call<BillingState>(rpc.billing.$get()),
});

/**
 * Both of these end at Stripe rather than in a local view: cards, invoices and
 * plan changes are its business, and rebuilding any of it here would mean
 * taking on PCI scope for no gain.
 */
export function useCheckout() {
  return useMutation({
    mutationFn: async (plan: PlanOption["id"]) => {
      const { url } = await call<{ url: string }>(rpc.billing.checkout.$post({ json: { plan } }));
      window.location.assign(url);
    },
  });
}

export function usePortal() {
  return useMutation({
    mutationFn: async () => {
      const { url } = await call<{ url: string }>(rpc.billing.portal.$post());
      window.location.assign(url);
    },
  });
}
