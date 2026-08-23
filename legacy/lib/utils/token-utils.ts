/**
 * Utility functions for token generation and management
 */

import crypto from "crypto";
import prisma from "@/lib/prisma";

/**
 * Generate a secure reset token and its hash
 * @returns Object with plaintext token and hashed token
 */
export function generateResetToken() {
  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  return { resetToken, hashedToken };
}

/**
 * Create a verification token in the database
 * @param email User's email address
 * @param hashedToken The hashed token to store
 * @param expiresInHours Number of hours until expiration (default: 24)
 */
export async function createVerificationToken(
  email: string,
  hashedToken: string,
  expiresInHours = 24
) {
  const expires = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  // Delete any existing tokens for this user
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  // Create new token
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashedToken,
      expires,
    },
  });

  return expires;
}

/**
 * Delete all verification tokens for a user
 * @param email User's email address
 */
export async function deleteVerificationTokens(email: string) {
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });
}
