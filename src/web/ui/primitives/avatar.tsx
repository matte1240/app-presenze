import { cn } from "../cn";

/** Initials on a neutral disc; no image upload exists in this product. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full",
        "bg-surface-sunken text-micro font-semibold text-muted-foreground",
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}
