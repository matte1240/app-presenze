import { cn } from "../../ui/cn";
import { t } from "../../i18n/it";
import type { DayCellModel } from "./view-model";

const STATE_STYLES: Record<DayCellModel["state"], string> = {
  filled: "bg-card",
  leave: "bg-info-subtle/60",
  missing: "bg-destructive-subtle/50",
  closed: "bg-muted/40",
  empty: "bg-card",
};

/**
 * Presentation only. Every decision — editable, missing, which badge — was
 * made in `buildMonth`; this renders what it was handed.
 */
export function MonthGrid({
  weeks,
  onSelect,
}: {
  weeks: DayCellModel[][];
  onSelect: (cell: DayCellModel) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {[1, 2, 3, 4, 5, 6, 0].map((weekday) => (
          <div key={weekday} className="px-2 py-2 text-center text-[11px] font-medium text-muted-foreground">
            {t.weekdaysShort[weekday]}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((cell) => (
          <DayCell key={cell.date} cell={cell} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function DayCell({ cell, onSelect }: { cell: DayCellModel; onSelect: (cell: DayCellModel) => void }) {
  const interactive = cell.inMonth && cell.editable;

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => onSelect(cell)}
      title={cell.holiday ?? undefined}
      className={cn(
        "relative flex min-h-20 flex-col items-start gap-1 border-b border-r border-border p-1.5 text-left transition-colors sm:min-h-24 sm:p-2",
        STATE_STYLES[cell.state],
        !cell.inMonth && "opacity-35",
        interactive ? "hover:bg-accent" : "cursor-default",
      )}
    >
      <span className="flex w-full items-center justify-between gap-1">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-[12px] font-medium tabular-nums",
            cell.isToday && "bg-primary text-primary-foreground",
            !cell.isToday && cell.holiday && "text-destructive",
          )}
        >
          {cell.dayOfMonth}
        </span>
        {cell.pendingRequest ? (
          <span className="size-1.5 rounded-full bg-warning" title={t.requests.statuses.PENDING} />
        ) : null}
      </span>

      {cell.entry ? (
        <span className="w-full min-w-0">
          <span className="block truncate text-[11px] text-muted-foreground">
            {cell.entry.kind === "work" ? t.timesheet.worked : t.timesheet.dayTypes[cell.entry.kind]}
          </span>
          <span className="block text-[13px] font-semibold tabular-nums">{cell.hours}h</span>
          {cell.entry.overtimeHours > 0 ? (
            <span className="block text-[11px] text-warning">+{cell.entry.overtimeHours}h</span>
          ) : null}
        </span>
      ) : cell.holiday ? (
        <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">{cell.holiday}</span>
      ) : cell.state === "missing" ? (
        <span className="text-[11px] text-destructive">{t.timesheet.emptyDay}</span>
      ) : null}
    </button>
  );
}
