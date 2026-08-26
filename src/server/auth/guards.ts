/**
 * Authorization, expressed on the route that needs it.
 *
 * The old build kept this in path regexes inside an edge middleware, several
 * files away from the handlers. That is precisely how the database restore
 * endpoint ended up listed as public while its handler assumed the middleware
 * had checked for an admin — any logged-in employee could overwrite the
 * database. A guard that sits on the route cannot fall out of step with it.
 *
 * Tenancy follows the same rule. `loadSession` opens the tenant and runs the
 * rest of the request inside it, so a handler cannot be reached with the wrong
 * organization current, or with none.
 */
import { and, eq } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { accessLevel } from "@core/plans";
import { db } from "../db/client";
import { currentOrg } from "../db/context";
import type { OrganizationRow } from "../db/platform-schema";
import { users, type UserRow } from "../db/schema";
import { runInTenant, UnknownOrganizationError } from "../db/tenant";
import { forbidden, unauthenticated } from "../http/errors";
import type { AppEnv } from "../http/app-env";
import { findSession, SESSION_COOKIE, type ActiveSession } from "./session";

export const loadSession = createMiddleware<AppEnv>(async (c, next) => {
  const found = await findSession(getCookie(c, SESSION_COOKIE));
  if (!found) {
    c.set("session", null);
    return next();
  }

  try {
    // The whole downstream request runs inside this transaction, with
    // `app.current_org_id` set on it. That is deliberate: it is what makes the
    // isolation policies apply to every query a handler makes, and it means a
    // request that fails half way leaves nothing behind.
    await runInTenant(found.organizationId, async () => {
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.organizationId, found.organizationId), eq(users.id, found.userId)))
        .limit(1);

      // Deleted mid-session: the cookie is stale, not privileged.
      if (!user) {
        c.set("session", null);
        return next();
      }

      c.set("session", {
        user,
        organization: currentOrg(),
        expiresAt: found.expiresAt,
        idleExpiresAt: found.idleExpiresAt,
      });
      await next();
    });
  } catch (error) {
    // The organization was deleted while the cookie survived it.
    if (!(error instanceof UnknownOrganizationError)) throw error;
    c.set("session", null);
    await next();
  }
});

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("session")) throw unauthenticated();
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const session = c.get("session");
  if (!session) throw unauthenticated();
  if (session.user.role !== "ADMIN") throw forbidden();
  await next();
});

/** Reads only; a subscription problem never stops someone consulting their data. */
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * What an unpaid or lapsed subscription actually costs a company: they may read
 * and export everything they have, and record nothing new.
 *
 * Read-only, never destructive, and never a lock-out. Holding a company's
 * timesheets hostage would be both wrong and useless — the leverage is that the
 * application stops being usable for today's work, which is felt immediately,
 * whereas deleting last year's data would only be felt once and never forgiven.
 *
 * Deliberately absent from `auth`, `billing` and `reports`: paying, and taking
 * your data with you, must both keep working.
 */
export const requireActiveSubscription = createMiddleware<AppEnv>(async (c, next) => {
  const session = c.get("session");
  if (!session) throw unauthenticated();
  if (READ_ONLY_METHODS.has(c.req.method)) return next();

  const { organization } = session;
  const level = accessLevel({
    status: organization.status,
    trialEndsAt: organization.trialEndsAt,
    pastDueSince: organization.pastDueSince,
    now: new Date(),
  });

  if (level === "read-only") {
    throw forbidden(
      "L'abbonamento non è attivo: puoi consultare ed esportare i dati, ma non modificarli.",
    );
  }
  await next();
});

/** Narrowing helper for handlers that already sit behind a guard. */
export function sessionOf(c: { get: (k: "session") => ActiveSession | null }): ActiveSession {
  const session = c.get("session");
  if (!session) throw unauthenticated();
  return session;
}

export function orgOf(c: { get: (k: "session") => ActiveSession | null }): OrganizationRow {
  return sessionOf(c).organization;
}

export const isAdmin = (user: UserRow) => user.role === "ADMIN";

/**
 * Employees may only ever act on themselves; admins may name anyone. Returns
 * the user id the request should operate on. Which organization that id has to
 * belong to is not decided here — every query is already fenced to the tenant
 * in context, so an id from elsewhere simply matches nothing.
 */
export function resolveTargetUser(session: ActiveSession, requested: string | undefined): string {
  if (!requested || requested === session.user.id) return session.user.id;
  if (!isAdmin(session.user)) throw forbidden("Puoi operare solo sui tuoi dati");
  return requested;
}
