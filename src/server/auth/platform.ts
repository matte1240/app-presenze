/**
 * Sessions for the back-office.
 *
 * A deliberate copy of the tenant session module rather than a shared
 * abstraction: the two look alike today, but they protect different things and
 * should be free to diverge — a shorter idle timeout here, a different cookie,
 * eventually a second factor — without a shared helper making that a change to
 * both. The duplication is about forty lines and it is the cheap half of the
 * trade.
 */
import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { platformDb } from "../db/client";
import { platformAdmins, platformSessions, type PlatformAdminRow } from "../db/platform-schema";

export const PLATFORM_COOKIE = "presenze_platform";
/** Shorter than a tenant session: this one can reach every customer. */
export const PLATFORM_IDLE_TIMEOUT_MS = 20 * 60 * 1000;
export const PLATFORM_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 1000;

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createPlatformSession(adminId: string, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const nowMs = Date.now();
  await platformDb.insert(platformSessions).values({
    id: digest(token),
    adminId,
    expiresAt: new Date(nowMs + PLATFORM_ABSOLUTE_TIMEOUT_MS),
    lastSeenAt: new Date(nowMs),
    userAgent: userAgent?.slice(0, 200) ?? null,
  });
  return token;
}

export async function resolvePlatformSession(
  token: string | undefined,
): Promise<PlatformAdminRow | null> {
  if (!token) return null;
  const key = digest(token);

  const rows = await platformDb
    .select({ session: platformSessions, admin: platformAdmins })
    .from(platformSessions)
    .innerJoin(platformAdmins, eq(platformAdmins.id, platformSessions.adminId))
    .where(eq(platformSessions.id, key))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const nowMs = Date.now();
  if (
    nowMs > row.session.lastSeenAt.getTime() + PLATFORM_IDLE_TIMEOUT_MS ||
    nowMs > row.session.expiresAt.getTime()
  ) {
    await platformDb.delete(platformSessions).where(eq(platformSessions.id, key));
    return null;
  }

  if (nowMs - row.session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await platformDb
      .update(platformSessions)
      .set({ lastSeenAt: new Date(nowMs) })
      .where(eq(platformSessions.id, key));
  }

  return row.admin;
}

export async function revokePlatformSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await platformDb.delete(platformSessions).where(eq(platformSessions.id, digest(token)));
}

export async function purgeExpiredPlatformSessions(): Promise<void> {
  await platformDb.delete(platformSessions).where(lt(platformSessions.expiresAt, new Date()));
}
