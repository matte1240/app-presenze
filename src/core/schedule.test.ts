import { describe, expect, it } from "vitest";
import { localDate } from "./date";
import {
  baseHoursFor,
  contractHoursOf,
  defaultDay,
  defaultWeek,
  isWorkingDate,
  shiftHours,
  weekFrom,
  type DaySchedule,
} from "./schedule";
import { span } from "./time";

const day = (over: Partial<DaySchedule> & Pick<DaySchedule, "weekday">): DaySchedule => ({
  isWorking: true,
  morning: span("08:00", "12:00"),
  afternoon: span("14:00", "18:00"),
  contractHours: 8,
  manualHours: false,
  ...over,
});

describe("contract hours", () => {
  it("adds the two shifts", () => {
    expect(shiftHours(day({ weekday: 1 }))).toBe(8);
    expect(shiftHours(day({ weekday: 1, afternoon: null }))).toBe(4);
  });

  it("honours a manual override for part-timers", () => {
    expect(contractHoursOf(day({ weekday: 1, manualHours: true, contractHours: 6 }))).toBe(6);
    expect(contractHoursOf(day({ weekday: 1, manualHours: false, contractHours: 6 }))).toBe(8);
  });

  it("is zero on a non-working day whatever the times say", () => {
    expect(contractHoursOf(day({ weekday: 6, isWorking: false }))).toBe(0);
  });
});

describe("baseHoursFor", () => {
  const week = defaultWeek();

  it("uses the weekday row", () => {
    expect(baseHoursFor(week, localDate(2026, 8, 24))).toBe(8); // Monday
    expect(baseHoursFor(week, localDate(2026, 8, 29))).toBe(0); // Saturday
    expect(baseHoursFor(week, localDate(2026, 8, 23))).toBe(0); // Sunday
  });

  it("falls back to a standard week when a row is missing", () => {
    expect(baseHoursFor({}, localDate(2026, 8, 24))).toBe(8);
    expect(baseHoursFor({}, localDate(2026, 8, 23))).toBe(0);
  });

  it("gives Sunday real contractual hours when the schedule says so", () => {
    // The old engine hard-coded Sunday to zero, so an employee cleared for
    // Sunday work could only ever accrue overtime.
    const sundayWorker = weekFrom([
      day({ weekday: 0 }),
      ...[1, 2, 3, 4, 5].map((d) => defaultDay(d as never)),
    ]);
    expect(baseHoursFor(sundayWorker, localDate(2026, 8, 23))).toBe(8);
    expect(isWorkingDate(sundayWorker, localDate(2026, 8, 23))).toBe(true);
  });

  it("supports a Saturday-working contract", () => {
    const week6 = weekFrom([day({ weekday: 6, manualHours: true, contractHours: 4, afternoon: null })]);
    expect(baseHoursFor(week6, localDate(2026, 8, 29))).toBe(4);
  });
});
