/**
 * Reading and writing weekly schedules, and turning stored rows into the
 * `WeekSchedule` shape the domain understands.
 */
import { and, eq } from "drizzle-orm";
import type { Weekday } from "@core/date";
import {
  ALL_WEEKDAYS,
  defaultDay,
  weekFrom,
  type DaySchedule,
  type WeekSchedule,
} from "@core/schedule";
import { toClock, type Span } from "@core/time";
import { db } from "../db/client";
import { currentOrgId } from "../db/context";
import { workSchedules, type WorkScheduleRow } from "../db/schema";

const mine = () => eq(workSchedules.organizationId, currentOrgId());

function spanOf(start: string | null, end: string | null): Span | null {
  return start && end ? { start: toClock(start), end: toClock(end) } : null;
}

export function toDaySchedule(row: WorkScheduleRow): DaySchedule {
  return {
    weekday: row.weekday as Weekday,
    isWorking: row.isWorking,
    morning: spanOf(row.morningStart, row.morningEnd),
    afternoon: spanOf(row.afternoonStart, row.afternoonEnd),
    contractHours: row.contractHours,
    manualHours: row.manualHours,
  };
}

/**
 * Missing rows fall back to a standard week rather than to zero, so a user
 * created a minute ago still has sensible contractual hours.
 */
export async function weekScheduleOf(userId: string): Promise<WeekSchedule> {
  const rows = await db
    .select()
    .from(workSchedules)
    .where(and(mine(), eq(workSchedules.userId, userId)));
  const byDay = new Map(rows.map((r) => [r.weekday, toDaySchedule(r)]));
  return weekFrom(ALL_WEEKDAYS.map((d) => byDay.get(d) ?? defaultDay(d)));
}

export async function scheduleRowsOf(userId: string): Promise<DaySchedule[]> {
  const rows = await db
    .select()
    .from(workSchedules)
    .where(and(mine(), eq(workSchedules.userId, userId)));
  const byDay = new Map(rows.map((r) => [r.weekday, toDaySchedule(r)]));
  return ALL_WEEKDAYS.map((d) => byDay.get(d) ?? defaultDay(d));
}

export function rowFor(userId: string, day: DaySchedule) {
  return {
    organizationId: currentOrgId(),
    userId,
    weekday: day.weekday,
    isWorking: day.isWorking,
    morningStart: day.morning?.start ?? null,
    morningEnd: day.morning?.end ?? null,
    afternoonStart: day.afternoon?.start ?? null,
    afternoonEnd: day.afternoon?.end ?? null,
    contractHours: day.contractHours,
    manualHours: day.manualHours,
  };
}

/** Seeds the standard Monday-to-Friday week for a newly created user. */
export async function createDefaultSchedules(userId: string): Promise<void> {
  await db
    .insert(workSchedules)
    .values(ALL_WEEKDAYS.map((d) => rowFor(userId, defaultDay(d))))
    .onConflictDoNothing();
}

export async function replaceSchedules(userId: string, days: readonly DaySchedule[]): Promise<void> {
  for (const day of days) {
    await db
      .insert(workSchedules)
      .values(rowFor(userId, day))
      .onConflictDoUpdate({
        target: [workSchedules.userId, workSchedules.weekday],
        set: rowFor(userId, day),
      });
  }
}
