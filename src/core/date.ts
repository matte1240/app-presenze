/**
 * Calendar dates as plain `YYYY-MM-DD` strings.
 *
 * The previous implementation stored work dates as UTC-midnight `Date` objects
 * and then read them back with local getters, which quietly produced the wrong
 * weekday for anyone west of Greenwich. A civil date has no time and no zone,
 * so it is modelled here as the string it actually is; a `Date` is only ever
 * constructed internally, in UTC, to borrow the calendar arithmetic.
 */

declare const localDateBrand: unique symbol;
export type LocalDate = string & { readonly [localDateBrand]: true };

declare const yearMonthBrand: unique symbol;
export type YearMonth = string & { readonly [yearMonthBrand]: true };

/** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const pad = (n: number) => String(n).padStart(2, "0");

export function isLocalDate(value: string): value is LocalDate {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  // Round-trips only for dates that exist: 2025-02-30 lands on March.
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

export function toLocalDate(value: string): LocalDate {
  if (!isLocalDate(value)) throw new RangeError(`Data non valida: ${value}`);
  return value;
}

export function localDate(year: number, month: number, day: number): LocalDate {
  return toLocalDate(`${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`);
}

/** Parts of a date, without ever leaving the UTC calendar. */
export function partsOf(date: LocalDate): { year: number; month: number; day: number } {
  const m = DATE_RE.exec(date)!;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function toUtc(date: LocalDate): Date {
  const { year, month, day } = partsOf(date);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtc(d: Date): LocalDate {
  return localDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function weekdayOf(date: LocalDate): Weekday {
  return toUtc(date).getUTCDay() as Weekday;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Negative when `a` is earlier, so it can be handed straight to `sort`. */
export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Inclusive on both ends; empty when `to` precedes `from`. */
export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; compareDates(d, to) <= 0; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthOf(date: LocalDate): YearMonth {
  return date.slice(0, 7) as YearMonth;
}

export function toYearMonth(value: string): YearMonth {
  if (!MONTH_RE.test(value)) throw new RangeError(`Mese non valido: ${value}`);
  return value as YearMonth;
}

export function monthRange(month: YearMonth): { from: LocalDate; to: LocalDate } {
  const year = Number(month.slice(0, 4));
  const mo = Number(month.slice(5, 7));
  const from = localDate(year, mo, 1);
  const lastDay = new Date(Date.UTC(year, mo, 0)).getUTCDate();
  return { from, to: localDate(year, mo, lastDay) };
}

/**
 * Today in a named IANA zone. `en-CA` is the shortest route to ISO order and
 * keeps the whole thing free of a date library.
 */
export function todayIn(timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return toLocalDate(parts);
}

/** `2026-08-23` → `23/08/2026`. */
export function formatDateIt(date: LocalDate): string {
  const { year, month, day } = partsOf(date);
  return `${pad(day)}/${pad(month)}/${year}`;
}
