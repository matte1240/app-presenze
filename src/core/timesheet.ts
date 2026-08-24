/**
 * The hour engine: given what an employee entered for one day and the schedule
 * they are on, decide how those hours are classified.
 *
 * This used to live in a React `useMemo`, with the server storing whatever
 * numbers the browser sent — so a hand-written request could book 24 regular
 * hours, and two further partial re-implementations on the server had already
 * drifted from it. There is now exactly one implementation. The API calls it to
 * decide what to store; the form calls it to preview what will be stored.
 */
import type { LocalDate } from "./date";
import { isHoliday, type HolidayConfig } from "./holidays";
import { baseHoursFor, type WeekSchedule } from "./schedule";
import { overlapHours, roundHours, spanHours, type Span } from "./time";

export type DayKind = "work" | "vacation" | "sickness" | "paternity";

export const DAY_KINDS: readonly DayKind[] = ["work", "vacation", "sickness", "paternity"];

export interface DayInput {
  readonly date: LocalDate;
  readonly kind: DayKind;
  readonly morning: Span | null;
  readonly afternoon: Span | null;
  /**
   * The whole shift was taken as leave. The old schema encoded this as the
   * literal string "PERM" inside the time columns, which then had to be
   * filtered out in four unrelated places.
   */
  readonly morningOnLeave: boolean;
  readonly afternoonOnLeave: boolean;
  /** Charge the shortfall to Law 104 leave instead of ordinary leave. */
  readonly use104: boolean;
  /** Partial 104 usage; `null` means "charge the whole shortfall". */
  readonly hours104Override: number | null;
  /** An approved hourly leave request covering this day, if any. */
  readonly approvedLeave: Span | null;
}

export interface DayBreakdown {
  readonly regular: number;
  readonly overtime: number;
  readonly leave: number;
  readonly leave104: number;
  readonly vacation: number;
  readonly sickness: number;
  readonly paternity: number;
  /** regular + overtime. Derived, but stored denormalised for reporting. */
  readonly worked: number;
}

const EMPTY: DayBreakdown = {
  regular: 0,
  overtime: 0,
  leave: 0,
  leave104: 0,
  vacation: 0,
  sickness: 0,
  paternity: 0,
  worked: 0,
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export interface ComputeOptions {
  readonly holidays?: HolidayConfig;
}

export function computeDay(
  input: DayInput,
  week: WeekSchedule,
  options: ComputeOptions = {},
): DayBreakdown {
  // Nothing is contractually owed on a public holiday, which settles both
  // halves of the question at once: work done on one is entirely overtime, and
  // a day of leave booked on one consumes no entitlement.
  const contractual = isHoliday(input.date, options.holidays)
    ? 0
    : baseHoursFor(week, input.date);

  switch (input.kind) {
    case "vacation":
      return { ...EMPTY, vacation: contractual };
    case "sickness":
      return { ...EMPTY, sickness: contractual };
    case "paternity":
      return { ...EMPTY, paternity: contractual };
    case "work":
      break;
  }

  const morningWorked = input.morningOnLeave ? 0 : spanHours(input.morning);
  const afternoonWorked = input.afternoonOnLeave ? 0 : spanHours(input.afternoon);

  // An approved hourly leave eats into the shifts actually entered, so a day
  // with a doctor's appointment in the middle is not also counted as worked.
  const overlap = roundHours(
    (input.morningOnLeave ? 0 : overlapHours(input.morning, input.approvedLeave)) +
      (input.afternoonOnLeave ? 0 : overlapHours(input.afternoon, input.approvedLeave)),
  );

  const net = roundHours(Math.max(0, morningWorked + afternoonWorked - overlap));

  // A day with no contractual hours to fill has nothing to classify as
  // ordinary, so everything present is overtime.
  if (contractual === 0) {
    return { ...EMPTY, overtime: net, worked: net };
  }

  if (net >= contractual) {
    const overtime = roundHours(net - contractual);
    return { ...EMPTY, regular: contractual, overtime, worked: roundHours(contractual + overtime) };
  }

  // Short of the contract: the gap is never simply lost, it becomes paid leave.
  const shortfall = roundHours(contractual - net);
  const leave104 = input.use104
    ? clamp(input.hours104Override ?? shortfall, 0, shortfall)
    : 0;

  return {
    ...EMPTY,
    regular: net,
    leave: roundHours(shortfall - leave104),
    leave104: roundHours(leave104),
    worked: net,
  };
}

/** Sums a set of breakdowns, for month totals and reports. */
export function sumBreakdowns(items: readonly DayBreakdown[]): DayBreakdown {
  return items.reduce<DayBreakdown>(
    (acc, b) => ({
      regular: roundHours(acc.regular + b.regular),
      overtime: roundHours(acc.overtime + b.overtime),
      leave: roundHours(acc.leave + b.leave),
      leave104: roundHours(acc.leave104 + b.leave104),
      vacation: roundHours(acc.vacation + b.vacation),
      sickness: roundHours(acc.sickness + b.sickness),
      paternity: roundHours(acc.paternity + b.paternity),
      worked: roundHours(acc.worked + b.worked),
    }),
    EMPTY,
  );
}
