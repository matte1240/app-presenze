import { cn } from "@/lib/utils";
import {
  forwardRef,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useId,
} from "react";

/*
 * Form controls share one resting state: a hairline border on the card
 * surface, no inner shadow. Emphasis arrives only on focus, through the
 * product-wide focus ring.
 */
const fieldBase =
  "w-full rounded-md border border-input bg-card text-foreground shadow-elevation-1 " +
  "placeholder:text-muted-foreground/70 " +
  "transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quart)] " +
  "hover:border-muted-foreground/30 " +
  "focus:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-input";

const fieldSize = "h-9 px-3 text-sm";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Renders the control in its error state and wires up aria-invalid. */
  invalid?: boolean;
  /** Icon rendered inside the field, on the leading edge. */
  icon?: ReactNode;
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, icon, ...props }, ref) => {
    const field = (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          fieldBase,
          fieldSize,
          icon && "pl-9",
          invalid && "border-destructive focus:border-destructive focus-visible:ring-destructive/30",
          className
        )}
        {...props}
      />
    );

    if (!icon) return field;

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
          {icon}
        </span>
        {field}
      </div>
    );
  }
);
Input.displayName = "Input";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBase,
        "min-h-20 px-3 py-2 text-sm",
        invalid && "border-destructive focus:border-destructive focus-visible:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBase,
        fieldSize,
        "cursor-pointer appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9",
        // Chevron drawn as a data URI so the control needs no wrapper element.
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%23888%22 stroke-width=%221.75%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22m4 6 4 4 4-4%22/%3E%3C/svg%3E')]",
        invalid && "border-destructive focus:border-destructive",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "block text-sm font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
);
Label.displayName = "Label";

/**
 * Label, control and message as one unit, so spacing and the
 * label→control→error association are consistent across every form.
 */
export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; "aria-describedby"?: string }) => ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const messageId = error || hint ? `${id}-message` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-describedby": messageId })}
      {(error || hint) && (
        <p
          id={messageId}
          className={cn(
            "text-xs",
            error ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}

export { Input, Textarea, Select, Label };
