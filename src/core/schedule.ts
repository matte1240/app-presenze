/**
 * Contractual weekly schedules: how many hours a given user owes on a given
 * weekday, and which shifts make them up.
 */
import { weekdayOf, type LocalDate, type Weekday } from "./date";
import { roundHours, span, spanHours, type Span } from "./time";

export interface DaySchedule {
  readonly weekday: Weekday;
  readonly isWorking: boolean;
  readonly morning: Span | null;
  readonly afternoon: Span | null;
  /** Only consulted when `manualHours` is set. */
  readonly contractHours: number;
  /**
   * Decouples the hours owed from the shift times, for part-timers whose
   * contract does not equal the span they are present for.
   */
  readonly manualHours: boolean;
}

export type WeekSchedule = Readonly<Partial<Record<Weekday, DaySchedule>>>;

export const DEFAULT_MORNING: Span = span("08:00", "12:00");
export const DEFAULT_AFTERNOON: Span = span("14:00", "18:00");
export const DEFAULT_WORKING_WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5];
export const DEFAULT_DAILY_HOURS = 8;

export const ALL_WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** Hours covered by the two shifts, ignoring any manual override. */
export function shiftHours(day: Pick<DaySchedule, "morning" | "afternoon">): number {
  return roundHours(spanHours(day.morning) + spanHours(day.afternoon));
}

export function contractHoursOf(day: DaySchedule): number {
  if (!day.isWorking) return 0;
  return roundHours(day.manualHours ? day.contractHours : shiftHours(day));
}

export function defaultDay(weekday: Weekday): DaySchedule {
  const working = DEFAULT_WORKING_WEEKDAYS.includes(weekday);
  return {
    weekday,
    isWorking: working,
    morning: working ? DEFAULT_MORNING : null,
    afternoon: working ? DEFAULT_AFTERNOON : null,
    contractHours: working ? DEFAULT_DAILY_HOURS : 0,
    manualHours: false,
  };
}

export function defaultWeek(): WeekSchedule {
  return Object.fromEntries(ALL_WEEKDAYS.map((d) => [d, defaultDay(d)])) as WeekSchedule;
}

/**
 * Hours the user is contractually due on this date.
 *
 * Note what is deliberately *not* here: a hard-coded zero for Sunday. The
 * previous implementation returned 0 for Sunday whatever the schedule said,
 * so an employee cleared to work Sundays could only ever accrue overtime and
 * the schedule editor refused to save a Sunday row at all. Sunday is now just
 * a weekday whose row usually happens to be non-working.
 */
export function baseHoursFor(week: WeekSchedule, date: LocalDate): number {
  const day = week[weekdayOf(date)];
  if (!day) return contractHoursOf(defaultDay(weekdayOf(date)));
  return contractHoursOf(day);
}

export function isWorkingDate(week: WeekSchedule, date: LocalDate): boolean {
  return baseHoursFor(week, date) > 0;
}

export function weekFrom(days: readonly DaySchedule[]): WeekSchedule {
  return Object.fromEntries(days.map((d) => [d.weekday, d])) as WeekSchedule;
}
