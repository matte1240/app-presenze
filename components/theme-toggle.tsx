"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Cambia tema"
      className={cn(
        // `relative` is required: the two icons are stacked and cross-faded,
        // and without it the absolutely positioned one escapes the button.
        "relative inline-flex size-9 cursor-pointer items-center justify-center rounded-md",
        "transition-colors hover:bg-accent hover:text-accent-foreground",
        className
      )}
    >
      <Sun className="size-4 rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Cambia tema</span>
    </button>
  );
}
