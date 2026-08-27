import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateUserPayload, UpdateUserPayload, WeekSchedulePayload } from "@core/contracts";
import type { DaySchedule } from "@core/schedule";
import { call, rpc } from "./client";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  canWorkSunday: boolean;
  has104: boolean;
  hasPaternity: boolean;
  /** Set when the person has left; their history stays, their account stops. */
  deactivatedAt: string | null;
  createdAt: string;
  regularHours: number | null;
  overtimeHours: number | null;
}

export const usersQuery = queryOptions({
  queryKey: ["users"],
  queryFn: () => call<{ users: ManagedUser[] }>(rpc.users.$get()),
  select: (data) => data.users,
  staleTime: 60_000,
});

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: CreateUserPayload) =>
      call<{ user: ManagedUser; invited: boolean }>(rpc.users.$post({ json })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...json }: UpdateUserPayload & { id: string }) =>
      call(rpc.users[":id"].$patch({ param: { id }, json })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call(rpc.users[":id"].deactivate.$post({ param: { id } })),
    // The seat count on the session changes too, so the whole cache goes.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call(rpc.users[":id"].reactivate.$post({ param: { id } })),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export interface DeletionPreview {
  deactivated: boolean;
  timeEntries: number;
  leaveRequests: number;
}

/** What deleting this person would destroy, so the confirmation can name it. */
export function deletionPreview(id: string) {
  return call<DeletionPreview>(rpc.users[":id"]["deletion-preview"].$get({ param: { id } }));
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call(rpc.users[":id"].$delete({ param: { id } })),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword?: string }) =>
      call<{ emailed: boolean }>(
        rpc.users[":id"]["reset-password"].$post({ param: { id }, json: { newPassword } }),
      ),
  });
}

export function useRemindUser() {
  return useMutation({
    mutationFn: (id: string) => call<{ sent: boolean }>(rpc.users[":id"].remind.$post({ param: { id } })),
  });
}

export function useSaveSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...json }: WeekSchedulePayload & { id: string }) =>
      call<{ days: DaySchedule[] }>(rpc.users[":id"].schedule.$put({ param: { id }, json })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedule"] }),
  });
}
