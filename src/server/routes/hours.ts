import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { monthRange, toLocalDate, toYearMonth, type LocalDate } from "@core/date";
import { dayEntrySchema, localDateSchema, recalculateSchema } from "@core/contracts";
import {
  canEditDate,
  check104Quota,
  checkPaternityQuota,
  isEntitledTo,
  isFutureTime,
  type UserFlags,
} from "@core/policy";
import { toClock, type Span } from "@core/time";
import { computeDay, type DayInput, type DayKind } from "@core/timesheet";
import { isAdmin, requireAdmin, requireUser, resolveTargetUser, sessionOf } from "../auth/guards";
import { db } from "../db/client";
import { timeEntries, users, type UserRow } from "../db/schema";
import { env, holidayConfig } from "../env";
import type { AppEnv } from "../http/app-env";
import { forbidden, notFound } from "../http/errors";
import { validate } from "../http/validate";
import { weekScheduleOf } from "../services/schedules";
import {
  approvedLeaveOn,
  entriesBetween,
  entryOn,
  hours104InMonth,
  paternityDaysInYear,
  recalculateMonth,
  saveEntry,
  today,
} from "../services/timesheet";

const flagsOf = (user: UserRow): UserFlags => ({
  canWorkSunday: user.canWorkSunday,
  has104: user.has104,
  hasPaternity: user.hasPaternity,
});

const DENIAL_MESSAGE: Record<string, string> = {
  holiday: "Non puoi registrare ore in un giorno festivo",
  sunday: "Non sei abilitato a lavorare di domenica",
  future: "Non puoi registrare ore per una data futura",
  "too-old": "Puoi modificare solo oggi e i due giorni precedenti",
};

const QUOTA_MESSAGE: Record<string, string> = {
  "not-entitled": "Non hai diritto a questo tipo di permesso",
  "monthly-limit": "Superato il limite mensile di 24 ore di permesso 104",
  "yearly-limit": "Superato il limite di 10 giorni di congedo di paternità nell'anno",
};

async function targetUser(userId: string): Promise<UserRow> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw notFound("Utente inesistente");
  return user;
}

function nowMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: env.TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const [h, m] = parts.split(":");
  return Number(h) * 60 + Number(m);
}

const listQuery = z.object({
  userId: z.string().min(1).optional(),
  from: localDateSchema,
  to: localDateSchema,
});

export const hoursRoutes = new Hono<AppEnv>()
  .use("*", requireUser)

  .get("/", validate("query", listQuery), async (c) => {
    const session = sessionOf(c);
    const { userId, from, to } = c.req.valid("query");

    // "all" is only meaningful to an admin and is how the reports screen asks
    // for the whole team in one call.
    const scope =
      userId === "all" && isAdmin(session.user) ? null : resolveTargetUser(session, userId);

    const rows = await entriesBetween(scope, toLocalDate(from), toLocalDate(to));
    return c.json({ entries: rows });
  })

  .post("/", validate("json", dayEntrySchema), async (c) => {
    const session = sessionOf(c);
    const payload = c.req.valid("json");
    const userId = resolveTargetUser(session, payload.userId);
    const user = await targetUser(userId);
    const date = toLocalDate(payload.date);

    const verdict = canEditDate({
      date,
      today: today(),
      role: session.user.role,
      flags: flagsOf(user),
      holidays: holidayConfig,
    });
    if (!verdict.ok) throw forbidden(DENIAL_MESSAGE[verdict.reason] ?? "Data non modificabile");

    const toSpan = (s: { start: string; end: string } | null): Span | null =>
      s ? { start: toClock(s.start), end: toClock(s.end) } : null;

    // Hours not yet worked cannot be booked. Admins are exempt: they correct
    // the record, sometimes for a day that is still in progress.
    if (!isAdmin(session.user)) {
      for (const span of [toSpan(payload.morning), toSpan(payload.afternoon)]) {
        for (const time of [span?.start, span?.end]) {
          if (time && isFutureTime({ date, time, today: today(), nowMinutes: nowMinutes() })) {
            throw forbidden("Non puoi registrare un orario che non è ancora trascorso");
          }
        }
      }
    }

    const kind = payload.kind as DayKind;
    if (!isEntitledTo(kind, flagsOf(user))) {
      throw forbidden("Non hai diritto a questo tipo di assenza");
    }

    const input: DayInput = {
      date,
      kind,
      morning: toSpan(payload.morning),
      afternoon: toSpan(payload.afternoon),
      morningOnLeave: payload.morningOnLeave,
      afternoonOnLeave: payload.afternoonOnLeave,
      use104: payload.use104,
      hours104Override: payload.hours104Override,
      approvedLeave: await approvedLeaveOn(userId, date),
    };

    const week = await weekScheduleOf(userId);
    const breakdown = computeDay(input, week, { holidays: holidayConfig });
    const existing = await entryOn(userId, date);

    const quota104 = check104Quota({
      flags: flagsOf(user),
      hoursUsedThisMonth: await hours104InMonth(userId, date, existing?.id),
      hoursRequested: breakdown.leave104,
    });
    if (!quota104.ok) throw forbidden(QUOTA_MESSAGE[quota104.reason]!);

    const quotaPaternity = checkPaternityQuota({
      flags: flagsOf(user),
      daysUsedThisYear: await paternityDaysInYear(userId, date, existing?.id),
      addingDay: breakdown.paternity > 0,
    });
    if (!quotaPaternity.ok) throw forbidden(QUOTA_MESSAGE[quotaPaternity.reason]!);

    const { row, created } = await saveEntry({
      userId,
      actorId: session.user.id,
      input,
      breakdown,
      notes: payload.notes,
      medicalCertificate: payload.medicalCertificate,
    });

    return c.json({ entry: row }, created ? 201 : 200);
  })

  .delete("/:id", async (c) => {
    const session = sessionOf(c);
    const [row] = await db.select().from(timeEntries).where(eq(timeEntries.id, c.req.param("id"))).limit(1);
    if (!row) throw notFound("Voce inesistente");

    if (!isAdmin(session.user)) {
      if (row.userId !== session.user.id) throw forbidden();
      const verdict = canEditDate({
        date: row.workDate as LocalDate,
        today: today(),
        role: session.user.role,
        flags: flagsOf(session.user),
        holidays: holidayConfig,
      });
      if (!verdict.ok) throw forbidden(DENIAL_MESSAGE[verdict.reason] ?? "Data non modificabile");
    }

    await db.delete(timeEntries).where(eq(timeEntries.id, row.id));
    return c.json({ ok: true });
  })

  /**
   * Replays the engine over a month after a schedule change. It calls the same
   * `computeDay` as the write path — the old build had a separate
   * implementation here that had already drifted from the one in the browser.
   */
  .post("/recalculate", requireAdmin, validate("json", recalculateSchema), async (c) => {
    const { userId, month } = c.req.valid("json");
    const week = await weekScheduleOf(userId);
    const result = await recalculateMonth(userId, month, week);
    return c.json(result);
  })

  .get("/summary", validate("query", z.object({ userId: z.string().optional(), month: z.string() })), async (c) => {
    const session = sessionOf(c);
    const { userId, month } = c.req.valid("query");
    const scope = userId === "all" && isAdmin(session.user) ? null : resolveTargetUser(session, userId);
    const { from, to } = monthRange(toYearMonth(month));

    const rows = await entriesBetween(scope, from, to);
    return c.json({ entries: rows, from, to });
  });

export { flagsOf, DENIAL_MESSAGE };
