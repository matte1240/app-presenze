/**
 * The back-office.
 *
 * A separate surface, not another role inside the application: its own table,
 * its own cookie, its own guard. Were "can administer the platform" a value in
 * the tenant `role` column, every path that writes that column would be a
 * possible way out of one customer's account and into everybody's.
 *
 * This router uses `platformDb` throughout, which is exempt from the isolation
 * policies — that is the point of it, and the reason it is the only router that
 * does.
 */
import { count, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { emailSchema, nameSchema, organizationNameSchema } from "@core/contracts";
import { isPlanId, ORG_STATUSES, PLAN_IDS, PLANS } from "@core/plans";
import { verifyPassword } from "../auth/password";
import {
  createPlatformSession,
  PLATFORM_ABSOLUTE_TIMEOUT_MS,
  PLATFORM_COOKIE,
  resolvePlatformSession,
  revokePlatformSession,
} from "../auth/platform";
import { createSession, revokeOrganizationSessions } from "../auth/session";
import { platformDb } from "../db/client";
import {
  organizations,
  platformAdmins,
  subscriptions,
  type PlatformAdminRow,
} from "../db/platform-schema";
import { users } from "../db/schema";
import { runInTenant } from "../db/tenant";
import { isProduction } from "../env";
import type { AppEnv } from "../http/app-env";
import { conflict, notFound, unauthenticated } from "../http/errors";
import { rateLimit } from "../http/rate-limit";
import { validate } from "../http/validate";
import { record, recentAudit } from "../services/audit";
import { sendWelcomeEmail } from "../services/email";
import { createOrganization } from "../services/organizations";
import { exportData } from "../services/export";
import { issueResetToken } from "./auth";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const requirePlatformAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const admin = await resolvePlatformSession(getCookie(c, PLATFORM_COOKIE));
  if (!admin) throw unauthenticated();
  c.set("platformAdmin", admin);
  await next();
});

function adminOf(c: { get: (k: "platformAdmin") => PlatformAdminRow | null }): PlatformAdminRow {
  const admin = c.get("platformAdmin");
  if (!admin) throw unauthenticated();
  return admin;
}

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });

const createOrganizationSchema = z.object({
  organizationName: organizationNameSchema,
  adminName: nameSchema,
  adminEmail: emailSchema,
  plan: z.string().refine((v): boolean => isPlanId(v), "Piano inesistente").optional(),
  trialDays: z.number().int().min(0).max(365).optional(),
});

const updateOrganizationSchema = z.object({
  plan: z.string().refine((v): boolean => isPlanId(v), "Piano inesistente").optional(),
  status: z.enum(ORG_STATUSES).optional(),
  /** Absolute, not a delta: an operator should see the date they are setting. */
  trialEndsAt: z.string().datetime().nullish(),
});

async function mustExist(id: string) {
  const [organization] = await platformDb
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);
  if (!organization) throw notFound("Organizzazione inesistente");
  return organization;
}

export const platformRoutes = new Hono<AppEnv>()
  .post(
    "/login",
    rateLimit("platform-login", 5, 15 * 60_000),
    validate("json", loginSchema),
    async (c) => {
      const { email, password } = c.req.valid("json");
      const [admin] = await platformDb
        .select()
        .from(platformAdmins)
        .where(eq(platformAdmins.email, email.toLowerCase()))
        .limit(1);

      if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
        throw unauthenticated("Email o password non corretti");
      }

      setCookie(c, PLATFORM_COOKIE, await createPlatformSession(admin.id, c.req.header("user-agent")), {
        httpOnly: true,
        sameSite: "Lax",
        secure: isProduction,
        // Scoped to the back-office, so it is not even sent with the requests
        // an ordinary user's browser makes.
        path: "/api/platform",
        maxAge: Math.floor(PLATFORM_ABSOLUTE_TIMEOUT_MS / 1000),
      });
      return c.json({ ok: true });
    },
  )

  .post("/logout", async (c) => {
    await revokePlatformSession(getCookie(c, PLATFORM_COOKIE));
    deleteCookie(c, PLATFORM_COOKIE, { path: "/api/platform" });
    return c.json({ ok: true });
  })

  .use("*", requirePlatformAdmin)

  .get("/me", (c) => {
    const admin = adminOf(c);
    return c.json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
  })

  .get("/organizations", async (c) => {
    const seats = platformDb
      .select({ organizationId: users.organizationId, total: count().as("total") })
      .from(users)
      .groupBy(users.organizationId)
      .as("seats");

    const rows = await platformDb
      .select({
        organization: organizations,
        seatsUsed: sql<number>`coalesce(${seats.total}, 0)`,
        stripeCustomerId: subscriptions.stripeCustomerId,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(organizations)
      .leftJoin(seats, eq(seats.organizationId, organizations.id))
      .leftJoin(subscriptions, eq(subscriptions.organizationId, organizations.id))
      .orderBy(desc(organizations.createdAt));

    return c.json({
      organizations: rows.map((row) => ({
        id: row.organization.id,
        name: row.organization.name,
        slug: row.organization.slug,
        status: row.organization.status,
        plan: row.organization.plan,
        planName: PLANS[row.organization.plan].name,
        seatsUsed: Number(row.seatsUsed),
        seatLimit: PLANS[row.organization.plan].maxEmployees,
        trialEndsAt: row.organization.trialEndsAt?.toISOString() ?? null,
        currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
        hasStripeCustomer: Boolean(row.stripeCustomerId),
        createdAt: row.organization.createdAt.toISOString(),
      })),
      plans: PLAN_IDS.map((id) => ({ id, name: PLANS[id].name, maxEmployees: PLANS[id].maxEmployees })),
    });
  })

  /** Assisted sales: you set the company up, the administrator gets an invite. */
  .post("/organizations", validate("json", createOrganizationSchema), async (c) => {
    const admin = adminOf(c);
    const input = c.req.valid("json");

    const clash = await platformDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.adminEmail.toLowerCase()))
      .limit(1);
    if (clash.length > 0) {
      throw conflict("Questo indirizzo ha già un account in un'altra organizzazione");
    }

    const { organization, adminId } = await createOrganization({
      organizationName: input.organizationName,
      adminName: input.adminName,
      adminEmail: input.adminEmail,
      plan: input.plan && isPlanId(input.plan) ? input.plan : undefined,
      trialDays: input.trialDays,
    });

    // No password was set, so the invite link is the only way in.
    const invited = await runInTenant(organization, async () =>
      sendWelcomeEmail(
        input.adminEmail.toLowerCase(),
        input.adminName,
        await issueResetToken(adminId, INVITE_TTL_MS),
        organization.name,
      ),
    );

    await record({
      organizationId: organization.id,
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      actorLabel: admin.email,
      action: "organization.created",
      detail: { plan: organization.plan, adminEmail: input.adminEmail },
    });

    return c.json({ organization: { id: organization.id, name: organization.name }, invited }, 201);
  })

  .patch("/organizations/:id", validate("json", updateOrganizationSchema), async (c) => {
    const admin = adminOf(c);
    const organization = await mustExist(c.req.param("id"));
    const payload = c.req.valid("json");

    const [updated] = await platformDb
      .update(organizations)
      .set({
        ...(payload.plan && isPlanId(payload.plan) ? { plan: payload.plan } : {}),
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.trialEndsAt !== undefined
          ? { trialEndsAt: payload.trialEndsAt ? new Date(payload.trialEndsAt) : null }
          : {}),
        // Reinstating a company clears the failed-payment clock; leaving it set
        // would put them straight back into the grace period they just left.
        ...(payload.status === "ACTIVE" ? { pastDueSince: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organization.id))
      .returning();

    // Suspending should take effect now, not whenever the open tabs happen to
    // reload.
    if (payload.status === "SUSPENDED" || payload.status === "CANCELLED") {
      await revokeOrganizationSessions(organization.id);
    }

    await record({
      organizationId: organization.id,
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      actorLabel: admin.email,
      action: "organization.updated",
      detail: {
        from: { plan: organization.plan, status: organization.status },
        to: { plan: updated!.plan, status: updated!.status },
      },
    });

    return c.json({ organization: { id: updated!.id, plan: updated!.plan, status: updated!.status } });
  })

  /**
   * Opens a tenant session as one of the company's administrators.
   *
   * Always audited, and always marked: the session carries `impersonatedBy`, so
   * the application shows a banner and the customer can see that somebody from
   * support was in their account rather than having to take our word for it.
   */
  .post("/organizations/:id/impersonate", async (c) => {
    const admin = adminOf(c);
    const organization = await mustExist(c.req.param("id"));

    const [target] = await platformDb
      .select()
      .from(users)
      .where(eq(users.organizationId, organization.id))
      .orderBy(users.role, users.createdAt)
      .limit(1);
    if (!target || target.role !== "ADMIN") {
      throw notFound("Questa organizzazione non ha ancora un amministratore");
    }

    await record({
      organizationId: organization.id,
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      actorLabel: admin.email,
      action: "organization.impersonated",
      detail: { asUser: target.email },
    });

    const token = await createSession(organization.id, target.id, c.req.header("user-agent"), admin.id);
    setCookie(c, "presenze_session", token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: isProduction,
      path: "/",
    });
    return c.json({ ok: true, as: { name: target.name, email: target.email } });
  })

  .get("/organizations/:id/export", async (c) => {
    const admin = adminOf(c);
    const organization = await mustExist(c.req.param("id"));

    const data = await runInTenant(organization, exportData);
    await record({
      organizationId: organization.id,
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      actorLabel: admin.email,
      action: "organization.exported",
    });

    return c.body(JSON.stringify(data, null, 2), 200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${organization.slug}.json"`,
    });
  })

  .get("/audit", async (c) => {
    const organizationId = c.req.query("organizationId");
    const rows = await recentAudit(100, organizationId);
    return c.json({ entries: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
  });

