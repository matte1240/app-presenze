import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "destructive";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

/**
 * `primary` is the only variant that spends the accent colour. Everything else
 * is drawn in neutrals, which is what lets a single accented button on screen
 * actually mean "this is the action".
 */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95",
  secondary: "bg-surface-sunken text-foreground hover:bg-border/60",
  ghost: "text-muted-foreground hover:bg-surface-sunken hover:text-foreground",
  outline: "border border-border bg-surface text-foreground hover:bg-surface-sunken",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-micro",
  md: "h-8 gap-1.5 px-3 text-label",
  lg: "h-9 gap-2 px-4 text-body",
  icon: "size-8 p-0",
  "icon-sm": "size-7 p-0",
};

export const buttonClasses = (variant: Variant = "primary", size: Size = "md", className?: string) =>
  cn(
    "inline-flex shrink-0 items-center justify-center rounded-sm font-medium whitespace-nowrap",
    "transition-colors duration-100 disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:size-3.5 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Render as the single child element instead, for links styled as buttons. */
  asChild?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  asChild = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={buttonClasses(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </Comp>
  );
}
