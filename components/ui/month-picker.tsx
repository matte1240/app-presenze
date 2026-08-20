"use client";

import { cn } from "@/lib/utils";
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
            "w-full cursor-pointer rounded-lg border border-input bg-background px-4 py-3 text-left text-sm font-medium outline-none transition",
            "hover:bg-muted focus:ring-2 focus:ring-primary/20",
            "flex items-center justify-between gap-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className={cn(!value && "text-muted-foreground")}>
            {displayValue}
          </span>
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-2 w-full min-w-[280px] bg-popover border border-border rounded-lg shadow-lg p-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Year selector */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Anno
              </label>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm transition-all hover:bg-accent/50 focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Month grid */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Mese
              </label>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS.map((monthName, idx) => {
                  const isSelected = selectedMonth === idx + 1;
                  return (
                    <button
                      key={monthName}
                      type="button"
                      onClick={() => handleMonthSelect(idx)}
                      className={cn(
                        "px-3 py-2 text-sm font-semibold rounded-md transition",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground hover:bg-muted/80"
                      )}
                    >
                      {monthName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full px-3 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-md transition"
            >
              Chiudi
            </button>
          </div>
        )}
      </div>
    );
  }
);
MonthPicker.displayName = "MonthPicker";

export { MonthPicker };
