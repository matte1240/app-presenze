import * as LabelPrimitive from "@radix-ui/react-label";
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../cn";

const control = cn(
  "w-full rounded-md border border-input bg-card px-3 text-sm text-foreground",
  "placeholder:text-muted-foreground/70 transition-colors",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "aria-[invalid=true]:border-destructive",
);

export function Label({ className, ...props }: LabelPrimitive.LabelProps) {
  return <LabelPrimitive.Root className={cn("text-[13px] font-medium text-foreground", className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-20 py-2 leading-relaxed", className)} {...props} />;
}

/** A native select: one control, no popover, keyboard support for free. */
export function NativeSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        control,
        "h-9 appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9",
        "bg-[image:var(--chevron)]",
        className,
      )}
      style={{
        // Inlined so the arrow follows the text colour instead of being a
        // hard-coded grey the way it was in the previous design system.
        ["--chevron" as string]:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    />
  );
}

/**
 * Wraps a control with its label, hint and error, and hands the child the ids
 * it needs so the association is never left to chance.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-describedby": string | undefined; "aria-invalid": boolean }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": Boolean(error) })}
      {error ? (
        <p id={`${id}-error`} className="text-[12px] text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
