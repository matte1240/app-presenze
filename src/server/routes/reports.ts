import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { monthRange, toYearMonth } from "@core/date";
import { excelReportSchema } from "@core/contracts";
import { isAdmin, requireUser, sessionOf } from "../auth/guards";
import { db } from "../db/client";
import { currentOrgId } from "../db/context";
import { users, type TimeEntryRow } from "../db/schema";
import { env } from "../env";
import type { AppEnv } from "../http/app-env";
import { forbidden } from "../http/errors";
import { validate } from "../http/validate";
import { entriesBetween } from "../services/timesheet";

export const reportRoutes = new Hono<AppEnv>()
  .use("*", requireUser)

  .post("/excel", validate("json", excelReportSchema), async (c) => {
    const session = sessionOf(c);
    const { userIds, month } = c.req.valid("json");

    if (!isAdmin(session.user) && (userIds.length !== 1 || userIds[0] !== session.user.id)) {
      throw forbidden("Puoi esportare solo il tuo cartellino");
    }

    // Ids naming somebody else's staff simply match nothing here; the export
    // comes back without them rather than refusing, because the caller was
    // never told they existed in the first place.
    const people = await db
      .select()
      .from(users)
      .where(and(eq(users.organizationId, currentOrgId()), inArray(users.id, userIds)));
    const { from, to } = monthRange(toYearMonth(month));

    const entriesByUser = new Map<string, TimeEntryRow[]>();
    for (const person of people) {
      entriesByUser.set(person.id, await entriesBetween(person.id, from, to));
    }

    // ExcelJS is the heaviest dependency in the tree and is only ever needed
    // here, so it is loaded when someone actually asks for a workbook.
    const { buildMonthlyWorkbook } = await import("../services/excel");
    const buffer = await buildMonthlyWorkbook({
      month,
      users: people.map((p) => ({ id: p.id, name: p.name, email: p.email })),
      entriesByUser,
      appName: env.APP_NAME,
    });

    const filename = `presenze-${month}.xlsx`;
    return c.body(new Uint8Array(buffer), 200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
  });
