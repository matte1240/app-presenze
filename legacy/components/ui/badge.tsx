import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

type BadgeVariant =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Renders a small leading dot in the badge colour. */
  dot?: boolean;
}

/*
 * Subtle fill plus a hairline ring, rather than a saturated pill: status has to
 * be readable at a glance in a dense table without shouting over the data.
 */
const variantStyles: Record<BadgeVariant, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  primary: "bg-primary/10 text-primary ring-primary/20",
  success: "bg-success-subtle text-success ring-success/25",
  warning: "bg-warning-subtle text-warning ring-warning/25",
  danger: "bg-destructive-subtle text-destructive ring-destructive/25",
  info: "bg-info-subtle text-info ring-info/25",
  outline: "bg-transparent text-foreground ring-border",
};

const dotStyles: Record<BadgeVariant, string> = {
  neutral: "bg-muted-foreground",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  outline: "bg-foreground",
};

export function Badge({
  className,
  variant = "neutral",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn("size-1.5 rounded-full", dotStyles[variant])} />
      )}
      {children}
    </span>
  );
}
