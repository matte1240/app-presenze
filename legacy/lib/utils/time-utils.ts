/**
 * Utility functions for time-related operations
 */

/**
 * Calculate hours between two time strings
 * @param start Start time in HH:MM format
 * @param end End time in HH:MM format
 * @returns Number of hours between start and end
 */
export function calculateHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return Math.max(0, (endMinutes - startMinutes) / 60);
}

/**
 * Generate time options from 06:00 to 22:00 with 30-minute intervals
 * @returns Array of time strings in HH:MM format
 */
export function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let hour = 6; hour <= 22; hour++) {
    options.push(`${hour.toString().padStart(2, "0")}:00`);
    if (hour < 22) {
      options.push(`${hour.toString().padStart(2, "0")}:30`);
    }
  }
  return options;
}

/**
 * Pre-generated time options for use in components
 */
export const TIME_OPTIONS = generateTimeOptions();
