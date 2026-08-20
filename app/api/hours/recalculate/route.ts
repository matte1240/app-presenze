import { z } from "zod";
import prisma from "@/lib/prisma";
import { isHoliday } from "@/lib/utils/holiday-utils";
import { getRequiredSession, isAdmin } from "@/lib/api-middleware";
import {
  successResponse,
  badRequestResponse,
  forbiddenResponse,
  handleError,
} from "@/lib/api-responses";
import { getBaseHoursForDate, isUserWorkingDay } from "@/lib/utils/schedule-utils.server";
import { calculateHours } from "@/lib/utils/time-utils";

const recalculateSchema = z.object({
  userId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/), // "2026-04"
});

export async function POST(request: Request) {
  const session = await getRequiredSession();
  if (!isAdmin(session)) {
    return forbiddenResponse("Solo gli admin possono ricalcolare le ore");
  }

  const body = await request.json();
  const parsed = recalculateSchema.safeParse(body);

  if (!parsed.success) {
    return badRequestResponse("Payload non valido. Richiesti: userId, month (YYYY-MM)");
  }

  const { userId, month } = parsed.data;
  const [year, monthNum] = month.split("-").map(Number);
  const startOfMonth = new Date(Date.UTC(year, monthNum - 1, 1));
  const endOfMonth = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59));

  try {
    // Get all entries for the user in the month
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId,
        workDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    let updated = 0;

    for (const entry of entries) {
      const baseHours = await getBaseHoursForDate(userId, entry.workDate);
      const isWorkingDay = await isUserWorkingDay(userId, entry.workDate);
      const workDateStr = entry.workDate.toISOString().split("T")[0];
      const isWorkday = isWorkingDay && !isHoliday(workDateStr);

      const sicknessHours = Number(entry.sicknessHours);
      const vacationHours = Number(entry.vacationHours);
      const permesso104Hours = Number(entry.permesso104Hours);
      const paternityHours = Number(entry.paternityHours);

      // Skip entries that are full-day leave types (vacation, sickness, paternity)
      // These should use the schedule's base hours
      const isFullDayLeave = (vacationHours > 0 || sicknessHours > 0 || paternityHours > 0)
        && !entry.morningStart && !entry.afternoonStart;

      if (isFullDayLeave) {
        // Recalculate full-day leave hours based on schedule
        const newData: Record<string, string> = {};
        if (vacationHours > 0) newData.vacationHours = baseHours.toString();
        if (sicknessHours > 0) newData.sicknessHours = baseHours.toString();
        if (paternityHours > 0) newData.paternityHours = baseHours.toString();

        if (Object.keys(newData).length > 0) {
          await prisma.timeEntry.update({
            where: { id: entry.id },
            data: newData,
          });
          updated++;
        }
        continue;
      }

      // Calculate actual worked hours from time fields
      let hoursWorked = 0;
      const morningStart = entry.morningStart;
      const morningEnd = entry.morningEnd;
      const afternoonStart = entry.afternoonStart;
      const afternoonEnd = entry.afternoonEnd;
      const isMorningPermesso = morningStart === "PERM";
      const isAfternoonPermesso = afternoonStart === "PERM";

      if (!isMorningPermesso && morningStart && morningEnd) {
        hoursWorked += calculateHours(morningStart, morningEnd);
      }
      if (!isAfternoonPermesso && afternoonStart && afternoonEnd) {
        hoursWorked += calculateHours(afternoonStart, afternoonEnd);
      }

      let regular = 0;
      let overtime = 0;
      let permessoHours = 0;

      if (!isWorkday) {
        // Non-working day: all hours are overtime
        overtime = hoursWorked;
      } else {
        if (hoursWorked < baseHours) {
          regular = hoursWorked;
          const missingHours = baseHours - hoursWorked;

          // Keep existing permesso104 allocation, rest as permesso
          if (permesso104Hours > 0) {
            const perm104 = Math.min(permesso104Hours, missingHours);
            permessoHours = missingHours - perm104;
          } else {
            // If no other leave covers the gap, it's permesso
            if (sicknessHours === 0 && vacationHours === 0 && paternityHours === 0) {
              permessoHours = missingHours;
            }
          }
        } else {
          regular = baseHours;
          overtime = hoursWorked - baseHours;
        }
      }

      await prisma.timeEntry.update({
        where: { id: entry.id },
        data: {
          hoursWorked: regular.toString(),
          overtimeHours: overtime.toString(),
          permessoHours: permessoHours.toString(),
        },
      });
      updated++;
    }

    return successResponse({
      message: `Ricalcolate ${updated} voci su ${entries.length} totali per ${month}`,
      updated,
      total: entries.length,
    });
  } catch (error) {
    return handleError(error, "recalculating hours");
  }
}
