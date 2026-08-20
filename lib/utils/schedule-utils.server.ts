/**
 * Server-only schedule utility functions that require database access
 */

import { prisma } from "@/lib/prisma";
import { WorkingScheduleDTO } from "@/types/models";
import {
  DEFAULT_SCHEDULE,
  DEFAULT_WORKING_DAYS,
  calculateTotalHoursFromShifts,
} from "./schedule-utils";

/**
 * Get all working schedules for a user
 */
export async function getUserSchedules(
  userId: string
): Promise<WorkingScheduleDTO[]> {
  const schedules = await prisma.workingSchedule.findMany({
    where: { userId },
    orderBy: { dayOfWeek: "asc" },
  });

  return schedules.map((s) => ({
    id: s.id,
    userId: s.userId,
    dayOfWeek: s.dayOfWeek,
    morningStart: s.morningStart,
    morningEnd: s.morningEnd,
    afternoonStart: s.afternoonStart,
    afternoonEnd: s.afternoonEnd,
    totalHours: parseFloat(s.totalHours.toString()),
    useManualHours: s.useManualHours,
    isWorkingDay: s.isWorkingDay,
  }));
}

/**
 * Get schedule for a specific day of week
 */
export async function getUserScheduleForDay(
  userId: string,
  dayOfWeek: number
): Promise<WorkingScheduleDTO | null> {
  const schedule = await prisma.workingSchedule.findUnique({
    where: {
      userId_dayOfWeek: { userId, dayOfWeek },
    },
  });

  if (!schedule) return null;

  return {
    id: schedule.id,
    userId: schedule.userId,
    dayOfWeek: schedule.dayOfWeek,
    morningStart: schedule.morningStart,
    morningEnd: schedule.morningEnd,
    afternoonStart: schedule.afternoonStart,
    afternoonEnd: schedule.afternoonEnd,
    totalHours: parseFloat(schedule.totalHours.toString()),
    useManualHours: schedule.useManualHours,
    isWorkingDay: schedule.isWorkingDay,
  };
}

/**
 * Get base hours for a specific date based on user's schedule
 * Returns 0 if the day is not a working day or Sunday
 */
export async function getBaseHoursForDate(
  userId: string,
  date: Date
): Promise<number> {
  const dayOfWeek = date.getDay(); // 0 = Sunday

  // Sunday is always non-working (blocked)
  if (dayOfWeek === 0) {
    return 0;
  }

  const schedule = await getUserScheduleForDay(userId, dayOfWeek);

  // If no schedule exists, use default (8h for Mon-Fri, 0 for Sat)
  if (!schedule) {
    return DEFAULT_WORKING_DAYS.includes(dayOfWeek) ? 8 : 0;
  }

  // If not a working day, return 0 (all hours will be overtime)
  if (!schedule.isWorkingDay) {
    return 0;
  }

  return schedule.totalHours;
}

/**
 * Check if a date is a working day for the user
 */
export async function isUserWorkingDay(
  userId: string,
  date: Date
): Promise<boolean> {
  const dayOfWeek = date.getDay();

  // Sunday is always non-working
  if (dayOfWeek === 0) {
    return false;
  }

  const schedule = await getUserScheduleForDay(userId, dayOfWeek);

  // If no schedule exists, use default (Mon-Fri are working days)
  if (!schedule) {
    return DEFAULT_WORKING_DAYS.includes(dayOfWeek);
  }

  return schedule.isWorkingDay;
}

/**
 * Create default working schedules for a user (Mon-Fri, 8-12, 14-18)
 */
export async function createDefaultSchedulesForUser(
  userId: string
): Promise<void> {
  const scheduleData = DEFAULT_WORKING_DAYS.map((dayOfWeek) => ({
    userId,
    dayOfWeek,
    morningStart: DEFAULT_SCHEDULE.morningStart,
    morningEnd: DEFAULT_SCHEDULE.morningEnd,
    afternoonStart: DEFAULT_SCHEDULE.afternoonStart,
    afternoonEnd: DEFAULT_SCHEDULE.afternoonEnd,
    totalHours: DEFAULT_SCHEDULE.totalHours,
    isWorkingDay: true,
  }));

  // Use createMany for efficiency
  try {
    await prisma.workingSchedule.createMany({
      data: scheduleData,
      skipDuplicates: true,
    });
  } catch (error) {
    console.error(`Failed to create default schedules for user ${userId}:`, error);
    // Don't throw, just log. This prevents app crashes during race conditions
  }
}

/**
 * Update or create a schedule for a specific day
 */
export async function upsertScheduleForDay(
  userId: string,
  dayOfWeek: number,
  data: {
    morningStart?: string | null;
    morningEnd?: string | null;
    afternoonStart?: string | null;
    afternoonEnd?: string | null;
    totalHours?: number;
    useManualHours?: boolean;
    isWorkingDay?: boolean;
  }
): Promise<WorkingScheduleDTO> {
  // Use provided totalHours if useManualHours is true, otherwise calculate from shifts
  const totalHours = data.useManualHours && data.totalHours !== undefined
    ? data.totalHours 
    : calculateTotalHoursFromShifts(
        data.morningStart ?? null,
        data.morningEnd ?? null,
        data.afternoonStart ?? null,
        data.afternoonEnd ?? null
      );

  const schedule = await prisma.workingSchedule.upsert({
    where: {
      userId_dayOfWeek: { userId, dayOfWeek },
    },
    update: {
      morningStart: data.morningStart ?? null,
      morningEnd: data.morningEnd ?? null,
      afternoonStart: data.afternoonStart ?? null,
      afternoonEnd: data.afternoonEnd ?? null,
      totalHours,
      useManualHours: data.useManualHours ?? false,
      isWorkingDay: data.isWorkingDay ?? true,
    },
    create: {
      userId,
      dayOfWeek,
      morningStart: data.morningStart ?? null,
      morningEnd: data.morningEnd ?? null,
      afternoonStart: data.afternoonStart ?? null,
      afternoonEnd: data.afternoonEnd ?? null,
      totalHours,
      useManualHours: data.useManualHours ?? false,
      isWorkingDay: data.isWorkingDay ?? true,
    },
  });

  return {
    id: schedule.id,
    userId: schedule.userId,
    dayOfWeek: schedule.dayOfWeek,
    morningStart: schedule.morningStart,
    morningEnd: schedule.morningEnd,
    afternoonStart: schedule.afternoonStart,
    afternoonEnd: schedule.afternoonEnd,
    totalHours: parseFloat(schedule.totalHours.toString()),
    useManualHours: schedule.useManualHours,
    isWorkingDay: schedule.isWorkingDay,
  };
}

/**
 * Update all schedules for a user at once
 */
export async function updateUserSchedules(
  userId: string,
  schedules: Array<{
    dayOfWeek: number;
    morningStart?: string | null;
    morningEnd?: string | null;
    afternoonStart?: string | null;
    afternoonEnd?: string | null;
    totalHours?: number;
    useManualHours?: boolean;
    isWorkingDay?: boolean;
  }>
): Promise<WorkingScheduleDTO[]> {
  const results: WorkingScheduleDTO[] = [];

  for (const schedule of schedules) {
    const result = await upsertScheduleForDay(userId, schedule.dayOfWeek, schedule);
    results.push(result);
  }

  return results.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}
