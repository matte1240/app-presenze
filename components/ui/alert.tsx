import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { forwardRef, HTMLAttributes, ReactNode } from "react";

type AlertVariant = "error" | "success" | "warning" | "info";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  /** The variant/type of alert */
  variant?: AlertVariant;
  /** The alert message */
  children: ReactNode;
  /** Optional title for the alert */
  title?: string;
  /** Show dismiss button */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
}

/*
 * Driven by the semantic status tokens rather than raw Tailwind palette
 * colours, so alerts stay legible in both themes and follow the same green /
 * amber / red vocabulary as badges and calendar cells.
 */
const variantStyles: Record<AlertVariant, { container: string; icon: string }> = {
  error: {
    container: "border-destructive/25 bg-destructive-subtle text-destructive",
    icon: "text-destructive",
  },
  success: {
    container: "border-success/25 bg-success-subtle text-success",
    icon: "text-success",
  },
  warning: {
    container: "border-warning/25 bg-warning-subtle text-warning",
    icon: "text-warning",
  },
  info: {
    container: "border-info/25 bg-info-subtle text-info",
    icon: "text-info",
  },
};

const variantIcons: Record<AlertVariant, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
};

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      variant = "info",
      children,
      title,
      dismissible = false,
      onDismiss,
      ...props
    },
    ref
  ) => {
    const styles = variantStyles[variant];
    const Icon = variantIcons[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "rounded-md border p-3.5",
          styles.container,
          className
        )}
        {...props}
      >
        <div className="flex items-start gap-2.5">
          <Icon className={cn("mt-0.5 size-4 shrink-0", styles.icon)} />
          <div className="flex-1 min-w-0">
            {title && (
              <h5 className="mb-0.5 text-sm font-semibold">{title}</h5>
            )}
            <div className="text-[13px] leading-relaxed">{children}</div>
          </div>
          {dismissible && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className={cn(
                "shrink-0 cursor-pointer rounded-sm p-1 transition-colors hover:bg-foreground/10",
                styles.icon
              )}
              aria-label="Chiudi"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

export { Alert };
