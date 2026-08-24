import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "../cn";
import { Button } from "./button";

export interface MonthPickerProps {
  /** `YYYY-MM`. */
  value: string;
  onChange: (month: string) => void;
  /** Supplied by the caller so this component holds no locale data. */
  monthNames: readonly string[];
  className?: string;
}

const parse = (value: string) => ({ year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) });
const format = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

/** One control: the arrows and the label form a single bordered group. */
export function MonthPicker({ value, onChange, monthNames, className }: MonthPickerProps) {
  const current = parse(value);
  const [year, setYear] = useState(current.year);
  const [open, setOpen] = useState(false);

  const shift = (delta: number) => {
    const total = current.year * 12 + (current.month - 1) + delta;
    onChange(format(Math.floor(total / 12), (total % 12) + 1));
  };

  return (
    <div className={cn("inline-flex h-8 items-stretch overflow-hidden rounded-sm border border-border bg-surface", className)}>
      <button
        type="button"
        onClick={() => shift(-1)}
        aria-label="Mese precedente"
        className="flex w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
      </button>

      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (next) setYear(current.year);
          setOpen(next);
        }}
      >
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            className="min-w-32 border-x border-border px-3 text-label font-medium capitalize transition-colors hover:bg-surface-sunken"
          >
            {monthNames[current.month - 1]} {current.year}
          </button>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="center"
            sideOffset={6}
            className="z-50 w-56 rounded-md border border-border bg-popover p-2 text-foreground shadow-popover"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <Button variant="ghost" size="icon-sm" onClick={() => setYear((y) => y - 1)} aria-label="Anno precedente">
                <ChevronLeft aria-hidden />
              </Button>
              <span className="text-label font-semibold tabular-nums">{year}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setYear((y) => y + 1)} aria-label="Anno successivo">
                <ChevronRight aria-hidden />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-0.5">
              {monthNames.map((name, index) => {
                const active = year === current.year && index + 1 === current.month;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onChange(format(year, index + 1));
                      setOpen(false);
                    }}
                    className={cn(
                      "rounded-xs px-2 py-1.5 text-label capitalize transition-colors",
                      active ? "bg-primary text-primary-foreground" : "hover:bg-surface-sunken",
                    )}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      <button
        type="button"
        onClick={() => shift(1)}
        aria-label="Mese successivo"
        className="flex w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground"
      >
        <ChevronRight className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
