import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, call, rpc } from "./client";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  canWorkSunday: boolean;
  has104: boolean;
  hasPaternity: boolean;
}

export interface Session {
  user: CurrentUser;
  idleExpiresAt: string;
}

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: async (): Promise<Session | null> => {
    try {
      return await call<Session>(rpc.auth.me.$get());
    } catch (error) {
      // Not being logged in is an expected answer here, not a failure.
      if (error instanceof ApiError && error.isUnauthenticated) return null;
      throw error;
    }
  },
  // The server decides when a session ends; this only controls how quickly the
  // client notices.
  staleTime: 60_000,
  retry: false,
});

export const authStateQuery = queryOptions({
  queryKey: ["auth-state"],
  queryFn: () => call<{ needsSetup: boolean; appName: string }>(rpc.auth.state.$get()),
  staleTime: Infinity,
});

export function useSession() {
  return useQuery(sessionQuery);
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: { email: string; password: string }) => call(rpc.auth.login.$post({ json })),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => call(rpc.auth.logout.$post()),
    onSettled: () => {
      queryClient.clear();
      window.location.assign("/");
    },
  });
}
