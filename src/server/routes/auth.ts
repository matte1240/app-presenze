import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  setupSchema,
} from "@core/contracts";
import { requireUser, sessionOf } from "../auth/guards";
import { hashPassword, verifyPassword } from "../auth/password";
import {
  ABSOLUTE_TIMEOUT_MS,
  createSession,
  revokeAllSessions,
  revokeSession,
  SESSION_COOKIE,
} from "../auth/session";
import { db } from "../db/client";
import { passwordResets, users } from "../db/schema";
import { env, isProduction } from "../env";
import type { AppEnv } from "../http/app-env";
import { conflict, forbidden, invalid, unauthenticated } from "../http/errors";
import { rateLimit } from "../http/rate-limit";
import { validate } from "../http/validate";
import { createDefaultSchedules } from "../services/schedules";
import { sendPasswordResetEmail } from "../services/email";

const RESET_TTL_MS = 60 * 60 * 1000;

const tokenDigest = (token: string) => createHash("sha256").update(token).digest("hex");

let decoy: Promise<string> | null = null;
const decoyHash = () => (decoy ??= hashPassword(randomBytes(24).toString("hex")));

function issueCookie(c: Context, token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isProduction,
    path: "/",
    maxAge: Math.floor(ABSOLUTE_TIMEOUT_MS / 1000),
  });
}

async function issueResetToken(userId: string, ttlMs: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  // Any earlier link stops working the moment a new one is issued.
  await db.delete(passwordResets).where(eq(passwordResets.userId, userId));
  await db.insert(passwordResets).values({
    id: tokenDigest(token),
    userId,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

export const authRoutes = new Hono<AppEnv>()
  /** Whether the instance still needs its first administrator. */
  .get("/state", async (c) => {
    const [row] = await db.select({ count: sql<number>`count(*)` }).from(users);
    return c.json({
      needsSetup: (row?.count ?? 0) === 0,
      appName: env.APP_NAME,
      companyName: env.COMPANY_NAME,
    });
  })

  .post("/setup", validate("json", setupSchema), async (c) => {
    const input = c.req.valid("json");

    // Hashing first keeps the transaction synchronous, which is what makes the
    // count and the insert atomic: two simultaneous requests cannot both
    // decide they are the first administrator.
    const passwordHash = await hashPassword(input.password);
    const userId = randomUUID();

    const created = db.transaction((tx) => {
      const [row] = tx.select({ count: sql<number>`count(*)` }).from(users).all();
      if ((row?.count ?? 0) > 0) return false;
      tx.insert(users)
        .values({
          id: userId,
          name: input.name,
          email: input.email.toLowerCase(),
          passwordHash,
          role: "ADMIN",
        })
        .run();
      return true;
    });
    if (!created) throw forbidden("La configurazione iniziale è già stata completata");

    await createDefaultSchedules(userId);

    const token = await createSession(userId, c.req.header("user-agent"));
    issueCookie(c, token);
    return c.json({ ok: true }, 201);
  })

  .post("/login", rateLimit("login", 8, 15 * 60_000), validate("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

    // An unknown address still pays for one verification, so the response time
    // does not reveal which accounts exist. The decoy hash is computed once.
    const ok = await verifyPassword(password, user?.passwordHash ?? (await decoyHash()));

    if (!user || !ok) throw unauthenticated("Email o password non corretti");

    issueCookie(c, await createSession(user.id, c.req.header("user-agent")));
    return c.json({ ok: true });
  })

  .post("/logout", async (c) => {
    await revokeSession(getCookie(c, SESSION_COOKIE));
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  })

  .post(
    "/forgot-password",
    rateLimit("forgot", 5, 15 * 60_000),
    validate("json", forgotPasswordSchema),
    async (c) => {
      const { email } = c.req.valid("json");
      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

      if (user) {
        await sendPasswordResetEmail(user.email, await issueResetToken(user.id, RESET_TTL_MS));
      }

      // Always the same answer: this endpoint is not an address oracle.
      return c.json({ ok: true });
    },
  )

  .post(
    "/reset-password",
    rateLimit("reset", 10, 15 * 60_000),
    validate("json", resetPasswordSchema),
    async (c) => {
      const { token, password } = c.req.valid("json");
      const [reset] = await db
        .select()
        .from(passwordResets)
        .where(and(eq(passwordResets.id, tokenDigest(token)), isNull(passwordResets.usedAt)))
        .limit(1);

      if (!reset || reset.expiresAt.getTime() < Date.now()) {
        throw invalid("Link non valido o scaduto");
      }

      const passwordHash = await hashPassword(password);
      await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, reset.userId));
      await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, reset.id));
      // Anyone holding an old session loses it, which is the point of a reset.
      await revokeAllSessions(reset.userId);

      return c.json({ ok: true });
    },
  )

  .get("/me", requireUser, (c) => {
    const { user, idleExpiresAt } = sessionOf(c);
    return c.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        canWorkSunday: user.canWorkSunday,
        has104: user.has104,
        hasPaternity: user.hasPaternity,
        /** The calendar uses this so it never reports gaps predating the hire. */
        createdAt: user.createdAt.toISOString(),
      },
      /** Drives the idle warning in the SPA; the server remains the authority. */
      idleExpiresAt: idleExpiresAt.toISOString(),
    });
  })

  .post("/change-password", requireUser, validate("json", changePasswordSchema), async (c) => {
    const { user } = sessionOf(c);
    const { currentPassword, newPassword } = c.req.valid("json");

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw invalid("La password attuale non è corretta");
    }
    if (await verifyPassword(newPassword, user.passwordHash)) {
      throw conflict("La nuova password deve essere diversa da quella attuale");
    }

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await revokeAllSessions(user.id);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });

    return c.json({ ok: true });
  });

export { issueResetToken, issueCookie };
