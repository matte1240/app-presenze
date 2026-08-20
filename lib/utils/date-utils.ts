import { isHoliday } from "./holiday-utils";

/**
 * Utility functions for date-related operations
 */

/**
 * Check if a date is editable based on business rules
 * - Must be within the last 2 calendar days (today, yesterday, day before yesterday)
 * - Must not be in the future
 * - Sundays are blocked for employees (unless canWorkSunday is true)
 * 
 * @param date The date to check
 * @param isAdmin Whether the current user is an admin (bypasses all restrictions)
 * @param canWorkSunday Whether the employee is allowed to work on Sundays
 * @returns true if the date is editable, false otherwise
 */
export function isDateEditable(date: Date, isAdmin = false, canWorkSunday = false): boolean {
  // Admins can edit any date, past or future
  if (isAdmin) {
    return true;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  // Employees can only edit today and the 2 previous calendar days
  const earliestEditableDate = new Date(today);
  earliestEditableDate.setDate(today.getDate() - 2);
  
  // Block Sundays (0 = Sunday) unless allowed, and Holidays always for employees
  if (!isAdmin) {
    const dayOfWeek = checkDate.getDay();
    if ((dayOfWeek === 0 && !canWorkSunday) || isHoliday(checkDate)) {
      return false;
    }
  }
  
  return checkDate >= earliestEditableDate && checkDate <= today;
}

/**
 * Format a Date object to database-compatible string format (YYYY-MM-DD)
 * Uses UTC components to avoid timezone-related day shifts.
 *
 * @param date The date to format
 * @returns String in YYYY-MM-DD format
 * @example
 * formatDateForDb(new Date('2026-02-12T15:30:00Z')) // "2026-02-12"
 */
export function formatDateForDb(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
