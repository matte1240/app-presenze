import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges class lists so a caller's utility always wins over a default. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
