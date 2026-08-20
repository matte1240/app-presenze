export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { performBackup } = await import("@/lib/db-backup");
    const { sendBackupEmail } = await import("@/lib/email");
    const cron = await import("node-cron");

    // Schedule backup every day at 2:00 AM (default) or use env var
    const schedule = process.env.BACKUP_CRON_SCHEDULE || "0 2 * * *";

    cron.schedule(schedule, async () => {
      console.log("Running scheduled database backup...");
      const recipient = process.env.BACKUP_EMAIL_RECIPIENT || process.env.EMAIL_USER;

      try {
        const result = await performBackup();

        if (result.s3Uri) {
          console.log(`Backup uploaded to S3: ${result.s3Uri}`);
        }

        if (recipient) {
          await sendBackupEmail(recipient, true, result.filename, result.path);
        }
      } catch (error) {
        console.error("Scheduled backup failed:", error);

        if (recipient) {
          await sendBackupEmail(
            recipient,
            false,
            undefined,
            undefined,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    }, { timezone: process.env.TZ || 'Europe/Rome' });

    console.log(`Backup scheduler initialized (${schedule})`);

    // Schedule daily timesheet reminder check at 19:00, every day (weekends included)
    // Sends reminder emails to employees who have 1+ missing days in the last 5 working days
    const reminderSchedule = process.env.REMINDER_CRON_SCHEDULE || "0 19 * * *";

    cron.schedule(reminderSchedule, async () => {
      console.log("Running scheduled timesheet reminder check...");

      try {
        const {
          getUsersWithMissingTimesheets,
          formatMissingDatesIT,
          partitionMissingDates,
        } = await import("@/lib/utils/timesheet-utils");
        const { sendMissingTimesheetReminderEmail } = await import("@/lib/email");

        const usersWithMissing = await getUsersWithMissingTimesheets(5);

        if (usersWithMissing.length === 0) {
          console.log("✅ Nessun utente con ore mancanti. Nessun promemoria inviato.");
          return;
        }

        console.log(`📧 Invio promemoria a ${usersWithMissing.length} utente/i con ore mancanti...`);

        for (const { user, missingDates } of usersWithMissing) {
          const { editable, requiresAdmin } = partitionMissingDates(missingDates);
          const editableFmt = formatMissingDatesIT(editable, false);
          const adminRequiredFmt = formatMissingDatesIT(requiresAdmin, false);
          const result = await sendMissingTimesheetReminderEmail(
            user.email,
            user.name ?? user.email,
            editableFmt,
            adminRequiredFmt
          );
          if (result.success) {
            console.log(`✅ Promemoria inviato a ${user.email}`);
          } else {
            console.error(`❌ Impossibile inviare promemoria a ${user.email}`);
          }
        }
      } catch (error) {
        console.error("Scheduled timesheet reminder check failed:", error);
      }
    }, { timezone: process.env.TZ || 'Europe/Rome' });

    console.log(`Timesheet reminder scheduler initialized (${reminderSchedule})`);
  }
}
