/**
 * Session lifecycle: create, look up, refresh, revoke.
 *
 * The cookie carries a random token; the table stores only its digest. Idle
 * timeout lives here as one comparison against `lastSeenAt`, replacing the old
 * arrangement of a client heartbeat, a JWT claim and a `tokenVersion` column
 * that between them still let a revoked login survive five minutes.
 *
 * A session now names an organization as well as a user, and it has to: the
 * lookup happens before any tenant is established — it is what establishes one
 * — so it runs on the plain pool. That is also why `sessions` carries no
 * row-level security policy. It holds no business data, and every row is
 * reachable only by the digest of a 32-byte random token.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "../db/client";
import { currentOrgId } from "../db/context";
import type { OrganizationRow } from "../db/platform-schema";
import { sessions, type UserRow } from "../db/schema";

export const SESSION_COOKIE = "presenze_session";
/** Logged out after this long without a request. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** Hard cap, so a tab left open forever still eventually re-authenticates. */
export const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
/** `lastSeenAt` is only written this often, to keep reads from writing. */
const TOUCH_INTERVAL_MS = 60 * 1000;

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

/** What the cookie resolves to before the tenant is opened. */
export interface SessionLookup {
  readonly organizationId: string;
  readonly userId: string;
  readonly expiresAt: Date;
  readonly idleExpiresAt: Date;
  readonly impersonatedBy: string | null;
}

/** What the request sees, once the tenant is open and the rows are loaded. */
export interface ActiveSession {
  readonly user: UserRow;
  readonly organization: OrganizationRow;
  readonly expiresAt: Date;
  readonly idleExpiresAt: Date;
  readonly impersonatedBy: string | null;
}

/**
 * `impersonatedBy` is set only by the back-office. It is carried on the session
 * rather than inferred later so the application can say so plainly to the
 * people whose account it is.
 */
export async function createSession(
  organizationId: string,
  userId: string,
  userAgent?: string,
  impersonatedBy?: string,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const nowMs = Date.now();
  await db.insert(sessions).values({
    id: digest(token),
    organizationId,
    userId,
    expiresAt: new Date(nowMs + ABSOLUTE_TIMEOUT_MS),
    lastSeenAt: new Date(nowMs),
    userAgent: userAgent?.slice(0, 200) ?? null,
    impersonatedBy: impersonatedBy ?? null,
  });
  return token;
}

export async function findSession(token: string | undefined): Promise<SessionLookup | null> {
  if (!token) return null;
  const key = digest(token);

  const [row] = await db.select().from(sessions).where(eq(sessions.id, key)).limit(1);
  if (!row) return null;

  const nowMs = Date.now();
  const idleDeadline = row.lastSeenAt.getTime() + IDLE_TIMEOUT_MS;
  if (nowMs > idleDeadline || nowMs > row.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, key));
    return null;
  }

  if (nowMs - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.update(sessions).set({ lastSeenAt: new Date(nowMs) }).where(eq(sessions.id, key));
  }

  return {
    organizationId: row.organizationId,
    userId: row.userId,
    expiresAt: row.expiresAt,
    idleExpiresAt: new Date(nowMs + IDLE_TIMEOUT_MS),
    impersonatedBy: row.impersonatedBy,
  };
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, digest(token)));
}

/** Used after any password change, which is what makes the old one useless. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db
    .delete(sessions)
    .where(and(eq(sessions.organizationId, currentOrgId()), eq(sessions.userId, userId)));
}

/** Suspending or deleting a company should not leave its people signed in. */
export async function revokeOrganizationSessions(organizationId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.organizationId, organizationId));
}

/**
 * The digest a cookie hashes to.
 *
 * Only for recognising which row in a list of sessions is the one asking: the
 * stored id is a digest precisely so the token itself never has to leave the
 * browser, and nothing here reverses that.
 */
export const sessionKeyFor = digest;

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

