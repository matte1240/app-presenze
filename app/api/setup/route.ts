import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import { passwordSchema } from "@/lib/validation";
import { auditSecurity } from "@/lib/audit-log";
import { getClientIp } from "@/lib/rate-limit";

const setupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = setupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const passwordHash = await hash(password, 10);

    // Atomic check-and-create to prevent race conditions
    const user = await prisma.$transaction(async (tx) => {
      const userCount = await tx.user.count();
      if (userCount > 0) {
        throw new SetupAlreadyCompletedError();
      }

      return tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "ADMIN",
        },
      });
    });

    await auditSecurity.setupCompleted(user.id, getClientIp(req));

    return NextResponse.json(
      { 
        message: "Setup completed successfully",
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SetupAlreadyCompletedError) {
      return NextResponse.json(
        { error: "Setup has already been completed" },
        { status: 403 }
      );
    }
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

class SetupAlreadyCompletedError extends Error {
  constructor() {
    super("Setup already completed");
  }
}
