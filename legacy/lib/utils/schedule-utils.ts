/**
 * Shared utility functions for user working schedule management
 * Safe for both client and server components (no database imports)
 */

import { WorkingScheduleDTO } from "@/types/models";
import { calculateHours } from "./time-utils";

// Default working schedule: Mon-Fri 8-12, 14-18 (8 hours/day)
export const DEFAULT_SCHEDULE = {
  morningStart: "08:00",
  morningEnd: "12:00",
  afternoonStart: "14:00",
  afternoonEnd: "18:00",
  totalHours: 8,
};

// Days that are working days by default (Monday to Friday)
export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri

/**
 * Calculate total hours from shift times
 */
export function calculateTotalHoursFromShifts(
  morningStart: string | null,
  morningEnd: string | null,
  afternoonStart: string | null,
  afternoonEnd: string | null
): number {
  let total = 0;
  if (morningStart && morningEnd) {
    total += calculateHours(morningStart, morningEnd);
  }
  if (afternoonStart && afternoonEnd) {
    total += calculateHours(afternoonStart, afternoonEnd);
  }
  return total;
}

/**
 * Convert schedules to a map for quick lookup by dayOfWeek
 */
export function schedulesToMap(
  schedules: WorkingScheduleDTO[]
): Map<number, WorkingScheduleDTO> {
  return new Map(schedules.map((s) => [s.dayOfWeek, s]));
}

/**
 * Get base hours from schedule map (for client-side use)
 */
export function getBaseHoursFromScheduleMap(
  scheduleMap: Map<number, WorkingScheduleDTO>,
  dayOfWeek: number
): number {
  // Sunday is always 0
  if (dayOfWeek === 0) {
    return 0;
  }

  const schedule = scheduleMap.get(dayOfWeek);

  if (!schedule) {
    // Default: Mon-Fri = 8h, Sat = 0
    return DEFAULT_WORKING_DAYS.includes(dayOfWeek) ? 8 : 0;
  }

  if (!schedule.isWorkingDay) {
    return 0;
  }

  return schedule.totalHours;
}

/**
 * Get morning hours from schedule map for a specific day
 */
export function getMorningHoursFromScheduleMap(
  scheduleMap: Map<number, WorkingScheduleDTO>,
  dayOfWeek: number
): number {
  if (dayOfWeek === 0) return 0;

  const schedule = scheduleMap.get(dayOfWeek);

  if (!schedule || !schedule.isWorkingDay) {
    if (!schedule && DEFAULT_WORKING_DAYS.includes(dayOfWeek)) {
      return calculateHours(DEFAULT_SCHEDULE.morningStart, DEFAULT_SCHEDULE.morningEnd);
    }
    return 0;
  }

  if (schedule.morningStart && schedule.morningEnd) {
    return calculateHours(schedule.morningStart, schedule.morningEnd);
  }
  return 0;
}

/**
 * Get afternoon hours from schedule map for a specific day
 */
export function getAfternoonHoursFromScheduleMap(
  scheduleMap: Map<number, WorkingScheduleDTO>,
  dayOfWeek: number
): number {
  if (dayOfWeek === 0) return 0;

  const schedule = scheduleMap.get(dayOfWeek);

  if (!schedule || !schedule.isWorkingDay) {
    if (!schedule && DEFAULT_WORKING_DAYS.includes(dayOfWeek)) {
      return calculateHours(DEFAULT_SCHEDULE.afternoonStart, DEFAULT_SCHEDULE.afternoonEnd);
    }
    return 0;
  }

  if (schedule.afternoonStart && schedule.afternoonEnd) {
    return calculateHours(schedule.afternoonStart, schedule.afternoonEnd);
  }
  return 0;
}

/**
 * Check if day is working from schedule map (for client-side use)
 */
export function isWorkingDayFromScheduleMap(
  scheduleMap: Map<number, WorkingScheduleDTO>,
  dayOfWeek: number
): boolean {
  if (dayOfWeek === 0) {
    return false;
  }

  const schedule = scheduleMap.get(dayOfWeek);

  if (!schedule) {
    return DEFAULT_WORKING_DAYS.includes(dayOfWeek);
  }

  return schedule.isWorkingDay;
}
