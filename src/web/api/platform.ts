/**
 * The back-office client.
 *
 * Deliberately not routed through the typed RPC client the rest of the SPA
 * uses: that client is built from the tenant app's route tree, and keeping the
 * two apart means a back-office call can never be made by accident from an
 * ordinary screen.
 */
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

export type OrgStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";
export type PlanId = "STARTER" | "PRO" | "BUSINESS";

export interface PlatformOrganization {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  plan: PlanId;
  planName: string;
  seatsUsed: number;
  seatLimit: number | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  organizationId: string | null;
  actorLabel: string | null;
  action: string;
  detail: unknown;
  createdAt: string;
}

async function platform<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/platform${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;
    throw new ApiError(
      body?.error?.code ?? "internal",
      body?.error?.message ?? "Errore imprevisto",
      response.status,
    );
  }
  return (await response.json()) as T;
}

export const platformMeQuery = queryOptions({
  queryKey: ["platform", "me"],
  queryFn: async () => {
    try {
      return await platform<{ admin: { id: string; name: string; email: string } }>("/me");
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthenticated) return null;
      throw error;
    }
  },
  retry: false,
});

export const platformOrganizationsQuery = queryOptions({
  queryKey: ["platform", "organizations"],
  queryFn: () =>
    platform<{
      organizations: PlatformOrganization[];
      plans: Array<{ id: PlanId; name: string; maxEmployees: number | null }>;
    }>("/organizations"),
});

export const platformAuditQuery = queryOptions({
  queryKey: ["platform", "audit"],
  queryFn: () => platform<{ entries: AuditEntry[] }>("/audit"),
});

export function usePlatformLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      platform<{ ok: true }>("/login", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.resetQueries(),
  });
}

export function usePlatformLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => platform<{ ok: true }>("/logout", { method: "POST" }),
    onSettled: () => {
      queryClient.clear();
      window.location.assign("/piattaforma");
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      organizationName: string;
      adminName: string;
      adminEmail: string;
      plan?: PlanId;
      trialDays?: number;
    }) => platform<{ organization: { id: string }; invited: boolean }>("/organizations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform"] }),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; plan?: PlanId; status?: OrgStatus; trialEndsAt?: string | null }) =>
      platform<{ organization: PlatformOrganization }>(`/organizations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform"] }),
  });
}

export function useImpersonate() {
  return useMutation({
    mutationFn: async (id: string) => {
      await platform<{ ok: true }>(`/organizations/${id}/impersonate`, { method: "POST" });
      // A full reload, not a router navigation: the tenant session cookie has
      // just changed underneath the entire app.
      window.location.assign("/calendario");
    },
  });
}

export function exportOrganization(organization: PlatformOrganization) {
  const anchor = document.createElement("a");
  anchor.href = `/api/platform/organizations/${organization.id}/export`;
  anchor.download = `${organization.slug}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
