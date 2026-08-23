import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  eachDay,
  formatDateIt,
  isLocalDate,
  localDate,
  monthOf,
  monthRange,
  toLocalDate,
  toYearMonth,
  todayIn,
  weekdayOf,
} from "./date";

describe("isLocalDate", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isLocalDate("2026-08-23")).toBe(true);
    expect(isLocalDate("2024-02-29")).toBe(true); // leap year
    expect(isLocalDate("2025-02-29")).toBe(false);
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("2026-04-31")).toBe(false);
    expect(isLocalDate("23/08/2026")).toBe(false);
    expect(isLocalDate("2026-8-3")).toBe(false);
  });

  it("throws on conversion of a bad value", () => {
    expect(() => toLocalDate("nope")).toThrow(RangeError);
  });
});

describe("weekdayOf", () => {
  it("is stable regardless of the host timezone", () => {
    // The bug this replaces: a UTC-midnight Date read with local getters
    // returned the previous day for any negative offset.
    expect(weekdayOf(localDate(2026, 8, 23))).toBe(0); // Sunday
    expect(weekdayOf(localDate(2026, 8, 24))).toBe(1);
    expect(weekdayOf(localDate(2026, 8, 29))).toBe(6);
    expect(weekdayOf(localDate(2000, 1, 1))).toBe(6);
  });
});

describe("addDays", () => {
  it("crosses month, year and leap boundaries", () => {
    expect(addDays(localDate(2026, 1, 31), 1)).toBe("2026-02-01");
    expect(addDays(localDate(2026, 12, 31), 1)).toBe("2027-01-01");
    expect(addDays(localDate(2024, 2, 28), 1)).toBe("2024-02-29");
    expect(addDays(localDate(2026, 3, 1), -1)).toBe("2026-02-28");
  });

  it("survives a DST transition unchanged", () => {
    // Last Sunday of March, when Italy springs forward.
    expect(addDays(localDate(2026, 3, 28), 1)).toBe("2026-03-29");
    expect(addDays(localDate(2026, 3, 29), 1)).toBe("2026-03-30");
  });
});

describe("eachDay", () => {
  it("is inclusive at both ends", () => {
    expect(eachDay(localDate(2026, 8, 1), localDate(2026, 8, 4))).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
    ]);
  });

  it("is empty for an inverted range", () => {
    expect(eachDay(localDate(2026, 8, 4), localDate(2026, 8, 1))).toEqual([]);
  });
});

describe("months", () => {
  it("derives the month and its bounds", () => {
    expect(monthOf(localDate(2026, 8, 23))).toBe("2026-08");
    expect(monthRange(toYearMonth("2026-02"))).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange(toYearMonth("2024-02"))).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthRange(toYearMonth("2026-12"))).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(() => toYearMonth("2026-13")).toThrow(RangeError);
  });
});

describe("misc", () => {
  it("counts days between dates", () => {
    expect(daysBetween(localDate(2026, 8, 1), localDate(2026, 8, 23))).toBe(22);
    expect(daysBetween(localDate(2026, 8, 23), localDate(2026, 8, 1))).toBe(-22);
  });

  it("formats in Italian order", () => {
    expect(formatDateIt(localDate(2026, 8, 3))).toBe("03/08/2026");
  });

  it("reads today in a named zone", () => {
    expect(isLocalDate(todayIn("Europe/Rome"))).toBe(true);
  });
});
