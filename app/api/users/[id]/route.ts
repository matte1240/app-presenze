import { z } from "zod";
import prisma from "@/lib/prisma";
import { findUserById, findUserByEmail } from "@/lib/utils/user-utils";
import { getRequiredSession } from "@/lib/api-middleware";
import {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  conflictResponse,
  handleError,
  handleZodError,
} from "@/lib/api-responses";
import { auditAdmin } from "@/lib/audit-log";

const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  email: z.string().email("Invalid email address").optional(),
  role: z.enum(["EMPLOYEE", "ADMIN"]).optional(),
  hasPermesso104: z.boolean().optional(),
  hasPaternityLeave: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRequiredSession();

  try {
    const { id: userId } = await params;

    // Check if user exists
    const existingUser = await findUserById(userId);

    if (!existingUser) {
      return notFoundResponse("User not found");
    }

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { name, email, role, hasPermesso104, hasPaternityLeave } = parsed.data;

    // Prevent admin from removing their own admin privileges
    if (session.user.id === userId && role && role !== existingUser.role) {
      return badRequestResponse("Cannot change your own role");
    }

    // If email is being changed, check if it's already in use
    if (email && email !== existingUser.email) {
      const emailInUse = await findUserByEmail(email);

      if (emailInUse) {
        return conflictResponse("Email already in use");
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(role !== undefined && { role }),
        ...(hasPermesso104 !== undefined && { hasPermesso104 }),
        ...(hasPaternityLeave !== undefined && { hasPaternityLeave }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        hasPermesso104: true,
        hasPaternityLeave: true,
      },
    });

    await auditAdmin.userUpdated(session.user.id, userId, parsed.data);
    return successResponse(updatedUser);
  } catch (error) {
    return handleError(error, "updating user");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRequiredSession();

  try {
    const { id: userId } = await params;

    // Prevent admin from deleting themselves
    if (session.user.id === userId) {
      return badRequestResponse("Cannot delete your own account");
    }

    // Check if user exists
    const existingUser = await findUserById(userId);

    if (!existingUser) {
      return notFoundResponse("User not found");
    }

    // Delete user and cascade delete their time entries
    await prisma.user.delete({
      where: { id: userId },
    });

    await auditAdmin.userDeleted(session.user.id, userId);
    return successResponse({ message: "User deleted successfully" });
  } catch (error) {
    return handleError(error, "deleting user");
  }
}
