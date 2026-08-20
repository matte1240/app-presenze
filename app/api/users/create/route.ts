import { z } from "zod";
import crypto from "crypto";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { sendWelcomeSetupEmail } from "@/lib/email";
import { generateResetToken, createVerificationToken, deleteVerificationTokens } from "@/lib/utils/token-utils";
import { findUserByEmail } from "@/lib/utils/user-utils";
import { getRequiredSession } from "@/lib/api-middleware";
import { passwordSchema } from "@/lib/validation";
import { auditAdmin } from "@/lib/audit-log";
import {
  successResponse,
  conflictResponse,
  handleError,
  handleZodError,
} from "@/lib/api-responses";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["EMPLOYEE", "ADMIN"]),
  password: passwordSchema.optional(),
});

export async function POST(request: Request) {
  const session = await getRequiredSession();

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { name, email, role, password } = parsed.data;

    // Check if user already exists
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      return conflictResponse("User with this email already exists");
    }

    // Determine password to use
    let passwordToHash: string;
    
    if (password) {
      // Manual password provided
      passwordToHash = password;
    } else {
      // Generate a secure temporary password (128-bit entropy)
      passwordToHash = crypto.randomBytes(16).toString('base64url');
    }

    // Hash password
    const passwordHash = await hash(passwordToHash, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // If manual password was provided, skip email sending
    if (password) {
      await auditAdmin.userCreated(session.user.id, newUser.id, role);
      return successResponse(newUser, 201);
    }

    // Generate reset token
    const { resetToken, hashedToken } = generateResetToken();
    
    // Token expires in 24 hours (longer for first setup)
    await createVerificationToken(email, hashedToken, 24);

    // Send welcome email with setup link
    try {
      const setupUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
      
      await sendWelcomeSetupEmail(
        email,
        name,
        setupUrl
      );
      
      await auditAdmin.userCreated(session.user.id, newUser.id, role);
    } catch (emailError) {
      console.error("⚠️ Failed to send welcome email:", emailError);
      
      // Cleanup: delete user and token if email fails
      await prisma.user.delete({ where: { id: newUser.id } });
      await deleteVerificationTokens(email);
      
      return handleError(emailError, "sending welcome email");
    }

    return successResponse(newUser, 201);
  } catch (error) {
    return handleError(error, "creating user");
  }
}
