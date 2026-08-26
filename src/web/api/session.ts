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
  createdAt: string;
}

export type OrgStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";

export interface CurrentOrganization {
  id: string;
  name: string;
  slug: string;
  companyName: string;
  plan: "STARTER" | "PRO" | "BUSINESS";
  planName: string;
  status: OrgStatus;
  /** What the server will actually let this company do right now. */
  access: "full" | "read-only";
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  seatsUsed: number;
  /** `null` on an unlimited plan. */
  seatLimit: number | null;
}

export interface Session {
  user: CurrentUser;
  organization: CurrentOrganization;
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
  queryFn: () => call<{ appName: string; signupEnabled: boolean }>(rpc.auth.state.$get()),
  staleTime: Infinity,
});

export function useSession() {
  return useQuery(sessionQuery);
}

/** The answer when one address and password open more than one company. */
export interface OrganizationChoice {
  ok: false;
  needsOrganizationChoice: true;
  organizations: Array<{ id: string; name: string }>;
}

export type LoginResult = { ok: true } | OrganizationChoice;

export const needsChoice = (result: LoginResult): result is OrganizationChoice =>
  result.ok === false;

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: { email: string; password: string; organizationId?: string }) =>
      call<LoginResult>(rpc.auth.login.$post({ json })),
    // `resetQueries`, not `invalidateQueries`: the router's `beforeLoad` calls
    // `ensureQueryData`, which hands back cached data even once it is stale.
    // Merely invalidating would leave the guard reading the pre-login answer —
    // that no session exists — and bouncing straight back to this page.
    onSuccess: () => queryClient.resetQueries(),
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: {
      organizationName: string;
      name: string;
      email: string;
      password: string;
    }) => call<{ ok: true }>(rpc.auth.signup.$post({ json })),
    onSuccess: () => queryClient.resetQueries(),
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
