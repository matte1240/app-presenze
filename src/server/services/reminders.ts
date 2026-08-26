/**
 * The evening sweep: email anyone whose recent timesheet has gaps.
 *
 * It is the one job that walks every customer, so it is also the one place
 * that has to be careful about it: each company is visited inside its own
 * tenant context, which is what makes `missingDaysFor` — and the working
 * calendar it consults — answer for that company and not for the last one.
 */
import { inArray } from "drizzle-orm";
import { platformDb } from "../db/client";
import { organizations } from "../db/platform-schema";
import { forEachTenant } from "../db/tenant";
import { sendMissingTimesheetReminder } from "./email";
import { weekScheduleOf } from "./schedules";
import { employeesWithEmail, missingDaysFor } from "./timesheet";

/**
 * Suspended and cancelled companies are skipped: their people cannot fill the
 * timesheet in anyway, and a nagging email about an account they have lost
 * access to is the worst possible reminder that the invoice is unpaid.
 */
const REMINDED_STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE"] as const;

/** Reminds one company's employees. Must run inside a tenant context. */
export async function remindOrganization(lookbackDays: number): Promise<number> {
  const employees = await employeesWithEmail();
  let sent = 0;

  for (const employee of employees) {
    const week = await weekScheduleOf(employee.id);
    const missing = await missingDaysFor(employee.id, week, lookbackDays);
    if (missing.editable.length === 0 && missing.requiresAdmin.length === 0) continue;

    const ok = await sendMissingTimesheetReminder({
      to: employee.email,
      name: employee.name,
      editable: missing.editable,
      requiresAdmin: missing.requiresAdmin,
    });
    if (ok) sent += 1;
  }

  return sent;
}

export async function sendMissingTimesheetReminders(lookbackDays = 5): Promise<number> {
  const targets = await platformDb
    .select({ id: organizations.id })
    .from(organizations)
    .where(inArray(organizations.status, [...REMINDED_STATUSES]));

  let sent = 0;
  const result = await forEachTenant(
    targets.map((o) => o.id),
    async () => {
      sent += await remindOrganization(lookbackDays);
    },
  );

  console.info(
    `Promemoria cartellino: ${sent} inviati su ${result.done} organizzazioni` +
      (result.failed > 0 ? `, ${result.failed} fallite` : ""),
  );
  return sent;
}
