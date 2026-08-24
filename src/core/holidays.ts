/**
 * Italian public holidays, computed rather than looked up.
 *
 * The previous version pulled in `date-holidays`, roughly two megabytes of
 * data for every country on earth, to answer a question about one. The Italian
 * set is nine fixed dates plus Easter Monday, and Easter is a closed-form
 * calculation — so this is a few dozen lines with no dependency and no cache
 * invalidation story.
 */
import { localDate, monthOf, partsOf, type LocalDate } from "./date";

export interface HolidayConfig {
  /** Local patron saint days as `MM-DD`, e.g. `["06-24"]` for Turin. */
  readonly patronDays?: readonly string[];
}

const FIXED: ReadonlyArray<readonly [string, string]> = [
  ["01-01", "Capodanno"],
  ["01-06", "Epifania"],
  ["04-25", "Festa della Liberazione"],
  ["05-01", "Festa dei Lavoratori"],
  ["06-02", "Festa della Repubblica"],
  ["08-15", "Ferragosto"],
  ["11-01", "Ognissanti"],
  ["12-08", "Immacolata Concezione"],
  ["12-25", "Natale"],
  ["12-26", "Santo Stefano"],
];

/** Gregorian Easter, Meeus/Jones/Butcher. */
export function easterOf(year: number): LocalDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return localDate(year, Math.floor(n / 31), (n % 31) + 1);
}

const cache = new Map<string, ReadonlyMap<LocalDate, string>>();

function keyOf(year: number, config: HolidayConfig): string {
  return `${year}|${(config.patronDays ?? []).join(",")}`;
}

export function holidaysOf(year: number, config: HolidayConfig = {}): ReadonlyMap<LocalDate, string> {
  const key = keyOf(year, config);
  const hit = cache.get(key);
  if (hit) return hit;

  const map = new Map<LocalDate, string>();
  for (const [md, name] of FIXED) {
    map.set(localDate(year, Number(md.slice(0, 2)), Number(md.slice(3, 5))), name);
  }

  const easter = easterOf(year);
  const { month, day } = partsOf(easter);
  map.set(easter, "Pasqua");
  // Easter Monday: adding a day can roll into the next month (31 March → 1 April).
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  map.set(
    localDate(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate()),
    "Lunedì dell'Angelo",
  );

  for (const md of config.patronDays ?? []) {
    map.set(localDate(year, Number(md.slice(0, 2)), Number(md.slice(3, 5))), "Santo patrono");
  }

  cache.set(key, map);
  return map;
}

export function isHoliday(date: LocalDate, config: HolidayConfig = {}): boolean {
  return holidaysOf(Number(monthOf(date).slice(0, 4)), config).has(date);
}

export function holidayName(date: LocalDate, config: HolidayConfig = {}): string | null {
  return holidaysOf(Number(monthOf(date).slice(0, 4)), config).get(date) ?? null;
}
