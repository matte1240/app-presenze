"use client";

import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Moon, Stethoscope, Sun, Baby } from "lucide-react";
import { TIME_OPTIONS } from "@/lib/utils/time-utils";
import type { ModalFormState } from "@/hooks/use-timesheet-data";
import type { LeaveRequestDTO } from "@/types/models";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FORM_ID = "time-entry-form";

type DayType = ModalFormState["dayType"];

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
  const dayTypes: Array<{ value: DayType; label: string }> = [
    { value: "normal", label: "Normale" },
    { value: "ferie", label: "Ferie" },
    { value: "malattia", label: "Malattia" },
    ...(userFeatures?.hasPaternityLeave
      ? [{ value: "paternity" as DayType, label: "Paternità" }]
      : []),
  ];

  const saveLabel =
    modalForm.dayType === "ferie"
      ? "Salva ferie"
      : modalForm.dayType === "malattia"
        ? "Salva malattia"
        : modalForm.dayType === "paternity"
          ? "Salva paternità"
          : "Salva";

  const nothingToSave =
    modalForm.dayType === "normal" &&
    calculatedHours.totalWorked === 0 &&
    calculatedHours.permesso === 0 &&
    calculatedHours.permesso104 === 0;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      size="md"
      title={
        selectedDate
          ? format(new Date(`${selectedDate}T12:00:00`), "EEEE d MMMM yyyy", {
              locale: it,
            })
          : "Registra ore"
      }
      footer={
        <>
          {hasExistingEntry && (
            <Button
              variant="ghost"
              onClick={onDelete}
              disabled={isSaving}
              className="mr-auto hover:bg-destructive-subtle hover:text-destructive"
            >
              Elimina
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Annulla
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            loading={isSaving}
            disabled={nothingToSave}
          >
            {isSaving ? "Salvataggio…" : saveLabel}
          </Button>
        </>
      }
    >
      {/* The submit button lives in the dialog footer, outside this element, so
          it is tied back to the form by id rather than by nesting. */}
      <form id={FORM_ID} onSubmit={onSubmit} className="space-y-4">
        {modalError && <Alert variant="error">{modalError}</Alert>}

        {/* Day type: a segmented control rather than a dropdown. Four options
            that switch the whole form deserve to be visible at once. */}
        <div className="space-y-1.5">
          <Label>Tipo di giornata</Label>
          <div className="flex rounded-md border border-border p-0.5">
            {dayTypes.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setModalForm((f) => ({ ...f, dayType: value }))}
                aria-pressed={modalForm.dayType === value}
                className={cn(
                  "flex-1 cursor-pointer rounded-sm px-2 py-1.5 text-[13px] font-medium transition-colors",
                  modalForm.dayType === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {modalForm.dayType === "malattia" && (
          <>
            <Field label="Numero certificato medico">
              {(field) => (
                <Input
                  {...field}
                  type="text"
                  value={modalForm.medicalCertificate}
                  onChange={(e) =>
                    setModalForm((f) => ({
                      ...f,
                      medicalCertificate: e.target.value,
                    }))
                  }
                  placeholder="Es. 1234567890"
                />
              )}
            </Field>
            <SummaryPanel
              icon={<Stethoscope />}
              label="Malattia"
              value={`${calculatedHours.sickness} ore`}
            />
          </>
        )}

        {modalForm.dayType === "ferie" && (
          <SummaryPanel
            icon={<Sun />}
            label="Ferie"
            value={`${calculatedHours.vacation} ore`}
            note="Giornata di ferie completa."
          />
        )}

        {modalForm.dayType === "paternity" && (
          <SummaryPanel
            icon={<Baby />}
            label="Congedo di paternità"
            value="Giornata intera"
          />
        )}

        {modalForm.dayType === "normal" && (
          <>
            {activePerm && activePerm.startTime && activePerm.endTime && (
              <Alert
                variant="info"
                title={`Permesso approvato ${activePerm.startTime}–${activePerm.endTime}`}
              >
                Le ore di permesso coprono automaticamente quelle mancanti al
                raggiungimento dell&apos;orario ordinario.
              </Alert>
            )}

            <ShiftSection
              label="Mattina"
              icon={<Sun />}
              isPermesso={modalForm.isMorningPermesso}
              onPermessoChange={(checked) =>
                setModalForm((f) => ({ ...f, isMorningPermesso: checked }))
              }
              startValue={modalForm.morningStart}
              endValue={modalForm.morningEnd}
              onStartChange={(v) =>
                setModalForm((f) => ({ ...f, morningStart: v }))
              }
              onEndChange={(v) => setModalForm((f) => ({ ...f, morningEnd: v }))}
              duration={calculatedHours.morning}
              timePrefix="morning"
            />

            <ShiftSection
              label="Pomeriggio"
              icon={<Moon />}
              isPermesso={modalForm.isAfternoonPermesso}
              onPermessoChange={(checked) =>
                setModalForm((f) => ({ ...f, isAfternoonPermesso: checked }))
              }
              startValue={modalForm.afternoonStart}
              endValue={modalForm.afternoonEnd}
              onStartChange={(v) =>
                setModalForm((f) => ({ ...f, afternoonStart: v }))
              }
              onEndChange={(v) =>
                setModalForm((f) => ({ ...f, afternoonEnd: v }))
              }
              duration={calculatedHours.afternoon}
              timePrefix="afternoon"
            />

            {userFeatures?.hasPermesso104 && (
              <div className="rounded-md border border-border p-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={modalForm.isPermesso104}
                    onChange={(e) =>
                      setModalForm((f) => ({
                        ...f,
                        isPermesso104: e.target.checked,
                        permesso104Override: null,
                      }))
                    }
                    className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))]"
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-foreground">
                      Usa permesso 104
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      Le ore mancanti sono conteggiate come permesso 104 invece
                      che come permesso ordinario.
                    </span>
                  </span>
                </label>

                {modalForm.isPermesso104 &&
                  (calculatedHours.permesso104 > 0 ||
                    calculatedHours.permesso > 0) && (
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="permesso104-hours" className="text-[13px]">
                          Ore permesso 104
                        </Label>
                        <Input
                          id="permesso104-hours"
                          type="number"
                          min={0}
                          max={
                            calculatedHours.permesso104 + calculatedHours.permesso
                          }
                          step={0.5}
                          value={
                            modalForm.permesso104Override ??
                            calculatedHours.permesso104 + calculatedHours.permesso
                          }
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            const maxH =
                              calculatedHours.permesso104 +
                              calculatedHours.permesso;
                            setModalForm((f) => ({
                              ...f,
                              permesso104Override: isNaN(val)
                                ? null
                                : Math.min(Math.max(0, val), maxH),
                            }));
                          }}
                          className="w-24 text-right"
                        />
                      </div>
                      {calculatedHours.permesso > 0 && (
                        <p className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Permesso ordinario</span>
                          <span className="font-medium tabular-nums text-foreground">
                            {calculatedHours.permesso.toFixed(2)} ore
                          </span>
                        </p>
                      )}
                    </div>
                  )}
              </div>
            )}

            {/* Totals: the worked figure carries the weight, and only the two
                lines that need attention take a tone. */}
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-medium text-foreground">
                  Ore totali
                </span>
                <span className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
                  {calculatedHours.totalWorked.toFixed(2)}
                </span>
              </div>
              <dl className="mt-2 space-y-1 border-t border-border pt-2 text-xs">
                <TotalRow label="Ore regolari" value={calculatedHours.regular} />
                {calculatedHours.overtime > 0 && (
                  <TotalRow
                    label="Straordinario"
                    value={calculatedHours.overtime}
                    tone="text-warning"
                  />
                )}
                {calculatedHours.permesso > 0 && (
                  <TotalRow
                    label="Permesso"
                    value={calculatedHours.permesso}
                    tone="text-info"
                  />
                )}
              </dl>
            </div>
          </>
        )}

        <Field label="Note" hint="Facoltative">
          {(field) => (
            <Textarea
              {...field}
              rows={3}
              className="resize-none"
              value={modalForm.notes}
              onChange={(e) =>
                setModalForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Aggiungi una nota sulla giornata…"
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

function TotalRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={cn("text-muted-foreground", tone)}>{label}</dt>
      <dd className={cn("font-medium tabular-nums text-foreground", tone)}>
        {value.toFixed(2)}
      </dd>
    </div>
  );
}

function SummaryPanel({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-card text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">
          {value}
          {note ? ` · ${note}` : ""}
        </p>
      </div>
    </div>
  );
}

// ──── Shift Section sub-component ────

type ShiftSectionProps = {
  label: string;
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

/*
 * Morning and afternoon used to be a blue panel and an orange one. The colours
 * carried no meaning — they were not a status, and they clashed with any
 * customer brand — so both shifts now share one neutral panel and are told
 * apart by their label and icon.
 */
function ShiftSection({
  label,
  icon,
  isPermesso,
  onPermessoChange,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  duration,
  timePrefix,
}: ShiftSectionProps) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground [&_svg]:size-4">
          {icon}
          <h3 className="text-[13px] font-medium text-foreground">{label}</h3>
        </div>
        {!isPermesso && duration > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {duration.toFixed(2)} ore
          </span>
        )}
      </div>

      <label className="mb-2.5 flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={isPermesso}
          onChange={(e) => onPermessoChange(e.target.checked)}
          className="size-4 cursor-pointer accent-[hsl(var(--primary))]"
        />
        <span className="text-xs text-muted-foreground">
          Permesso per l&apos;intero turno (4h)
        </span>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Inizio">
          {(field) => (
            <Select
              {...field}
              value={startValue}
              onChange={(e) => onStartChange(e.target.value)}
              disabled={isPermesso}
            >
              <option value="">—</option>
              {TIME_OPTIONS.map((time) => (
                <option key={`${timePrefix}-start-${time}`} value={time}>
                  {time}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fine">
          {(field) => (
            <Select
              {...field}
              value={endValue}
              onChange={(e) => onEndChange(e.target.value)}
              disabled={isPermesso}
            >
              <option value="">—</option>
              {TIME_OPTIONS.map((time) => (
                <option key={`${timePrefix}-end-${time}`} value={time}>
                  {time}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {isPermesso && (
        <p className="mt-2 text-xs text-info">
          Queste ore saranno conteggiate come permesso.
        </p>
      )}
    </div>
  );
}
