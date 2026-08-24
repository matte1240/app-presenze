import type { ReactNode } from "react";
import { cn } from "../cn";
import { Skeleton } from "./skeleton";

export interface Metric {
  key: string;
  label: ReactNode;
  value: ReactNode;
  /** Draws the value at full weight; use for the one number that matters most. */
  lead?: boolean;
  /** A quiet status tint for values that carry meaning, never for decoration. */
  tone?: "default" | "warning" | "info";
}

const TONES = {
  default: "text-foreground",
  warning: "text-warning",
  info: "text-info",
} as const;

/**
 * Replaces a row of tall stat cards.
 *
 * Four boxed metrics took four hundred vertical pixels and carried the same
 * visual weight as the calendar underneath them, which is the actual content.
 * This is one strip: labels small and muted, values tabular, divided by
 * hairlines rather than boxed individually.
 */
export function SummaryBar({
  metrics,
  loading = false,
  className,
}: {
  metrics: readonly Metric[];
  loading?: boolean;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 divide-border overflow-hidden rounded-md border border-border bg-surface",
        "sm:flex sm:divide-x",
        className,
      )}
    >
      {metrics.map((metric, index) => (
        <div
          key={metric.key}
          className={cn(
            "min-w-0 flex-1 px-4 py-2.5",
            // On two columns the dividers have to be drawn per-cell.
            "border-border sm:border-0",
            index % 2 === 0 && "border-r",
            index < metrics.length - 2 && "border-b",
          )}
        >
          <dt className="truncate text-micro font-medium uppercase tracking-[0.04em] text-muted-foreground">
            {metric.label}
          </dt>
          {loading ? (
            <Skeleton className="mt-1 h-5 w-14" />
          ) : (
            <dd
              className={cn(
                "mt-0.5 tabular-nums",
                metric.lead ? "text-metric font-semibold" : "text-title font-medium",
                TONES[metric.tone ?? "default"],
              )}
            >
              {metric.value}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}
