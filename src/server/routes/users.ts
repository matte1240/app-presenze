import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Weekday } from "@core/date";
import { adminResetPasswordSchema, createUserSchema, updateUserSchema, weekSchedulePayloadSchema } from "@core/contracts";
import type { DaySchedule } from "@core/schedule";
import { toClock, type Span } from "@core/time";
import { seatsAvailable, smallestPlanFor, PLANS } from "@core/plans";
import { orgOf, requireAdmin, requireUser, sessionOf } from "../auth/guards";
import { hashPassword } from "../auth/password";
import { revokeAllSessions } from "../auth/session";
import { db } from "../db/client";
import { currentOrgId } from "../db/context";
import { timeEntries, users } from "../db/schema";
import type { AppEnv } from "../http/app-env";
import { conflict, forbidden, notFound } from "../http/errors";
import { validate } from "../http/validate";
import { issueResetToken } from "./auth";
import {
  sendMissingTimesheetReminder,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "../services/email";
import {
  createDefaultSchedules,
  replaceSchedules,
  scheduleRowsOf,
  weekScheduleOf,
} from "../services/schedules";
import { emailTaken, seatsUsed } from "../services/organizations";
import { missingDaysFor } from "../services/timesheet";

const WELCOME_TTL_MS = 24 * 60 * 60 * 1000;

const publicUser = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  canWorkSunday: users.canWorkSunday,
  has104: users.has104,
  hasPaternity: users.hasPaternity,
  createdAt: users.createdAt,
};

/**
 * Not found, never forbidden, for an id belonging to another company: a 403
 * would confirm that the id exists, which is a thing about someone else's data
 * that this caller has no business learning.
 */
async function mustExist(id: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.organizationId, currentOrgId()), eq(users.id, id)))
    .limit(1);
  if (!user) throw notFound("Utente inesistente");
  return user;
}

const toSpan = (s: { start: string; end: string } | null): Span | null =>
  s ? { start: toClock(s.start), end: toClock(s.end) } : null;

/** The employee's own schedule, readable without admin rights. */
export const meRoutes = new Hono<AppEnv>()
  .use("*", requireUser)
  .get("/schedule", async (c) => {
    const session = sessionOf(c);
    return c.json({
      days: await scheduleRowsOf(session.user.id),
      canWorkSunday: session.user.canWorkSunday,
    });
  })
  .get("/missing-days", async (c) => {
    const session = sessionOf(c);
    const week = await weekScheduleOf(session.user.id);
    return c.json(await missingDaysFor(session.user.id, week));
  });

export const userRoutes = new Hono<AppEnv>()
  .use("*", requireAdmin)

  .get("/", async (c) => {
    const organizationId = currentOrgId();

    const totals = db
      .select({
        userId: timeEntries.userId,
        regular: sql<number>`coalesce(sum(${timeEntries.regularHours}), 0)`.as("regular"),
        overtime: sql<number>`coalesce(sum(${timeEntries.overtimeHours}), 0)`.as("overtime"),
      })
      .from(timeEntries)
      .where(eq(timeEntries.organizationId, organizationId))
      .groupBy(timeEntries.userId)
      .as("totals");

    const rows = await db
      .select({ ...publicUser, regularHours: totals.regular, overtimeHours: totals.overtime })
      .from(users)
      .leftJoin(totals, eq(totals.userId, users.id))
      .where(eq(users.organizationId, organizationId))
      .orderBy(users.name);

    return c.json({ users: rows });
  })

  .post("/", validate("json", createUserSchema), async (c) => {
    const payload = c.req.valid("json");
    const organization = orgOf(c);
    const email = payload.email.toLowerCase();

    if (await emailTaken(email)) throw conflict("Esiste già un utente con questa email");

    // The seat limit is checked here rather than at sign-in, so nobody is ever
    // locked out of an account they already had because the plan changed.
    const used = await seatsUsed();
    if (!seatsAvailable(organization.plan, used)) {
      const next = smallestPlanFor(used + 1);
      throw conflict(
        next
          ? `Il piano ${PLANS[organization.plan].name} arriva a ${PLANS[organization.plan].maxEmployees} persone. ` +
              `Passa al piano ${next.name} per aggiungerne altre.`
          : "Limite di utenti raggiunto per questo piano.",
      );
    }

    const id = randomUUID();
    // Without a password the account is created locked behind a setup link,
    // rather than behind a shared default everybody knows.
    const passwordHash = await hashPassword(payload.password ?? randomUUID());

    await db.insert(users).values({
      id,
      organizationId: organization.id,
      name: payload.name,
      email,
      passwordHash,
      role: payload.role,
      canWorkSunday: payload.canWorkSunday ?? false,
      has104: payload.has104 ?? false,
      hasPaternity: payload.hasPaternity ?? false,
    });
    await createDefaultSchedules(id);

    let invited = false;
    if (!payload.password) {
      invited = await sendWelcomeEmail(
        email,
        payload.name,
        await issueResetToken(id, WELCOME_TTL_MS),
        organization.name,
      );
    }

    const [created] = await db
      .select(publicUser)
      .from(users)
      .where(and(eq(users.organizationId, organization.id), eq(users.id, id)))
      .limit(1);
    return c.json({ user: created, invited }, 201);
  })

  .patch("/:id", validate("json", updateUserSchema), async (c) => {
    const session = sessionOf(c);
    const target = await mustExist(c.req.param("id"));
    const payload = c.req.valid("json");

    // Demoting yourself is how an installation ends up with no administrator.
    if (target.id === session.user.id && payload.role && payload.role !== target.role) {
      throw forbidden("Non puoi cambiare il tuo stesso ruolo");
    }

    if (payload.email && payload.email.toLowerCase() !== target.email) {
      if (await emailTaken(payload.email, target.id)) {
        throw conflict("Esiste già un utente con questa email");
      }
    }

    await db
      .update(users)
      .set({
        name: payload.name ?? target.name,
        email: payload.email?.toLowerCase() ?? target.email,
        role: payload.role ?? target.role,
        canWorkSunday: payload.canWorkSunday ?? target.canWorkSunday,
        has104: payload.has104 ?? target.has104,
        hasPaternity: payload.hasPaternity ?? target.hasPaternity,
        updatedAt: new Date(),
      })
      .where(and(eq(users.organizationId, currentOrgId()), eq(users.id, target.id)));

    const [updated] = await db
      .select(publicUser)
      .from(users)
      .where(and(eq(users.organizationId, currentOrgId()), eq(users.id, target.id)))
      .limit(1);
    return c.json({ user: updated });
  })

  .delete("/:id", async (c) => {
    const session = sessionOf(c);
    const target = await mustExist(c.req.param("id"));
    if (target.id === session.user.id) throw forbidden("Non puoi eliminare il tuo stesso account");

    await db
      .delete(users)
      .where(and(eq(users.organizationId, currentOrgId()), eq(users.id, target.id)));
    return c.json({ ok: true });
  })

  .post("/:id/reset-password", validate("json", adminResetPasswordSchema), async (c) => {
    const target = await mustExist(c.req.param("id"));
    const { newPassword } = c.req.valid("json");

    if (newPassword) {
      await db
        .update(users)
        .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
        .where(and(eq(users.organizationId, currentOrgId()), eq(users.id, target.id)));
      await revokeAllSessions(target.id);
      return c.json({ ok: true, emailed: false });
    }

    const emailed = await sendPasswordResetEmail(
      target.email,
      await issueResetToken(target.id, WELCOME_TTL_MS),
      orgOf(c).name,
    );
    return c.json({ ok: true, emailed });
  })

  .get("/:id/schedule", async (c) => {
    const target = await mustExist(c.req.param("id"));
    return c.json({ days: await scheduleRowsOf(target.id), canWorkSunday: target.canWorkSunday });
  })

  .put("/:id/schedule", validate("json", weekSchedulePayloadSchema), async (c) => {
    const target = await mustExist(c.req.param("id"));
    const payload = c.req.valid("json");

    const days: DaySchedule[] = payload.days.map((d) => ({
      weekday: d.weekday as Weekday,
      isWorking: d.isWorking,
      morning: toSpan(d.morning),
      afternoon: toSpan(d.afternoon),
      contractHours: d.contractHours,
      manualHours: d.manualHours,
    }));

    await replaceSchedules(target.id, days);
    if (payload.canWorkSunday !== undefined) {
      await db
        .update(users)
        .set({ canWorkSunday: payload.canWorkSunday, updatedAt: new Date() })
        .where(and(eq(users.organizationId, currentOrgId()), eq(users.id, target.id)));
    }

    return c.json({ days: await scheduleRowsOf(target.id) });
  })

  .post("/:id/remind", async (c) => {
    const target = await mustExist(c.req.param("id"));
    const week = await weekScheduleOf(target.id);
    const missing = await missingDaysFor(target.id, week);

    // Nothing missing means nothing to send. The old endpoint invented a
    // placeholder day so the mail went out regardless, which taught people to
    // ignore it.
    if (missing.editable.length === 0 && missing.requiresAdmin.length === 0) {
      return c.json({ sent: false, reason: "no-missing-days" });
    }

    const sent = await sendMissingTimesheetReminder({
      to: target.email,
      name: target.name,
      editable: missing.editable,
      requiresAdmin: missing.requiresAdmin,
    });
    return c.json({ sent, ...missing });
  });
