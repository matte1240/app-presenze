"use client";

import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/input";
import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect, forwardRef } from "react";

export interface MonthPickerProps {
  /** Current value in "YYYY-MM" format */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Custom year range (default: current year ± 3) */
  yearRange?: { start: number; end: number };
  /** Custom class name for the trigger button */
  className?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

const MONTHS = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic"
];

const MONTHS_FULL = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

const MonthPicker = forwardRef<HTMLDivElement, MonthPickerProps>(
  (
    {
      value,
      onChange,
      yearRange,
      className,
      disabled = false,
      placeholder = "Seleziona un mese",
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate year range
    const currentYear = new Date().getFullYear();
    const startYear = yearRange?.start ?? currentYear - 3;
    const endYear = yearRange?.end ?? currentYear + 3;
    const years = Array.from(
      { length: endYear - startYear + 1 },
      (_, i) => startYear + i
    ).reverse();

    // Parse current value
    const [selectedYear, selectedMonth] = value
      ? value.split("-").map(Number)
      : [currentYear, new Date().getMonth() + 1];

    // Close on click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);

    // Close on escape
    useEffect(() => {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener("keydown", handleEscape);
      }
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }, [isOpen]);

    const handleYearChange = (newYear: number) => {
      onChange(`${newYear}-${String(selectedMonth).padStart(2, "0")}`);
    };

    const handleMonthSelect = (monthIndex: number) => {
      const newMonth = String(monthIndex + 1).padStart(2, "0");
      onChange(`${selectedYear}-${newMonth}`);
      setIsOpen(false);
    };

    const displayValue = value
      ? `${MONTHS_FULL[selectedMonth - 1]} ${selectedYear}`
      : placeholder;

    return (
      <div ref={containerRef} className="relative">
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input",
            "bg-card px-3 text-left text-sm shadow-elevation-1 outline-none",
            "transition-[border-color] duration-150 hover:border-muted-foreground/30",
            "disabled:cursor-not-allowed disabled:opacity-60",
            className
          )}
        >
          <span className={cn(!value && "text-muted-foreground")}>
            {displayValue}
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1.5 w-full min-w-[268px] rounded-lg border border-border bg-popover p-3 shadow-elevation-3 animate-in fade-in zoom-in-95 duration-150">
            <Select
              aria-label="Anno"
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="mb-2"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>

            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((monthName, idx) => {
                const isSelected = selectedMonth === idx + 1;
                return (
                  <button
                    key={monthName}
                    type="button"
                    onClick={() => handleMonthSelect(idx)}
                    className={cn(
                      "cursor-pointer rounded-sm px-2 py-1.5 text-[13px] font-medium transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {monthName}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
);
MonthPicker.displayName = "MonthPicker";

export { MonthPicker };
