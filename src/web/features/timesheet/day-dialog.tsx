import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { formatDateIt, type LocalDate } from "@core/date";
import type { WeekSchedule } from "@core/schedule";
import { clockOptions, toClock, type Span } from "@core/time";
import { computeDay, type DayInput, type DayKind } from "@core/timesheet";
import { t } from "../../i18n/it";
import { cn } from "../../ui/cn";
import {
  Alert,
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  NativeSelect,
  Segmented,
  Textarea,
} from "../../ui/primitives";
import type { DayCellModel } from "./view-model";

const TIMES = clockOptions();

export interface DayFormState {
  kind: DayKind;
  morning: Span | null;
  afternoon: Span | null;
  morningOnLeave: boolean;
  afternoonOnLeave: boolean;
  use104: boolean;
  hours104Override: number | null;
  notes: string;
  medicalCertificate: string;
}

export function initialFormState(cell: DayCellModel, week: WeekSchedule): DayFormState {
  const entry = cell.entry;
  const scheduled = week[cell.weekday as keyof WeekSchedule];

  if (!entry) {
    return {
      kind: "work",
      morning: scheduled?.morning ?? null,
      afternoon: scheduled?.afternoon ?? null,
      morningOnLeave: false,
      afternoonOnLeave: false,
      use104: false,
      hours104Override: null,
      notes: "",
      medicalCertificate: "",
    };
  }

  const span = (start: string | null, end: string | null): Span | null =>
    start && end ? { start: toClock(start), end: toClock(end) } : null;

  return {
    kind: entry.kind,
    morning: span(entry.morningStart, entry.morningEnd),
    afternoon: span(entry.afternoonStart, entry.afternoonEnd),
    morningOnLeave: entry.morningOnLeave,
    afternoonOnLeave: entry.afternoonOnLeave,
    use104: entry.use104,
    hours104Override: entry.hours104Override,
    notes: entry.notes ?? "",
    medicalCertificate: entry.medicalCertificate ?? "",
  };
}

export function DayDialog({
  cell,
  week,
  canUse104,
  canUsePaternity,
  saving,
  deleting,
  onClose,
  onSave,
  onDelete,
}: {
  cell: DayCellModel;
  week: WeekSchedule;
  canUse104: boolean;
  canUsePaternity: boolean;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: (form: DayFormState) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState<DayFormState>(() => initialFormState(cell, week));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = (changes: Partial<DayFormState>) => setForm((current) => ({ ...current, ...changes }));

  const approvedSpan: Span | null = useMemo(() => {
    const leave = cell.approvedLeave;
    return leave?.type === "PERMESSO" && leave.startTime && leave.endTime
      ? { start: toClock(leave.startTime), end: toClock(leave.endTime) }
      : null;
  }, [cell.approvedLeave]);

  /**
   * The same engine the server runs, used here purely as a preview. The server
   * recomputes on save and stores its own answer, so this can never be the
   * source of a wrong payslip.
   */
  const preview = useMemo(() => {
    const input: DayInput = {
      date: cell.date as LocalDate,
      kind: form.kind,
      morning: form.morning,
      afternoon: form.afternoon,
      morningOnLeave: form.morningOnLeave,
      afternoonOnLeave: form.afternoonOnLeave,
      use104: form.use104,
      hours104Override: form.hours104Override,
      approvedLeave: approvedSpan,
    };
    return computeDay(input, week);
  }, [form, cell.date, week, approvedSpan]);

  const dayTypes = [
    { value: "work" as const, label: t.timesheet.dayTypes.work },
    { value: "vacation" as const, label: t.timesheet.dayTypes.vacation },
    { value: "sickness" as const, label: t.timesheet.dayTypes.sickness },
    ...(canUsePaternity ? [{ value: "paternity" as const, label: t.timesheet.dayTypes.paternity }] : []),
  ];

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => !open && onClose()}
        title={formatDateIt(cell.date as LocalDate)}
        description={
          cell.holiday
            ? `${t.timesheet.holiday} — ${cell.holiday}`
            : `${t.timesheet.contract}: ${cell.contractHours}h`
        }
        footer={
          <>
            {cell.entry ? (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="mr-auto text-destructive">
                <Trash2 aria-hidden />
                {t.app.delete}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={onClose}>
              {t.app.cancel}
            </Button>
            <Button onClick={() => onSave(form)} loading={saving}>
              {t.app.save}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Segmented
            label={t.timesheet.title}
            value={form.kind}
            onChange={(kind) => patch({ kind })}
            options={dayTypes}
            className="w-full"
          />

          {approvedSpan ? (
            <Alert tone="info">
              {t.timesheet.approvedLeaveOn(approvedSpan.start, approvedSpan.end)}
            </Alert>
          ) : null}

          {form.kind === "work" ? (
            <>
              <ShiftRow
                label={t.timesheet.morning}
                span={form.morning}
                onLeave={form.morningOnLeave}
                onSpanChange={(morning) => patch({ morning })}
                onLeaveChange={(morningOnLeave) => patch({ morningOnLeave })}
              />
              <ShiftRow
                label={t.timesheet.afternoon}
                span={form.afternoon}
                onLeave={form.afternoonOnLeave}
                onSpanChange={(afternoon) => patch({ afternoon })}
                onLeaveChange={(afternoonOnLeave) => patch({ afternoonOnLeave })}
              />

              {canUse104 ? (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <Checkbox
                    checked={form.use104}
                    onCheckedChange={(use104) => patch({ use104, hours104Override: null })}
                    label={t.timesheet.use104}
                    hint={t.users.has104Hint}
                  />
                  {form.use104 ? (
                    <Field label={t.timesheet.hours104}>
                      {(props) => (
                        <Input
                          type="number"
                          min={0}
                          max={24}
                          step={0.5}
                          value={form.hours104Override ?? ""}
                          placeholder={String(preview.leave104 + preview.leave)}
                          onChange={(event) =>
                            patch({
                              hours104Override: event.target.value === "" ? null : Number(event.target.value),
                            })
                          }
                          {...props}
                        />
                      )}
                    </Field>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          {form.kind === "sickness" ? (
            <Field label={t.timesheet.medicalCertificate} hint={t.requests.reasonHint}>
              {(props) => (
                <Input
                  value={form.medicalCertificate}
                  onChange={(event) => patch({ medicalCertificate: event.target.value })}
                  {...props}
                />
              )}
            </Field>
          ) : null}

          <Field label={t.timesheet.notes} hint={t.requests.reasonHint}>
            {(props) => (
              <Textarea value={form.notes} onChange={(event) => patch({ notes: event.target.value })} {...props} />
            )}
          </Field>

          <Preview
            rows={[
              [t.timesheet.regular, preview.regular],
              [t.timesheet.overtime, preview.overtime],
              [t.timesheet.leave, preview.leave],
              [t.timesheet.leave104, preview.leave104],
              [t.timesheet.vacation, preview.vacation],
              [t.timesheet.sickness, preview.sickness],
              [t.timesheet.paternity, preview.paternity],
            ]}
          />
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t.app.delete}
        description={t.timesheet.deleteConfirm}
        confirmLabel={t.app.delete}
        destructive
        loading={deleting}
        onConfirm={onDelete}
      />
    </>
  );
}

function ShiftRow({
  label,
  span,
  onLeave,
  onSpanChange,
  onLeaveChange,
}: {
  label: string;
  span: Span | null;
  onLeave: boolean;
  onSpanChange: (span: Span | null) => void;
  onLeaveChange: (onLeave: boolean) => void;
}) {
  const set = (key: "start" | "end", value: string) => {
    if (!value) return onSpanChange(null);
    const base = span ?? { start: toClock("08:00"), end: toClock("12:00") };
    onSpanChange({ ...base, [key]: toClock(value) });
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-[13px] font-medium">{label}</p>

      <div className={cn("grid grid-cols-2 gap-2", onLeave && "opacity-50")}>
        <Field label={t.timesheet.from}>
          {(props) => (
            <NativeSelect
              value={span?.start ?? ""}
              disabled={onLeave}
              onChange={(event) => set("start", event.target.value)}
              {...props}
            >
              <option value="">—</option>
              {TIMES.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field label={t.timesheet.to}>
          {(props) => (
            <NativeSelect
              value={span?.end ?? ""}
              disabled={onLeave}
              onChange={(event) => set("end", event.target.value)}
              {...props}
            >
              <option value="">—</option>
              {TIMES.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>

      <Checkbox checked={onLeave} onCheckedChange={onLeaveChange} label={t.timesheet.wholeShiftOnLeave} />
    </div>
  );
}

function Preview({ rows }: { rows: Array<[string, number]> }) {
  const visible = rows.filter(([, hours]) => hours > 0);
  return (
    <div className="rounded-md bg-muted/60 p-3">
      {visible.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{t.timesheet.emptyDay}</p>
      ) : (
        <dl className="space-y-1">
          {visible.map(([label, hours]) => (
            <div key={label} className="flex items-center justify-between text-[13px]">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">{hours}h</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
