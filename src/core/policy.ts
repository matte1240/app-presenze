/**
 * Who may change what, and how much of each kind of leave they may take.
 *
 * These rules used to be scattered: the edit window was re-implemented in four
 * places, and the Law 104 / paternity entitlements were enforced only by
 * hiding a checkbox, so a direct API call bypassed them entirely. They live
 * here, and the server calls them on every write.
 */
import { addDays, compareDates, weekdayOf, type LocalDate } from "./date";
import { isHoliday, type HolidayConfig } from "./holidays";
import { baseHoursFor, type WeekSchedule } from "./schedule";
import { minutesOf, type Clock } from "./time";
import type { DayKind } from "./timesheet";

export type Role = "ADMIN" | "EMPLOYEE";

export interface UserFlags {
  readonly canWorkSunday: boolean;
  readonly has104: boolean;
  readonly hasPaternity: boolean;
}

/** Today plus the two days before it. */
export const EMPLOYEE_EDIT_WINDOW_DAYS = 2;
export const QUOTA_104_MONTHLY_HOURS = 24;
export const QUOTA_PATERNITY_DAYS = 10;

export type EditDenial = "holiday" | "sunday" | "future" | "too-old";

export type Verdict<R extends string> = { ok: true } | { ok: false; reason: R };

const deny = <R extends string>(reason: R): Verdict<R> => ({ ok: false, reason });
const allow = { ok: true } as const;

export interface EditCheck {
  readonly date: LocalDate;
  readonly today: LocalDate;
  readonly role: Role;
  readonly flags: UserFlags;
  readonly holidays?: HolidayConfig;
}

export function canEditDate({ date, today, role, flags, holidays }: EditCheck): Verdict<EditDenial> {
  // Admins correct the record, including for closed days — that is the point
  // of having them.
  if (role === "ADMIN") return allow;

  if (isHoliday(date, holidays)) return deny("holiday");
  if (weekdayOf(date) === 0 && !flags.canWorkSunday) return deny("sunday");
  if (compareDates(date, today) > 0) return deny("future");
  if (compareDates(date, addDays(today, -EMPLOYEE_EDIT_WINDOW_DAYS)) < 0) return deny("too-old");

  return allow;
}

/** An employee cannot book hours they have not worked yet. */
export function isFutureTime(args: {
  date: LocalDate;
  time: Clock;
  today: LocalDate;
  nowMinutes: number;
}): boolean {
  if (compareDates(args.date, args.today) !== 0) return false;
  return minutesOf(args.time) > args.nowMinutes;
}

export type QuotaDenial = "not-entitled" | "monthly-limit" | "yearly-limit";

export function check104Quota(args: {
  flags: UserFlags;
  hoursUsedThisMonth: number;
  hoursRequested: number;
}): Verdict<QuotaDenial> {
  if (args.hoursRequested <= 0) return allow;
  if (!args.flags.has104) return deny("not-entitled");
  if (args.hoursUsedThisMonth + args.hoursRequested > QUOTA_104_MONTHLY_HOURS) {
    return deny("monthly-limit");
  }
  return allow;
}

/**
 * Counted per calendar year. The previous version counted rows across all
 * time, so the entitlement was spent once and never came back.
 */
export function checkPaternityQuota(args: {
  flags: UserFlags;
  daysUsedThisYear: number;
  addingDay: boolean;
}): Verdict<QuotaDenial> {
  if (!args.addingDay) return allow;
  if (!args.flags.hasPaternity) return deny("not-entitled");
  if (args.daysUsedThisYear >= QUOTA_PATERNITY_DAYS) return deny("yearly-limit");
  return allow;
}

export function isEntitledTo(kind: DayKind, flags: UserFlags): boolean {
  return kind === "paternity" ? flags.hasPaternity : true;
}

/**
 * Which days an approved leave request actually turns into timesheet rows.
 *
 * Driven by the employee's own schedule rather than by a generic "is it a
 * weekend" test: someone contracted to work Saturdays should get a Saturday of
 * approved holiday materialised like any other day.
 */
export function daysToMaterialize(args: {
  days: readonly LocalDate[];
  week: WeekSchedule;
  holidays?: HolidayConfig;
}): LocalDate[] {
  return args.days.filter(
    (d) => !isHoliday(d, args.holidays) && baseHoursFor(args.week, d) > 0,
  );
}
