import { z } from "zod";
import prisma from "@/lib/prisma";
import { getRequiredSession, isAdmin } from "@/lib/api-middleware";
import {
  successResponse,
  badRequestResponse,
  forbiddenResponse,
  conflictResponse,
  handleError,
  handleZodError,
} from "@/lib/api-responses";
import { sendLeaveRequestAdminNotification } from "@/lib/email";
import { auditCalendar } from "@/lib/audit-log";

const createRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["VACATION", "SICKNESS", "PERMESSO"]),
  reason: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

interface LeaveRequestWhereClause {
  userId?: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
}

export async function POST(req: Request) {
  const session = await getRequiredSession();

  try {
    const json = await req.json();
    const body = createRequestSchema.parse(json);
    const userId = session.user.id;

    if (body.type === "PERMESSO") {
      if (!body.startTime || !body.endTime) {
        return badRequestResponse("Start time and end time are required for Permesso");
      }
      if (body.startDate !== body.endDate) {
        return badRequestResponse("Permesso requests must be for a single day");
      }
    }

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);

    if (endDate < startDate) {
      return badRequestResponse("End date must be after start date");
    }

    // Check for overlaps with existing requests
    const existingRequest = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: { in: ["PENDING", "APPROVED"] },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (existingRequest) {
      return conflictResponse("Request overlaps with an existing request");
    }
    
    // Check for overlaps with existing TimeEntries
    const existingEntry = await prisma.timeEntry.findFirst({
        where: {
            userId,
            workDate: {
                gte: startDate,
                lte: endDate
            }
        }
    });

    if (existingEntry) {
        return conflictResponse("Request overlaps with existing time entries");
    }

    const request = await prisma.leaveRequest.create({
      data: {
        userId,
        startDate,
        endDate,
        type: body.type,
        reason: body.reason,
        startTime: body.startTime,
        endTime: body.endTime,
      },
    });

    auditCalendar.leaveRequested(userId, body.type, body.startDate, body.endDate);

    // Notify all admins via email (fire-and-forget, errors don't block response)
    const employee = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (employee) {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { name: true, email: true },
      });

      await Promise.allSettled(
        admins.map((admin) =>
          sendLeaveRequestAdminNotification({
            adminEmail: admin.email,
            adminName: admin.name ?? admin.email,
            employeeName: employee.name ?? employee.email,
            employeeEmail: employee.email,
            leaveType: body.type,
            startDate: body.startDate,
            endDate: body.endDate,
            startTime: body.startTime,
            endTime: body.endTime,
            reason: body.reason,
          })
        )
      );
    }

    return successResponse(request);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(error);
    }
    return handleError(error, "creating leave request");
  }
}

export async function GET(req: Request) {
  const session = await getRequiredSession();

  const { searchParams } = new URL(req.url);
  const userIdParam = searchParams.get("userId");
  const statusParam = searchParams.get("status");

  // Only admin can view other users' requests
  if (userIdParam && userIdParam !== session.user.id && !isAdmin(session)) {
    return forbiddenResponse("Forbidden");
  }

  const where: LeaveRequestWhereClause = {};
  
  if (userIdParam) {
    where.userId = userIdParam;
  } else if (!isAdmin(session)) {
    // If not admin and no userId specified, show own requests
    where.userId = session.user.id;
  }
  // If admin and no userId, show all (or filter by status)

  if (statusParam && (statusParam === "PENDING" || statusParam === "APPROVED" || statusParam === "REJECTED")) {
    where.status = statusParam;
  }

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return successResponse(requests);
}
