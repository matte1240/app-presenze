/**
 * Authorization, expressed on the route that needs it.
 *
 * The old build kept this in path regexes inside an edge middleware, several
 * files away from the handlers. That is precisely how the database restore
 * endpoint ended up listed as public while its handler assumed the middleware
 * had checked for an admin — any logged-in employee could overwrite the
 * database. A guard that sits on the route cannot fall out of step with it.
 */
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { UserRow } from "../db/schema";
import { forbidden, unauthenticated } from "../http/errors";
import type { AppEnv } from "../http/app-env";
import { resolveSession, SESSION_COOKIE, type ActiveSession } from "./session";

export const loadSession = createMiddleware<AppEnv>(async (c, next) => {
  c.set("session", await resolveSession(getCookie(c, SESSION_COOKIE)));
  await next();
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

/** Narrowing helper for handlers that already sit behind a guard. */
export function sessionOf(c: { get: (k: "session") => ActiveSession | null }): ActiveSession {
  const session = c.get("session");
  if (!session) throw unauthenticated();
  return session;
}

export const isAdmin = (user: UserRow) => user.role === "ADMIN";

/**
 * Employees may only ever act on themselves; admins may name anyone. Returns
 * the user id the request should operate on.
 */
export function resolveTargetUser(session: ActiveSession, requested: string | undefined): string {
  if (!requested || requested === session.user.id) return session.user.id;
  if (!isAdmin(session.user)) throw forbidden("Puoi operare solo sui tuoi dati");
  return requested;
}
