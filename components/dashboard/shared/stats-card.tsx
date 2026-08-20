import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ColorType = "green" | "blue" | "purple" | "red" | "orange";

type StatsCardProps = {
  title: string;
  value: string | number;
  icon: ReactNode;
  color: ColorType;
  isLoading?: boolean;
  className?: string;
};

const colorMap: Record<ColorType, { bg: string; text: string }> = {
  green: {
    bg: "bg-emerald-100 dark:bg-emerald-900/20",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/20",
    text: "text-blue-600 dark:text-blue-400",
  },
  purple: {
    bg: "bg-violet-100 dark:bg-violet-900/20",
    text: "text-violet-600 dark:text-violet-400",
  },
  red: {
    bg: "bg-rose-100 dark:bg-rose-900/20",
    text: "text-rose-600 dark:text-rose-400",
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-900/20",
    text: "text-orange-600 dark:text-orange-400",
  },
};

export default function StatsCard({
  title,
  value,
  icon,
  color,
  isLoading = false,
  className,
}: StatsCardProps) {
  const colors = colorMap[color];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/50 bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-center gap-4">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-110",
            colors.bg
          )}
        >
          <div className={cn("h-6 w-6", colors.text)}>{icon}</div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">
            {isLoading ? (
              <span className="animate-pulse text-muted-foreground">...</span>
            ) : (
              value
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
