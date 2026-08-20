"use client";

import { useState, useEffect, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkingScheduleDTO, DAY_NAMES } from "@/types/models";
import { cn } from "@/lib/utils";
import { TIME_OPTIONS } from "@/lib/utils/time-utils";
import { calculateTotalHoursFromShifts } from "@/lib/utils/schedule-utils";

type ScheduleEntry = {
  dayOfWeek: number;
  morningStart: string | null;
  morningEnd: string | null;
  afternoonStart: string | null;
  afternoonEnd: string | null;
  isWorkingDay: boolean;
  totalHours: number;
  useManualHours: boolean;
};

type UserScheduleEditorProps = {
  userId: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
};

// Default schedule for each day (Mon-Fri 8-12, 14-18)
const DEFAULT_SCHEDULES: ScheduleEntry[] = [
  { dayOfWeek: 0, morningStart: null, morningEnd: null, afternoonStart: null, afternoonEnd: null, isWorkingDay: false, totalHours: 0, useManualHours: false }, // Sunday - always off
  { dayOfWeek: 1, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "18:00", isWorkingDay: true, totalHours: 8, useManualHours: false },
  { dayOfWeek: 2, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "18:00", isWorkingDay: true, totalHours: 8, useManualHours: false },
  { dayOfWeek: 3, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "18:00", isWorkingDay: true, totalHours: 8, useManualHours: false },
  { dayOfWeek: 4, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "18:00", isWorkingDay: true, totalHours: 8, useManualHours: false },
  { dayOfWeek: 5, morningStart: "08:00", morningEnd: "12:00", afternoonStart: "14:00", afternoonEnd: "18:00", isWorkingDay: true, totalHours: 8, useManualHours: false },
  { dayOfWeek: 6, morningStart: null, morningEnd: null, afternoonStart: null, afternoonEnd: null, isWorkingDay: false, totalHours: 0, useManualHours: false }, // Saturday - configurable
];

export default function UserScheduleEditor({
  userId,
  userName,
  isOpen,
  onClose,
}: UserScheduleEditorProps) {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>(DEFAULT_SCHEDULES);
  const [canWorkSunday, setCanWorkSunday] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch existing schedules on mount
  useEffect(() => {
    if (!isOpen) return;

    async function fetchSchedules() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/users/${userId}/schedule`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Impossibile caricare gli orari");
          return;
        }

        // Get canWorkSunday flag
        const responseData = data.data || data;
        setCanWorkSunday(responseData.canWorkSunday ?? false);

        // Merge fetched schedules with defaults (to ensure all 7 days are present)
        const fetchedSchedules: WorkingScheduleDTO[] = responseData.schedules || responseData;
        const mergedSchedules = DEFAULT_SCHEDULES.map((defaultEntry) => {
          const fetched = Array.isArray(fetchedSchedules) ? fetchedSchedules.find(
            (s) => s.dayOfWeek === defaultEntry.dayOfWeek
          ) : undefined;
          if (fetched) {
            return {
              dayOfWeek: fetched.dayOfWeek,
              morningStart: fetched.morningStart,
              morningEnd: fetched.morningEnd,
              afternoonStart: fetched.afternoonStart,
              afternoonEnd: fetched.afternoonEnd,
              isWorkingDay: fetched.isWorkingDay,
              totalHours: fetched.totalHours,
              useManualHours: fetched.useManualHours ?? false,
            };
          }
          return defaultEntry;
        });

        setSchedules(mergedSchedules);
      } catch (err) {
        console.error(err);
        setError("Errore durante il caricamento degli orari");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSchedules();
  }, [userId, isOpen]);

  // Update a schedule entry
  const updateSchedule = (
    dayOfWeek: number,
    field: keyof ScheduleEntry,
    value: string | boolean | number | null
  ) => {
    setSchedules((prev) =>
      prev.map((entry) => {
        if (entry.dayOfWeek !== dayOfWeek) return entry;

        const updated = { ...entry, [field]: value };

        // If toggling isWorkingDay off, clear times
        if (field === "isWorkingDay" && value === false) {
          updated.morningStart = null;
          updated.morningEnd = null;
          updated.afternoonStart = null;
          updated.afternoonEnd = null;
          updated.totalHours = 0;
          updated.useManualHours = false;
        } else if (field === "useManualHours") {
          // When toggling useManualHours, recalculate if turning it off
          if (value === false) {
            updated.totalHours = calculateTotalHoursFromShifts(
              updated.morningStart,
              updated.morningEnd,
              updated.afternoonStart,
              updated.afternoonEnd
            );
          }
          // If turning it on, keep current totalHours as manual value
        } else if (field !== "totalHours" && !updated.useManualHours) {
          // Auto-recalculate totalHours only if useManualHours is false (using updated state)
          updated.totalHours = calculateTotalHoursFromShifts(
            updated.morningStart,
            updated.morningEnd,
            updated.afternoonStart,
            updated.afternoonEnd
          );
        }

        return updated;
      })
    );
  };

  // Save schedules
  const handleSave = () => {
    setError(null);
    setSuccess(null);

    startSaving(async () => {
      try {
        // Only send non-Sunday schedules (Sunday is always off unless canWorkSunday)
        const schedulesToSave = schedules
          .filter((s) => s.dayOfWeek !== 0)
          .map((s) => ({
            dayOfWeek: s.dayOfWeek,
            morningStart: s.isWorkingDay ? s.morningStart : null,
            morningEnd: s.isWorkingDay ? s.morningEnd : null,
            afternoonStart: s.isWorkingDay ? s.afternoonStart : null,
            afternoonEnd: s.isWorkingDay ? s.afternoonEnd : null,
            totalHours: s.totalHours,
            useManualHours: s.useManualHours,
            isWorkingDay: s.isWorkingDay,
          }));

        const response = await fetch(`/api/users/${userId}/schedule`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schedules: schedulesToSave,
            canWorkSunday,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Impossibile salvare gli orari");
          return;
        }

        setSuccess("Orari salvati con successo!");
        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (err) {
        console.error(err);
        setError("Errore durante il salvataggio");
      }
    });
  };

  const weeklyTotal = schedules.reduce((sum, s) => sum + s.totalHours, 0);

  const timeSelect = (
    entry: (typeof schedules)[number],
    field: "morningStart" | "morningEnd" | "afternoonStart" | "afternoonEnd",
    label: string
  ) => (
    <Field label={label}>
      {(fieldProps) => (
        <Select
          {...fieldProps}
          value={entry[field] || ""}
          onChange={(e) =>
            updateSchedule(entry.dayOfWeek, field, e.target.value || null)
          }
          className="h-8 text-[13px]"
        >
          <option value="">—</option>
          {TIME_OPTIONS.map((t) => (
            <option key={`${field}-${t}`} value={t}>
              {t}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      size="lg"
      title="Orari settimanali"
      description={userName}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Annulla
          </Button>
          <Button onClick={handleSave} loading={isSaving} disabled={isLoading}>
            {isSaving ? "Salvataggio…" : "Salva orari"}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <Alert variant="info">
            Imposta l&apos;orario base di ogni giorno. Le ore lavorate oltre questo
            orario vengono conteggiate come straordinario.
          </Alert>

          <label
            htmlFor="canWorkSunday"
            className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-3 transition-colors hover:bg-accent/40"
          >
            <input
              type="checkbox"
              id="canWorkSunday"
              checked={canWorkSunday}
              onChange={(e) => setCanWorkSunday(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))]"
            />
            <span>
              <span className="block text-[13px] font-medium text-foreground">
                Consenti lavoro domenicale
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                Il dipendente può inserire ore di domenica; sono tutte
                straordinario.
              </span>
            </span>
          </label>

          <div className="space-y-2">
            {schedules.map((entry) => {
              const isSunday = entry.dayOfWeek === 0;
              const active = !isSunday && entry.isWorkingDay;

              return (
                <div
                  key={entry.dayOfWeek}
                  className={cn(
                    "rounded-md border p-3 transition-colors",
                    // Non-working days recede rather than each taking a hue:
                    // Sunday used to be red and Saturday blue, which said
                    // nothing that "closed" does not already say.
                    active ? "border-border" : "border-border/60 bg-muted/40"
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="flex min-w-[9rem] items-center gap-2">
                      {!isSunday && (
                        <input
                          type="checkbox"
                          checked={entry.isWorkingDay}
                          onChange={(e) =>
                            updateSchedule(
                              entry.dayOfWeek,
                              "isWorkingDay",
                              e.target.checked
                            )
                          }
                          className="size-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))]"
                        />
                      )}
                      <span
                        className={cn(
                          "text-[13px] font-medium",
                          active ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {DAY_NAMES[entry.dayOfWeek]}
                      </span>
                      {isSunday && (
                        <span className="text-xs text-muted-foreground/70">
                          chiuso
                        </span>
                      )}
                    </div>

                    {active && (
                      <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                        {timeSelect(entry, "morningStart", "Mattina da")}
                        {timeSelect(entry, "morningEnd", "a")}
                        {timeSelect(entry, "afternoonStart", "Pomeriggio da")}
                        {timeSelect(entry, "afternoonEnd", "a")}
                      </div>
                    )}

                    <div className="min-w-[8.5rem] sm:text-right">
                      {active ? (
                        <div className="space-y-1">
                          <label className="flex cursor-pointer items-center gap-1.5 sm:justify-end">
                            <input
                              type="checkbox"
                              checked={entry.useManualHours}
                              onChange={(e) =>
                                updateSchedule(
                                  entry.dayOfWeek,
                                  "useManualHours",
                                  e.target.checked
                                )
                              }
                              className="size-3.5 cursor-pointer accent-[hsl(var(--primary))]"
                            />
                            <span className="text-xs text-muted-foreground">
                              Ore base manuali
                            </span>
                          </label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            aria-label={`Ore base ${DAY_NAMES[entry.dayOfWeek]}`}
                            value={entry.totalHours}
                            readOnly={!entry.useManualHours}
                            onChange={(e) => {
                              if (!entry.useManualHours) return;
                              const value = parseFloat(e.target.value) || 0;
                              updateSchedule(
                                entry.dayOfWeek,
                                "totalHours",
                                Math.max(0, Math.min(24, value))
                              );
                            }}
                            className={cn(
                              "h-8 w-20 text-center text-[13px] font-medium sm:ml-auto",
                              !entry.useManualHours &&
                                "cursor-not-allowed bg-muted/60 text-muted-foreground"
                            )}
                          />
                        </div>
                      ) : !isSunday ? (
                        <span className="text-xs text-muted-foreground">
                          Solo straordinario
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
            <span className="text-[13px] font-medium text-foreground">
              Totale settimanale
            </span>
            <span className="text-base font-semibold tabular-nums tracking-tight text-foreground">
              {weeklyTotal.toFixed(1)}h
            </span>
          </div>

          {error && <Alert variant="error">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}
        </div>
      )}
    </Dialog>
  );
}
