import type { ReactNode } from "react";
import { cn } from "../cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

/**
 * A radio group that looks like a switch. Used for the day type and for
 * anywhere a handful of exclusive choices need to stay visible at once —
 * previously inlined ad hoc in two different screens.
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
    <div role="radiogroup" aria-label={label} className={cn("inline-flex gap-1 rounded-lg bg-muted p-1", className)}>
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
              "flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-elevation-1"
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
