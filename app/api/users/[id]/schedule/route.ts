import { z } from "zod";
import prisma from "@/lib/prisma";
import { getRequiredSession } from "@/lib/api-middleware";
import {
  successResponse,
  notFoundResponse,
  handleError,
  handleZodError,
} from "@/lib/api-responses";
import { findUserById } from "@/lib/utils/user-utils";
import {
  getUserSchedules,
  updateUserSchedules,
  createDefaultSchedulesForUser,
} from "@/lib/utils/schedule-utils.server";

// Time format validation (HH:MM)
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)")
  .nullable()
  .optional();

// Schedule entry for a single day
const scheduleEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  morningStart: timeSchema,
  morningEnd: timeSchema,
  afternoonStart: timeSchema,
  afternoonEnd: timeSchema,
  totalHours: z.number().min(0).max(24).optional(),
  useManualHours: z.boolean().optional(),
  isWorkingDay: z.boolean().optional(),
});

// Full schedule update schema (array of day schedules + canWorkSunday flag)
const updateScheduleSchema = z.object({
  schedules: z.array(scheduleEntrySchema),
  canWorkSunday: z.boolean().optional(),
});

/**
 * GET /api/users/[id]/schedule
 * Get all working schedules for a user
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await getRequiredSession();

  try {
    const { id: userId } = await params;

    // Check if user exists
    const user = await findUserById(userId);
    if (!user) {
      return notFoundResponse("User not found");
    }

    // Get user's canWorkSunday flag
    const userWithFlags = await prisma.user.findUnique({
      where: { id: userId },
      select: { canWorkSunday: true },
    });

    // Get schedules
    let schedules = await getUserSchedules(userId);

    // If no schedules exist, create default ones
    if (schedules.length === 0) {
      await createDefaultSchedulesForUser(userId);
      schedules = await getUserSchedules(userId);
    }

    return successResponse({
      schedules,
      canWorkSunday: userWithFlags?.canWorkSunday ?? false,
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PUT /api/users/[id]/schedule
 * Update all working schedules for a user
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await getRequiredSession();

  try {
    const { id: userId } = await params;

    // Check if user exists
    const user = await findUserById(userId);
    if (!user) {
      return notFoundResponse("User not found");
    }

    const body = await request.json();
    const parsed = updateScheduleSchema.safeParse(body);

    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    // Update canWorkSunday flag if provided
    if (parsed.data.canWorkSunday !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { canWorkSunday: parsed.data.canWorkSunday },
      });
    }

    // Update schedules
    const updatedSchedules = await updateUserSchedules(userId, parsed.data.schedules);

    return successResponse({
      schedules: updatedSchedules,
      canWorkSunday: parsed.data.canWorkSunday ?? false,
    });
  } catch (err) {
    return handleError(err);
  }
}
