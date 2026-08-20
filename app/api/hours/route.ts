import type { Prisma } from "@/lib/generated/prisma/client";

type Decimal = Prisma.Decimal;
import { z } from "zod";
import prisma from "@/lib/prisma";
import { isHoliday } from "@/lib/utils/holiday-utils";
import { getRequiredSession, isAdmin } from "@/lib/api-middleware";
import {
  successResponse,
  badRequestResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-responses";
import { serializeTimeEntry, serializeTimeEntries } from "@/lib/utils/serialization";
import { getBaseHoursForDate, isUserWorkingDay } from "@/lib/utils/schedule-utils.server";
import { auditCalendar } from "@/lib/audit-log";

const createHoursSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hoursWorked: z.number().min(0).max(24),
  overtimeHours: z.number().min(0).optional(),
  permessoHours: z.number().min(0).optional(),
  sicknessHours: z.number().min(0).optional(),
  vacationHours: z.number().min(0).optional(),
  permesso104Hours: z.number().min(0).optional(),
  paternityHours: z.number().min(0).optional(),
  morningStart: z.string().nullable().optional(),
  morningEnd: z.string().nullable().optional(),
  afternoonStart: z.string().nullable().optional(),
  afternoonEnd: z.string().nullable().optional(),
  medicalCertificate: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  userId: z.string().optional(), // Admin can specify userId
});

const querySchema = z.object({
  userId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

type RawEntry = {
  id: string;
  userId: string;
  workDate: Date;
  hoursWorked: Decimal;
  overtimeHours: Decimal;
  permessoHours: Decimal;
  sicknessHours: Decimal;
  vacationHours: Decimal;
  permesso104Hours: Decimal;
  paternityHours: Decimal;
  morningStart: string | null;
  morningEnd: string | null;
  afternoonStart: string | null;
  afternoonEnd: string | null;
  medicalCertificate: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function GET(request: Request) {
  const session = await getRequiredSession();

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return badRequestResponse("Invalid query");
  }

  const { userId, from, to } = parsed.data;

  const where: {
    userId?: string;
    workDate?: { gte?: Date; lte?: Date };
  } = {
    userId: isAdmin(session) && userId ? userId : session.user.id,
  };

  if (isAdmin(session) && userId === "all") {
    delete where.userId;
  }

  if (from || to) {
    where.workDate = {};
    if (from) {
      where.workDate.gte = new Date(`${from}T00:00:00.000Z`);
    }
    if (to) {
      where.workDate.lte = new Date(`${to}T23:59:59.999Z`);
    }
  }

  // If userId is not set (meaning "all" for admin), still apply date filters
  if (!where.userId) {
    const entries = (await prisma.timeEntry.findMany({
      where: where.workDate ? { workDate: where.workDate } : undefined,
      orderBy: { workDate: "desc" },
    })) as RawEntry[];
    return successResponse(serializeTimeEntries(entries));
  }

  const entries = (await prisma.timeEntry.findMany({
    where,
    orderBy: { workDate: "desc" },
  })) as RawEntry[];

  return successResponse(serializeTimeEntries(entries));
}

export async function POST(request: Request) {
  const session = await getRequiredSession();

  const body = await request.json();
  const parsed = createHoursSchema.safeParse(body);

  if (!parsed.success) {
    return badRequestResponse("Invalid payload");
  }

  const { workDate, hoursWorked, overtimeHours, morningStart, morningEnd, afternoonStart, afternoonEnd, medicalCertificate, notes, userId: requestedUserId } = parsed.data;

  // Determine which userId to use: admin can specify, employee uses their own
  const targetUserId = isAdmin(session) && requestedUserId ? requestedUserId : session.user.id;

  // Employees can only enter hours for today and the 2 previous calendar days
  if (!isAdmin(session)) {
    // entryDateLocal uses local TZ for business rule checks (today, day-of-week)
    const entryDateLocal = new Date(`${workDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // local midnight
    
    // Employees can only edit today and the 2 previous calendar days
    const earliestEditableDate = new Date(today);
    earliestEditableDate.setDate(today.getDate() - 2);

    // Check Sunday restrictions (local day of week)
    const dayOfWeek = entryDateLocal.getDay();
    
    // Check if user can work on Sundays
    const userFlags = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { canWorkSunday: true },
    });
    const canWorkSunday = userFlags?.canWorkSunday ?? false;
    
    // Block Sundays (0 = Sunday) unless user has canWorkSunday flag
    if (dayOfWeek === 0 && !canWorkSunday) {
      return forbiddenResponse("Cannot enter hours on Sundays");
    }
    
    // Block holidays
    if (isHoliday(workDate)) {
      return forbiddenResponse("Cannot enter hours on Holidays");
    }

    if (entryDateLocal > today) {
      return forbiddenResponse("Cannot enter hours for future dates");
    }

    // Block future times for today's date
    if (entryDateLocal.getTime() === today.getTime()) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTotalMinutes = currentHour * 60 + currentMinute;

      const timeFields = [
        { name: "morningEnd", value: morningEnd },
        { name: "afternoonEnd", value: afternoonEnd },
        { name: "morningStart", value: morningStart },
        { name: "afternoonStart", value: afternoonStart },
      ];

      for (const field of timeFields) {
        if (field.value && field.value !== "PERM") {
          const [h, m] = field.value.split(":").map(Number);
          if (h * 60 + m > currentTotalMinutes) {
            return forbiddenResponse(
              `Non puoi inserire un orario futuro (${field.value}). L'ora attuale è ${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}.`
            );
          }
        }
      }
    }

    if (entryDateLocal < earliestEditableDate) {
      return forbiddenResponse("Puoi inserire ore solo per oggi e i 2 giorni precedenti.");
    }
  }

  // Calculate permessoHours based on user's working schedule
  const entryDate = new Date(`${workDate}T00:00:00.000Z`);
  
  // Get user's schedule-based working day status and base hours
  const isWorkingDayForUser = await isUserWorkingDay(targetUserId, entryDate);
  const baseHours = await getBaseHoursForDate(targetUserId, entryDate);
  const isWorkday = isWorkingDayForUser && !isHoliday(workDate);

  let permessoHours = parsed.data.permessoHours ?? 0;
  const sicknessHours = parsed.data.sicknessHours ?? 0;
  const vacationHours = parsed.data.vacationHours ?? 0;
  const permesso104Hours = parsed.data.permesso104Hours ?? 0;
  const paternityHours = parsed.data.paternityHours ?? 0;

  // Only auto-calculate permesso if not already provided and not vacation/sickness/104/paternity
  if (!parsed.data.permessoHours && sicknessHours === 0 && vacationHours === 0 && permesso104Hours === 0 && paternityHours === 0) {
    if (isWorkday && hoursWorked < baseHours) {
      permessoHours = baseHours - hoursWorked;
    }
  }

  const existing = await prisma.timeEntry.findUnique({
    where: {
      userId_workDate: {
        userId: targetUserId,
        workDate: entryDate,
      },
    },
  });

  // --- VALIDATION LOGIC ---
  
  // 1. Permesso 104 Validation (Max 24h/month)
  if (permesso104Hours > 0) {
    const entryDateObj = new Date(`${workDate}T00:00:00.000Z`);
    const startOfMonth = new Date(Date.UTC(entryDateObj.getUTCFullYear(), entryDateObj.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(entryDateObj.getUTCFullYear(), entryDateObj.getUTCMonth() + 1, 0, 23, 59, 59));

    const monthlyEntries = await prisma.timeEntry.findMany({
      where: {
        userId: targetUserId,
        workDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        // Exclude current entry if updating
        ...(existing ? { id: { not: existing.id } } : {}),
      },
      select: {
        permesso104Hours: true,
      },
    });

    const currentTotal = monthlyEntries.reduce((sum, e) => sum + Number(e.permesso104Hours), 0);
    
    if (currentTotal + permesso104Hours > 24) {
      return badRequestResponse(`Limite Permesso 104 superato. Hai già usato ${currentTotal}h questo mese. Massimo consentito: 24h.`);
    }
  }

  // 2. Paternity Leave Validation (Max 10 days total)
  if (paternityHours > 0) {
    // Count distinct days with paternity leave
    // Note: This is a simple total count. For "per event" logic, we'd need a more complex system linking leaves to events.
    // Assuming "per event" means we just warn or block based on a reasonable history or manual reset, 
    // but for now we implement a total count check.
    
    const paternityEntries = await prisma.timeEntry.findMany({
      where: {
        userId: targetUserId,
        paternityHours: { gt: 0 },
        // Exclude current entry if updating
        ...(existing ? { id: { not: existing.id } } : {}),
      },
      select: {
        id: true, // Just need to count rows
      },
    });

    if (paternityEntries.length >= 10) {
      return badRequestResponse(`Limite Congedo Paternità superato. Hai già usato ${paternityEntries.length} giorni. Massimo consentito: 10 giorni.`);
    }
  }

  // --- END VALIDATION ---

  let entry: RawEntry;

  if (existing) {
    // Update existing entry
    entry = (await prisma.timeEntry.update({
      where: { id: existing.id },
      data: {
        hoursWorked: hoursWorked.toString(),
        overtimeHours: (overtimeHours ?? 0).toString(),
        permessoHours: permessoHours.toString(),
        sicknessHours: sicknessHours.toString(),
        vacationHours: vacationHours.toString(),
        permesso104Hours: permesso104Hours.toString(),
        paternityHours: paternityHours.toString(),
        morningStart,
        morningEnd,
        afternoonStart,
        afternoonEnd,
        medicalCertificate,
        notes,
      },
    })) as RawEntry;
    auditCalendar.entryUpdated(targetUserId, workDate, { hoursWorked, overtimeHours: overtimeHours ?? 0, editedBy: session.user.id });
  } else {
    // Create new entry
    entry = (await prisma.timeEntry.create({
      data: {
        userId: targetUserId,
        workDate: new Date(`${workDate}T00:00:00.000Z`),
        hoursWorked: hoursWorked.toString(),
        overtimeHours: (overtimeHours ?? 0).toString(),
        permessoHours: permessoHours.toString(),
        sicknessHours: sicknessHours.toString(),
        vacationHours: vacationHours.toString(),
        permesso104Hours: permesso104Hours.toString(),
        paternityHours: paternityHours.toString(),
        morningStart,
        morningEnd,
        afternoonStart,
        afternoonEnd,
        medicalCertificate,
        notes,
      },
    })) as RawEntry;
    auditCalendar.entryCreated(targetUserId, workDate, { hoursWorked, overtimeHours: overtimeHours ?? 0, createdBy: session.user.id });
  }

  return successResponse(serializeTimeEntry(entry), existing ? 200 : 201);
}

export async function DELETE(request: Request) {
  const session = await getRequiredSession();

  const url = new URL(request.url);
  const entryId = url.searchParams.get("id");

  if (!entryId) {
    return badRequestResponse("Entry ID required");
  }

  // Find the entry
  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry) {
    return notFoundResponse("Entry not found");
  }

  // Check permissions: employees can only delete their own entries, admins can delete any
  if (!isAdmin(session) && entry.userId !== session.user.id) {
    return forbiddenResponse("Forbidden");
  }

  // Employees can only delete entries within the last 2 calendar days
  if (!isAdmin(session)) {
    const entryDate = new Date(entry.workDate);
    entryDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const earliestEditableDate = new Date(today);
    earliestEditableDate.setDate(today.getDate() - 2);
    if (entryDate < earliestEditableDate) {
      return forbiddenResponse("Puoi eliminare inserimenti solo degli ultimi 2 giorni.");
    }
  }

  // Delete the entry
  await prisma.timeEntry.delete({
    where: { id: entryId },
  });

  const workDate = entry.workDate instanceof Date ? entry.workDate.toISOString().split("T")[0] : String(entry.workDate);
  auditCalendar.entryDeleted(entry.userId, workDate, session.user.id);

  return successResponse({ success: true });
}
