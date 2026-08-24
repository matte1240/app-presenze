import { useState } from "react";
import { ALL_WEEKDAYS, defaultDay, shiftHours, type DaySchedule } from "@core/schedule";
import { clockOptions, toClock, type Span } from "@core/time";
import { t } from "../../i18n/it";
import { cn } from "../../ui/cn";
import { Button, Checkbox, Dialog, Input, NativeSelect } from "../../ui/primitives";

const TIMES = clockOptions();

/**
 * Every weekday is editable, Sunday included. The previous editor rendered
 * Sunday as permanently closed and stripped it from the payload before saving,
 * so an employee cleared for Sunday work could never be given hours for it.
 */
export function ScheduleEditor({
  open,
  userName,
  days,
  canWorkSunday,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  userName: string;
  days: readonly DaySchedule[];
  canWorkSunday: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (days: DaySchedule[], canWorkSunday: boolean) => void;
}) {
  const [draft, setDraft] = useState<DaySchedule[]>(() =>
    ALL_WEEKDAYS.map((weekday) => days.find((d) => d.weekday === weekday) ?? defaultDay(weekday)),
  );
  const [sunday, setSunday] = useState(canWorkSunday);

  const patch = (weekday: number, changes: Partial<DaySchedule>) =>
    setDraft((current) =>
      current.map((day) => {
        if (day.weekday !== weekday) return day;
        const next = { ...day, ...changes };
        // Turning a day off clears its shifts, so a stale time can never be
        // resurrected by turning it back on.
        if (!next.isWorking) return { ...next, morning: null, afternoon: null, contractHours: 0 };
        return next.manualHours ? next : { ...next, contractHours: shiftHours(next) };
      }),
    );

  const setSpan = (weekday: number, key: "morning" | "afternoon", part: "start" | "end", value: string) => {
    const day = draft.find((d) => d.weekday === weekday)!;
    const existing = day[key];
    const span: Span | null = value
      ? { ...(existing ?? { start: toClock("08:00"), end: toClock("12:00") }), [part]: toClock(value) }
      : null;
    patch(weekday, { [key]: span });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t.users.schedule}
      description={userName}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.app.cancel}
          </Button>
          <Button loading={saving} onClick={() => onSave(draft, sunday)}>
            {t.app.save}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Checkbox
          checked={sunday}
          onCheckedChange={setSunday}
          label={t.users.canWorkSunday}
          hint={t.users.canWorkSundayHint}
        />

        {draft.map((day) => (
          <div
            key={day.weekday}
            className={cn("rounded-md border border-border p-3", !day.isWorking && "bg-muted/40")}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-medium capitalize">{t.weekdaysLong[day.weekday]}</span>
              <Checkbox
                checked={day.isWorking}
                onCheckedChange={(isWorking) => patch(day.weekday, { isWorking })}
                // The label says what ticking the box does and stays put; only
                // the hint reports the consequence of leaving it clear.
                label={t.users.workingDay}
                hint={day.isWorking ? undefined : t.users.onlyOvertime}
              />
            </div>

            {day.isWorking ? (
              <div className="mt-3 space-y-3">
                <div className="grid gap-2 sm:grid-cols-4">
                  {(["morning", "afternoon"] as const).map((key) =>
                    (["start", "end"] as const).map((part) => (
                      <label key={`${key}-${part}`} className="space-y-1">
                        <span className="text-[11px] text-muted-foreground">
                          {key === "morning" ? t.timesheet.morning : t.timesheet.afternoon}{" "}
                          {part === "start" ? t.timesheet.from.toLowerCase() : t.timesheet.to.toLowerCase()}
                        </span>
                        <NativeSelect
                          value={day[key]?.[part] ?? ""}
                          onChange={(event) => setSpan(day.weekday, key, part, event.target.value)}
                        >
                          <option value="">—</option>
                          {TIMES.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </NativeSelect>
                      </label>
                    )),
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-4">
                  <Checkbox
                    checked={day.manualHours}
                    onCheckedChange={(manualHours) =>
                      patch(day.weekday, {
                        manualHours,
                        ...(manualHours ? {} : { contractHours: shiftHours(day) }),
                      })
                    }
                    label={t.users.manualHours}
                  />
                  <label className="space-y-1">
                    <span className="block text-[11px] text-muted-foreground">{t.users.contractHours}</span>
                    <Input
                      type="number"
                      min={0}
                      max={24}
                      step={0.5}
                      className="w-24"
                      disabled={!day.manualHours}
                      value={day.contractHours}
                      onChange={(event) => patch(day.weekday, { contractHours: Number(event.target.value) })}
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Dialog>
  );
}
