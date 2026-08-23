import { describe, expect, it } from "vitest";
import { clockOptions, fromMinutes, isClock, minutesOf, overlapHours, span, spanHours, toClock } from "./time";

describe("clock parsing", () => {
  it("accepts 24h times and rejects everything else", () => {
    expect(isClock("00:00")).toBe(true);
    expect(isClock("23:59")).toBe(true);
    expect(isClock("24:00")).toBe(false);
    expect(isClock("8:00")).toBe(false);
    expect(isClock("12:60")).toBe(false);
    expect(() => toClock("PERM")).toThrow(RangeError);
  });

  it("round-trips through minutes", () => {
    expect(minutesOf(toClock("08:30"))).toBe(510);
    expect(fromMinutes(510)).toBe("08:30");
    expect(fromMinutes(0)).toBe("00:00");
  });
});

describe("spanHours", () => {
  it("measures a shift", () => {
    expect(spanHours(span("08:00", "12:00"))).toBe(4);
    expect(spanHours(span("08:30", "12:00"))).toBe(3.5);
    expect(spanHours(span("09:10", "12:00"))).toBe(2.83);
  });

  it("treats a null or inverted span as empty rather than negative", () => {
    expect(spanHours(null)).toBe(0);
    expect(spanHours(span("18:00", "09:00"))).toBe(0);
  });
});

describe("overlapHours", () => {
  const morning = span("08:00", "12:00");

  it("measures the shared part", () => {
    expect(overlapHours(morning, span("10:00", "11:00"))).toBe(1);
    expect(overlapHours(morning, span("07:00", "09:30"))).toBe(1.5);
    expect(overlapHours(morning, span("11:00", "15:00"))).toBe(1);
    expect(overlapHours(morning, span("06:00", "20:00"))).toBe(4);
  });

  it("is zero when the spans only touch or miss entirely", () => {
    expect(overlapHours(morning, span("12:00", "14:00"))).toBe(0);
    expect(overlapHours(morning, span("14:00", "18:00"))).toBe(0);
    expect(overlapHours(morning, null)).toBe(0);
  });
});

describe("clockOptions", () => {
  it("produces a half-hour grid", () => {
    const opts = clockOptions("06:00", "22:00", 30);
    expect(opts[0]).toBe("06:00");
    expect(opts.at(-1)).toBe("22:00");
    expect(opts).toHaveLength(33);
  });
});
