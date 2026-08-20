import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { passwordSchema } from "@/lib/validation";
import { auditAuth } from "@/lib/audit-log";
import { getClientIp } from "@/lib/rate-limit";

const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  token: z.string().min(1, "Token is required"),
  newPassword: passwordSchema,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { email, token, newPassword } = parsed.data;

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find valid token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: email,
          token: hashedToken,
        },
      },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Token non valido o scaduto" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (verificationToken.expires < new Date()) {
      // Delete expired token
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: email,
            token: hashedToken,
          },
        },
      });

      return NextResponse.json(
        { error: "Token scaduto. Richiedi un nuovo reset della password." },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utente non trovato" },
        { status: 404 }
      );
    }

    // Hash new password
    const passwordHash = await hash(newPassword, 10);

    // Update password, increment tokenVersion, delete token, and invalidate all sessions
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { 
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: email,
            token: hashedToken,
          },
        },
      }),
      // Delete all active sessions for this user
      prisma.session.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    await auditAuth.passwordReset(user.id, getClientIp(request));

    return NextResponse.json({
      message: "Password aggiornata con successo. Ora puoi effettuare il login.",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
