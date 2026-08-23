/**
 * Wall-clock times as `HH:MM` strings, and the arithmetic the timesheet needs.
 *
 * Everything here works in minutes and only converts to hours at the edge, so
 * a half-hour shift can never turn into 0.4999999999999999 in a payroll total.
 */

declare const clockBrand: unique symbol;
export type Clock = string & { readonly [clockBrand]: true };

export interface Span {
  readonly start: Clock;
  readonly end: Clock;
}

const CLOCK_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isClock(value: string): value is Clock {
  return CLOCK_RE.test(value);
}

export function toClock(value: string): Clock {
  if (!isClock(value)) throw new RangeError(`Orario non valido: ${value}`);
  return value;
}

export function minutesOf(time: Clock): number {
  const m = CLOCK_RE.exec(time)!;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function fromMinutes(minutes: number): Clock {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return toClock(
    `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`,
  );
}

/** Two decimals is the resolution payroll actually uses; float dust is noise. */
export function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

export function span(start: string, end: string): Span {
  return { start: toClock(start), end: toClock(end) };
}

/**
 * Length of a span in hours. A span that ends before it starts is treated as
 * empty rather than negative — there is no overnight shift in this product,
 * and silently wrapping to the next day would be worse than refusing.
 */
export function spanHours(s: Span | null | undefined): number {
  if (!s) return 0;
  return roundHours(Math.max(0, minutesOf(s.end) - minutesOf(s.start)) / 60);
}

/** Hours the two spans have in common; 0 when they merely touch. */
export function overlapHours(a: Span | null | undefined, b: Span | null | undefined): number {
  if (!a || !b) return 0;
  const start = Math.max(minutesOf(a.start), minutesOf(b.start));
  const end = Math.min(minutesOf(a.end), minutesOf(b.end));
  return roundHours(Math.max(0, end - start) / 60);
}

/**
 * The pickers offer a fixed grid rather than a free text field: attendance is
 * recorded to the half hour, and a dropdown removes a whole class of typos.
 */
export function clockOptions(from = "06:00", to = "22:00", stepMinutes = 30): Clock[] {
  const out: Clock[] = [];
  for (let m = minutesOf(toClock(from)); m <= minutesOf(toClock(to)); m += stepMinutes) {
    out.push(fromMinutes(m));
  }
  return out;
}
