/**
 * Session lifecycle: create, look up, refresh, revoke.
 *
 * The cookie carries a random token; the table stores only its digest. Idle
 * timeout lives here as one comparison against `lastSeenAt`, replacing the old
 * arrangement of a client heartbeat, a JWT claim and a `tokenVersion` column
 * that between them still let a revoked login survive five minutes.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "../db/client";
import { sessions, users, type UserRow } from "../db/schema";

export const SESSION_COOKIE = "presenze_session";
/** Logged out after this long without a request. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** Hard cap, so a tab left open forever still eventually re-authenticates. */
export const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
/** `lastSeenAt` is only written this often, to keep reads from writing. */
const TOUCH_INTERVAL_MS = 60 * 1000;

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export interface ActiveSession {
  readonly user: UserRow;
  readonly expiresAt: Date;
  readonly idleExpiresAt: Date;
}

export async function createSession(userId: string, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const nowMs = Date.now();
  await db.insert(sessions).values({
    id: digest(token),
    userId,
    expiresAt: new Date(nowMs + ABSOLUTE_TIMEOUT_MS),
    lastSeenAt: new Date(nowMs),
    userAgent: userAgent?.slice(0, 200) ?? null,
  });
  return token;
}

export async function resolveSession(token: string | undefined): Promise<ActiveSession | null> {
  if (!token) return null;
  const key = digest(token);

  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, key))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const nowMs = Date.now();
  const idleDeadline = row.session.lastSeenAt.getTime() + IDLE_TIMEOUT_MS;
  if (nowMs > idleDeadline || nowMs > row.session.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, key));
    return null;
  }

  if (nowMs - row.session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.update(sessions).set({ lastSeenAt: new Date(nowMs) }).where(eq(sessions.id, key));
  }

  return {
    user: row.user,
    expiresAt: row.session.expiresAt,
    idleExpiresAt: new Date(nowMs + IDLE_TIMEOUT_MS),
  };
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, digest(token)));
}

/** Used after any password change, which is what makes the old one useless. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export const sessionKeyFor = digest;
export const sessionsOf = (userId: string) =>
  db.select().from(sessions).where(and(eq(sessions.userId, userId)));
