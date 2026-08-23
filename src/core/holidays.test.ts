import { describe, expect, it } from "vitest";
import { localDate } from "./date";
import { easterOf, holidayName, holidaysOf, isHoliday } from "./holidays";

describe("easterOf", () => {
  // Independently published Gregorian Easter dates.
  const known: Array<[number, string]> = [
    [2020, "2020-04-12"],
    [2021, "2021-04-04"],
    [2022, "2022-04-17"],
    [2023, "2023-04-09"],
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2028, "2028-04-16"],
    [2029, "2029-04-01"],
    [2030, "2030-04-21"],
    [2031, "2031-04-13"],
    [2032, "2032-03-28"],
    [2033, "2033-04-17"],
    [2034, "2034-04-09"],
    [2035, "2035-03-25"],
    [2036, "2036-04-13"],
    [2037, "2037-04-05"],
    [2038, "2038-04-25"],
    [2039, "2039-04-10"],
  ];

  it.each(known)("computes Easter %i", (year, expected) => {
    expect(easterOf(year)).toBe(expected);
  });

  it("always lands on a Sunday", () => {
    for (let y = 1900; y <= 2100; y++) {
      expect(new Date(`${easterOf(y)}T00:00:00Z`).getUTCDay()).toBe(0);
    }
  });
});

describe("Italian holidays", () => {
  it("covers the eleven national days", () => {
    expect(holidaysOf(2026).size).toBe(12); // 10 fixed + Easter + Easter Monday
    for (const d of [
      "2026-01-01",
      "2026-01-06",
      "2026-04-25",
      "2026-05-01",
      "2026-06-02",
      "2026-08-15",
      "2026-11-01",
      "2026-12-08",
      "2026-12-25",
      "2026-12-26",
    ]) {
      expect(isHoliday(d as never)).toBe(true);
    }
  });

  it("marks Easter Monday, including when it crosses a month", () => {
    expect(holidayName(localDate(2026, 4, 6))).toBe("Lunedì dell'Angelo");
    // Easter 2024 was 31 March, so Pasquetta fell on 1 April.
    expect(holidayName(localDate(2024, 4, 1))).toBe("Lunedì dell'Angelo");
  });

  it("leaves ordinary days alone", () => {
    expect(isHoliday(localDate(2026, 8, 23))).toBe(false);
    expect(holidayName(localDate(2026, 8, 23))).toBeNull();
  });

  it("accepts a local patron saint day", () => {
    const turin = { patronDays: ["06-24"] };
    expect(isHoliday(localDate(2026, 6, 24), turin)).toBe(true);
    expect(isHoliday(localDate(2026, 6, 24))).toBe(false);
  });
});
