import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1.5 px-6 py-14 text-center", className)}>
      {Icon ? <Icon className="mb-1 size-5 text-muted-foreground/60" aria-hidden /> : null}
      <p className="text-label font-medium">{title}</p>
      {description ? <p className="max-w-xs text-micro text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
