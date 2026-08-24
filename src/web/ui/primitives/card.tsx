import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

/** A hairline, not a shadow. Panels sit on the page rather than above it. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("overflow-hidden rounded-md border border-border bg-surface text-foreground", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border bg-surface-sunken/60 px-4 py-2.5",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="truncate text-label font-semibold">{title}</h3>
        {description ? <p className="mt-0.5 text-micro text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
