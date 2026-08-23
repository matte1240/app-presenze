import { randomUUID } from "node:crypto";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { eachDay, toLocalDate, type LocalDate } from "@core/date";
import { leaveRequestSchema, leaveReviewSchema, leaveStatusSchema } from "@core/contracts";
import { daysToMaterialize } from "@core/policy";
import { computeDay, type DayInput } from "@core/timesheet";
import { isAdmin, requireAdmin, requireUser, sessionOf } from "../auth/guards";
import { db } from "../db/client";
import { leaveRequests, timeEntries, users, type LeaveRequestRow } from "../db/schema";
import { holidayConfig } from "../env";
import type { AppEnv } from "../http/app-env";
import { conflict, notFound } from "../http/errors";
import { validate } from "../http/validate";
import { sendLeaveDecision, sendLeaveRequestToAdmin } from "../services/email";
import { weekScheduleOf } from "../services/schedules";
import { approvedLeaveOn, entryOn, hourColumns, saveEntry, toDayInput } from "../services/timesheet";

const KIND_FOR = { VACATION: "vacation", SICKNESS: "sickness" } as const;

async function loadRequest(id: string): Promise<LeaveRequestRow> {
  const [row] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id)).limit(1);
  if (!row) throw notFound("Richiesta inesistente");
  return row;
}

/**
 * Turns an approved absence into timesheet rows.
 *
 * Two properties the previous version lacked: it is idempotent, so approving
 * twice is harmless rather than a unique-constraint error; and it never
 * overwrites a day on which work was actually recorded — those days come back
 * as conflicts for a human to look at.
 */
async function materialize(request: LeaveRequestRow, actorId: string) {
  const kind = KIND_FOR[request.type as keyof typeof KIND_FOR];
  if (!kind) return { created: 0, conflicts: [] as LocalDate[] };

  const week = await weekScheduleOf(request.userId);
  const days = daysToMaterialize({
    days: eachDay(toLocalDate(request.startDate), toLocalDate(request.endDate)),
    week,
    holidays: holidayConfig,
  });

  const conflicts: LocalDate[] = [];
  let created = 0;

  for (const date of days) {
    const existing = await entryOn(request.userId, date);
    if (existing && existing.kind !== kind) {
      conflicts.push(date);
      continue;
    }

    const input: DayInput = {
      date,
      kind,
      morning: null,
      afternoon: null,
      morningOnLeave: false,
      afternoonOnLeave: false,
      use104: false,
      hours104Override: null,
      approvedLeave: null,
    };

    await saveEntry({
      userId: request.userId,
      actorId,
      input,
      breakdown: computeDay(input, week, { holidays: holidayConfig }),
      notes: existing?.notes ?? null,
      medicalCertificate: existing?.medicalCertificate ?? null,
    });
    created += 1;
  }

  return { created, conflicts };
}

/**
 * An approved hourly leave changes what an already-entered day is worth, so
 * the day is re-run through the engine rather than left stale.
 */
async function refreshDayForPermesso(request: LeaveRequestRow) {
  const date = toLocalDate(request.startDate);
  const existing = await entryOn(request.userId, date);
  if (!existing) return;

  const week = await weekScheduleOf(request.userId);
  const leave = await approvedLeaveOn(request.userId, date);
  const breakdown = computeDay(toDayInput(existing, leave), week, { holidays: holidayConfig });

  await db
    .update(timeEntries)
    .set({ ...hourColumns(breakdown), updatedAt: new Date() })
    .where(eq(timeEntries.id, existing.id));
}

const listQuery = z.object({
  userId: z.string().min(1).optional(),
  status: leaveStatusSchema.optional(),
});

export const requestRoutes = new Hono<AppEnv>()
  .use("*", requireUser)

  .get("/", validate("query", listQuery), async (c) => {
    const session = sessionOf(c);
    const scope = isAdmin(session.user) ? c.req.valid("query").userId : session.user.id;
    const status = c.req.valid("query").status;

    const rows = await db
      .select({
        request: leaveRequests,
        user: { id: users.id, name: users.name, email: users.email },
      })
      .from(leaveRequests)
      .innerJoin(users, eq(users.id, leaveRequests.userId))
      .where(
        and(
          scope ? eq(leaveRequests.userId, scope) : undefined,
          status ? eq(leaveRequests.status, status) : undefined,
        ),
      )
      .orderBy(leaveRequests.startDate);

    return c.json({ requests: rows.map((r) => ({ ...r.request, user: r.user })) });
  })

  .post("/", validate("json", leaveRequestSchema), async (c) => {
    const session = sessionOf(c);
    const payload = c.req.valid("json");

    // Overlapping an existing request, or a day already filled in, means the
    // two records would disagree about the same day.
    const [clash] = await db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.userId, session.user.id),
          ne(leaveRequests.status, "REJECTED"),
          lte(leaveRequests.startDate, payload.endDate),
          gte(leaveRequests.endDate, payload.startDate),
        ),
      )
      .limit(1);
    if (clash) throw conflict("Hai già una richiesta che copre questo periodo");

    const [busy] = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, session.user.id),
          gte(timeEntries.workDate, payload.startDate),
          lte(timeEntries.workDate, payload.endDate),
        ),
      )
      .limit(1);
    if (busy && payload.type !== "PERMESSO") {
      throw conflict("Hai già registrato delle ore in questo periodo");
    }

    const [row] = await db
      .insert(leaveRequests)
      .values({
        id: randomUUID(),
        userId: session.user.id,
        type: payload.type,
        startDate: payload.startDate,
        endDate: payload.endDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        reason: payload.reason,
      })
      .returning();

    const admins = await db.select().from(users).where(eq(users.role, "ADMIN"));
    await Promise.allSettled(
      admins.map((admin) =>
        sendLeaveRequestToAdmin({
          to: admin.email,
          employeeName: session.user.name,
          employeeEmail: session.user.email,
          type: payload.type,
          startDate: toLocalDate(payload.startDate),
          endDate: toLocalDate(payload.endDate),
          reason: payload.reason,
        }),
      ),
    );

    return c.json({ request: row }, 201);
  })

  /**
   * Approve or reject. Kept separate from editing so the side effects of a
   * status change always run: the old API had a second endpoint that accepted
   * `status: "APPROVED"` and quietly created no timesheet rows at all.
   */
  .patch("/:id/review", requireAdmin, validate("json", leaveReviewSchema), async (c) => {
    const session = sessionOf(c);
    const request = await loadRequest(c.req.param("id"));
    const { status } = c.req.valid("json");

    const [updated] = await db
      .update(leaveRequests)
      .set({ status, reviewedBy: session.user.id, reviewedAt: new Date() })
      .where(eq(leaveRequests.id, request.id))
      .returning();

    let materialized = { created: 0, conflicts: [] as LocalDate[] };
    if (status === "APPROVED") {
      if (request.type === "PERMESSO") {
        await refreshDayForPermesso(request);
      } else {
        materialized = await materialize(request, session.user.id);
      }
    }

    const [employee] = await db.select().from(users).where(eq(users.id, request.userId)).limit(1);
    if (employee) {
      void sendLeaveDecision({
        to: employee.email,
        type: request.type,
        startDate: toLocalDate(request.startDate),
        endDate: toLocalDate(request.endDate),
        approved: status === "APPROVED",
      });
    }

    return c.json({ request: updated, ...materialized });
  })

  .patch(
    "/:id",
    requireAdmin,
    validate("json", leaveRequestSchema),
    async (c) => {
      const request = await loadRequest(c.req.param("id"));
      const payload = c.req.valid("json");

      const [updated] = await db
        .update(leaveRequests)
        .set({
          type: payload.type,
          startDate: payload.startDate,
          endDate: payload.endDate,
          startTime: payload.startTime,
          endTime: payload.endTime,
          reason: payload.reason,
        })
        .where(eq(leaveRequests.id, request.id))
        .returning();

      return c.json({ request: updated });
    },
  )

  .delete("/:id", requireAdmin, async (c) => {
    const request = await loadRequest(c.req.param("id"));
    await db.delete(leaveRequests).where(eq(leaveRequests.id, request.id));
    return c.json({ ok: true });
  });

export { materialize };
