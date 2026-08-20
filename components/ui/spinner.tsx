import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { forwardRef, HTMLAttributes } from "react";

type SpinnerSize = "sm" | "md" | "lg" | "xl";

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Optional label for accessibility */
  label?: string;
}

const sizeStyles: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = "md", label = "Caricamento...", ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-label={label}
        className={cn("inline-flex items-center justify-center", className)}
        {...props}
      >
        <Loader2 className={cn("animate-spin text-muted-foreground", sizeStyles[size])} />
        <span className="sr-only">{label}</span>
      </div>
    );
  }
);
Spinner.displayName = "Spinner";

export { Spinner };
