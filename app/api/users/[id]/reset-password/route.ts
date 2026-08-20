import { z } from "zod";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { sendPasswordResetLinkEmail } from "@/lib/email";
import { generateResetToken, createVerificationToken, deleteVerificationTokens } from "@/lib/utils/token-utils";
import { findUserById } from "@/lib/utils/user-utils";
import { getRequiredSession } from "@/lib/api-middleware";
import { passwordSchema } from "@/lib/validation";
import { auditAdmin } from "@/lib/audit-log";
import {
  successResponse,
  notFoundResponse,
  handleError,
  handleZodError,
} from "@/lib/api-responses";

const resetPasswordSchema = z.object({
  newPassword: passwordSchema.optional(),
});

export async function POST(
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

    // Parse request body to check if manual password is provided
    const body = await request.json().catch(() => ({}));
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { newPassword } = parsed.data;

    // If manual password is provided, reset password directly
    if (newPassword) {
      const passwordHash = await hash(newPassword, 10);

      // Update password and invalidate all sessions
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            passwordHash,
            tokenVersion: { increment: 1 },
            updatedAt: new Date(),
          },
        }),
        // Delete all active sessions for this user
        prisma.session.deleteMany({
          where: { userId },
        }),
      ]);

      await auditAdmin.userUpdated(session.user.id, userId, { action: "password_reset" });
      return successResponse({ 
        message: "Password reimpostata con successo." 
      });
    }

    // Otherwise, send email with reset link
    // Generate reset token
    const { resetToken, hashedToken } = generateResetToken();
    
    // Token expires in 24 hours (admin reset has longer expiry)
    await createVerificationToken(existingUser.email, hashedToken, 24);

    // Send email with reset link
    try {
      const resetUrl = `${process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${resetToken}&email=${encodeURIComponent(existingUser.email)}`;
      
      await sendPasswordResetLinkEmail(
        existingUser.email,
        existingUser.name || existingUser.email,
        resetUrl,
        "24 ore"
      );
      
      console.log(`✅ Password reset email sent to ${existingUser.email}`);
    } catch (emailError) {
      console.error("⚠️ Failed to send password reset email:", emailError);
      
      // Cleanup token if email fails
      await deleteVerificationTokens(existingUser.email);
      
      return handleError(emailError, "sending password reset email");
    }

    return successResponse({ 
      message: "Email di reset password inviata con successo all'utente." 
    });
  } catch (error) {
    return handleError(error, "resetting password");
  }
}
