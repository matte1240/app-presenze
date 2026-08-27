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

export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
  createdAt: string;
}

export const platformMeQuery = queryOptions({
  queryKey: ["platform", "me"],
  queryFn: async () => {
    try {
      return await platform<{
        admin: { id: string; name: string; email: string; mustChangePassword: boolean };
      }>("/me");
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthenticated) return null;
      throw error;
    }
  },
  retry: false,
});

export const platformAdminsQuery = queryOptions({
  queryKey: ["platform", "admins"],
  queryFn: () => platform<{ admins: PlatformAdmin[]; me: string }>("/admins"),
});

export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string; temporaryPassword: string }) =>
      platform<{ admin: { id: string } }>("/admins", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform"] }),
  });
}

export function useDeleteAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => platform<{ ok: true }>(`/admins/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform"] }),
  });
}

export function useChangeOwnPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      platform<{ ok: true }>("/admins/me/password", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform"] }),
  });
}

export interface OrganizationDetail {
  organization: PlatformOrganization & {
    pastDueSince: string | null;
    timezone: string;
    holidayPatronDays: string;
  };
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "EMPLOYEE";
    deactivatedAt: string | null;
    createdAt: string;
  }>;
  subscription: {
    stripeCustomerId: string | null;
    stripeStatus: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  audit: AuditEntry[];
}

export const organizationDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["platform", "organization", id],
    queryFn: () => platform<OrganizationDetail>(`/organizations/${id}`),
  });

export function organizationDeletionPreview(id: string) {
  return platform<{ users: number; timeEntries: number }>(`/organizations/${id}/deletion-preview`);
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => platform<{ ok: true }>(`/organizations/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform"] }),
  });
}

/** Leaves a customer's account without signing out of the back office. */
export function stopImpersonation() {
  return platform<{ ok: true }>("/stop-impersonation", { method: "POST" });
}

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

export interface StoredBackup {
  filename: string;
  sizeBytes: number;
  lastModified: string;
}

export interface BackupStatus {
  enabled: boolean;
  bucket: string | null;
  prefix: string;
  cronExpression: string;
  retentionDays: number;
  minCount: number;
  backups: StoredBackup[];
}

export const platformBackupsQuery = queryOptions({
  queryKey: ["platform", "backups"],
  queryFn: () => platform<BackupStatus>("/backups"),
});

export function useCreateBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => platform<{ backup: StoredBackup }>("/backups", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "backups"] }),
  });
}

export function usePruneBackups() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => platform<{ removed: string[] }>("/backups/prune", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "backups"] }),
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) => platform<{ ok: true }>(`/backups/${filename}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "backups"] }),
  });
}

export function useRestoreBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) =>
      platform<{ ok: true; safetyBackup: string }>(`/backups/${filename}/restore`, {
        method: "POST",
        body: JSON.stringify({ confirm: filename }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "backups"] }),
  });
}

/**
 * A plain navigation, not `platform()`: the server answers with a 302 straight
 * to the bucket, and following that redirect here would mean downloading a
 * multi-gigabyte dump into this tab's memory just to hand it back out again.
 */
export function downloadBackup(filename: string) {
  const anchor = document.createElement("a");
  anchor.href = `/api/platform/backups/${filename}/download`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export interface OrgBackupStatus {
  enabled: boolean;
  backups: StoredBackup[];
}

export const organizationBackupsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["platform", "organization", organizationId, "backups"],
    queryFn: () => platform<OrgBackupStatus>(`/organizations/${organizationId}/backups`),
  });

export function useCreateOrgBackup(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      platform<{ backup: StoredBackup }>(`/organizations/${organizationId}/backups`, { method: "POST" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["platform", "organization", organizationId, "backups"] }),
  });
}

export function useDeleteOrgBackup(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) =>
      platform<{ ok: true }>(`/organizations/${organizationId}/backups/${filename}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["platform", "organization", organizationId, "backups"] }),
  });
}

export function useRestoreOrgBackup(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) =>
      platform<{ ok: true; safetyBackup: string; usersRestored: number; emailed: number }>(
        `/organizations/${organizationId}/backups/${filename}/restore`,
        { method: "POST", body: JSON.stringify({ confirm: filename }) },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["platform", "organization", organizationId, "backups"] }),
  });
}

export function downloadOrgBackup(organizationId: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = `/api/platform/organizations/${organizationId}/backups/${filename}/download`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
