import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LeaveRequestPayload, LeaveStatus, LeaveType } from "@core/contracts";
import { call, rpc } from "./client";

export interface LeaveRequest {
  id: string;
  userId: string;
  type: LeaveType;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  user: { id: string; name: string; email: string };
}

export const requestsQuery = (filters: { userId?: string; status?: LeaveStatus } = {}) =>
  queryOptions({
    queryKey: ["requests", filters],
    queryFn: () => call<{ requests: LeaveRequest[] }>(rpc.requests.$get({ query: filters })),
    select: (data) => data.requests,
  });

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: LeaveRequestPayload) => call(rpc.requests.$post({ json })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["requests"] }),
  });
}

export function useReviewRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "APPROVED" | "REJECTED" }) =>
      call<{ created: number; conflicts: string[] }>(
        rpc.requests[":id"].review.$patch({ param: { id }, json: { status } }),
      ),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useDeleteRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call(rpc.requests[":id"].$delete({ param: { id } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["requests"] }),
  });
}
