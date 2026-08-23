/**
 * The evening sweep: email anyone whose recent timesheet has gaps.
 */
import { sendMissingTimesheetReminder } from "./email";
import { weekScheduleOf } from "./schedules";
import { employeesWithEmail, missingDaysFor } from "./timesheet";

export async function sendMissingTimesheetReminders(lookbackDays = 5): Promise<number> {
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

  console.info(`Promemoria cartellino inviati: ${sent}/${employees.length}`);
  return sent;
}
