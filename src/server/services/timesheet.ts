/**
 * Persistence for timesheet entries, plus the queries the domain rules need to
 * be answered before they can decide anything.
 */
import { randomUUID } from "node:crypto";
import { and, between, eq, gt, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { addDays, eachDay, monthRange, todayIn, toYearMonth, type LocalDate } from "@core/date";
import { daysToMaterialize, EMPLOYEE_EDIT_WINDOW_DAYS } from "@core/policy";
import type { WeekSchedule } from "@core/schedule";
import { toClock, type Span } from "@core/time";
import { computeDay, type DayBreakdown, type DayInput, type DayKind } from "@core/timesheet";
import { db } from "../db/client";
import { currentOrgId } from "../db/context";
import { currentHolidays, currentTimezone } from "../db/current";
import { leaveRequests, timeEntries, users, type TimeEntryRow } from "../db/schema";

/**
 * The civil date in the company's own timezone. A branch in Palermo and one in
 * Munich do not roll over to tomorrow at the same instant.
 */
export const today = () => todayIn(currentTimezone());

/**
 * Every query below repeats this, on top of the row-level security policy that
 * would already refuse the rows. Two locks on one door: the policy is what
 * holds if a filter is ever forgotten, and the filter is what holds on the
 * connection that the policy exempts.
 */
const mine = () => eq(timeEntries.organizationId, currentOrgId());

function spanOf(start: string | null, end: string | null): Span | null {
  return start && end ? { start: toClock(start), end: toClock(end) } : null;
}

export function toDayInput(row: TimeEntryRow, approvedLeave: Span | null = null): DayInput {
  return {
    date: row.workDate as LocalDate,
    kind: row.kind as DayKind,
    morning: spanOf(row.morningStart, row.morningEnd),
    afternoon: spanOf(row.afternoonStart, row.afternoonEnd),
    morningOnLeave: row.morningOnLeave,
    afternoonOnLeave: row.afternoonOnLeave,
    use104: row.use104,
    hours104Override: row.hours104Override,
    approvedLeave,
  };
}

/** Columns derived from a breakdown; the inputs are stored alongside them. */
export function hourColumns(b: DayBreakdown) {
  return {
    regularHours: b.regular,
    overtimeHours: b.overtime,
    leaveHours: b.leave,
    leave104Hours: b.leave104,
    vacationHours: b.vacation,
    sicknessHours: b.sickness,
    paternityHours: b.paternity,
  };
}

/** `userId: null` means "everyone" — everyone in this company, that is. */
export function entriesBetween(userId: string | null, from: LocalDate, to: LocalDate) {
  return db
    .select()
    .from(timeEntries)
    .where(
      and(
        mine(),
        between(timeEntries.workDate, from, to),
        userId ? eq(timeEntries.userId, userId) : undefined,
      ),
    )
    .orderBy(timeEntries.workDate);
}

export async function entryOn(userId: string, date: LocalDate): Promise<TimeEntryRow | undefined> {
  const [row] = await db
    .select()
    .from(timeEntries)
    .where(and(mine(), eq(timeEntries.userId, userId), eq(timeEntries.workDate, date)))
    .limit(1);
  return row;
}

/**
 * The approved hourly leave covering a day, if any. Feeding this into the
 * engine is what stops an afternoon at the doctor's from being counted twice.
 */
export async function approvedLeaveOn(userId: string, date: LocalDate): Promise<Span | null> {
  const [row] = await db
    .select()
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.organizationId, currentOrgId()),
        eq(leaveRequests.userId, userId),
        eq(leaveRequests.status, "APPROVED"),
        eq(leaveRequests.type, "PERMESSO"),
        eq(leaveRequests.startDate, date),
      ),
    )
    .limit(1);
  return row ? spanOf(row.startTime, row.endTime) : null;
}

export async function hours104InMonth(userId: string, date: LocalDate, excludeEntryId?: string) {
  const { from, to } = monthRange(toYearMonth(date.slice(0, 7)));
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${timeEntries.leave104Hours}), 0)` })
    .from(timeEntries)
    .where(
      and(
        mine(),
        eq(timeEntries.userId, userId),
        between(timeEntries.workDate, from, to),
        excludeEntryId ? sql`${timeEntries.id} <> ${excludeEntryId}` : undefined,
      ),
    );
  return rows[0]?.total ?? 0;
}

export async function paternityDaysInYear(userId: string, date: LocalDate, excludeEntryId?: string) {
  const year = date.slice(0, 4);
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(timeEntries)
    .where(
      and(
        mine(),
        eq(timeEntries.userId, userId),
        gte(timeEntries.workDate, `${year}-01-01`),
        lte(timeEntries.workDate, `${year}-12-31`),
        gt(timeEntries.paternityHours, 0),
        excludeEntryId ? sql`${timeEntries.id} <> ${excludeEntryId}` : undefined,
      ),
    );
  return rows[0]?.count ?? 0;
}

export interface SaveArgs {
  userId: string;
  actorId: string;
  input: DayInput;
  /** Computed by the caller so quotas can be checked against it first. */
  breakdown: DayBreakdown;
  notes: string | null;
  medicalCertificate: string | null;
}

/** One row per user per day: saving the same date again replaces it. */
export async function saveEntry(args: SaveArgs): Promise<{ row: TimeEntryRow; created: boolean }> {
  const { breakdown } = args;
  const existing = await entryOn(args.userId, args.input.date);

  const values = {
    organizationId: currentOrgId(),
    userId: args.userId,
    workDate: args.input.date,
    kind: args.input.kind,
    morningStart: args.input.morning?.start ?? null,
    morningEnd: args.input.morning?.end ?? null,
    afternoonStart: args.input.afternoon?.start ?? null,
    afternoonEnd: args.input.afternoon?.end ?? null,
    morningOnLeave: args.input.morningOnLeave,
    afternoonOnLeave: args.input.afternoonOnLeave,
    use104: args.input.use104,
    hours104Override: args.input.hours104Override,
    notes: args.notes,
    medicalCertificate: args.medicalCertificate,
    ...hourColumns(breakdown),
    updatedAt: new Date(),
  };

  if (existing) {
    const [row] = await db
      .update(timeEntries)
      .set(values)
      .where(and(mine(), eq(timeEntries.id, existing.id)))
      .returning();
    return { row: row!, created: false };
  }

  const [row] = await db
    .insert(timeEntries)
    .values({ id: randomUUID(), createdBy: args.actorId, ...values })
    .returning();
  return { row: row!, created: true };
}

/**
 * Replays the engine over a month, so that a corrected schedule takes effect
 * on days already entered. The stored inputs make this a recomputation rather
 * than a guess — and it is the same function the write path uses, not a second
 * implementation that can drift from it.
 */
export async function recalculateMonth(userId: string, month: string, week: WeekSchedule) {
  const { from, to } = monthRange(toYearMonth(month));
  const rows = await entriesBetween(userId, from, to);

  let changed = 0;
  for (const row of rows) {
    const leave = await approvedLeaveOn(userId, row.workDate as LocalDate);
    const breakdown = computeDay(toDayInput(row, leave), week, { holidays: currentHolidays() });
    const next = hourColumns(breakdown);

    const differs = (Object.keys(next) as Array<keyof typeof next>).some(
      (k) => Math.abs((row[k] as number) - next[k]) > 0.001,
    );
    if (!differs) continue;

    await db
      .update(timeEntries)
      .set({ ...next, updatedAt: new Date() })
      .where(and(mine(), eq(timeEntries.id, row.id)));
    changed += 1;
  }

  return { total: rows.length, changed };
}

/**
 * Days in the recent past with neither an entry nor approved leave. Split by
 * whether the employee can still fix them themselves, because a reminder that
 * only lists days they are locked out of is just noise.
 */
export async function missingDaysFor(userId: string, week: WeekSchedule, lookbackDays = 5) {
  const to = addDays(today(), -1);
  const from = addDays(to, -(lookbackDays - 1));
  const candidates = daysToMaterialize({ days: eachDay(from, to), week, holidays: currentHolidays() });
  if (candidates.length === 0) return { editable: [], requiresAdmin: [] };

  const entered = new Set(
    (await entriesBetween(userId, from, to)).map((r) => r.workDate),
  );

  const leaves = await db
    .select()
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.organizationId, currentOrgId()),
        eq(leaveRequests.userId, userId),
        eq(leaveRequests.status, "APPROVED"),
        lte(leaveRequests.startDate, to),
        gte(leaveRequests.endDate, from),
      ),
    );
  const covered = (d: LocalDate) => leaves.some((l) => l.startDate <= d && d <= l.endDate);

  const missing = candidates.filter((d) => !entered.has(d) && !covered(d));
  const cutoff = addDays(today(), -EMPLOYEE_EDIT_WINDOW_DAYS);

  return {
    editable: missing.filter((d) => d >= cutoff),
    requiresAdmin: missing.filter((d) => d < cutoff),
  };
}

/** The active employees of the organization in context — never of all of them. */
export async function employeesWithEmail() {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(
      and(
        eq(users.organizationId, currentOrgId()),
        inArray(users.role, ["EMPLOYEE"]),
        // Nobody should be nagged about a timesheet they can no longer open.
        isNull(users.deactivatedAt),
      ),
    );
}
