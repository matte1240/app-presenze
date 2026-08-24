import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LocalDate } from "@core/date";
import type { DayEntryPayload } from "@core/contracts";
import type { DaySchedule } from "@core/schedule";
import { call, rpc } from "./client";

export interface TimeEntry {
  id: string;
  userId: string;
  workDate: string;
  kind: "work" | "vacation" | "sickness" | "paternity";
  morningStart: string | null;
  morningEnd: string | null;
  afternoonStart: string | null;
  afternoonEnd: string | null;
  morningOnLeave: boolean;
  afternoonOnLeave: boolean;
  use104: boolean;
  hours104Override: number | null;
  regularHours: number;
  overtimeHours: number;
  leaveHours: number;
  leave104Hours: number;
  vacationHours: number;
  sicknessHours: number;
  paternityHours: number;
  notes: string | null;
  medicalCertificate: string | null;
}

export const entriesQuery = (userId: string, from: LocalDate, to: LocalDate) =>
  queryOptions({
    queryKey: ["entries", userId, from, to],
    queryFn: () => call<{ entries: TimeEntry[] }>(rpc.hours.$get({ query: { userId, from, to } })),
    select: (data) => data.entries,
  });

export const scheduleQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["schedule", userId ?? "me"],
    queryFn: () =>
      userId
        ? call<{ days: DaySchedule[]; canWorkSunday: boolean }>(
            rpc.users[":id"].schedule.$get({ param: { id: userId } }),
          )
        : call<{ days: DaySchedule[]; canWorkSunday: boolean }>(rpc.me.schedule.$get()),
    staleTime: 5 * 60_000,
  });

export function useSaveEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: DayEntryPayload) => call<{ entry: TimeEntry }>(rpc.hours.$post({ json })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["entries"] }),
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call(rpc.hours[":id"].$delete({ param: { id } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["entries"] }),
  });
}

export function useRecalculateMonth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: { userId: string; month: string }) =>
      call<{ total: number; changed: number }>(rpc.hours.recalculate.$post({ json })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["entries"] }),
  });
}
