import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
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

export function MonthPicker({ value, onChange, monthNames, className }: MonthPickerProps) {
  const current = parse(value);
  const [year, setYear] = useState(current.year);
  const [open, setOpen] = useState(false);

  const shift = (delta: number) => {
    const total = current.year * 12 + (current.month - 1) + delta;
    onChange(format(Math.floor(total / 12), (total % 12) + 1));
  };

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Mese precedente">
        <ChevronLeft aria-hidden />
      </Button>

      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (next) setYear(current.year);
          setOpen(next);
        }}
      >
        <PopoverPrimitive.Trigger asChild>
          <Button variant="outline" className="min-w-44 justify-between">
            <span className="flex items-center gap-2">
              <Calendar aria-hidden />
              {monthNames[current.month - 1]} {current.year}
            </span>
          </Button>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={6}
            className="z-50 w-64 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-elevation-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)} aria-label="Anno precedente">
                <ChevronLeft aria-hidden />
              </Button>
              <span className="text-sm font-semibold">{year}</span>
              <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)} aria-label="Anno successivo">
                <ChevronRight aria-hidden />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-1">
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
                      "rounded-md px-2 py-1.5 text-[13px] capitalize transition-colors",
                      active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
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

      <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Mese successivo">
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
