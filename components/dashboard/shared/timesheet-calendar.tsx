"use client";

import { useRef, useState } from "react";
import { addMonths, format, getDay, isSameMonth, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  Clock,
  Briefcase,
  Stethoscope,
  RefreshCw,
} from "lucide-react";
import StatsCard from "./stats-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
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
  const [confirmDelete, setConfirmDelete] = useState<{ id: string } | null>(null);
  const [confirmRecalculate, setConfirmRecalculate] = useState(false);
  const toast = useToast();
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
    setConfirmDelete({ id: entry.id });
  };

  const performDelete = (entryId: string) => {
    const entry = data.entries.find((e) => e.id === entryId);
    if (!entry) return;
    setConfirmDelete(null);
    data.setModalError(null);
    data.startSaving(async () => {
      try {
        const response = await fetch(`/api/hours?id=${entry.id}`, { method: "DELETE" });
        if (!response.ok) {
          const result = await response.json();
          const message = result?.error ?? "Impossibile eliminare l'inserimento.";
          data.setModalError(message);
          // The same failure has to reach the user when the delete was started
          // from the context menu, where no modal is open to show the error.
          toast({ title: message, variant: "error" });
          return;
        }
        data.setEntries((prev) => {
          const newEntries = prev.filter((e) => e.id !== entry.id);
          onEntrySaved?.(newEntries);
          return newEntries;
        });
        data.setIsModalOpen(false);
        data.setIsRefetching(true);
        toast({ title: "Inserimento eliminato", variant: "success" });
      } catch {
        data.setModalError("Errore imprevisto durante l'eliminazione.");
        toast({ title: "Errore imprevisto durante l'eliminazione", variant: "error" });
      }
    });
  };

  // ──── Recalculate hours for admin ────

  const handleRecalculate = async () => {
    if (!targetUserId) return;
    setConfirmRecalculate(false);
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
      <div className="flex w-full flex-col gap-4">
        {/* Stats cards */}
        {!hideStats && (
          <div className="order-2 grid grid-cols-2 gap-3 sm:order-1 lg:grid-cols-4">
            <StatsCard title="Totale mese" value={data.totalHours.toFixed(1)} tone="primary" icon={<Clock />} />
            {data.totalOvertime > 0 && (
              <StatsCard title="Straordinario" value={data.totalOvertime.toFixed(1)} tone="warning" icon={<Briefcase />} />
            )}
            <StatsCard title="Permessi e ferie" value={data.totalPermFerie.toFixed(1)} tone="info" icon={<CalendarIcon />} />
            {data.totalPermesso104 > 0 && (
              <StatsCard title="Permesso 104" value={data.totalPermesso104.toFixed(1)} tone="info" icon={<CalendarIcon />} />
            )}
            {data.totalSickness > 0 && (
              <StatsCard title="Malattia" value={data.totalSickness.toFixed(1)} tone="danger" icon={<Stethoscope />} />
            )}
          </div>
        )}

        {data.error && (
          <Alert variant="error" className="order-3 sm:order-2">
            {data.error}
          </Alert>
        )}

        {/* Calendar section */}
        <section className="order-1 overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1 sm:order-3">
          {/* Calendar navigation header */}
          <div className="border-b border-border px-4 py-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative z-20">
                <button
                  type="button"
                  onClick={() => data.setIsMonthPickerOpen(!data.isMonthPickerOpen)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-base font-semibold capitalize tracking-tight text-foreground transition-colors hover:bg-accent"
                >
                  <span>{format(data.currentMonth, "MMMM yyyy", { locale: it })}</span>
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-200", data.isMonthPickerOpen && "rotate-180")} />
                </button>
                {data.isFetching && (
                  <p className="absolute -bottom-4 left-1.5 animate-pulse text-[10px] text-muted-foreground">Aggiornamento…</p>
                )}

                {data.isMonthPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => data.setIsMonthPickerOpen(false)} />
                    <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-lg border border-border bg-popover p-3 shadow-elevation-3 animate-in fade-in zoom-in-95 duration-100">
                      <Select
                        aria-label="Anno"
                        value={data.currentMonth.getFullYear()}
                        onChange={(e) => {
                          const newDate = new Date(data.currentMonth);
                          newDate.setFullYear(parseInt(e.target.value));
                          data.setCurrentMonth(newDate);
                        }}
                        className="mb-3"
                      >
                        {years.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </Select>
                      <div className="grid grid-cols-3 gap-1.5">
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
                              "cursor-pointer rounded-sm px-2 py-1.5 text-[13px] font-medium capitalize transition-colors",
                              idx === data.currentMonth.getMonth()
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmRecalculate(true)}
                    loading={isRecalculating}
                    icon={<RefreshCw />}
                    title="Ricalcola ore del mese in base all'orario ordinario"
                  >
                    <span className="hidden sm:inline">
                      {isRecalculating ? "Ricalcolo…" : "Ricalcola ore"}
                    </span>
                  </Button>
                )}
                <Button size="sm" onClick={() => setIsRequestModalOpen(true)}>
                  <span className="sm:hidden">Ferie</span>
                  <span className="hidden sm:inline">Richiedi ferie</span>
                </Button>

                {/* Month stepper: one segmented control rather than three
                    free-floating buttons. */}
                <div className="flex items-center rounded-md border border-border">
                  <button
                    type="button"
                    aria-label="Mese precedente"
                    onClick={() => data.setCurrentMonth((m) => addMonths(m, -1))}
                    className="inline-flex size-8 cursor-pointer items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => data.setCurrentMonth(startOfMonth(new Date()))}
                    className="h-8 cursor-pointer border-x border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    Oggi
                  </button>
                  <button
                    type="button"
                    aria-label="Mese successivo"
                    onClick={() => data.setCurrentMonth((m) => addMonths(m, 1))}
                    className="inline-flex size-8 cursor-pointer items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ChevronRight className="size-4" />
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
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-[13px] outline-none hover:bg-accent hover:text-accent-foreground"
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
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-[13px] outline-none hover:bg-accent hover:text-accent-foreground"
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
              setConfirmDelete({ id: entry.id });
            }}
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-[13px] text-destructive outline-none hover:bg-destructive-subtle"
          >
            Elimina
          </button>
        </div>
      )}

      <RequestLeaveModal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} />

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && performDelete(confirmDelete.id)}
        title="Eliminare l'inserimento?"
        description="Le ore registrate per questa giornata vengono rimosse definitivamente."
        confirmLabel="Elimina"
        destructive
      />

      <ConfirmDialog
        open={confirmRecalculate}
        onClose={() => setConfirmRecalculate(false)}
        onConfirm={handleRecalculate}
        title="Ricalcolare le ore del mese?"
        description="Ogni giornata del mese selezionato viene ricalcolata in base all'orario ordinario del dipendente. Le ore inserite a mano saranno sovrascritte."
        confirmLabel="Ricalcola"
      />
    </div>
  );
}
