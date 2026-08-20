"use client";

import { useRef, useState } from "react";
import { addMonths, format, getDay, isSameMonth, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { Logo } from "@/components/ui/logo";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  Clock,
  Briefcase,
  AlertCircle,
  Stethoscope,
  RefreshCw,
} from "lucide-react";
import LogoutButton from "@/components/auth/logout-button";
import StatsCard from "./stats-card";
import CalendarGrid from "./calendar-grid";
import TimeEntryModal from "./time-entry-modal";
import RequestLeaveModal from "../employee/request-leave-modal";
import { useTimesheetData } from "@/hooks/use-timesheet-data";
import type { ModalFormState } from "@/hooks/use-timesheet-data";
import type { TimeEntryDTO } from "@/types/models";
import { cn } from "@/lib/utils";
import { getBaseHoursFromScheduleMap } from "@/lib/utils/schedule-utils";

// Re-export for backward compatibility
export type { TimeEntryDTO };

type EmployeeDashboardProps = {
  initialEntries: TimeEntryDTO[];
  userName: string;
  hideHeader?: boolean;
  hideStats?: boolean;
  targetUserId?: string;
  onEntrySaved?: (updatedEntries: TimeEntryDTO[]) => void;
  isAdmin?: boolean;
  userFeatures?: {
    hasPermesso104: boolean;
    hasPaternityLeave: boolean;
  };
};

export default function TimesheetCalendar({
  initialEntries,
  userName,
  hideHeader = false,
  hideStats = false,
  targetUserId,
  onEntrySaved,
  isAdmin = false,
  userFeatures = { hasPermesso104: false, hasPaternityLeave: false },
}: EmployeeDashboardProps) {
  const data = useTimesheetData({
    initialEntries,
    targetUserId,
    isAdmin,
    onEntrySaved,
    userFeatures,
  });

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // ──── Year/month picker constants ────
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 3;
  const endYear = currentYear + 3;
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i).reverse();
  const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

  // ──── Day click handler ────

  const handleDayClick = (day: Date) => {
    if (!isSameMonth(day, data.currentMonth)) return;

    if (!data.isAdmin) {
      const dayOfWeek = day.getDay();
      const dateKey = format(day, "yyyy-MM-dd");
      const holidayInfo = data.holidayMap.get(dateKey);

      if (dayOfWeek === 0 && !data.canWorkSunday) {
        data.setError("Non è possibile inserire ore la domenica.");
        return;
      }
      if (holidayInfo?.isHoliday) {
        data.setError("Non è possibile inserire ore nei giorni festivi.");
        return;
      }
    }

    if (!data.isDateEditable(day)) {
      data.setError("È possibile inserire ore solo per oggi e i 2 giorni di calendario precedenti.");
      return;
    }

    const dateStr = format(day, "yyyy-MM-dd");
    data.setSelectedDate(dateStr);

    const existingEntry = data.entries.find((e) => e.workDate === dateStr);
    if (existingEntry) {
      let dayType: ModalFormState["dayType"] = "normal";
      let medicalCertificate = "";
      if ((existingEntry.vacationHours ?? 0) > 0) dayType = "ferie";
      else if ((existingEntry.sicknessHours ?? 0) > 0) {
        dayType = "malattia";
        medicalCertificate = existingEntry.medicalCertificate || "";
      } else if ((existingEntry.paternityHours ?? 0) > 0) dayType = "paternity";

      const isMorningPermesso = existingEntry.morningStart === "PERM";
      const isAfternoonPermesso = existingEntry.afternoonStart === "PERM";
      const isPermesso104 = (existingEntry.permesso104Hours ?? 0) > 0;

      const selectedDay = new Date(dateStr + "T00:00:00");
      const schedule = data.scheduleMap.get(selectedDay.getDay());

      data.setModalForm({
        morningStart: isMorningPermesso ? (schedule?.morningStart ?? "08:00") : (existingEntry.morningStart || "08:00"),
        morningEnd: isMorningPermesso ? (schedule?.morningEnd ?? "12:00") : (existingEntry.morningEnd || "12:00"),
        afternoonStart: isAfternoonPermesso ? (schedule?.afternoonStart ?? "14:00") : (existingEntry.afternoonStart || "14:00"),
        afternoonEnd: isAfternoonPermesso ? (schedule?.afternoonEnd ?? "18:00") : (existingEntry.afternoonEnd || "18:00"),
        notes: existingEntry.notes || "",
        dayType,
        medicalCertificate,
        isMorningPermesso,
        isAfternoonPermesso,
        isPermesso104,
        permesso104Override: isPermesso104 ? parseFloat(existingEntry.permesso104Hours?.toString() ?? "0") : null,
      });
    } else {
      const selectedDay = new Date(dateStr + "T00:00:00");
      const schedule = data.scheduleMap.get(selectedDay.getDay());

      data.setModalForm({
        morningStart: schedule ? (schedule.morningStart ?? "") : "08:00",
        morningEnd: schedule ? (schedule.morningEnd ?? "") : "12:00",
        afternoonStart: schedule ? (schedule.afternoonStart ?? "") : "14:00",
        afternoonEnd: schedule ? (schedule.afternoonEnd ?? "") : "18:00",
        notes: "",
        dayType: "normal",
        medicalCertificate: "",
        isMorningPermesso: false,
        isAfternoonPermesso: false,
        isPermesso104: false,
        permesso104Override: null,
      });
    }

    data.setModalError(null);
    data.setIsModalOpen(true);
  };

  // ──── Modal submit handler ────

  const handleModalSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    data.setModalError(null);

    if (
      data.modalForm.dayType === "normal" &&
      data.calculatedHours.totalWorked === 0 &&
      data.calculatedHours.permesso === 0 &&
      data.calculatedHours.permesso104 === 0
    ) {
      data.setModalError("Inserisci ore di lavoro o permesso valide.");
      return;
    }

    if (!data.selectedDate) return;

    // Block future times for today (employees only)
    if (!isAdmin && data.modalForm.dayType === "normal") {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      if (data.selectedDate === todayStr) {
        const now = new Date();
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
        const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        const timeFields = [
          { label: "Fine mattina", value: data.modalForm.isMorningPermesso ? null : data.modalForm.morningEnd },
          { label: "Inizio pomeriggio", value: data.modalForm.isAfternoonPermesso ? null : data.modalForm.afternoonStart },
          { label: "Fine pomeriggio", value: data.modalForm.isAfternoonPermesso ? null : data.modalForm.afternoonEnd },
          { label: "Inizio mattina", value: data.modalForm.isMorningPermesso ? null : data.modalForm.morningStart },
        ];

        for (const field of timeFields) {
          if (field.value) {
            const [h, m] = field.value.split(":").map(Number);
            if (h * 60 + m > currentTotalMinutes) {
              data.setModalError(`Non puoi inserire un orario futuro per "${field.label}" (${field.value}). Ora attuale: ${currentTimeStr}.`);
              return;
            }
          }
        }
      }
    }

    let payload: Record<string, unknown>;
    if (data.modalForm.dayType === "ferie") {
      payload = {
        workDate: data.selectedDate,
        hoursWorked: 0, overtimeHours: 0, permessoHours: 0, sicknessHours: 0,
        vacationHours: data.calculatedHours.vacation, permesso104Hours: 0, paternityHours: 0,
        notes: data.modalForm.notes.trim() || null,
        ...(targetUserId && { userId: targetUserId }),
      };
    } else if (data.modalForm.dayType === "malattia") {
      payload = {
        workDate: data.selectedDate,
        hoursWorked: 0, overtimeHours: 0, permessoHours: 0, sicknessHours: data.calculatedHours.sickness,
        vacationHours: 0, permesso104Hours: 0, paternityHours: 0,
        medicalCertificate: data.modalForm.medicalCertificate || null,
        notes: data.modalForm.notes.trim() || null,
        ...(targetUserId && { userId: targetUserId }),
      };
    } else if (data.modalForm.dayType === "paternity") {
      payload = {
        workDate: data.selectedDate,
        hoursWorked: 0, overtimeHours: 0, permessoHours: 0, sicknessHours: 0,
        vacationHours: 0, permesso104Hours: 0, paternityHours: data.calculatedHours.paternity,
        notes: data.modalForm.notes.trim() || null,
        ...(targetUserId && { userId: targetUserId }),
      };
    } else {
      payload = {
        workDate: data.selectedDate,
        hoursWorked: data.calculatedHours.regular,
        overtimeHours: data.calculatedHours.overtime,
        permessoHours: data.calculatedHours.permesso,
        sicknessHours: 0, vacationHours: 0,
        permesso104Hours: data.calculatedHours.permesso104,
        paternityHours: 0,
        morningStart: data.modalForm.isMorningPermesso ? "PERM" : data.modalForm.morningStart || undefined,
        morningEnd: data.modalForm.isMorningPermesso ? "PERM" : data.modalForm.morningEnd || undefined,
        afternoonStart: data.modalForm.isAfternoonPermesso ? "PERM" : data.modalForm.afternoonStart || undefined,
        afternoonEnd: data.modalForm.isAfternoonPermesso ? "PERM" : data.modalForm.afternoonEnd || undefined,
        notes: data.modalForm.notes.trim() || null,
        ...(targetUserId && { userId: targetUserId }),
      };
    }

    data.startSaving(async () => {
      try {
        const response = await fetch("/api/hours", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) {
          data.setModalError(result?.error ?? "Impossibile salvare l'inserimento.");
          return;
        }
        const newEntries = [...data.entries.filter((e) => e.workDate !== data.selectedDate), result as TimeEntryDTO];
        onEntrySaved?.(newEntries);
        data.setEntries(newEntries);
        data.setIsModalOpen(false);
        data.setIsRefetching(true);
      } catch {
        data.setModalError("Errore imprevisto durante il salvataggio.");
      }
    });
  };

  // ──── Delete handler ────

  const handleDelete = () => {
    if (!data.selectedDate) return;
    const entry = data.entries.find((e) => e.workDate === data.selectedDate);
    if (!entry) return;
    if (!confirm("Sei sicuro di voler eliminare questo inserimento?")) return;

    data.setModalError(null);
    data.startSaving(async () => {
      try {
        const response = await fetch(`/api/hours?id=${entry.id}`, { method: "DELETE" });
        if (!response.ok) {
          const result = await response.json();
          data.setModalError(result?.error ?? "Impossibile eliminare l'inserimento.");
          return;
        }
        data.setEntries((prev) => {
          const newEntries = prev.filter((e) => e.id !== entry.id);
          onEntrySaved?.(newEntries);
          return newEntries;
        });
        data.setIsModalOpen(false);
        data.setIsRefetching(true);
      } catch {
        data.setModalError("Errore imprevisto durante l'eliminazione.");
      }
    });
  };

  // ──── Recalculate hours for admin ────

  const handleRecalculate = async () => {
    if (!targetUserId) return;
    if (!confirm("Ricalcolare tutte le ore del mese selezionato in base all'orario ordinario del dipendente?")) return;

    setIsRecalculating(true);
    data.setError(null);
    try {
      const month = format(data.currentMonth, "yyyy-MM");
      const response = await fetch("/api/hours/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId, month }),
      });
      const result = await response.json();
      if (!response.ok) {
        data.setError(result?.error ?? "Errore durante il ricalcolo.");
        return;
      }
      data.setIsRefetching(true);
    } catch {
      data.setError("Errore imprevisto durante il ricalcolo.");
    } finally {
      setIsRecalculating(false);
    }
  };

  // ──── Context menu quick actions ────

  const handleFerie = async (date: string) => {
    data.setContextMenu(null);
    data.setError(null);
    const dayOfWeek = getDay(new Date(`${date}T12:00:00`));
    const baseHours = getBaseHoursFromScheduleMap(data.scheduleMap, dayOfWeek) || 8;
    const payload = {
      workDate: date, hoursWorked: 0, overtimeHours: 0, permessoHours: 0,
      sicknessHours: 0, vacationHours: baseHours,
      ...(targetUserId && { userId: targetUserId }),
    };
    try {
      const response = await fetch("/api/hours", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) { data.setError(result?.error ?? "Errore nel salvare le ferie."); return; }
      const newEntries = [...data.entries.filter((e) => e.workDate !== date), result as TimeEntryDTO];
      onEntrySaved?.(newEntries);
      data.setEntries(newEntries);
      data.router.refresh();
    } catch {
      data.setError("Errore imprevisto durante il salvataggio delle ferie.");
    }
  };

  const handleMalattia = async (date: string) => {
    data.setContextMenu(null);
    data.setError(null);
    const dayOfWeekM = getDay(new Date(`${date}T12:00:00`));
    const baseHoursM = getBaseHoursFromScheduleMap(data.scheduleMap, dayOfWeekM) || 8;
    const payload = {
      workDate: date, hoursWorked: 0, overtimeHours: 0, permessoHours: 0,
      sicknessHours: baseHoursM, vacationHours: 0,
      ...(targetUserId && { userId: targetUserId }),
    };
    try {
      const response = await fetch("/api/hours", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) { data.setError(result?.error ?? "Errore nel salvare la malattia."); return; }
      const newEntries = [...data.entries.filter((e) => e.workDate !== date), result as TimeEntryDTO];
      onEntrySaved?.(newEntries);
      data.setEntries(newEntries);
      data.router.refresh();
    } catch {
      data.setError("Errore imprevisto durante il salvataggio della malattia.");
    }
  };

  // ──── Render ────

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      {!hideHeader && (
        <header className="border-b border-border bg-card shadow-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
            <div className="flex items-center gap-6">
              <Logo className="h-9 w-auto" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-foreground">
                  Benvenuto, {userName.split(" ")[0] ?? userName}
                </h1>
                <p className="text-sm text-muted-foreground">Gestisci le tue ore di lavoro</p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </header>
      )}

      <div className={cn(
        "flex flex-col gap-6",
        hideHeader ? "w-full pb-8" : "mx-auto w-full max-w-7xl px-4 sm:px-6 py-8"
      )}>
        {/* Stats cards */}
        {!hideStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 order-2 sm:order-1">
            <StatsCard title="Totale Mese" value={data.totalHours.toFixed(1)} color="blue" icon={<Clock className="h-5 w-5" />} />
            {data.totalOvertime > 0 && (
              <StatsCard title="Straordinario" value={data.totalOvertime.toFixed(1)} color="orange" icon={<Briefcase className="h-5 w-5" />} />
            )}
            <StatsCard title="Ore Perm/Ferie" value={data.totalPermFerie.toFixed(1)} color="purple" icon={<CalendarIcon className="h-5 w-5" />} />
            {data.totalPermesso104 > 0 && (
              <StatsCard title="Permesso 104" value={data.totalPermesso104.toFixed(1)} color="purple" icon={<CalendarIcon className="h-5 w-5" />} />
            )}
            {data.totalSickness > 0 && (
              <StatsCard title="Malattia" value={data.totalSickness.toFixed(1)} color="red" icon={<Stethoscope className="h-5 w-5" />} />
            )}
          </div>
        )}

        {data.error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 animate-in fade-in slide-in-from-top-2 order-3 sm:order-2">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm font-medium text-destructive">{data.error}</p>
            </div>
          </div>
        )}

        {/* Calendar section */}
        <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden order-1 sm:order-3">
          {/* Calendar navigation header */}
          <div className="border-b border-border px-4 sm:px-6 py-4 bg-muted/30">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative z-20">
                <button
                  type="button"
                  onClick={() => data.setIsMonthPickerOpen(!data.isMonthPickerOpen)}
                  className="flex items-center gap-2 text-lg font-semibold text-foreground hover:text-primary transition-colors capitalize"
                >
                  <span>{format(data.currentMonth, "MMMM yyyy", { locale: it })}</span>
                  <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", data.isMonthPickerOpen && "rotate-180")} />
                </button>
                {data.isFetching && (
                  <p className="absolute -bottom-5 left-0 text-[10px] text-muted-foreground animate-pulse">Aggiornamento...</p>
                )}

                {data.isMonthPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => data.setIsMonthPickerOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-72 rounded-lg border border-border bg-popover p-4 shadow-lg animate-in fade-in zoom-in-95 duration-100 z-30">
                      <select
                        value={data.currentMonth.getFullYear()}
                        onChange={(e) => {
                          const newDate = new Date(data.currentMonth);
                          newDate.setFullYear(parseInt(e.target.value));
                          data.setCurrentMonth(newDate);
                        }}
                        className="mb-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {years.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                      <div className="grid grid-cols-3 gap-2">
                        {months.map((month, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              const newDate = new Date(data.currentMonth);
                              newDate.setMonth(idx);
                              data.setCurrentMonth(newDate);
                              data.setIsMonthPickerOpen(false);
                            }}
                            className={cn(
                              "rounded-md px-2 py-2 text-sm font-medium transition-colors",
                              idx === data.currentMonth.getMonth()
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                            )}
                          >
                            {month}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                {isAdmin && targetUserId && (
                  <button
                    type="button"
                    onClick={handleRecalculate}
                    disabled={isRecalculating}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 h-9 px-3 sm:px-4 py-2 mr-1 shadow-sm"
                    title="Ricalcola ore del mese in base all'orario ordinario"
                  >
                    <RefreshCw className={cn("h-4 w-4", isRecalculating && "animate-spin")} />
                    <span className="hidden sm:inline">{isRecalculating ? "Ricalcolo..." : "Ricalcola Ore"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 sm:px-4 py-2 mr-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                  <span className="sm:hidden">Ferie</span>
                  <span className="hidden sm:inline">Richiedi Ferie</span>
                </button>
                <div className="flex items-center gap-1 bg-card p-1 rounded-lg border border-border shadow-sm">
                  <button type="button" onClick={() => data.setCurrentMonth((m) => addMonths(m, -1))} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 text-muted-foreground">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => data.setCurrentMonth(startOfMonth(new Date()))} className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground h-8 px-3 text-foreground">
                    Oggi
                  </button>
                  <button type="button" onClick={() => data.setCurrentMonth((m) => addMonths(m, 1))} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 text-muted-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar grid */}
          <CalendarGrid
            calendarDays={data.calendarDays}
            currentMonth={data.currentMonth}
            entriesByDay={data.entriesByDay}
            holidayMap={data.holidayMap}
            pendingRequests={data.pendingRequests}
            approvedRequests={data.approvedRequests}
            scheduleMap={data.scheduleMap}
            isDateEditable={data.isDateEditable}
            onDayClick={handleDayClick}
            onContextMenu={(e, dateKey) => {
              data.setContextMenu({ x: e.clientX, y: e.clientY, date: dateKey, visible: true });
            }}
          />
        </section>
      </div>

      {/* Time Entry Modal */}
      <TimeEntryModal
        isOpen={data.isModalOpen}
        onClose={() => data.setIsModalOpen(false)}
        selectedDate={data.selectedDate}
        modalForm={data.modalForm}
        setModalForm={data.setModalForm}
        modalError={data.modalError}
        calculatedHours={data.calculatedHours}
        activePerm={data.activePerm ?? null}
        isSaving={data.isSaving}
        hasExistingEntry={Boolean(data.selectedDate && data.entries.find((e) => e.workDate === data.selectedDate))}
        onSubmit={handleModalSubmit}
        onDelete={handleDelete}
        userFeatures={userFeatures}
      />

      {/* Context Menu */}
      {data.contextMenu?.visible && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[8rem] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: data.contextMenu.x, top: data.contextMenu.y }}
          onClick={() => data.setContextMenu(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.setContextMenu(null);
              data.setSelectedDate(data.contextMenu!.date);
              handleFerie(data.contextMenu!.date);
            }}
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
          >
            Ferie
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.setContextMenu(null);
              data.setSelectedDate(data.contextMenu!.date);
              handleMalattia(data.contextMenu!.date);
            }}
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
          >
            Malattia
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.setContextMenu(null);
              const date = data.contextMenu!.date;
              const entry = data.entries.find((e) => e.workDate === date);
              if (!entry) return;
              if (!confirm("Sei sicuro di voler eliminare questo inserimento?")) return;
              fetch(`/api/hours?id=${entry.id}`, { method: "DELETE" })
                .then((response) => {
                  if (response.ok) {
                    data.setEntries((current) => current.filter((e) => e.id !== entry.id));
                    setTimeout(() => data.setIsRefetching(true), 200);
                  } else {
                    alert("Errore nell'eliminazione");
                  }
                })
                .catch(() => alert("Errore nell'eliminazione"));
            }}
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-destructive/10 hover:text-destructive text-destructive"
          >
            Elimina
          </button>
        </div>
      )}

      <RequestLeaveModal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} />
    </div>
  );
}
