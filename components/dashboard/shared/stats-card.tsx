import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Semantic tones rather than raw colour names. The previous version hardcoded
 * Tailwind palette colours (`bg-emerald-100`, `text-violet-600`), which meant
 * these cards were the one part of the product a customer's branding could not
 * reach.
 */
type Tone = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

type StatsCardProps = {
  title: string;
  value: string | number;
  icon: ReactNode;
  tone?: Tone;
  /** Small qualifier under the value, e.g. a unit or a comparison. */
  hint?: string;
  isLoading?: boolean;
  className?: string;
};

const toneStyles: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-destructive-subtle text-destructive",
  info: "bg-info-subtle text-info",
  neutral: "bg-muted text-muted-foreground",
};

export default function StatsCard({
  title,
  value,
  icon,
  tone = "primary",
  hint,
  isLoading = false,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-elevation-1",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5",
            toneStyles[tone]
          )}
        >
          {icon}
        </span>
      </div>

      {/* The number is the point of the card, so it gets the weight and the
          tight tracking, and it never shifts width as it updates. */}
      <div className="mt-3">
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {value}
          </p>
        )}
        {hint && !isLoading && (
          <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    </div>
  );
}
