"use client";

import { format, isSameDay, isSameMonth } from "date-fns";
import { Plus } from "lucide-react";
import { calculateHours } from "@/lib/utils/time-utils";
import {
  getBaseHoursFromScheduleMap,
  isWorkingDayFromScheduleMap,
} from "@/lib/utils/schedule-utils";
import { cn } from "@/lib/utils";
import type { TimeEntryDTO, LeaveRequestDTO, WorkingScheduleDTO } from "@/types/models";

type CalendarGridProps = {
  calendarDays: Date[];
  currentMonth: Date;
  entriesByDay: Map<string, TimeEntryDTO[]>;
  holidayMap: Map<string, { isHoliday: boolean; name: string | undefined }>;
  pendingRequests: LeaveRequestDTO[];
  approvedRequests: LeaveRequestDTO[];
  scheduleMap: Map<number, WorkingScheduleDTO>;
  isDateEditable: (date: Date) => boolean;
  onDayClick: (day: Date) => void;
  onContextMenu: (e: React.MouseEvent, dateKey: string) => void;
};

export default function CalendarGrid({
  calendarDays,
  currentMonth,
  entriesByDay,
  holidayMap,
  pendingRequests,
  approvedRequests,
  scheduleMap,
  isDateEditable,
  onDayClick,
  onContextMenu,
}: CalendarGridProps) {
  return (
    <div className="bg-card p-3 sm:p-4">
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground sm:gap-2">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
          <div key={day} className="py-1.5">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {calendarDays.map((day) => (
          <DayCell
            key={format(day, "yyyy-MM-dd")}
            day={day}
            currentMonth={currentMonth}
            entriesByDay={entriesByDay}
            holidayMap={holidayMap}
            pendingRequests={pendingRequests}
            approvedRequests={approvedRequests}
            scheduleMap={scheduleMap}
            isEditable={isDateEditable(day) && isSameMonth(day, currentMonth)}
            onDayClick={onDayClick}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
    </div>
  );
}

// ──── DayCell sub-component ────

type DayCellProps = {
  day: Date;
  currentMonth: Date;
  entriesByDay: Map<string, TimeEntryDTO[]>;
  holidayMap: Map<string, { isHoliday: boolean; name: string | undefined }>;
  pendingRequests: LeaveRequestDTO[];
  approvedRequests: LeaveRequestDTO[];
  scheduleMap: Map<number, WorkingScheduleDTO>;
  isEditable: boolean;
  onDayClick: (day: Date) => void;
  onContextMenu: (e: React.MouseEvent, dateKey: string) => void;
};

function DayCell({
  day,
  currentMonth,
  entriesByDay,
  holidayMap,
  pendingRequests,
  approvedRequests,
  scheduleMap,
  isEditable,
  onDayClick,
  onContextMenu,
}: DayCellProps) {
  const key = format(day, "yyyy-MM-dd");
  const bucket = entriesByDay.get(key);
  const dayEntry = bucket?.[0];
  const regularHours = dayEntry?.hoursWorked ?? 0;
  const overtimeHours = dayEntry?.overtimeHours ?? 0;
  const totalHours = regularHours + overtimeHours;
  const isFerie = (dayEntry?.vacationHours ?? 0) > 0;
  const isMalattia = (dayEntry?.sicknessHours ?? 0) > 0;
  const hasEntries = Boolean(dayEntry);
  const highlight = isSameDay(day, new Date());
  const dayOfWeek = day.getDay();
  const isSaturday = dayOfWeek === 6;
  const isSunday = dayOfWeek === 0;
  const holidayInfo = holidayMap.get(key);
  const isHolidayDay = holidayInfo?.isHoliday ?? false;
  const holidayName = holidayInfo?.name;

  const pendingRequest = pendingRequests.find((req) => {
    const start = new Date(req.startDate);
    const end = new Date(req.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const current = new Date(day);
    current.setHours(0, 0, 0, 0);
    return current >= start && current <= end;
  });

  const approvedRequest = approvedRequests.find((req) => {
    const start = new Date(req.startDate);
    const end = new Date(req.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const current = new Date(day);
    current.setHours(0, 0, 0, 0);
    return current >= start && current <= end && req.type === "PERMESSO";
  });

  // Calculate permesso hours
  let permessoHours = 0;
  if (hasEntries) {
    permessoHours = dayEntry?.permessoHours ?? 0;
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isWorkingDayForUser =
      isWorkingDayFromScheduleMap(scheduleMap, dayOfWeek) && !isHolidayDay;
    const baseHoursForDay = getBaseHoursFromScheduleMap(scheduleMap, dayOfWeek);
    const isPastOrYesterday = day <= yesterday;
    const isInCurrentMonth = isSameMonth(day, currentMonth);

    if (isWorkingDayForUser && isPastOrYesterday && isInCurrentMonth) {
      permessoHours = baseHoursForDay;
    }
  }

  const baseHoursForDay = getBaseHoursFromScheduleMap(scheduleMap, dayOfWeek);
  const isMissingEntry =
    permessoHours === baseHoursForDay && baseHoursForDay > 0 && !hasEntries;

  const isPermesso = (hasEntries && permessoHours > 0) || !!approvedRequest;
  const isPermesso104 = hasEntries && (dayEntry?.permesso104Hours ?? 0) > 0;
  const isPaternity = hasEntries && (dayEntry?.paternityHours ?? 0) > 0;

  let approvedHours = 0;
  if (approvedRequest && approvedRequest.startTime && approvedRequest.endTime) {
    approvedHours = calculateHours(approvedRequest.startTime, approvedRequest.endTime);
  }

  return (
    <button
      onClick={() => onDayClick(day)}
      title={holidayName || undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!isEditable) return;
        onContextMenu(e, key);
      }}
      disabled={!isEditable}
      className={cn(
        "group relative flex min-h-[68px] flex-col overflow-hidden rounded-md border p-2 text-left sm:min-h-[92px]",
        "transition-[background-color,border-color] duration-150",
        isSameMonth(day, currentMonth)
          ? isEditable
            ? "cursor-pointer border-border bg-card hover:border-muted-foreground/30 hover:bg-accent/40"
            : "cursor-not-allowed border-border/50 bg-muted/30 text-muted-foreground"
          : "border-transparent bg-transparent text-muted-foreground/25",
        // Non-working days recede into the muted surface instead of each
        // picking up their own tint. Saturday and Sunday reading as two
        // different colours told the user nothing the layout did not.
        (isSaturday || isSunday || isHolidayDay) &&
          isSameMonth(day, currentMonth) &&
          "border-border/50 bg-muted/40",
        pendingRequest && isSameMonth(day, currentMonth) && "bg-warning-subtle",
        // Today is marked with the accent border alone: an offset ring lifted
        // the cell out of the grid and broke the alignment of the whole row.
        highlight && "border-primary ring-1 ring-inset ring-primary"
      )}
    >
      <div className="mb-1 flex w-full items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              highlight
                ? "text-primary"
                : "text-muted-foreground group-hover:text-foreground"
            )}
          >
            {format(day, "d")}
          </span>
          {/* A steady dot, not a pulsing one: on a month with several gaps a
              row of blinking dots is noise rather than a signal. */}
          {isMissingEntry && (
            <span
              className="size-1.5 rounded-full bg-destructive"
              title="Mancato inserimento"
            />
          )}
        </div>
        <div className="flex gap-0.5">
          {isFerie && (
            <span className="flex h-4 items-center justify-center rounded-sm px-1 text-[10px] font-semibold leading-none bg-success-subtle text-success" title="Ferie">
              F
            </span>
          )}
          {isMalattia && (
            <span className="flex h-4 items-center justify-center rounded-sm px-1 text-[10px] font-semibold leading-none bg-destructive-subtle text-destructive" title="Malattia">
              M
            </span>
          )}
          {isPermesso && (
            <span className="flex h-4 items-center justify-center rounded-sm px-1 text-[10px] font-semibold leading-none bg-warning-subtle text-warning" title="Permesso">
              {hasEntries && permessoHours > 0
                ? permessoHours === 8
                  ? "P"
                  : `${Number(permessoHours)}h P`
                : approvedHours > 0
                  ? approvedHours === 8
                    ? "P"
                    : `${Number(approvedHours)}h P`
                  : "P"}
            </span>
          )}
          {isPermesso104 && (
            <span className="flex h-4 items-center justify-center rounded-sm px-1 text-[10px] font-semibold leading-none bg-info-subtle text-info" title="Permesso 104">
              104
            </span>
          )}
          {isPaternity && (
            <span className="flex h-4 items-center justify-center rounded-sm px-1 text-[10px] font-semibold leading-none bg-primary/10 text-primary" title="Congedo di paternità">
              PT
            </span>
          )}
        </div>
      </div>

      {hasEntries ? (
        <div className="flex w-full flex-1 flex-col justify-end gap-0.5">
          {/* Bottom-left rather than centred: the hours line up down the
              column, so a month can be scanned vertically at a glance. */}
          <div className="flex items-baseline gap-0.5">
            <span className="text-base font-semibold tabular-nums leading-none tracking-tight text-foreground sm:text-lg">
              {totalHours.toFixed(1)}
            </span>
            <span className="text-[10px] text-muted-foreground">h</span>
          </div>
          {dayEntry?.notes && (
            <p className="w-full truncate text-[10px] text-muted-foreground">
              {dayEntry.notes}
            </p>
          )}
        </div>
      ) : pendingRequest ? (
        <div className="flex flex-1 items-end">
          <span className="text-[10px] font-medium text-warning">In attesa</span>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          {isEditable ? <Plus className="size-4 text-muted-foreground" /> : null}
        </div>
      )}
    </button>
  );
}
