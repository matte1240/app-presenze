"use client";

import { useState, useEffect, useTransition } from "react";
import { X, Calendar, Clock, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-card border border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-primary px-6 py-4 rounded-t-xl flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary-foreground" />
              <div>
                <h2 className="text-lg font-semibold text-primary-foreground">
                  Orari Settimanali
                </h2>
                <p className="text-sm text-primary-foreground/80">{userName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-primary-foreground/80 transition hover:bg-primary-foreground/20 hover:text-primary-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Info */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                    Configura Orari Base
                  </p>
                  <p className="text-blue-800 dark:text-blue-400">
                    Imposta gli orari lavorativi base per ogni giorno. Le ore lavorate oltre
                    questi orari verranno conteggiate come straordinario.
                  </p>
                </div>
              </div>

              {/* Sunday Work Toggle */}
              <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="canWorkSunday"
                    checked={canWorkSunday}
                    onChange={(e) => setCanWorkSunday(e.target.checked)}
                    className="w-4 h-4 text-amber-600 border-input rounded focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="canWorkSunday" className="cursor-pointer">
                    <span className="font-semibold text-amber-900 dark:text-amber-300">
                      Abilita Lavoro Domenicale
                    </span>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Permette al dipendente di inserire ore la domenica (tutte le ore saranno straordinario)
                    </p>
                  </label>
                </div>
              </div>

              {/* Schedule Grid */}
              <div className="space-y-3">
                {schedules.map((entry) => {
                  const isSunday = entry.dayOfWeek === 0;
                  const isSaturday = entry.dayOfWeek === 6;

                  return (
                    <div
                      key={entry.dayOfWeek}
                      className={cn(
                        "rounded-lg border p-4 transition-all",
                        isSunday
                          ? "bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800/50"
                          : isSaturday
                          ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800/50"
                          : entry.isWorkingDay
                          ? "bg-card border-border"
                          : "bg-muted/50 border-border"
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        {/* Day Name and Toggle */}
                        <div className="flex items-center gap-3 min-w-[160px]">
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
                              className="w-4 h-4 text-primary border-input rounded focus:ring-2 focus:ring-primary cursor-pointer"
                            />
                          )}
                          <span
                            className={cn(
                              "font-semibold",
                              isSunday
                                ? "text-red-600 dark:text-red-400"
                                : isSaturday
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-foreground"
                            )}
                          >
                            {DAY_NAMES[entry.dayOfWeek]}
                          </span>
                          {isSunday && (
                            <span className="text-xs text-red-500 dark:text-red-400">
                              (sempre chiuso)
                            </span>
                          )}
                        </div>

                        {/* Time Inputs */}
                        {!isSunday && entry.isWorkingDay && (
                          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {/* Morning */}
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">
                                Mattina Inizio
                              </label>
                              <select
                                value={entry.morningStart || ""}
                                onChange={(e) =>
                                  updateSchedule(
                                    entry.dayOfWeek,
                                    "morningStart",
                                    e.target.value || null
                                  )
                                }
                                className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20"
                              >
                                <option value="">--</option>
                                {TIME_OPTIONS.map((t) => (
                                  <option key={`ms-${t}`} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">
                                Mattina Fine
                              </label>
                              <select
                                value={entry.morningEnd || ""}
                                onChange={(e) =>
                                  updateSchedule(
                                    entry.dayOfWeek,
                                    "morningEnd",
                                    e.target.value || null
                                  )
                                }
                                className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20"
                              >
                                <option value="">--</option>
                                {TIME_OPTIONS.map((t) => (
                                  <option key={`me-${t}`} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Afternoon */}
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">
                                Pomeriggio Inizio
                              </label>
                              <select
                                value={entry.afternoonStart || ""}
                                onChange={(e) =>
                                  updateSchedule(
                                    entry.dayOfWeek,
                                    "afternoonStart",
                                    e.target.value || null
                                  )
                                }
                                className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20"
                              >
                                <option value="">--</option>
                                {TIME_OPTIONS.map((t) => (
                                  <option key={`as-${t}`} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">
                                Pomeriggio Fine
                              </label>
                              <select
                                value={entry.afternoonEnd || ""}
                                onChange={(e) =>
                                  updateSchedule(
                                    entry.dayOfWeek,
                                    "afternoonEnd",
                                    e.target.value || null
                                  )
                                }
                                className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20"
                              >
                                <option value="">--</option>
                                {TIME_OPTIONS.map((t) => (
                                  <option key={`ae-${t}`} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Total Hours - Editable with flag */}
                        <div className="min-w-[140px] text-right">
                          {!isSunday && entry.isWorkingDay ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-end gap-2">
                                <label className="text-xs text-muted-foreground">
                                  Ore base:
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
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
                                    className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary/20"
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    Manuale
                                  </span>
                                </label>
                              </div>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="24"
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
                                  "w-20 rounded-lg border px-2 py-1 text-sm text-center font-semibold outline-none transition",
                                  entry.useManualHours
                                    ? "border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 cursor-text"
                                    : "border-muted bg-muted/50 text-muted-foreground cursor-not-allowed"
                                )}
                              />
                            </div>
                          ) : !isSunday ? (
                            <span className="text-sm text-muted-foreground italic">
                              Straordinario
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Weekly Total */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    Totale Ore Settimanali Base
                  </span>
                  <span className="text-xl font-bold text-primary">
                    {schedules.reduce((sum, s) => sum + s.totalHours, 0).toFixed(1)}h
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {error && (
            <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  {success}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted/30 px-6 py-4 flex-shrink-0">
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSaving ? "Salvataggio..." : "Salva Orari"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
