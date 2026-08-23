import { describe, expect, it } from "vitest";
import { eachDay, localDate } from "./date";
import {
  canEditDate,
  check104Quota,
  checkPaternityQuota,
  daysToMaterialize,
  isFutureTime,
  type UserFlags,
} from "./policy";
import { defaultWeek, weekFrom, defaultDay, type DaySchedule } from "./schedule";
import { toClock } from "./time";

const flags = (over: Partial<UserFlags> = {}): UserFlags => ({
  canWorkSunday: false,
  has104: false,
  hasPaternity: false,
  ...over,
});

const TODAY = localDate(2026, 8, 26); // a Wednesday

describe("canEditDate", () => {
  const employee = { today: TODAY, role: "EMPLOYEE" as const, flags: flags() };

  it("allows today and the two days before it", () => {
    for (const d of [localDate(2026, 8, 26), localDate(2026, 8, 25), localDate(2026, 8, 24)]) {
      expect(canEditDate({ ...employee, date: d })).toEqual({ ok: true });
    }
  });

  it("refuses anything older than the window", () => {
    expect(canEditDate({ ...employee, date: localDate(2026, 8, 23) })).toMatchObject({
      ok: false,
    });
    expect(canEditDate({ ...employee, date: localDate(2026, 8, 21) })).toEqual({
      ok: false,
      reason: "too-old",
    });
  });

  it("refuses the future", () => {
    expect(canEditDate({ ...employee, date: localDate(2026, 8, 27) })).toEqual({
      ok: false,
      reason: "future",
    });
  });

  it("refuses Sunday unless the employee is cleared for it", () => {
    const sunday = localDate(2026, 8, 30);
    expect(canEditDate({ ...employee, today: localDate(2026, 8, 30), date: sunday })).toEqual({
      ok: false,
      reason: "sunday",
    });
    expect(
      canEditDate({
        ...employee,
        today: localDate(2026, 8, 30),
        date: sunday,
        flags: flags({ canWorkSunday: true }),
      }),
    ).toEqual({ ok: true });
  });

  it("refuses public holidays outright", () => {
    expect(
      canEditDate({
        ...employee,
        today: localDate(2026, 12, 25),
        date: localDate(2026, 12, 25),
        flags: flags({ canWorkSunday: true }),
      }),
    ).toEqual({ ok: false, reason: "holiday" });
  });

  it("lets an admin correct any date, in either direction", () => {
    const admin = { today: TODAY, role: "ADMIN" as const, flags: flags() };
    for (const d of [localDate(2020, 1, 2), localDate(2026, 12, 25), localDate(2030, 5, 5)]) {
      expect(canEditDate({ ...admin, date: d })).toEqual({ ok: true });
    }
  });
});

describe("isFutureTime", () => {
  it("blocks hours not yet worked today", () => {
    const args = { date: TODAY, today: TODAY, nowMinutes: 10 * 60 };
    expect(isFutureTime({ ...args, time: toClock("18:00") })).toBe(true);
    expect(isFutureTime({ ...args, time: toClock("09:00") })).toBe(false);
    expect(isFutureTime({ ...args, time: toClock("10:00") })).toBe(false);
  });

  it("does not constrain earlier days", () => {
    expect(
      isFutureTime({
        date: localDate(2026, 8, 25),
        today: TODAY,
        time: toClock("23:00"),
        nowMinutes: 60,
      }),
    ).toBe(false);
  });
});

describe("Law 104 quota", () => {
  it("refuses an employee without the entitlement", () => {
    expect(
      check104Quota({ flags: flags(), hoursUsedThisMonth: 0, hoursRequested: 2 }),
    ).toEqual({ ok: false, reason: "not-entitled" });
  });

  it("allows up to 24 hours a month", () => {
    const f = flags({ has104: true });
    expect(check104Quota({ flags: f, hoursUsedThisMonth: 22, hoursRequested: 2 })).toEqual({
      ok: true,
    });
    expect(check104Quota({ flags: f, hoursUsedThisMonth: 22, hoursRequested: 2.5 })).toEqual({
      ok: false,
      reason: "monthly-limit",
    });
  });

  it("ignores a request for no hours", () => {
    expect(check104Quota({ flags: flags(), hoursUsedThisMonth: 0, hoursRequested: 0 })).toEqual({
      ok: true,
    });
  });
});

describe("paternity quota", () => {
  it("refuses an employee without the entitlement", () => {
    expect(
      checkPaternityQuota({ flags: flags(), daysUsedThisYear: 0, addingDay: true }),
    ).toEqual({ ok: false, reason: "not-entitled" });
  });

  it("allows ten days per calendar year", () => {
    const f = flags({ hasPaternity: true });
    expect(checkPaternityQuota({ flags: f, daysUsedThisYear: 9, addingDay: true })).toEqual({
      ok: true,
    });
    expect(checkPaternityQuota({ flags: f, daysUsedThisYear: 10, addingDay: true })).toEqual({
      ok: false,
      reason: "yearly-limit",
    });
  });

  it("does not charge a day that is being edited rather than added", () => {
    expect(
      checkPaternityQuota({ flags: flags(), daysUsedThisYear: 99, addingDay: false }),
    ).toEqual({ ok: true });
  });
});

describe("daysToMaterialize", () => {
  const week = defaultWeek();

  it("expands a range to the working days it touches", () => {
    // Mon 24 → Sun 30 August 2026.
    const days = eachDay(localDate(2026, 8, 24), localDate(2026, 8, 30));
    expect(daysToMaterialize({ days, week })).toEqual([
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
    ]);
  });

  it("skips public holidays inside the range", () => {
    // 25 December and Santo Stefano are holidays, the 27th is a Sunday.
    const days = eachDay(localDate(2026, 12, 24), localDate(2026, 12, 28));
    expect(daysToMaterialize({ days, week })).toEqual(["2026-12-24", "2026-12-28"]);
  });

  it("includes Saturday for someone contracted to work it", () => {
    // The old approval loop used a generic weekend test and skipped this day
    // even though the employee's own schedule said otherwise.
    const withSaturday = weekFrom([
      ...[1, 2, 3, 4, 5].map((d) => defaultDay(d as never)),
      { ...defaultDay(1), weekday: 6 } as DaySchedule,
    ]);
    const days = eachDay(localDate(2026, 8, 28), localDate(2026, 8, 29));
    expect(daysToMaterialize({ days, week: withSaturday })).toEqual(["2026-08-28", "2026-08-29"]);
  });
});
