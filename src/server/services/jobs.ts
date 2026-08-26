/**
 * Scheduled work.
 *
 * A module-level flag guards against the double registration that a dev-server
 * reload used to cause. That was enough when the database was a file owned by
 * one process; with Postgres a second instance would be a second scheduler, so
 * each job also takes a Postgres advisory lock before doing anything — see
 * `withJobLock`.
 */
import cron from "node-cron";
import { sql } from "../db/client";
import { env } from "../env";

let started = false;

/**
 * Advisory locks are held for the life of the session and released when it
 * ends, so a crashed instance does not wedge the job forever. `try` returns
 * immediately rather than queueing: a second instance should skip the run, not
 * perform it late.
 */
export async function withJobLock(key: number, run: () => Promise<void>): Promise<boolean> {
  const [row] = await sql<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(${key}) AS locked`;
  if (!row?.locked) return false;
  try {
    await run();
    return true;
  } finally {
    await sql`SELECT pg_advisory_unlock(${key})`;
  }
}

const REMINDER_LOCK = 4_201_001;
const TRIAL_SWEEP_LOCK = 4_201_003;

export function startScheduledJobs(): void {
  if (started) return;
  started = true;

  const options = { timezone: env.TZ };

  cron.schedule(
    env.REMINDER_CRON,
    () => {
      void withJobLock(REMINDER_LOCK, async () => {
        const m = await import("./reminders");
        await m.sendMissingTimesheetReminders();
      }).catch((e) => console.error("Promemoria falliti:", e));
    },
    options,
  );

  // Once a day, a little after midnight: trials that ran out overnight should
  // be read-only by the time anyone opens the application.
  cron.schedule(
    "15 1 * * *",
    () => {
      void withJobLock(TRIAL_SWEEP_LOCK, async () => {
        const m = await import("./trials");
        await m.expireLapsedTrials();
      }).catch((e) => console.error("Controllo dei trial fallito:", e));
    },
    options,
  );

  console.info(
    `Job pianificati: promemoria "${env.REMINDER_CRON}", scadenza trial "15 1 * * *" (${env.TZ})`,
  );
}
