/**
 * Utility functions for user-related operations
 */

import prisma from "@/lib/prisma";

/**
 * Check if a user exists by email
 * @param email User's email address
 * @returns User object if found, null otherwise
 */
export async function findUserByEmail(email: string) {
  return await prisma.user.findUnique({
    where: { email },
  });
}

/**
 * Check if a user exists by ID
 * @param userId User's ID
 * @returns User object if found, null otherwise
 */
export async function findUserById(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
  });
}

/**
 * Check admin authorization for a session
 * @param session The session object from getAuthSession
 * @returns true if user is admin, false otherwise
 */
export function isAdmin(session: { user: { role: string } } | null): boolean {
  return session?.user?.role === "ADMIN";
}
