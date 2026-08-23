import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

/**
 * Placeholder that mirrors the shape of the content still loading.
 *
 * Prefer a skeleton over a spinner wherever the final layout is predictable:
 * it keeps the page from reflowing and reads as "almost there" rather than
 * "something is happening somewhere".
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-sm bg-muted", className)}
      {...props}
    />
  );
}

/** A block of stacked text lines, the last one deliberately short. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}
