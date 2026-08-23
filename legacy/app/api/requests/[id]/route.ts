import { z } from "zod";
import prisma from "@/lib/prisma";
import { isHoliday } from "@/lib/utils/holiday-utils";
import { addDays, isWeekend } from "date-fns";
import { getRequiredSession } from "@/lib/api-middleware";
import { getBaseHoursForDate } from "@/lib/utils/schedule-utils.server";
import { auditAdmin } from "@/lib/audit-log";
import {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  handleError,
  handleZodError,
} from "@/lib/api-responses";
import { sendLeaveRequestStatusEmail } from "@/lib/email";

const updateStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

const updateRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(["VACATION", "SICKNESS", "PERMESSO"]).optional(),
  reason: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

interface TimeEntryData {
  userId: string;
  workDate: Date;
  hoursWorked: number;
  vacationHours?: number;
  sicknessHours?: number;
}

interface LeaveRequestUpdateData {
  startDate?: Date;
  endDate?: Date;
  type?: "VACATION" | "SICKNESS" | "PERMESSO";
  reason?: string;
  startTime?: string;
  endTime?: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRequiredSession();

  try {
    const json = await req.json();
    const { status } = updateStatusSchema.parse(json);
    const { id } = await params;

    const request = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!request) {
      return notFoundResponse("Request not found");
    }

    // Allow status change even if not pending (admin override)

    // Update status
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id },
      data: { status },
    });

    if (status === "APPROVED") {
      // Generate TimeEntries only for VACATION and SICKNESS
      // PERMESSO requests are just marked in the calendar, user enters hours manually
      if (request.type !== "PERMESSO") {
        const entriesToCreate: TimeEntryData[] = [];
        let currentDate = new Date(request.startDate);
        const endDate = new Date(request.endDate);

        while (currentDate <= endDate) {
          // Skip weekends and holidays
          if (!isWeekend(currentDate) && !isHoliday(currentDate)) {
            // Use employee's schedule-based hours for the day
            const hours = await getBaseHoursForDate(request.userId, currentDate);

            if (hours > 0) {
              const entryData: TimeEntryData = {
                userId: request.userId,
                workDate: new Date(currentDate),
                hoursWorked: 0, 
              };

              if (request.type === "VACATION") {
                entryData.vacationHours = hours;
              } else if (request.type === "SICKNESS") {
                entryData.sicknessHours = hours;
              }

              entriesToCreate.push(entryData);
            }
          }
          currentDate = addDays(currentDate, 1);
        }

        // Transaction to create entries
        if (entriesToCreate.length > 0) {
          await prisma.$transaction(
            entriesToCreate.map(data => prisma.timeEntry.create({ data }))
          );
        }
      }
    }

    await auditAdmin.leaveRequestReviewed(session.user.id, id, status);

    // Notifica email all'utente
    sendLeaveRequestStatusEmail({
      employeeEmail: request.user.email,
      employeeName: request.user.name ?? request.user.email,
      action: status as "APPROVED" | "REJECTED",
      leaveType: request.type,
      startDate: request.startDate.toISOString().split("T")[0],
      endDate: request.endDate.toISOString().split("T")[0],
      startTime: request.startTime ?? undefined,
      endTime: request.endTime ?? undefined,
    }).catch(() => {});

    return successResponse(updatedRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(error);
    }
    return handleError(error, "updating leave request status");
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await getRequiredSession();

  try {
    const json = await req.json();
    const body = updateRequestSchema.parse(json);
    const { id } = await params;

    const request = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return notFoundResponse("Request not found");
    }

    // Validate PERMESSO constraints
    if (body.type === "PERMESSO" || (body.type === undefined && request.type === "PERMESSO")) {
      const startDate = body.startDate ? new Date(body.startDate) : request.startDate;
      const endDate = body.endDate ? new Date(body.endDate) : request.endDate;
      
      if (startDate.getTime() !== endDate.getTime()) {
        return badRequestResponse("Permesso requests must be for a single day");
      }
    }

    // Build update data
    const updateData: LeaveRequestUpdateData = {};
    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.endDate) updateData.endDate = new Date(body.endDate);
    if (body.type) updateData.type = body.type;
    if (body.reason !== undefined) updateData.reason = body.reason;
    if (body.startTime !== undefined) updateData.startTime = body.startTime;
    if (body.endTime !== undefined) updateData.endTime = body.endTime;
    if (body.status) updateData.status = body.status;

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id },
      data: updateData,
      include: { user: true },
    });

    // Notifica email all'utente per modifica
    sendLeaveRequestStatusEmail({
      employeeEmail: updatedRequest.user.email,
      employeeName: updatedRequest.user.name ?? updatedRequest.user.email,
      action: "MODIFIED",
      leaveType: updatedRequest.type,
      startDate: updatedRequest.startDate.toISOString().split("T")[0],
      endDate: updatedRequest.endDate.toISOString().split("T")[0],
      startTime: updatedRequest.startTime ?? undefined,
      endTime: updatedRequest.endTime ?? undefined,
    }).catch(() => {});

    return successResponse(updatedRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(error);
    }
    return handleError(error, "updating leave request");
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await getRequiredSession();

  try {
    const { id } = await params;

    const request = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return notFoundResponse("Request not found");
    }

    await prisma.leaveRequest.delete({
      where: { id },
    });

    return successResponse({ success: true });
  } catch (error) {
    return handleError(error, "deleting leave request");
  }
}
