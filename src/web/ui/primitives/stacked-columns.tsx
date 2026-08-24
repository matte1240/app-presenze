import { useId, useState, type ReactNode } from "react";
import { cn } from "../cn";

export interface Series {
  key: string;
  label: string;
  /** A `--series-N` role, never a literal colour. */
  color: string;
}

export interface Column {
  key: string;
  /** Shown under the column, thinned out so labels never collide. */
  label: string;
  /** Full description for the tooltip and the accessible name. */
  caption: string;
  values: Readonly<Record<string, number>>;
  /** Draws the column back, for days outside the working week. */
  muted?: boolean;
}

/** Ticks land on round numbers, so the axis carries the values not directly labelled. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/**
 * A stacked column chart, drawn in plain elements rather than SVG so it reflows
 * with the page and keeps real hover targets.
 *
 * Mark specs follow the house rules: columns capped in width with the band's
 * leftover left as air, a rounded cap on the data end and a square foot at the
 * baseline, a 2px gap in the surface colour separating touching segments, and
 * hairline gridlines that stay behind the data.
 */
export function StackedColumns({
  columns,
  series,
  unit = "h",
  height = 200,
  emptyLabel,
  className,
}: {
  columns: readonly Column[];
  series: readonly Series[];
  unit?: string;
  height?: number;
  emptyLabel?: ReactNode;
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const captionId = useId();

  const totals = columns.map((c) => series.reduce((sum, s) => sum + (c.values[s.key] ?? 0), 0));
  const max = Math.max(...totals, 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] ?? 0;

  if (max <= 0) {
    return (
      <div
        className={cn("flex items-center justify-center rounded-md border border-border bg-surface", className)}
        style={{ height: height + 40 }}
      >
        <p className="text-body text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border border-border bg-surface p-4", className)}>
      <div className="flex gap-3">
        {/* Axis ticks, top down. */}
        <div
          className="relative w-8 shrink-0 text-right text-micro tabular-nums text-muted-foreground"
          style={{ height }}
          aria-hidden
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: `${(tick / top) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-0" style={{ height }} aria-hidden>
            {ticks.map((tick) => (
              <span
                key={tick}
                className={cn("absolute inset-x-0 h-px", tick === 0 ? "bg-border-strong" : "bg-grid-line")}
                style={{ bottom: `${(tick / top) * 100}%` }}
              />
            ))}
          </div>

          <div className="relative flex items-end gap-px" style={{ height }} role="img" aria-describedby={captionId}>
            {columns.map((column, index) => {
              const total = totals[index] ?? 0;
              const active = hovered === index;
              return (
                <div
                  key={column.key}
                  className="group relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center"
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* The hit target is the whole band, not the drawn column. */}
                  <span
                    className={cn("absolute inset-0 rounded-xs", active && "bg-surface-sunken/70")}
                    aria-hidden
                  />

                  <div
                    className="relative flex w-full max-w-6 flex-col-reverse"
                    style={{ height: `${(total / top) * 100}%` }}
                  >
                    {series.map((s, depth) => {
                      const value = column.values[s.key] ?? 0;
                      if (value <= 0) return null;
                      const isCap = series.slice(depth + 1).every((rest) => (column.values[rest.key] ?? 0) <= 0);
                      return (
                        <span
                          key={s.key}
                          className={cn(
                            "w-full shrink-0",
                            // The gap is the separator; never a stroke around the mark.
                            depth > 0 && "mb-0.5",
                            isCap && "rounded-t",
                            column.muted && !active && "opacity-55",
                          )}
                          style={{
                            height: `${(value / total) * 100}%`,
                            backgroundColor: s.color,
                          }}
                        />
                      );
                    })}
                  </div>

                  {active ? (
                    <Tooltip
                      column={column}
                      series={series}
                      total={total}
                      unit={unit}
                      // A tall column would push the panel out of the chart and
                      // over the legend, so it flips under the cap instead.
                      below={total / top > 0.6}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-1.5 flex gap-px" aria-hidden>
            {columns.map((column) => (
              <span
                key={column.key}
                className="min-w-0 flex-1 text-center text-micro tabular-nums text-muted-foreground"
              >
                {column.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p id={captionId} className="sr-only">
        {columns
          .map((column, index) => `${column.caption}: ${totals[index]}${unit}`)
          .join(". ")}
      </p>
    </div>
  );
}

function Tooltip({
  column,
  series,
  total,
  unit,
  below,
}: {
  column: Column;
  series: readonly Series[];
  total: number;
  unit: string;
  below: boolean;
}) {
  const rows = series.filter((s) => (column.values[s.key] ?? 0) > 0);

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 z-20 w-max -translate-x-1/2 rounded-md border border-border bg-popover p-2.5 shadow-popover",
        below ? "top-2" : "bottom-full mb-2",
      )}
    >
      <p className="mb-1.5 whitespace-nowrap text-micro font-medium text-foreground">{column.caption}</p>
      <dl className="space-y-1">
        {rows.map((s) => (
          <div key={s.key} className="flex items-center gap-2 whitespace-nowrap">
            {/* Identity rides a coloured mark beside the text, never the text itself. */}
            <span className="size-2 shrink-0 rounded-xs" style={{ backgroundColor: s.color }} aria-hidden />
            <dt className="flex-1 text-micro text-muted-foreground">{s.label}</dt>
            <dd className="text-micro font-medium tabular-nums text-foreground">
              {column.values[s.key]}
              {unit}
            </dd>
          </div>
        ))}
        {rows.length > 1 ? (
          <div className="mt-1 flex items-center gap-2 whitespace-nowrap border-t border-border pt-1">
            <span className="size-2 shrink-0" aria-hidden />
            <dt className="flex-1 text-micro text-muted-foreground">Totale</dt>
            <dd className="text-micro font-semibold tabular-nums text-foreground">
              {Math.round(total * 100) / 100}
              {unit}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

/** Always shipped for two or more series: identity never rests on colour alone. */
export function ChartLegend({ series, className }: { series: readonly Series[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="size-2 rounded-xs" style={{ backgroundColor: s.color }} aria-hidden />
          <span className="text-micro text-muted-foreground">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The same five series as a single thin bar, for use inside a table row where
 * a full chart would not fit. Magnitude comes from the bar's own width against
 * the widest row, so rows stay comparable to each other.
 */
export function StackedBar({
  values,
  series,
  total,
  max,
  unit = "h",
  className,
}: {
  values: Readonly<Record<string, number>>;
  series: readonly Series[];
  total: number;
  max: number;
  unit?: string;
  className?: string;
}) {
  if (total <= 0 || max <= 0) {
    return <span className={cn("block h-1.5 rounded-full bg-surface-sunken", className)} aria-hidden />;
  }

  return (
    <span
      className={cn("block h-1.5 rounded-full bg-surface-sunken", className)}
      title={series
        .filter((s) => (values[s.key] ?? 0) > 0)
        .map((s) => `${s.label}: ${values[s.key]}${unit}`)
        .join(" · ")}
    >
      <span className="flex h-full overflow-hidden rounded-full" style={{ width: `${(total / max) * 100}%` }}>
        {series.map((s, index) => {
          const value = values[s.key] ?? 0;
          if (value <= 0) return null;
          return (
            <span
              key={s.key}
              className={cn("h-full shrink-0", index > 0 && "ml-0.5")}
              style={{ width: `${(value / total) * 100}%`, backgroundColor: s.color }}
            />
          );
        })}
      </span>
    </span>
  );
}
