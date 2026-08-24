import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../cn";
import { Skeleton } from "./skeleton";

type Tone = "neutral" | "primary" | "success" | "warning" | "info";

const TONES: Record<Tone, string> = {
  neutral: "text-muted-foreground bg-muted",
  primary: "text-primary bg-primary/10",
  success: "text-success bg-success-subtle",
  warning: "text-warning bg-warning-subtle",
  info: "text-info bg-info-subtle",
};

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  loading = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 shadow-elevation-1", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          )}
          {hint ? <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className={cn("flex size-8 items-center justify-center rounded-md", TONES[tone])}>
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
    </div>
  );
}
