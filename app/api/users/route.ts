import { hash } from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { findUserByEmail } from "@/lib/utils/user-utils";
import { getRequiredSession } from "@/lib/api-middleware";
import { passwordSchema } from "@/lib/validation";
import {
  successResponse,
  badRequestResponse,
  conflictResponse,
  handleError,
} from "@/lib/api-responses";
import { decimalToNumber } from "@/lib/utils/serialization";
import { createDefaultSchedulesForUser } from "@/lib/utils/schedule-utils.server";

type UserRole = "EMPLOYEE" | "ADMIN";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  createdAt: Date;
  hasPermesso104: boolean;
  hasPaternityLeave: boolean;
};

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: passwordSchema,
  role: z.enum(["EMPLOYEE", "ADMIN"]).default("EMPLOYEE"),
  hasPermesso104: z.boolean().optional().default(false),
  hasPaternityLeave: z.boolean().optional().default(false),
});

export async function GET() {
  await getRequiredSession();

  const [users, totals] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        hasPermesso104: true,
        hasPaternityLeave: true,
      },
    }) as Promise<UserRow[]>,
    prisma.timeEntry.groupBy({
      by: ["userId"],
      _sum: { hoursWorked: true },
    }),
  ]);

  const totalsMap = new Map<string, number>();

  for (const item of totals) {
    const total = item._sum.hoursWorked;
    totalsMap.set(item.userId, decimalToNumber(total));
  }

  const payload = users.map((user) => ({
    ...user,
    totalHours: totalsMap.get(user.id) ?? 0,
  }));

  return successResponse(payload);
}

export async function POST(request: Request) {
  await getRequiredSession();

  const payload = await request.json();
  const parsed = createUserSchema.safeParse(payload);

  if (!parsed.success) {
    return badRequestResponse("Invalid payload");
  }

  const existing = await findUserByEmail(parsed.data.email);

  if (existing) {
    return conflictResponse("Email already in use");
  }

  try {
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash: await hash(parsed.data.password, 10),
        role: parsed.data.role,
        hasPermesso104: parsed.data.hasPermesso104,
        hasPaternityLeave: parsed.data.hasPaternityLeave,
      },
    });

    // Create default working schedules for the new user
    await createDefaultSchedulesForUser(user.id);

    return successResponse({ id: user.id }, 201);
  } catch (error) {
    return handleError(error, "creating user");
  }
}
