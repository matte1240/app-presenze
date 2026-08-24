/**
 * Turns a month of timesheet rows into the columns the chart draws.
 *
 * Five buckets, which is the comfortable ceiling for a stacked column: past it
 * the legend stops being scannable and the palette stops being separable. Sick
 * leave and parental leave share the last slot because parental leave is capped
 * at ten days a year and is empty in almost every month — a series that is
 * always zero costs a colour and a legend row and returns nothing. The table
 * underneath keeps them apart.
 */
import { eachDay, formatDateIt, monthRange, toYearMonth, weekdayOf, type LocalDate } from "@core/date";
import { holidayName } from "@core/holidays";
import { roundHours } from "@core/time";
import type { Column, Series } from "../../ui/primitives";
import type { TimeEntry } from "../../api/timesheet";
import { t } from "../../i18n/it";

export const HOUR_SERIES: readonly Series[] = [
  { key: "regular", label: t.timesheet.regular, color: "var(--series-1)" },
  { key: "overtime", label: t.timesheet.overtime, color: "var(--series-2)" },
  { key: "leave", label: t.timesheet.leave, color: "var(--series-3)" },
  { key: "vacation", label: t.timesheet.vacation, color: "var(--series-4)" },
  { key: "sickness", label: t.reports.sicknessAndParental, color: "var(--series-5)" },
];

export type BucketKey = "regular" | "overtime" | "leave" | "vacation" | "sickness";

/**
 * A type alias rather than an interface on purpose: only aliases pick up an
 * implicit index signature, which is what lets a bucket be handed straight to
 * a chart that takes `Record<string, number>` without a cast.
 */
export type Bucket = Record<BucketKey, number>;

const EMPTY: Bucket = { regular: 0, overtime: 0, leave: 0, vacation: 0, sickness: 0 };

export function bucketsOf(entries: readonly TimeEntry[]): Bucket {
  return entries.reduce<Bucket>(
    (acc, e) => ({
      regular: acc.regular + e.regularHours,
      overtime: acc.overtime + e.overtimeHours,
      leave: acc.leave + e.leaveHours + e.leave104Hours,
      vacation: acc.vacation + e.vacationHours,
      sickness: acc.sickness + e.sicknessHours + e.paternityHours,
    }),
    EMPTY,
  );
}

export const roundBucket = (b: Bucket): Bucket => ({
  regular: roundHours(b.regular),
  overtime: roundHours(b.overtime),
  leave: roundHours(b.leave),
  vacation: roundHours(b.vacation),
  sickness: roundHours(b.sickness),
});

export function dailyColumns(month: string, entries: readonly TimeEntry[]): Column[] {
  const { from, to } = monthRange(toYearMonth(month));

  const byDate = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const bucket = byDate.get(entry.workDate);
    if (bucket) bucket.push(entry);
    else byDate.set(entry.workDate, [entry]);
  }

  return eachDay(from, to).map((date) => {
    const day = Number(date.slice(8, 10));
    const weekday = weekdayOf(date);
    const holiday = holidayName(date);

    return {
      key: date,
      // Labelling all thirty-one would collide at any realistic width; the axis
      // and the tooltip carry the days in between.
      label: day === 1 || day % 5 === 0 ? String(day) : "",
      caption: [
        `${t.weekdaysLong[weekday]} ${formatDateIt(date as LocalDate)}`,
        holiday,
      ]
        .filter(Boolean)
        .join(" · "),
      muted: weekday === 0 || weekday === 6 || holiday !== null,
      values: roundBucket(bucketsOf(byDate.get(date) ?? [])),
    };
  });
}
