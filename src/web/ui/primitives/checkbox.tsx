import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "../cn";

/**
 * The design system this replaces had no checkbox at all, so a raw input with
 * an accent-colour utility was copy-pasted into six different files.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  hint,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        disabled={disabled}
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input bg-card",
          "transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary",
          "data-[state=checked]:text-primary-foreground disabled:opacity-50",
        )}
      >
        <CheckboxPrimitive.Indicator>
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <div className="min-w-0">
        <label htmlFor={id} className={cn("text-[13px] leading-tight", disabled && "opacity-60")}>
          {label}
        </label>
        {hint ? <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}
