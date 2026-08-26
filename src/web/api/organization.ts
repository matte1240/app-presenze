import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import type { organizationSettingsSchema } from "@core/contracts";
import { call, rpc } from "./client";

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema> & {
  id: string;
  slug: string;
};

export const organizationQuery = queryOptions({
  queryKey: ["organization"],
  queryFn: () => call<{ organization: OrganizationSettings }>(rpc.organization.$get()),
  select: (data) => data.organization,
});

export function useSaveOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: z.infer<typeof organizationSettingsSchema>) =>
      call<{ organization: OrganizationSettings }>(rpc.organization.$patch({ json })),
    // The session carries the company's name and calendar too, so both go.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export interface ActiveSessionRow {
  id: string;
  current: boolean;
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
  impersonated: boolean;
}

export const mySessionsQuery = queryOptions({
  queryKey: ["me", "sessions"],
  queryFn: () => call<{ sessions: ActiveSessionRow[] }>(rpc.me.sessions.$get()),
  select: (data) => data.sessions,
});

export function useCloseOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => call<{ closed: number }>(rpc.me.sessions.$delete()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "sessions"] }),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: { name: string; email: string; currentPassword?: string }) =>
      call(rpc.me.$patch({ json })),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
