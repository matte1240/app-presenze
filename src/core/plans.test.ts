import { describe, expect, it } from "vitest";
import {
  accessLevel,
  GRACE_DAYS,
  PLANS,
  seatsAvailable,
  smallestPlanFor,
  trialDaysLeft,
  type AccessInput,
} from "./plans";

const at = (value: string | number) => new Date(value);
const base: AccessInput = {
  status: "ACTIVE",
  trialEndsAt: null,
  pastDueSince: null,
  now: at("2026-03-10T12:00:00Z"),
};

describe("seats", () => {
  it("counts up to the plan limit", () => {
    expect(seatsAvailable("STARTER", 9)).toBe(true);
    expect(seatsAvailable("STARTER", 10)).toBe(false);
  });

  it("never refuses on an unlimited plan", () => {
    expect(PLANS.BUSINESS.maxEmployees).toBeNull();
    expect(seatsAvailable("BUSINESS", 10_000)).toBe(true);
  });

  it("names the cheapest plan that fits", () => {
    expect(smallestPlanFor(8)?.id).toBe("STARTER");
    expect(smallestPlanFor(11)?.id).toBe("PRO");
    expect(smallestPlanFor(500)?.id).toBe("BUSINESS");
  });
});

describe("accessLevel", () => {
  it("lets an active subscription write", () => {
    expect(accessLevel(base)).toBe("full");
  });

  it("lets a running trial write, and stops it the moment it lapses", () => {
    const trial = { ...base, status: "TRIAL" as const };
    expect(accessLevel({ ...trial, trialEndsAt: at("2026-03-11T12:00:00Z") })).toBe("full");
    expect(accessLevel({ ...trial, trialEndsAt: at("2026-03-10T11:59:00Z") })).toBe("read-only");
  });

  it("keeps a failed payment working through the grace period", () => {
    const pastDue = { ...base, status: "PAST_DUE" as const };
    const inGrace = at(base.now.getTime() - (GRACE_DAYS - 1) * 86_400_000);
    const expired = at(base.now.getTime() - (GRACE_DAYS + 1) * 86_400_000);

    expect(accessLevel({ ...pastDue, pastDueSince: inGrace })).toBe("full");
    expect(accessLevel({ ...pastDue, pastDueSince: expired })).toBe("read-only");
  });

  it("leaves suspended and cancelled companies able to read their own data", () => {
    expect(accessLevel({ ...base, status: "SUSPENDED" })).toBe("read-only");
    expect(accessLevel({ ...base, status: "CANCELLED" })).toBe("read-only");
  });
});

describe("trialDaysLeft", () => {
  it("rounds up and floors at zero", () => {
    expect(trialDaysLeft(at("2026-03-13T12:00:00Z"), base.now)).toBe(3);
    expect(trialDaysLeft(at("2026-03-01T12:00:00Z"), base.now)).toBe(0);
    expect(trialDaysLeft(null, base.now)).toBeNull();
  });
});
