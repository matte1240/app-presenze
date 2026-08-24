import type { ReactNode } from "react";
import { cn } from "../cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

/**
 * A radio group that looks like a switch, for a handful of exclusive choices
 * that all need to stay visible.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentOption<T>>;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex gap-0.5 rounded-sm border border-border bg-surface-sunken p-0.5", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-xs px-2.5 py-1 text-label font-medium transition-colors",
              active
                ? "bg-surface text-foreground shadow-popover"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
