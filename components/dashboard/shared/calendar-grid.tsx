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
    <div className="p-4 sm:p-6 bg-card">
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-3">
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
        "flex min-h-[80px] sm:min-h-[110px] flex-col rounded-xl border p-2 sm:p-3 text-left transition-all duration-200 relative group overflow-hidden",
        isSameMonth(day, currentMonth)
          ? isEditable
            ? "border-border bg-card hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
            : "border-border/40 bg-muted/20 text-muted-foreground cursor-not-allowed"
          : "border-transparent bg-transparent text-muted-foreground/20",
        highlight &&
          "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-xl z-10 bg-primary/5",
        (isSunday || isHolidayDay) &&
          isSameMonth(day, currentMonth) &&
          "bg-red-50/30 dark:bg-red-950/10 border-red-100/50 dark:border-red-900/20",
        isSaturday &&
          isSameMonth(day, currentMonth) &&
          "bg-blue-50/30 dark:bg-blue-950/10 border-blue-100/50 dark:border-blue-900/20",
        pendingRequest &&
          "bg-yellow-50/50 dark:bg-yellow-950/10 border-yellow-100 dark:border-yellow-900/20"
      )}
    >
      <div className="flex items-center justify-between mb-2 w-full">
        <div className="flex items-center gap-1.5">
          {isMissingEntry && (
            <div
              className="w-2 h-2 rounded-full bg-destructive animate-pulse"
              title="Mancato inserimento"
            />
          )}
          <span
            className={cn(
              "text-xs sm:text-sm font-semibold",
              highlight
                ? "text-primary"
                : "text-muted-foreground group-hover:text-foreground"
            )}
          >
            {format(day, "d")}
          </span>
        </div>
        <div className="flex gap-1">
          {isFerie && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              F
            </span>
          )}
          {isMalattia && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30 text-[10px] font-bold text-rose-600 dark:text-rose-400">
              M
            </span>
          )}
          {isPermesso && (
            <span className="flex h-5 min-w-[1.25rem] px-1 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-[10px] font-bold text-yellow-600 dark:text-yellow-400">
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
            <span className="flex h-5 min-w-[1.25rem] px-1 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 text-[10px] font-bold text-purple-600 dark:text-purple-400">
              104
            </span>
          )}
          {isPaternity && (
            <span className="flex h-5 min-w-[1.25rem] px-1 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-[10px] font-bold text-blue-600 dark:text-blue-400">
              PT
            </span>
          )}
        </div>
      </div>

      {hasEntries ? (
        <div className="flex-1 flex flex-col justify-center items-center gap-1 w-full">
          <div className="flex flex-col items-center">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-primary">
              {totalHours.toFixed(1)}
            </div>
            <div className="text-[9px] sm:text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              ore
            </div>
          </div>
          {dayEntry?.notes && (
            <div className="w-full max-w-full">
              <p className="text-[10px] text-muted-foreground truncate w-full text-center opacity-70 px-1">
                {dayEntry.notes}
              </p>
            </div>
          )}
        </div>
      ) : pendingRequest ? (
        <div className="flex-1 flex flex-col justify-center items-center">
          <span className="text-[10px] font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full border border-yellow-200 dark:border-yellow-800">
            In Attesa
          </span>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-muted-foreground/50">
            {isEditable ? <Plus className="h-5 w-5" /> : null}
          </span>
        </div>
      )}
    </button>
  );
}
