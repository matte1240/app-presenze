/**
 * Scheduled work: the nightly backup and the evening reminder sweep.
 *
 * A module-level flag guards against the double registration that a dev-server
 * reload used to cause; with a single process and an embedded database that is
 * the whole of the coordination needed.
 */
import cron from "node-cron";
import { env } from "../env";

let started = false;

export function startScheduledJobs(): void {
  if (started) return;
  started = true;

  const options = { timezone: env.TZ };

  cron.schedule(
    env.BACKUP_CRON,
    () => {
      void import("./backup").then((m) => m.runScheduledBackup()).catch((e) => console.error("Backup pianificato fallito:", e));
    },
    options,
  );

  cron.schedule(
    env.REMINDER_CRON,
    () => {
      void import("./reminders").then((m) => m.sendMissingTimesheetReminders()).catch((e) => console.error("Promemoria falliti:", e));
    },
    options,
  );

  console.info(`Job pianificati: backup "${env.BACKUP_CRON}", promemoria "${env.REMINDER_CRON}" (${env.TZ})`);
}
