import { cn } from "../../ui/cn";
import { t } from "../../i18n/it";
import type { DayCellModel } from "./view-model";

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
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border bg-surface-sunken/60">
        {[1, 2, 3, 4, 5, 6, 0].map((weekday) => (
          <div
            key={weekday}
            className="px-2 py-1.5 text-center text-micro font-medium uppercase tracking-[0.04em] text-muted-foreground"
          >
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

/**
 * What the hour count alone cannot say. A plain full day gets nothing: the
 * number is already the whole story, and repeating "lavorate" under every cell
 * turned the month into a wall of the same word.
 */
function footnoteFor(cell: DayCellModel): string | null {
  const entry = cell.entry;
  if (!entry) return null;
  if (entry.kind !== "work") return t.timesheet.dayTypes[entry.kind].toLowerCase();
  if (entry.overtimeHours > 0) return `+${entry.overtimeHours}h ${t.timesheet.overtime.toLowerCase()}`;
  const leave = entry.leaveHours + entry.leave104Hours;
  if (leave > 0) return `+${leave}h ${t.timesheet.leave.toLowerCase()}`;
  return null;
}

function DayCell({ cell, onSelect }: { cell: DayCellModel; onSelect: (cell: DayCellModel) => void }) {
  const interactive = cell.inMonth && cell.editable;
  // A day still to be filled in is a task, not a failure: it gets a marker on
  // the edge rather than a red wash over the whole cell.
  const missing = cell.state === "missing";
  const closed = cell.state === "closed";

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => onSelect(cell)}
      title={cell.holiday ?? undefined}
      className={cn(
        "relative flex min-h-16 flex-col gap-1 border-b border-r border-border p-1.5 text-left transition-colors sm:min-h-24 sm:p-2",
        closed ? "bg-surface-sunken" : "bg-surface",
        !cell.inMonth && "opacity-40",
        interactive ? "hover:bg-surface-sunken" : "cursor-default",
      )}
    >
      {missing ? (
        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-destructive/70" aria-hidden />
      ) : null}

      <span className="flex items-center justify-between gap-1">
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full text-label tabular-nums",
            cell.isToday && "bg-primary font-semibold text-primary-foreground",
            !cell.isToday && cell.holiday && "font-medium text-destructive",
            !cell.isToday && !cell.holiday && "text-muted-foreground",
          )}
        >
          {cell.dayOfMonth}
        </span>
        {cell.pendingRequest ? (
          <span className="size-1.5 rounded-full bg-warning" title={t.requests.statuses.PENDING} />
        ) : null}
      </span>

      {cell.entry ? (
        <span className="min-w-0">
          {/* The hours are the message; the label is the footnote. */}
          <span className="block text-title font-semibold leading-none tabular-nums">{cell.hours}h</span>
          {footnoteFor(cell) ? (
            <span className="mt-1 hidden truncate text-micro text-muted-foreground sm:block">
              {footnoteFor(cell)}
            </span>
          ) : null}
        </span>
      ) : cell.holiday ? (
        <span className="hidden line-clamp-2 text-micro leading-tight text-muted-foreground sm:block">{cell.holiday}</span>
      ) : null}
    </button>
  );
}
