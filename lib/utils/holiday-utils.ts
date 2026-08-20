import Holidays from 'date-holidays';
import { staticBranding } from '@/branding';

/**
 * Public-holiday calendar for the configured country.
 *
 * This module runs on both the server and the client, so it reads the static
 * branding (plus the NEXT_PUBLIC_ override, which is inlined at build time)
 * rather than the server-only resolver.
 */
const { holidayCountry, holidayState, holidayRegion } = staticBranding.regional;

const country =
  process.env.NEXT_PUBLIC_BRAND_HOLIDAY_COUNTRY?.trim() || holidayCountry;

// Use a singleton instance to avoid creating multiple Holidays objects.
// date-holidays takes country/state/region positionally, so pass only as many
// levels as are actually configured.
const hd = holidayState
  ? holidayRegion
    ? new Holidays(country, holidayState, holidayRegion)
    : new Holidays(country, holidayState)
  : new Holidays(country);

// Cache for holiday lookups by year to avoid repeated calculations
const holidayCache = new Map<number, Map<string, { isHoliday: boolean; name?: string }>>();

export type Holiday = {
  date: string;
  start: Date;
  end: Date;
  name: string;
  type: string;
};

/**
 * Get all holidays for a given year
 */
export function getHolidays(year: number): Holiday[] {
  return hd.getHolidays(year);
}

/**
 * Check if a date is a holiday (cached for performance)
 */
export function isHoliday(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const dateKey = formatDateKey(dateObj);
  
  // Check cache first
  const yearCache = getOrCreateYearCache(year);
  const cached = yearCache.get(dateKey);
  if (cached !== undefined) {
    return cached.isHoliday;
  }
  
  // Calculate and cache
  const result = !!hd.isHoliday(date);
  yearCache.set(dateKey, { isHoliday: result });
  return result;
}

/**
 * Get the name of a holiday if the date is a holiday (cached for performance)
 */
export function getHolidayName(date: Date | string): string | undefined {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const dateKey = formatDateKey(dateObj);
  
  // Check cache first - return early if we have cached data
  const yearCache = getOrCreateYearCache(year);
  const cached = yearCache.get(dateKey);
  if (cached !== undefined) {
    return cached.name;
  }
  
  // Calculate and cache
  const holiday = hd.isHoliday(date);
  let name: string | undefined;
  
  if (holiday) {
    // date-holidays returns an array of holidays or false/undefined
    // but the type definition says it returns Holiday | false
    // Let's handle the return type safely
    if (Array.isArray(holiday)) {
      name = holiday[0].name;
    } else {
      name = (holiday as { name: string }).name;
    }
  }
  
  yearCache.set(dateKey, { isHoliday: !!holiday, name });
  return name;
}

/**
 * Helper to format date as YYYY-MM-DD for cache key using local time components
 * This avoids issues where toISOString() shifts the date for local midnight (e.g. UTC+1 -> UTC previous day)
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get or create the cache for a specific year
 */
function getOrCreateYearCache(year: number): Map<string, { isHoliday: boolean; name?: string }> {
  let yearCache = holidayCache.get(year);
  if (!yearCache) {
    yearCache = new Map();
    holidayCache.set(year, yearCache);
  }
  return yearCache;
}

/**
 * Clear the cache (useful for testing or if memory becomes a concern)
 */
export function clearHolidayCache(): void {
  holidayCache.clear();
}
