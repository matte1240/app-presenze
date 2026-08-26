/**
 * Plans and what a subscription's state permits.
 *
 * Plans live in code rather than in a table on purpose. A price and a seat
 * limit are commercial promises: changing one should be a commit someone
 * reviewed, not a row an administrator can edit at three in the morning. The
 * Stripe price ids are the only part that varies per deployment, and those
 * come from the environment.
 */

export const PLAN_IDS = ["STARTER", "PRO", "BUSINESS"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  /** `null` means unlimited. */
  readonly maxEmployees: number | null;
}

export const PLANS: Readonly<Record<PlanId, Plan>> = {
  STARTER: { id: "STARTER", name: "Starter", maxEmployees: 10 },
  PRO: { id: "PRO", name: "Pro", maxEmployees: 50 },
  BUSINESS: { id: "BUSINESS", name: "Business", maxEmployees: null },
};

export const isPlanId = (value: string): value is PlanId => value in PLANS;

/** The cheapest plan that can hold this many people, or `null` if none can. */
export function smallestPlanFor(employees: number): Plan | null {
  return (
    PLAN_IDS.map((id) => PLANS[id]).find((p) => p.maxEmployees === null || employees <= p.maxEmployees) ?? null
  );
}

export function seatsAvailable(plan: PlanId, current: number): boolean {
  const limit = PLANS[plan].maxEmployees;
  return limit === null || current < limit;
}

// ── Subscription state ────────────────────────────────────────────────────

export const ORG_STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

/**
 * How long a failed payment keeps full access. Long enough for a card to be
 * replaced over a weekend, short enough to matter.
 */
export const GRACE_DAYS = 7;

export type AccessLevel = "full" | "read-only";

export interface AccessInput {
  readonly status: OrgStatus;
  readonly trialEndsAt: Date | null;
  /** When the subscription first went unpaid; the grace period counts from here. */
  readonly pastDueSince: Date | null;
  readonly now: Date;
}

/**
 * Read-only, never destructive. A company that stops paying keeps its data and
 * keeps being able to read and export it: the leverage is that they cannot
 * record anything new, not that we hold their timesheets hostage.
 */
export function accessLevel(input: AccessInput): AccessLevel {
  switch (input.status) {
    case "ACTIVE":
      return "full";

    case "TRIAL":
      return input.trialEndsAt && input.trialEndsAt.getTime() <= input.now.getTime()
        ? "read-only"
        : "full";

    case "PAST_DUE": {
      if (!input.pastDueSince) return "full";
      const deadline = input.pastDueSince.getTime() + GRACE_DAYS * 86_400_000;
      return input.now.getTime() <= deadline ? "full" : "read-only";
    }

    case "SUSPENDED":
    case "CANCELLED":
      return "read-only";
  }
}

/** Days left in a trial, floored at zero; `null` when there is no trial running. */
export function trialDaysLeft(trialEndsAt: Date | null, now: Date): number | null {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000));
}
