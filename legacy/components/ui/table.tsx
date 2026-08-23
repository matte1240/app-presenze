import { cn } from "@/lib/utils";
import {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

/**
 * Table shell: rounded surface, hairline edge, and a horizontal scroll area
 * that shows a slim scrollbar rather than hiding it.
 */
export function TableWrapper({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1",
        className
      )}
      {...props}
    >
      <div className="scrollbar-slim overflow-x-auto">{children}</div>
    </div>
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full caption-bottom border-collapse text-sm", className)}
      {...props}
    />
  );
}

export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-muted/40", className)} {...props} />;
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Adds hover feedback and a pointer cursor for navigable rows. */
  interactive?: boolean;
}

export function TableRow({ className, interactive, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        "border-b border-border/70 transition-colors duration-100",
        interactive && "cursor-pointer hover:bg-muted/50",
        className
      )}
      {...props}
    />
  );
}

export interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Right-aligns the column, for numbers. */
  numeric?: boolean;
}

/*
 * Sentence case at normal tracking. The uppercase, letter-spaced header is the
 * single clearest tell of a dashboard designed a decade ago, and it costs
 * legibility for nothing.
 */
export function TableHead({ className, numeric, ...props }: TableHeadProps) {
  return (
    <th
      scope="col"
      className={cn(
        "h-10 px-4 text-left align-middle text-xs font-medium text-muted-foreground",
        numeric && "text-right tabular-nums",
        className
      )}
      {...props}
    />
  );
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export function TableCell({ className, numeric, ...props }: TableCellProps) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle text-foreground",
        numeric && "text-right tabular-nums",
        className
      )}
      {...props}
    />
  );
}

/** Header strip above a table: title, optional description, trailing actions. */
export function TableToolbar({
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
        "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
