import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "../cn";

/** Horizontal overflow scrolls inside the wrapper, never on the page. */
export function TableWrapper({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("scrollbar-slim w-full overflow-x-auto rounded-md border border-border bg-surface", className)}>
      {children}
    </div>
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full caption-bottom text-body", className)} {...props} />;
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-border bg-surface-sunken/60", className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("border-b border-border transition-colors hover:bg-surface-sunken/50", className)} {...props} />
  );
}

/** Column headings are small caps: they label, they do not compete. */
export function TH({ numeric, className, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        "h-8 px-3 text-left align-middle text-micro font-medium uppercase tracking-[0.04em] text-muted-foreground",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ numeric, className, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td className={cn("h-9 px-3 align-middle", numeric && "text-right tabular-nums", className)} {...props} />;
}
