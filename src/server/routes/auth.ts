import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@core/contracts";
import { accessLevel, PLANS, trialDaysLeft } from "@core/plans";
import { requireUser, sessionOf } from "../auth/guards";
import { hashPassword, verifyPassword } from "../auth/password";
import {
  ABSOLUTE_TIMEOUT_MS,
  createSession,
  revokeAllSessions,
  revokeSession,
  SESSION_COOKIE,
} from "../auth/session";
import { db, platformDb } from "../db/client";
import { currentOrgId } from "../db/context";
import { organizations, type OrganizationRow } from "../db/platform-schema";
import { passwordResets, users, type UserRow } from "../db/schema";
import { runInTenant } from "../db/tenant";
import { env, isProduction } from "../env";
import type { AppEnv } from "../http/app-env";
import { conflict, forbidden, invalid, unauthenticated } from "../http/errors";
import { rateLimit } from "../http/rate-limit";
import { validate } from "../http/validate";
import { createOrganization, seatsUsed } from "../services/organizations";
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
  const organizationId = currentOrgId();
  // Any earlier link stops working the moment a new one is issued.
  await db
    .delete(passwordResets)
    .where(and(eq(passwordResets.organizationId, organizationId), eq(passwordResets.userId, userId)));
  await db.insert(passwordResets).values({
    id: tokenDigest(token),
    organizationId,
    userId,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

/**
 * Every account with this address, in whichever companies hold one.
 *
 * This is the one query in the application that is allowed to look across all
 * of them, and it is why the platform connection exists: at sign-in there is no
 * organization yet to be inside of. It reads nothing but what is needed to
 * check a password.
 */
async function accountsFor(email: string) {
  const rows = await platformDb
    .select({ user: users, organization: organizations })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    // A deactivated account is not an account: it cannot be signed into, and
    // it cannot be resolved for a password reset either.
    .where(and(eq(users.email, email.toLowerCase()), isNull(users.deactivatedAt)));
  return rows;
}

export function organizationSummary(organization: OrganizationRow, seats: number) {
  const now = new Date();
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    companyName: organization.companyName ?? organization.name,
    plan: organization.plan,
    planName: PLANS[organization.plan].name,
    status: organization.status,
    access: accessLevel({
      status: organization.status,
      trialEndsAt: organization.trialEndsAt,
      pastDueSince: organization.pastDueSince,
      now,
    }),
    trialEndsAt: organization.trialEndsAt?.toISOString() ?? null,
    trialDaysLeft: organization.status === "TRIAL" ? trialDaysLeft(organization.trialEndsAt, now) : null,
    seatsUsed: seats,
    seatLimit: PLANS[organization.plan].maxEmployees,
  };
}

export const authRoutes = new Hono<AppEnv>()
  /** What the sign-in screen needs before anyone has identified themselves. */
  .get("/state", (c) =>
    c.json({ appName: env.APP_NAME, signupEnabled: env.SIGNUP_ENABLED }),
  )

  .post(
    "/signup",
    rateLimit("signup", 5, 60 * 60_000),
    validate("json", signupSchema),
    async (c) => {
      if (!env.SIGNUP_ENABLED) {
        throw forbidden("La registrazione libera non è attiva su questa installazione");
      }

      const input = c.req.valid("json");
      const email = input.email.toLowerCase();

      // Not an oracle in the way the sign-in form is: an address that already
      // has an account somewhere still gets a clear answer here, because the
      // alternative is a person who cannot tell why nothing happened. The rate
      // limit above is what makes enumerating addresses impractical.
      const existing = await accountsFor(email);
      if (existing.length > 0) {
        throw conflict("Questo indirizzo ha già un account: accedi invece di registrarti");
      }

      const { organization, adminId } = await createOrganization({
        organizationName: input.organizationName,
        adminName: input.name,
        adminEmail: email,
        adminPassword: input.password,
      });

      issueCookie(c, await createSession(organization.id, adminId, c.req.header("user-agent")));
      return c.json({ ok: true, organization: { id: organization.id, name: organization.name } }, 201);
    },
  )

  .post("/login", rateLimit("login", 8, 15 * 60_000), validate("json", loginSchema), async (c) => {
    const { email, password, organizationId } = c.req.valid("json");

    const candidates = await accountsFor(email);
    const scoped = organizationId
      ? candidates.filter((row) => row.organization.id === organizationId)
      : candidates;

    // An unknown address still pays for one verification, so the response time
    // does not reveal which accounts exist. The decoy hash is computed once.
    if (scoped.length === 0) {
      await verifyPassword(password, await decoyHash());
      throw unauthenticated("Email o password non corretti");
    }

    const matches: Array<{ user: UserRow; organization: OrganizationRow }> = [];
    for (const row of scoped) {
      if (await verifyPassword(password, row.user.passwordHash)) matches.push(row);
    }

    if (matches.length === 0) throw unauthenticated("Email o password non corretti");

    // The same person, same password, in two companies. Asking which one is
    // the only honest move; the list discloses nothing the password has not
    // already unlocked.
    if (matches.length > 1) {
      return c.json({
        ok: false,
        needsOrganizationChoice: true,
        organizations: matches.map((m) => ({ id: m.organization.id, name: m.organization.name })),
      });
    }

    const chosen = matches[0]!;
    issueCookie(
      c,
      await createSession(chosen.organization.id, chosen.user.id, c.req.header("user-agent")),
    );
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

      // One link per account. Somebody who keeps the books for two companies
      // has two passwords to forget, and the email says which is which.
      for (const { user, organization } of await accountsFor(email)) {
        await runInTenant(organization, async () => {
          await sendPasswordResetEmail(
            user.email,
            await issueResetToken(user.id, RESET_TTL_MS),
            organization.name,
          );
        });
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

      // The token is the only thing identifying the tenant here, so the lookup
      // has to happen before one is open.
      const [reset] = await platformDb
        .select()
        .from(passwordResets)
        .where(and(eq(passwordResets.id, tokenDigest(token)), isNull(passwordResets.usedAt)))
        .limit(1);

      if (!reset || reset.expiresAt.getTime() < Date.now()) {
        throw invalid("Link non valido o scaduto");
      }

      const passwordHash = await hashPassword(password);
      await runInTenant(reset.organizationId, async () => {
        await db
          .update(users)
          .set({ passwordHash, updatedAt: new Date() })
          .where(and(eq(users.organizationId, reset.organizationId), eq(users.id, reset.userId)));
        await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, reset.id));
        // Anyone holding an old session loses it, which is the point of a reset.
        await revokeAllSessions(reset.userId);
      });

      return c.json({ ok: true });
    },
  )

  .get("/me", requireUser, async (c) => {
    const { user, organization, idleExpiresAt, impersonatedBy } = sessionOf(c);
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
      organization: organizationSummary(organization, await seatsUsed()),
      /** Drives the banner: support being in your account is not a secret. */
      impersonated: Boolean(impersonatedBy),
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
      .where(and(eq(users.organizationId, currentOrgId()), eq(users.id, user.id)));
    await revokeAllSessions(user.id);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });

    return c.json({ ok: true });
  });

export { issueCookie, issueResetToken };
