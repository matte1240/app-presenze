import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/**
 * The screen a user sees before they have any data — which, for a product
 * being demoed, is often the first screen they see at all. It states what the
 * area is for and offers the action that fills it, instead of a bare "Nessun
 * risultato".
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Tighter spacing, for use inside a table or a small panel. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-6 py-10" : "gap-3 px-6 py-16",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-muted text-muted-foreground",
            compact ? "size-9 [&_svg]:size-4" : "size-12 [&_svg]:size-5"
          )}
        >
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p
          className={cn(
            "font-medium text-foreground",
            compact ? "text-sm" : "text-base"
          )}
        >
          {title}
        </p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
