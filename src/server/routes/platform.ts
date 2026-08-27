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
import { randomUUID } from "node:crypto";
import { count, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { emailSchema, nameSchema, organizationNameSchema, passwordSchema } from "@core/contracts";
import { isPlanId, ORG_STATUSES, PLAN_IDS, PLANS } from "@core/plans";
import { hashPassword, verifyPassword } from "../auth/password";
import {
  createPlatformSession,
  PLATFORM_ABSOLUTE_TIMEOUT_MS,
  PLATFORM_COOKIE,
  resolvePlatformSession,
  revokePlatformSession,
} from "../auth/platform";
import {
  createSession,
  revokeOrganizationSessions,
  revokeSession,
  SESSION_COOKIE,
} from "../auth/session";
import { platformDb } from "../db/client";
import {
  organizations,
  platformAdmins,
  subscriptions,
  type PlatformAdminRow,
} from "../db/platform-schema";
import { timeEntries, users } from "../db/schema";
import { runInTenant } from "../db/tenant";
import { isProduction, s3Enabled } from "../env";
import type { AppEnv } from "../http/app-env";
import { conflict, forbidden, invalid, notFound, unauthenticated } from "../http/errors";
import { rateLimit } from "../http/rate-limit";
import { validate } from "../http/validate";
import { record, recentAudit } from "../services/audit";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../services/email";
import { createOrganization } from "../services/organizations";
import { exportData } from "../services/export";
import {
  createOrgBackup,
  deleteOrgBackup,
  listOrgBackups,
  orgBackupInfo,
  presignedOrgBackupDownloadUrl,
  restoreOrgBackup,
} from "../services/org-backup";
import { issueResetToken } from "./auth";
import { platformBackupRoutes } from "./platform-backups";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * While `mustChangePassword` is set, these are the only two things the account
 * can do: see who it is, and pick its own password.
 */
const ALLOWED_WHILE_LOCKED = new Set(["/api/platform/me", "/api/platform/admins/me/password"]);

const requirePlatformAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const admin = await resolvePlatformSession(getCookie(c, PLATFORM_COOKIE));
  if (!admin) throw unauthenticated();

  // A password somebody else chose gets an account far enough to replace it and
  // no further; otherwise a temporary password is simply a permanent one that
  // two people know.
  if (admin.mustChangePassword && !ALLOWED_WHILE_LOCKED.has(c.req.path)) {
    throw forbidden("Devi prima scegliere una nuova password");
  }

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

const createAdminSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  /** Temporary by construction: its owner is made to replace it at first use. */
  temporaryPassword: passwordSchema,
});

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

/** `backup-<timestamp>.json` or `pre-restore-<timestamp>.json` — never anything a client made up. */
const ORG_BACKUP_FILENAME_PATTERN = /^(backup|pre-restore)-[0-9TZ-]+\.json$/;

function assertKnownOrgBackupFilename(filename: string): void {
  if (!ORG_BACKUP_FILENAME_PATTERN.test(filename)) throw invalid("Nome del backup non valido");
}

const restoreOrgBackupSchema = z.object({
  /** Must equal the filename in the URL, same as the whole-database restore. */
  confirm: z.string(),
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

  // Whole-database backups: every route here reaches every customer's data at
  // once, which is exactly why it lives behind this guard and nowhere near a
  // tenant's own "maintenance" screen.
  .route("/backups", platformBackupRoutes)

  .get("/me", async (c) => {
    // Not `adminOf`: this route is reachable while locked, and the guard does
    // not populate the context in that case.
    const admin = await resolvePlatformSession(getCookie(c, PLATFORM_COOKIE));
    if (!admin) throw unauthenticated();
    return c.json({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        mustChangePassword: admin.mustChangePassword,
      },
    });
  })

  // ── Administrators ──────────────────────────────────────────────────────

  .get("/admins", async (c) => {
    const rows = await platformDb
      .select({
        id: platformAdmins.id,
        name: platformAdmins.name,
        email: platformAdmins.email,
        mustChangePassword: platformAdmins.mustChangePassword,
        createdAt: platformAdmins.createdAt,
      })
      .from(platformAdmins)
      .orderBy(platformAdmins.createdAt);

    return c.json({
      admins: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      me: adminOf(c).id,
    });
  })

  .post("/admins", validate("json", createAdminSchema), async (c) => {
    const admin = adminOf(c);
    const input = c.req.valid("json");
    const email = input.email.toLowerCase();

    const [clash] = await platformDb
      .select({ id: platformAdmins.id })
      .from(platformAdmins)
      .where(eq(platformAdmins.email, email))
      .limit(1);
    if (clash) throw conflict("Esiste già un amministratore con questa email");

    const [created] = await platformDb
      .insert(platformAdmins)
      .values({
        id: randomUUID(),
        name: input.name,
        email,
        passwordHash: await hashPassword(input.temporaryPassword),
        mustChangePassword: true,
      })
      .returning({ id: platformAdmins.id });

    await record({
      organizationId: null,
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      actorLabel: admin.email,
      action: "platform_admin.created",
      detail: { email },
    });

    return c.json({ admin: { id: created!.id } }, 201);
  })

  .post("/admins/me/password", validate("json", changeOwnPasswordSchema), async (c) => {
    // Reachable while locked, so the admin is resolved directly again.
    const admin = await resolvePlatformSession(getCookie(c, PLATFORM_COOKIE));
    if (!admin) throw unauthenticated();

    const { currentPassword, newPassword } = c.req.valid("json");
    if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
      throw unauthenticated("La password attuale non è corretta");
    }
    if (await verifyPassword(newPassword, admin.passwordHash)) {
      throw conflict("La nuova password deve essere diversa da quella attuale");
    }

    await platformDb
      .update(platformAdmins)
      .set({
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(platformAdmins.id, admin.id));

    return c.json({ ok: true });
  })

  .delete("/admins/:id", async (c) => {
    const admin = adminOf(c);
    const id = c.req.param("id");
    if (id === admin.id) throw forbidden("Non puoi eliminare il tuo stesso account");

    // Never the last one: an installation with no back-office account has no
    // way back in short of editing the database by hand.
    const [remaining] = await platformDb.select({ total: count() }).from(platformAdmins);
    if (Number(remaining?.total ?? 0) <= 1) throw conflict("Deve restare almeno un amministratore");

    const [removed] = await platformDb
      .delete(platformAdmins)
      .where(eq(platformAdmins.id, id))
      .returning({ email: platformAdmins.email });
    if (!removed) throw notFound("Amministratore inesistente");

    await record({
      organizationId: null,
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      actorLabel: admin.email,
      action: "platform_admin.deleted",
      detail: { email: removed.email },
    });

    return c.json({ ok: true });
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

  /** Everything about one customer, in one place instead of a table row. */
  .get("/organizations/:id", async (c) => {
    const organization = await mustExist(c.req.param("id"));

    const [people, subscription, audit] = await Promise.all([
      platformDb
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          deactivatedAt: users.deactivatedAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.organizationId, organization.id))
        .orderBy(users.name),
      platformDb
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.organizationId, organization.id))
        .limit(1),
      recentAudit(30, organization.id),
    ]);

    return c.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        plan: organization.plan,
        planName: PLANS[organization.plan].name,
        seatLimit: PLANS[organization.plan].maxEmployees,
        seatsUsed: people.filter((p) => !p.deactivatedAt).length,
        trialEndsAt: organization.trialEndsAt?.toISOString() ?? null,
        pastDueSince: organization.pastDueSince?.toISOString() ?? null,
        timezone: organization.timezone,
        holidayPatronDays: organization.holidayPatronDays,
        createdAt: organization.createdAt.toISOString(),
      },
      users: people.map((p) => ({
        ...p,
        deactivatedAt: p.deactivatedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      subscription: subscription[0]
        ? {
            stripeCustomerId: subscription[0].stripeCustomerId,
            stripeStatus: subscription[0].stripeStatus,
            currentPeriodEnd: subscription[0].currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: subscription[0].cancelAtPeriodEnd === "true",
          }
        : null,
      audit: audit.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    });
  })

  /**
   * What closing an account would destroy, so the confirmation can name it
   * rather than gesture at it.
   */
  .get("/organizations/:id/deletion-preview", async (c) => {
    const organization = await mustExist(c.req.param("id"));

    const [people] = await platformDb
      .select({ total: count() })
      .from(users)
      .where(eq(users.organizationId, organization.id));
    const [entries] = await platformDb
      .select({ total: count() })
      .from(timeEntries)
      .where(eq(timeEntries.organizationId, organization.id));

    return c.json({
      users: Number(people?.total ?? 0),
      timeEntries: Number(entries?.total ?? 0),
    });
  })

  /**
   * Closing an account for good — a request to be forgotten, or a customer who
   * asked to be removed. Everything cascades from `organizations`, so this one
   * statement takes the people, the timesheets and the requests with it.
   */
  .delete("/organizations/:id", async (c) => {
    const admin = adminOf(c);
    const organization = await mustExist(c.req.param("id"));

    await revokeOrganizationSessions(organization.id);
    await platformDb.delete(organizations).where(eq(organizations.id, organization.id));

    // Written after the fact and with the organization id nulled by the
    // cascade, so the label is what survives to say who did what.
    await record({
      organizationId: null,
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      actorLabel: admin.email,
      action: "organization.deleted",
      detail: { name: organization.name, slug: organization.slug },
    });

    return c.json({ ok: true });
  })

  /**
   * Leaving a customer's account without signing out of the back office.
   *
   * The two cookies coexist — the platform one is scoped to `/api/platform` —
   * so this only has to end the tenant session and clear its cookie.
   */
  .post("/stop-impersonation", async (c) => {
    await revokeSession(getCookie(c, SESSION_COOKIE));
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
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

  // ── Per-organization backups ────────────────────────────────────────────
  // The same JSON `export` above, kept on S3 instead of a downloads folder,
  // with the restore that a plain export never had — scoped to this one
  // organization, never touching another customer's data.

  .get("/organizations/:id/backups", async (c) => {
    const organization = await mustExist(c.req.param("id"));
    const backups = s3Enabled ? await listOrgBackups(organization.id) : [];
    return c.json({ enabled: s3Enabled, backups });
  })

  .post("/organizations/:id/backups", async (c) => {
    const admin = adminOf(c);
    const organization = await mustExist(c.req.param("id"));

    const backup = await runInTenant(organization, () => createOrgBackup());

    await record({
      organizationId: organization.id,
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      actorLabel: admin.email,
      action: "organization.backup_created",
      detail: { filename: backup.filename, sizeBytes: backup.sizeBytes },
    });

    return c.json({ backup }, 201);
  })

  .get("/organizations/:id/backups/:filename/download", async (c) => {
    const organization = await mustExist(c.req.param("id"));
    const filename = c.req.param("filename");
    assertKnownOrgBackupFilename(filename);
    if (!(await orgBackupInfo(organization.id, filename))) throw notFound("Backup inesistente");

    const url = await presignedOrgBackupDownloadUrl(organization.id, filename);
    return c.redirect(url, 302);
  })

  .post(
    "/organizations/:id/backups/:filename/restore",
    validate("json", restoreOrgBackupSchema),
    async (c) => {
      const admin = adminOf(c);
      const organization = await mustExist(c.req.param("id"));
      const filename = c.req.param("filename");
      assertKnownOrgBackupFilename(filename);

      const { confirm } = c.req.valid("json");
      if (confirm !== filename) {
        throw invalid("Il nome digitato non corrisponde al backup da ripristinare");
      }
      if (!(await orgBackupInfo(organization.id, filename))) throw notFound("Backup inesistente");

      const result = await runInTenant(organization, () => restoreOrgBackup(filename));

      // The export never carries password hashes, so a reset link is the only
      // way any of these accounts works again.
      let emailed = 0;
      for (const restored of result.users) {
        const sent = await runInTenant(organization, async () =>
          sendPasswordResetEmail(restored.email, await issueResetToken(restored.id, INVITE_TTL_MS), organization.name),
        );
        if (sent) emailed += 1;
      }

      await record({
        organizationId: organization.id,
        actorType: "PLATFORM_ADMIN",
        actorId: admin.id,
        actorLabel: admin.email,
        action: "organization.restored",
        detail: {
          filename,
          safetyBackup: result.safetyBackup,
          usersRestored: result.users.length,
          emailed,
        },
      });

      return c.json({
        ok: true,
        safetyBackup: result.safetyBackup,
        usersRestored: result.users.length,
        emailed,
      });
    },
  )

  .delete("/organizations/:id/backups/:filename", async (c) => {
    const admin = adminOf(c);
    const organization = await mustExist(c.req.param("id"));
    const filename = c.req.param("filename");
    assertKnownOrgBackupFilename(filename);
    if (!(await orgBackupInfo(organization.id, filename))) throw notFound("Backup inesistente");

    await deleteOrgBackup(organization.id, filename);

    await record({
      organizationId: organization.id,
      actorType: "PLATFORM_ADMIN",
      actorId: admin.id,
      actorLabel: admin.email,
      action: "organization.backup_deleted",
      detail: { filename },
    });

    return c.json({ ok: true });
  })

  .get("/audit", async (c) => {
    const organizationId = c.req.query("organizationId");
    const rows = await recentAudit(100, organizationId);
    return c.json({ entries: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
  });

