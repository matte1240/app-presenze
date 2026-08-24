/**
 * Turns a month of raw data into ready-made cells.
 *
 * The point is that the grid component receives finished view models and makes
 * no decisions of its own. The previous calendar did the opposite: each cell
 * scanned the request arrays linearly and inferred its own state during
 * render, forty-two times per pass.
 */
import { addDays, eachDay, monthRange, toYearMonth, weekdayOf, type LocalDate } from "@core/date";
import { holidayName } from "@core/holidays";
import { canEditDate, type Role, type UserFlags } from "@core/policy";
import { baseHoursFor, type WeekSchedule } from "@core/schedule";
import { roundHours } from "@core/time";
import type { LeaveRequest } from "../../api/requests";
import type { TimeEntry } from "../../api/timesheet";

export type CellState = "empty" | "filled" | "leave" | "missing" | "closed";

export interface DayCellModel {
  date: LocalDate;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  weekday: number;
  holiday: string | null;
  contractHours: number;
  editable: boolean;
  state: CellState;
  entry: TimeEntry | undefined;
  /** Hours to display: worked on a normal day, the absence otherwise. */
  hours: number;
  pendingRequest: boolean;
  approvedLeave: LeaveRequest | undefined;
}

export interface MonthModel {
  weeks: DayCellModel[][];
  totals: {
    regular: number;
    overtime: number;
    leave: number;
    leave104: number;
    vacation: number;
    sickness: number;
    paternity: number;
  };
  missingCount: number;
}

const sum = (entries: readonly TimeEntry[], key: keyof TimeEntry) =>
  roundHours(entries.reduce((total, entry) => total + (entry[key] as number), 0));

/** Monday-first, the way an Italian calendar is read. */
const mondayOffset = (weekday: number) => (weekday + 6) % 7;

export function buildMonth(args: {
  month: string;
  entries: readonly TimeEntry[];
  requests: readonly LeaveRequest[];
  week: WeekSchedule;
  role: Role;
  flags: UserFlags;
  today: LocalDate;
}): MonthModel {
  const { from, to } = monthRange(toYearMonth(args.month));

  const entriesByDate = new Map(args.entries.map((entry) => [entry.workDate, entry]));

  // Requests are indexed once rather than searched per cell.
  const pending = new Set<string>();
  const approved = new Map<string, LeaveRequest>();
  for (const request of args.requests) {
    for (const date of eachDay(request.startDate as LocalDate, request.endDate as LocalDate)) {
      if (request.status === "PENDING") pending.add(date);
      else if (request.status === "APPROVED") approved.set(date, request);
    }
  }

  const gridStart = addDays(from, -mondayOffset(weekdayOf(from)));
  const gridEnd = addDays(to, 6 - mondayOffset(weekdayOf(to)));

  const cells = eachDay(gridStart, gridEnd).map<DayCellModel>((date) => {
    const entry = entriesByDate.get(date);
    const holiday = holidayName(date);
    const contractHours = baseHoursFor(args.week, date);
    const inMonth = date >= from && date <= to;

    const verdict = canEditDate({
      date,
      today: args.today,
      role: args.role,
      flags: args.flags,
    });

    const hours = entry
      ? entry.kind === "work"
        ? roundHours(entry.regularHours + entry.overtimeHours)
        : roundHours(entry.vacationHours + entry.sicknessHours + entry.paternityHours)
      : 0;

    let state: CellState = "empty";
    if (entry) state = entry.kind === "work" ? "filled" : "leave";
    else if (holiday || contractHours === 0) state = "closed";
    else if (date < args.today && !approved.has(date)) state = "missing";

    return {
      date,
      dayOfMonth: Number(date.slice(8, 10)),
      inMonth,
      isToday: date === args.today,
      weekday: weekdayOf(date),
      holiday,
      contractHours,
      editable: verdict.ok,
      state,
      entry,
      hours,
      pendingRequest: pending.has(date),
      approvedLeave: approved.get(date),
    };
  });

  const weeks: DayCellModel[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const inMonthEntries = args.entries.filter((e) => e.workDate >= from && e.workDate <= to);

  return {
    weeks,
    totals: {
      regular: sum(inMonthEntries, "regularHours"),
      overtime: sum(inMonthEntries, "overtimeHours"),
      leave: sum(inMonthEntries, "leaveHours"),
      leave104: sum(inMonthEntries, "leave104Hours"),
      vacation: sum(inMonthEntries, "vacationHours"),
      sickness: sum(inMonthEntries, "sicknessHours"),
      paternity: sum(inMonthEntries, "paternityHours"),
    },
    missingCount: cells.filter((c) => c.inMonth && c.state === "missing").length,
  };
}
