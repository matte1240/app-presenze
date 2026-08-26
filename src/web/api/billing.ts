import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
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

export interface BillingProfile {
  legalName: string;
  addressLine: string;
  postalCode: string;
  city: string;
  province: string | null;
  country: string;
  vatNumber: string | null;
  taxCode: string | null;
  sdiCode: string | null;
  pec: string | null;
  billingEmail: string | null;
}

export interface Invoice {
  id: string;
  number: string | null;
  status: string | null;
  total: number;
  currency: string;
  createdAt: string;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

export const billingProfileQuery = queryOptions({
  queryKey: ["billing", "profile"],
  queryFn: () => call<{ profile: BillingProfile | null }>(rpc.organization["billing-profile"].$get()),
  select: (data) => data.profile,
});

export function useSaveBillingProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: BillingProfile) =>
      call<{ profile: BillingProfile; synced: boolean }>(
        rpc.organization["billing-profile"].$put({ json }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing"] }),
  });
}

export const invoicesQuery = queryOptions({
  queryKey: ["billing", "invoices"],
  queryFn: () => call<{ invoices: Invoice[] }>(rpc.billing.invoices.$get()),
  select: (data) => data.invoices,
});

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
