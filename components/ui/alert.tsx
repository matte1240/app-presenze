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

const variantStyles: Record<AlertVariant, { container: string; icon: string }> = {
  error: {
    container: "bg-destructive/10 border-destructive/20 text-destructive",
    icon: "text-destructive",
  },
  success: {
    container: "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400",
    icon: "text-green-600 dark:text-green-400",
  },
  warning: {
    container: "bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400",
    icon: "text-yellow-600 dark:text-yellow-400",
  },
  info: {
    container: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400",
    icon: "text-blue-600 dark:text-blue-400",
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
          "rounded-lg border p-4",
          styles.container,
          className
        )}
        {...props}
      >
        <div className="flex items-start gap-3">
          <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", styles.icon)} />
          <div className="flex-1 min-w-0">
            {title && (
              <h5 className="font-medium mb-1">{title}</h5>
            )}
            <div className="text-sm">{children}</div>
          </div>
          {dismissible && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className={cn(
                "shrink-0 rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10",
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
