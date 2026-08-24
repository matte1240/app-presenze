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

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call(rpc.users[":id"].$delete({ param: { id } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
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
