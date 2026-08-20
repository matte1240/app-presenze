import { sendMissingTimesheetReminderEmail } from "@/lib/email";
import { findUserById } from "@/lib/utils/user-utils";
import { getRequiredSession } from "@/lib/api-middleware";
import { successResponse, notFoundResponse, handleError } from "@/lib/api-responses";
import {
  getMissingDaysForUser,
  formatMissingDatesIT,
  partitionMissingDates,
} from "@/lib/utils/timesheet-utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await getRequiredSession();

  try {
    const { id: userId } = await params;

    const user = await findUserById(userId);
    if (!user) {
      return notFoundResponse("Utente non trovato");
    }

    // Find missing working days in the last 5 days
    const missingDates = await getMissingDaysForUser(userId, 5);

    let editableFormatted: string;
    let adminRequiredFormatted: string;
    if (missingDates.length === 0) {
      // Admin manually triggered: send the reminder even if no missing days detected.
      // Use yesterday as a placeholder — falls in the editable window.
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      editableFormatted = formatMissingDatesIT([yesterday]);
      adminRequiredFormatted = "";
    } else {
      const { editable, requiresAdmin } = partitionMissingDates(missingDates);
      editableFormatted = formatMissingDatesIT(editable);
      adminRequiredFormatted = formatMissingDatesIT(requiresAdmin);
    }

    const result = await sendMissingTimesheetReminderEmail(
      user.email,
      user.name ?? user.email,
      editableFormatted,
      adminRequiredFormatted
    );

    if (!result.success) {
      return handleError(new Error("Impossibile inviare l'email. Controlla la configurazione SMTP."));
    }

    console.log(`✅ Promemoria timesheet inviato a ${user.email} dall'admin`);
    return successResponse({
      message: `Promemoria inviato con successo a ${user.email}`,
    });
  } catch (error) {
    return handleError(error);
  }
}
