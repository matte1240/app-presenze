import { describe, expect, it } from "vitest";
import { localDate, type LocalDate } from "./date";
import { defaultDay, defaultWeek, weekFrom, type DaySchedule, type WeekSchedule } from "./schedule";
import { span } from "./time";
import { computeDay, sumBreakdowns, type DayInput } from "./timesheet";

const MONDAY = localDate(2026, 8, 24);
const SATURDAY = localDate(2026, 8, 29);
const SUNDAY = localDate(2026, 8, 23);
const LIBERATION_DAY = localDate(2026, 4, 25); // a Saturday in 2026
const CHRISTMAS = localDate(2026, 12, 25); // a Friday in 2026

const week = defaultWeek();

const input = (over: Partial<DayInput> = {}): DayInput => ({
  date: MONDAY,
  kind: "work",
  morning: span("08:00", "12:00"),
  afternoon: span("14:00", "18:00"),
  morningOnLeave: false,
  afternoonOnLeave: false,
  use104: false,
  hours104Override: null,
  approvedLeave: null,
  ...over,
});

describe("a normal working day", () => {
  it("books a full contract as ordinary hours", () => {
    expect(computeDay(input(), week)).toMatchObject({
      regular: 8,
      overtime: 0,
      leave: 0,
      worked: 8,
    });
  });

  it("charges the shortfall to leave rather than losing it", () => {
    const r = computeDay(input({ afternoon: span("14:00", "17:00") }), week);
    expect(r).toMatchObject({ regular: 7, overtime: 0, leave: 1, leave104: 0, worked: 7 });
  });

  it("counts anything above the contract as overtime", () => {
    const r = computeDay(input({ afternoon: span("14:00", "19:30") }), week);
    expect(r).toMatchObject({ regular: 8, overtime: 1.5, leave: 0, worked: 9.5 });
  });

  it("treats an empty working day as entirely leave", () => {
    const r = computeDay(input({ morning: null, afternoon: null }), week);
    expect(r).toMatchObject({ regular: 0, overtime: 0, leave: 8, worked: 0 });
  });

  it("handles half hours without float dust", () => {
    const r = computeDay(
      input({ morning: span("08:30", "12:00"), afternoon: span("14:00", "18:00") }),
      week,
    );
    expect(r.regular).toBe(7.5);
    expect(r.leave).toBe(0.5);
  });
});

describe("a shift taken entirely as leave", () => {
  it("zeroes that shift and charges the gap", () => {
    const r = computeDay(input({ morningOnLeave: true }), week);
    expect(r).toMatchObject({ regular: 4, leave: 4, worked: 4 });
  });

  it("can apply to both shifts", () => {
    const r = computeDay(input({ morningOnLeave: true, afternoonOnLeave: true }), week);
    expect(r).toMatchObject({ regular: 0, leave: 8, worked: 0 });
  });
});

describe("an approved hourly leave request", () => {
  it("is subtracted from the shifts actually worked", () => {
    const r = computeDay(input({ approvedLeave: span("10:00", "12:00") }), week);
    expect(r).toMatchObject({ regular: 6, leave: 2, worked: 6 });
  });

  it("spans both shifts", () => {
    const r = computeDay(input({ approvedLeave: span("11:00", "15:00") }), week);
    expect(r).toMatchObject({ regular: 6, leave: 2, worked: 6 });
  });

  it("is not double-counted against a shift already marked as leave", () => {
    const r = computeDay(
      input({ morningOnLeave: true, approvedLeave: span("08:00", "12:00") }),
      week,
    );
    expect(r).toMatchObject({ regular: 4, leave: 4, worked: 4 });
  });

  it("is ignored when it falls outside the entered shifts", () => {
    const r = computeDay(input({ approvedLeave: span("18:00", "20:00") }), week);
    expect(r).toMatchObject({ regular: 8, leave: 0 });
  });
});

describe("Law 104", () => {
  const short = { afternoon: span("14:00", "16:00") }; // 6 worked, shortfall 2

  it("charges the whole shortfall when no override is given", () => {
    const r = computeDay(input({ ...short, use104: true }), week);
    expect(r).toMatchObject({ regular: 6, leave104: 2, leave: 0 });
  });

  it("splits the shortfall when an override is given", () => {
    const r = computeDay(input({ ...short, use104: true, hours104Override: 1.5 }), week);
    expect(r).toMatchObject({ regular: 6, leave104: 1.5, leave: 0.5 });
  });

  it("clamps an override above the shortfall", () => {
    const r = computeDay(input({ ...short, use104: true, hours104Override: 99 }), week);
    expect(r).toMatchObject({ leave104: 2, leave: 0 });
  });

  it("clamps a negative override", () => {
    const r = computeDay(input({ ...short, use104: true, hours104Override: -5 }), week);
    expect(r).toMatchObject({ leave104: 0, leave: 2 });
  });

  it("ignores the override when 104 is not selected", () => {
    const r = computeDay(input({ ...short, use104: false, hours104Override: 2 }), week);
    expect(r).toMatchObject({ leave104: 0, leave: 2 });
  });
});

describe("days with no contractual hours", () => {
  it("makes Sunday work entirely overtime for a Monday-to-Friday contract", () => {
    const r = computeDay(input({ date: SUNDAY }), week);
    expect(r).toMatchObject({ regular: 0, overtime: 8, leave: 0, worked: 8 });
  });

  it("makes Saturday work entirely overtime", () => {
    expect(computeDay(input({ date: SATURDAY }), week)).toMatchObject({ regular: 0, overtime: 8 });
  });

  it("gives a Sunday-contracted employee ordinary hours on a Sunday", () => {
    // The regression this guards: the old engine hard-coded Sunday to zero
    // base hours, so this employee's whole Sunday was overtime.
    const sundayWorker: WeekSchedule = weekFrom([
      { ...(defaultDay(1) as DaySchedule), weekday: 0 },
      ...[1, 2, 3, 4, 5].map((d) => defaultDay(d as never)),
    ]);
    const r = computeDay(input({ date: SUNDAY }), sundayWorker);
    expect(r).toMatchObject({ regular: 8, overtime: 0 });
  });
});

describe("public holidays", () => {
  it("make all work overtime even on a contracted weekday", () => {
    const r = computeDay(input({ date: CHRISTMAS }), week);
    expect(r).toMatchObject({ regular: 0, overtime: 8, leave: 0 });
  });

  it("do not charge a shortfall as leave", () => {
    const r = computeDay(input({ date: CHRISTMAS, afternoon: null }), week);
    expect(r).toMatchObject({ regular: 0, overtime: 4, leave: 0 });
  });

  it("consume no entitlement when booked as holiday leave", () => {
    expect(computeDay(input({ date: CHRISTMAS, kind: "vacation" }), week).vacation).toBe(0);
    expect(computeDay(input({ date: LIBERATION_DAY, kind: "sickness" }), week).sickness).toBe(0);
  });
});

describe("full-day absences", () => {
  it("are worth exactly one contracted day", () => {
    expect(computeDay(input({ kind: "vacation" }), week)).toMatchObject({ vacation: 8, worked: 0 });
    expect(computeDay(input({ kind: "sickness" }), week)).toMatchObject({ sickness: 8 });
    expect(computeDay(input({ kind: "paternity" }), week)).toMatchObject({ paternity: 8 });
  });

  it("follow a part-time contract", () => {
    const partTime = weekFrom([
      { ...defaultDay(1), manualHours: true, contractHours: 4, afternoon: null },
    ]);
    expect(computeDay(input({ kind: "vacation" }), partTime).vacation).toBe(4);
  });

  it("consume nothing on a non-working day", () => {
    expect(computeDay(input({ date: SATURDAY, kind: "vacation" }), week).vacation).toBe(0);
  });

  it("ignore any shift times that were entered", () => {
    const r = computeDay(input({ kind: "vacation", morning: span("08:00", "12:00") }), week);
    expect(r).toMatchObject({ vacation: 8, regular: 0, worked: 0 });
  });
});

describe("sumBreakdowns", () => {
  it("adds a month without accumulating float error", () => {
    const days: LocalDate[] = [MONDAY, localDate(2026, 8, 25), localDate(2026, 8, 26)];
    const total = sumBreakdowns(
      days.map((date) => computeDay(input({ date, afternoon: span("14:00", "17:30") }), week)),
    );
    expect(total).toMatchObject({ regular: 22.5, leave: 1.5, worked: 22.5 });
  });

  it("is empty for no days", () => {
    expect(sumBreakdowns([])).toMatchObject({ regular: 0, worked: 0 });
  });
});
