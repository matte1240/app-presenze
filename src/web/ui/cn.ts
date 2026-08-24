import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The type scale is named for roles rather than sizes, which means the
 * font-size utilities are `text-body`, `text-label` and so on — and those
 * collide with text *colour* utilities under tailwind-merge's default rules.
 *
 * Left unconfigured it treats `text-label` and `text-primary-foreground` as the
 * same class group and silently drops one of them. That is not theoretical: it
 * had stripped the foreground colour off every primary button, leaving black
 * text on the accent blue at a 3.6:1 contrast ratio. Naming the scale here
 * keeps the two groups apart.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["micro", "label", "body", "title", "display", "metric"] }],
    },
  },
});

/** Merges class lists so a caller's utility always wins over a default. */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
