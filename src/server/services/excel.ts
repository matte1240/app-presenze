/**
 * The monthly workbook for payroll.
 *
 * One summary sheet when more than one person is exported, then a sheet per
 * person. Styling is deliberately thin — a header band, borders on the totals
 * row, and number formats — because the previous version spent roughly five
 * hundred lines on cell decoration.
 */
import ExcelJS from "exceljs";
import { eachDay, formatDateIt, monthRange, toYearMonth, weekdayOf } from "@core/date";
import { holidayName } from "@core/holidays";
import { roundHours } from "@core/time";
import { currentHolidays } from "../db/current";
import type { TimeEntryRow } from "../db/schema";

const WEEKDAY_LABELS = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"] as const;

const HOUR_COLUMNS = [
  ["regularHours", "Ordinarie"],
  ["overtimeHours", "Straordinario"],
  ["leaveHours", "Permesso"],
  ["leave104Hours", "Permesso 104"],
  ["vacationHours", "Ferie"],
  ["sicknessHours", "Malattia"],
  ["paternityHours", "Paternità"],
] as const satisfies ReadonlyArray<readonly [keyof TimeEntryRow, string]>;

export interface ExportUser {
  id: string;
  name: string;
  email: string;
}

const HEADER_FILL = "FF1F2937";
const HOLIDAY_FILL = "FFFEF3C7";

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  row.alignment = { vertical: "middle" };
  row.height = 22;
}

function shiftLabel(start: string | null, end: string | null, onLeave: boolean): string {
  if (onLeave) return "permesso";
  return start && end ? `${start} – ${end}` : "";
}

export async function buildMonthlyWorkbook(args: {
  month: string;
  users: readonly ExportUser[];
  entriesByUser: ReadonlyMap<string, readonly TimeEntryRow[]>;
  appName: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = args.appName;
  workbook.created = new Date();

  // Public holidays belong to the company, not to the deployment: a local
  // patron saint's day is a working day everywhere else.
  const holidays = currentHolidays();

  const { from, to } = monthRange(toYearMonth(args.month));

  if (args.users.length > 1) {
    const sheet = workbook.addWorksheet("Riepilogo");
    sheet.columns = [
      { header: "Dipendente", key: "name", width: 28 },
      ...HOUR_COLUMNS.map(([key, header]) => ({ header, key, width: 14 })),
      { header: "Totale lavorate", key: "worked", width: 16 },
    ];
    styleHeader(sheet.getRow(1));

    for (const user of args.users) {
      const entries = args.entriesByUser.get(user.id) ?? [];
      const totals = Object.fromEntries(
        HOUR_COLUMNS.map(([key]) => [key, roundHours(entries.reduce((s, e) => s + (e[key] as number), 0))]),
      );
      sheet.addRow({
        name: user.name || user.email,
        ...totals,
        worked: roundHours((totals.regularHours ?? 0) + (totals.overtimeHours ?? 0)),
      });
    }

    sheet.getColumn("name").alignment = { vertical: "middle" };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  const used = new Set<string>();
  for (const user of args.users) {
    // Sheet names are capped at 31 characters and cannot repeat.
    const base = (user.name || user.email).replace(/[\\/*?:[\]]/g, " ").slice(0, 28).trim();
    let title = base || "Dipendente";
    for (let n = 2; used.has(title); n++) title = `${base.slice(0, 26)} ${n}`;
    used.add(title);

    const sheet = workbook.addWorksheet(title);
    sheet.columns = [
      { header: "Data", key: "date", width: 12 },
      { header: "Giorno", key: "weekday", width: 8 },
      { header: "Mattina", key: "morning", width: 16 },
      { header: "Pomeriggio", key: "afternoon", width: 16 },
      ...HOUR_COLUMNS.map(([key, header]) => ({ header, key, width: 13 })),
      { header: "Totale", key: "worked", width: 11 },
      { header: "Note", key: "notes", width: 34 },
    ];
    styleHeader(sheet.getRow(1));

    const byDate = new Map((args.entriesByUser.get(user.id) ?? []).map((e) => [e.workDate, e]));

    // Every day of the month is listed, not only the ones with an entry: a gap
    // in the timesheet is exactly what a payroll reviewer needs to see.
    for (const date of eachDay(from, to)) {
      const entry = byDate.get(date);
      const holiday = holidayName(date, holidays);

      const row = sheet.addRow({
        date: formatDateIt(date),
        weekday: WEEKDAY_LABELS[weekdayOf(date)],
        morning: entry ? shiftLabel(entry.morningStart, entry.morningEnd, entry.morningOnLeave) : "",
        afternoon: entry ? shiftLabel(entry.afternoonStart, entry.afternoonEnd, entry.afternoonOnLeave) : "",
        ...Object.fromEntries(HOUR_COLUMNS.map(([key]) => [key, entry ? (entry[key] as number) : 0])),
        worked: entry ? roundHours(entry.regularHours + entry.overtimeHours) : 0,
        notes: holiday ?? entry?.notes ?? "",
      });

      if (holiday || weekdayOf(date) === 0) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HOLIDAY_FILL } };
      }
    }

    const firstDataRow = 2;
    const lastDataRow = sheet.rowCount;
    const totalRow = sheet.addRow({
      date: "TOTALE",
      ...Object.fromEntries(
        HOUR_COLUMNS.map(([key], i) => {
          const letter = sheet.getColumn(5 + i).letter;
          return [key, { formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})` }];
        }),
      ),
      worked: {
        formula: `SUM(${sheet.getColumn(5 + HOUR_COLUMNS.length).letter}${firstDataRow}:${sheet.getColumn(5 + HOUR_COLUMNS.length).letter}${lastDataRow})`,
      },
    });
    totalRow.font = { bold: true };
    totalRow.border = { top: { style: "thin" } };

    sheet.views = [{ state: "frozen", ySplit: 1 }];
    for (let i = 5; i <= 5 + HOUR_COLUMNS.length; i++) {
      sheet.getColumn(i).numFmt = "0.00";
      sheet.getColumn(i).alignment = { horizontal: "right" };
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
