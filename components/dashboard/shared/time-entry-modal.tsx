"use client";

import { format } from "date-fns";
import {
  XCircle,
  AlertCircle,
  Sun,
  Stethoscope,
  Briefcase,
  Loader2,
} from "lucide-react";
import { TIME_OPTIONS } from "@/lib/utils/time-utils";
import type { ModalFormState } from "@/hooks/use-timesheet-data";
import type { LeaveRequestDTO } from "@/types/models";

type TimeEntryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string | null;
  modalForm: ModalFormState;
  setModalForm: React.Dispatch<React.SetStateAction<ModalFormState>>;
  modalError: string | null;
  calculatedHours: {
    morning: number;
    afternoon: number;
    totalWorked: number;
    regular: number;
    overtime: number;
    permesso: number;
    sickness: number;
    vacation: number;
    permesso104: number;
    paternity: number;
  };
  activePerm: LeaveRequestDTO | null;
  isSaving: boolean;
  hasExistingEntry: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  userFeatures?: { hasPermesso104: boolean; hasPaternityLeave: boolean };
};

export default function TimeEntryModal({
  isOpen,
  onClose,
  selectedDate,
  modalForm,
  setModalForm,
  modalError,
  calculatedHours,
  activePerm,
  isSaving,
  hasExistingEntry,
  onSubmit,
  onDelete,
  userFeatures = { hasPermesso104: false, hasPaternityLeave: false },
}: TimeEntryModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg my-8 rounded-xl border border-border bg-card shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
          {/* Header */}
          <div className="flex items-center justify-between bg-primary px-6 py-4 flex-shrink-0">
            <h2 className="text-lg font-semibold text-primary-foreground">
              {selectedDate &&
                format(new Date(`${selectedDate}T12:00:00`), "EEEE, MMM d, yyyy")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-primary-foreground/80 transition hover:bg-primary-foreground/20 hover:text-primary-foreground"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>

          {/* Error banner */}
          {modalError && (
            <div className="mx-6 mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                <p className="text-sm font-medium text-destructive">{modalError}</p>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="space-y-5 p-6 pb-5 overflow-y-auto flex-1">
            {/* Day type selector */}
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-foreground">Tipo di giornata</span>
              <select
                value={modalForm.dayType}
                onChange={(e) =>
                  setModalForm((f) => ({ ...f, dayType: e.target.value as ModalFormState["dayType"] }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="normal">Normale</option>
                <option value="ferie">Ferie</option>
                <option value="malattia">Malattia</option>
                {userFeatures?.hasPaternityLeave && (
                  <option value="paternity">Congedo Paternità</option>
                )}
              </select>
            </label>

            {/* Medical certificate */}
            {modalForm.dayType === "malattia" && (
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-foreground">Numero certificato medico</span>
                <input
                  type="text"
                  value={modalForm.medicalCertificate}
                  onChange={(e) => setModalForm((f) => ({ ...f, medicalCertificate: e.target.value }))}
                  placeholder="Inserisci il numero del certificato..."
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </label>
            )}

            {/* Normal day: shifts */}
            {modalForm.dayType === "normal" && (
              <>
                {activePerm && activePerm.startTime && activePerm.endTime && (
                  <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:bg-yellow-900/10 dark:border-yellow-900/20">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      <div className="text-xs text-yellow-800 dark:text-yellow-200">
                        <p className="font-semibold">Permesso Approvato ({activePerm.startTime} - {activePerm.endTime})</p>
                        <p>Le ore di permesso verranno conteggiate automaticamente per coprire le ore mancanti al raggiungimento delle ore lavorative ordinarie.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Morning shift */}
                <ShiftSection
                  label="Turno Mattina"
                  color="blue"
                  icon={<Sun className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                  isPermesso={modalForm.isMorningPermesso}
                  onPermessoChange={(checked) => setModalForm((f) => ({ ...f, isMorningPermesso: checked }))}
                  startValue={modalForm.morningStart}
                  endValue={modalForm.morningEnd}
                  onStartChange={(v) => setModalForm((f) => ({ ...f, morningStart: v }))}
                  onEndChange={(v) => setModalForm((f) => ({ ...f, morningEnd: v }))}
                  duration={calculatedHours.morning}
                  timePrefix="morning"
                />

                {/* Afternoon shift */}
                <ShiftSection
                  label="Turno Pomeriggio"
                  color="orange"
                  icon={<Sun className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
                  isPermesso={modalForm.isAfternoonPermesso}
                  onPermessoChange={(checked) => setModalForm((f) => ({ ...f, isAfternoonPermesso: checked }))}
                  startValue={modalForm.afternoonStart}
                  endValue={modalForm.afternoonEnd}
                  onStartChange={(v) => setModalForm((f) => ({ ...f, afternoonStart: v }))}
                  onEndChange={(v) => setModalForm((f) => ({ ...f, afternoonEnd: v }))}
                  duration={calculatedHours.afternoon}
                  timePrefix="afternoon"
                />

                {/* Permesso 104 */}
                {userFeatures?.hasPermesso104 && (
                  <div className="rounded-xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20 p-4 shadow-sm">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modalForm.isPermesso104}
                        onChange={(e) =>
                          setModalForm((f) => ({ ...f, isPermesso104: e.target.checked, permesso104Override: null }))
                        }
                        className="h-5 w-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">Usa Permesso 104</span>
                        <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                          Le ore mancanti saranno conteggiate come permesso 104 invece che permesso normale.
                        </p>
                      </div>
                    </label>
                    {modalForm.isPermesso104 && (calculatedHours.permesso104 > 0 || calculatedHours.permesso > 0) && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-sm font-medium text-purple-700 dark:text-purple-300 whitespace-nowrap">
                            Ore Permesso 104:
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={calculatedHours.permesso104 + calculatedHours.permesso}
                            step={0.5}
                            value={modalForm.permesso104Override ?? (calculatedHours.permesso104 + calculatedHours.permesso)}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              const maxH = calculatedHours.permesso104 + calculatedHours.permesso;
                              setModalForm((f) => ({
                                ...f,
                                permesso104Override: isNaN(val) ? null : Math.min(Math.max(0, val), maxH),
                              }));
                            }}
                            className="w-24 rounded-md border border-purple-300 dark:border-purple-700 bg-white dark:bg-purple-950 px-2 py-1 text-sm font-bold text-purple-900 dark:text-purple-100 text-right focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        {calculatedHours.permesso > 0 && (
                          <p className="flex items-center justify-between text-xs text-purple-600 dark:text-purple-400">
                            <span>Permesso normale:</span>
                            <span className="font-semibold">{calculatedHours.permesso.toFixed(2)} ore</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Ferie info */}
            {modalForm.dayType === "ferie" && (
              <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Sun className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Ferie</h3>
                </div>
                <p className="text-sm text-emerald-800 dark:text-emerald-200">Giornata di ferie completa - {calculatedHours.vacation} ore di ferie.</p>
              </div>
            )}

            {/* Malattia info */}
            {modalForm.dayType === "malattia" && (
              <div className="rounded-xl bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Stethoscope className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  <h3 className="text-sm font-bold text-rose-900 dark:text-rose-100">Malattia</h3>
                </div>
                <p className="text-sm text-rose-800 dark:text-rose-200">Giornata di malattia - {calculatedHours.sickness} ore di malattia.</p>
              </div>
            )}

            {/* Paternity info */}
            {modalForm.dayType === "paternity" && (
              <div className="rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100">Congedo Paternità</h3>
                </div>
                <p className="text-sm text-blue-800 dark:text-blue-200">Giornata di congedo paternità completa.</p>
              </div>
            )}

            {/* Summary */}
            {modalForm.dayType === "normal" && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-foreground">Ore totali:</span>
                    <span className="text-2xl font-bold text-primary">{calculatedHours.totalWorked.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border pt-2">
                    <span className="font-medium text-muted-foreground">Ore regolari:</span>
                    <span className="font-bold text-foreground">{calculatedHours.regular.toFixed(2)}</span>
                  </div>
                  {calculatedHours.overtime > 0 && (
                    <div className="flex justify-between items-center border-t border-orange-100 dark:border-orange-900/20 pt-2">
                      <span className="font-medium text-orange-700 dark:text-orange-300">Straordinario:</span>
                      <span className="font-bold text-orange-600 dark:text-orange-400">{calculatedHours.overtime.toFixed(2)}</span>
                    </div>
                  )}
                  {calculatedHours.permesso > 0 && (
                    <div className="flex justify-between items-center border-t border-yellow-100 dark:border-yellow-900/20 pt-2">
                      <span className="font-medium text-yellow-700 dark:text-yellow-300">Permesso:</span>
                      <span className="font-bold text-yellow-600 dark:text-yellow-400">{calculatedHours.permesso.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-foreground">Note (opzionali)</span>
              <textarea
                value={modalForm.notes}
                onChange={(e) => setModalForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Aggiungi note sul tuo lavoro..."
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </label>
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-border bg-muted/50 px-6 py-4 pt-6 rounded-b-xl flex-shrink-0">
            {hasExistingEntry && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isSaving}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-destructive bg-background hover:bg-destructive hover:text-destructive-foreground h-10 px-4 py-2 text-destructive"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Elimina"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 flex-1"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={
                isSaving ||
                (modalForm.dayType === "normal" &&
                  calculatedHours.totalWorked === 0 &&
                  calculatedHours.permesso === 0 &&
                  calculatedHours.permesso104 === 0)
              }
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 flex-1 shadow-md"
            >
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvataggio...</>
              ) : modalForm.dayType === "ferie" ? "Salva Ferie"
                : modalForm.dayType === "malattia" ? "Salva Malattia"
                : modalForm.dayType === "paternity" ? "Salva Paternità"
                : "Salva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──── Shift Section sub-component ────

type ShiftSectionProps = {
  label: string;
  color: "blue" | "orange";
  icon: React.ReactNode;
  isPermesso: boolean;
  onPermessoChange: (checked: boolean) => void;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  duration: number;
  timePrefix: string;
};

function ShiftSection({
  label, color, icon, isPermesso, onPermessoChange,
  startValue, endValue, onStartChange, onEndChange,
  duration, timePrefix,
}: ShiftSectionProps) {
  const colorClasses = color === "blue"
    ? { bg: "bg-blue-50/50 dark:bg-blue-900/10", border: "border-blue-100 dark:border-blue-900/20", title: "text-blue-900 dark:text-blue-100", label: "text-blue-800 dark:text-blue-200", duration: "text-blue-700 dark:text-blue-300", durationBold: "text-blue-900 dark:text-blue-100", check: "border-blue-300 text-blue-600 focus:ring-blue-500", note: "text-blue-700 dark:text-blue-300" }
    : { bg: "bg-orange-50/50 dark:bg-orange-900/10", border: "border-orange-100 dark:border-orange-900/20", title: "text-orange-900 dark:text-orange-100", label: "text-orange-800 dark:text-orange-200", duration: "text-orange-700 dark:text-orange-300", durationBold: "text-orange-900 dark:text-orange-100", check: "border-orange-300 text-orange-600 focus:ring-orange-500", note: "text-orange-700 dark:text-orange-300" };

  return (
    <div className={`rounded-xl ${colorClasses.bg} border ${colorClasses.border} p-4 shadow-sm`}>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className={`text-sm font-bold ${colorClasses.title}`}>{label}</h3>
      </div>
      <div className="mb-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isPermesso}
            onChange={(e) => onPermessoChange(e.target.checked)}
            className={`h-4 w-4 rounded ${colorClasses.check}`}
          />
          <span className={`text-xs font-medium ${colorClasses.label}`}>Permesso Totale Turno (4h)</span>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-2">
          <span className={`text-xs font-semibold ${colorClasses.label}`}>Ora inizio</span>
          <select
            value={startValue}
            onChange={(e) => onStartChange(e.target.value)}
            disabled={isPermesso}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">--</option>
            {TIME_OPTIONS.map((time) => (
              <option key={`${timePrefix}-start-${time}`} value={time}>{time}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className={`text-xs font-semibold ${colorClasses.label}`}>Ora fine</span>
          <select
            value={endValue}
            onChange={(e) => onEndChange(e.target.value)}
            disabled={isPermesso}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">--</option>
            {TIME_OPTIONS.map((time) => (
              <option key={`${timePrefix}-end-${time}`} value={time}>{time}</option>
            ))}
          </select>
        </label>
      </div>
      {!isPermesso && (
        <p className="mt-3 flex items-center justify-between text-xs">
          <span className={`font-medium ${colorClasses.duration}`}>Durata:</span>
          <span className={`font-bold ${colorClasses.durationBold}`}>{duration.toFixed(2)} ore</span>
        </p>
      )}
      {isPermesso && (
        <p className={`mt-2 text-xs ${colorClasses.note}`}>Queste ore saranno conteggiate come permesso.</p>
      )}
    </div>
  );
}
