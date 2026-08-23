import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks interaction. */
  loading?: boolean;
  /** Rendered before the label, hidden while loading. */
  icon?: ReactNode;
}

/*
 * Buttons carry their weight through surface and border, not shadow. The only
 * filled control on a given screen should be its primary action — everything
 * else steps down to outline or ghost.
 */
const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-elevation-1 hover:bg-primary/90 active:bg-primary/95",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/70 active:bg-secondary",
  outline:
    "border border-border bg-card text-foreground shadow-elevation-1 hover:bg-accent hover:text-accent-foreground",
  ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  destructive:
    "bg-destructive text-destructive-foreground shadow-elevation-1 hover:bg-destructive/90",
  link: "text-primary underline-offset-4 hover:underline",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-sm px-3 text-[13px]",
  md: "h-9 gap-2 rounded-md px-4 text-sm",
  lg: "h-11 gap-2 rounded-md px-6 text-[15px]",
  icon: "h-9 w-9 rounded-md",
};

/**
 * Shared class string, so an anchor that should look like a button can borrow
 * the styling without nesting a <Link> inside a <button> — which is invalid
 * HTML and breaks keyboard activation.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap font-medium",
    "transition-[background-color,color,border-color,opacity] duration-150 ease-[var(--ease-out-quart)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    variantStyles[variant],
    sizeStyles[size],
    className
  );
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={buttonClasses({ variant, size, className })}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" /> : icon}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
