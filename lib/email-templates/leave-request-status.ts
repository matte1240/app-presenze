import { getEmailBranding } from "@/lib/branding";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: "Ferie",
  SICKNESS: "Malattia",
  PERMESSO: "Permesso",
};

type StatusAction = "APPROVED" | "REJECTED" | "MODIFIED";

const STATUS_CONFIG: Record<StatusAction, {
  title: string;
  emoji: string;
  messageColor: string;
  badgeColor: string;
}> = {
  APPROVED: {
    title: "Richiesta approvata",
    emoji: "✅",
    messageColor: "#166534",
    badgeColor: "#10b981",
  },
  REJECTED: {
    title: "Richiesta rifiutata",
    emoji: "❌",
    messageColor: "#991b1b",
    badgeColor: "#ef4444",
  },
  MODIFIED: {
    title: "Richiesta modificata",
    emoji: "✏️",
    messageColor: "#92400e",
    badgeColor: "#f59e0b",
  },
};

export function getLeaveRequestStatusEmailTemplate(params: {
  employeeName: string;
  action: StatusAction;
  leaveType: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  adminNotes?: string;
  dashboardUrl: string;
}) {
  const brand = getEmailBranding();
  const {
    employeeName,
    action,
    leaveType,
    startDate,
    endDate,
    startTime,
    endTime,
    adminNotes,
    dashboardUrl,
  } = params;

  const typeLabel = LEAVE_TYPE_LABELS[leaveType] ?? leaveType;
  const config = STATUS_CONFIG[action];

  // The header band and CTA follow the branded palette; STATUS_CONFIG keeps the
  // lighter tints used inside the message body.
  const statusColor = {
    APPROVED: brand.colors.success,
    REJECTED: brand.colors.danger,
    MODIFIED: brand.colors.warning,
  }[action];

  const isSingleDay = startDate === endDate;
  const dateRange = isSingleDay ? startDate : `${startDate} → ${endDate}`;
  const timeRange = startTime && endTime ? `${startTime} – ${endTime}` : null;

  const messageByAction: Record<StatusAction, string> = {
    APPROVED: `La tua richiesta di <strong>${typeLabel}</strong> è stata approvata! 🎉`,
    REJECTED: `Purtroppo la tua richiesta di <strong>${typeLabel}</strong> è stata rifiutata.`,
    MODIFIED: `La tua richiesta di <strong>${typeLabel}</strong> è stata modificata dall'amministratore.`,
  };

  const html = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${config.title}</title>
    <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
    <![endif]-->
  </head>
  <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:Arial,Helvetica,sans-serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;" bgcolor="#f1f5f9">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;" bgcolor="#f1f5f9">
      <tr>
        <td align="center" style="padding:20px 10px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#ffffff;" bgcolor="#ffffff">
            <!-- Header -->
            <tr>
              <td align="center" style="background-color:${statusColor}; padding:32px 30px;" bgcolor="${statusColor}">
                <img src="cid:${brand.logoDarkCid}" alt="${brand.appName}" width="${brand.logoWidth}" style="display:block; max-width:${brand.logoWidth}px; height:auto; margin:0 auto 12px auto;" />
                <h1 style="color:#ffffff; font-size:24px; font-weight:700; margin:0; font-family:Arial,Helvetica,sans-serif; line-height:1.3;">${config.title} ${config.emoji}</h1>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding:36px 30px; font-family:Arial,Helvetica,sans-serif;">
                <p style="font-size:18px; font-weight:600; color:#0f172a; margin:0 0 12px 0; line-height:1.4;">Ciao ${employeeName}! &#128075;</p>
                <p style="color:#475569; margin:0 0 20px 0; font-size:15px; line-height:1.6;">${messageByAction[action]}</p>

                <!-- Detail card -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
                  <tr>
                    <td style="background-color:#f8fafc; border:2px solid #e2e8f0; border-radius:12px; padding:20px;" bgcolor="#f8fafc">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
                        <tr>
                          <td style="background-color:${config.badgeColor}; color:#ffffff; font-size:12px; font-weight:700; padding:4px 10px; border-radius:20px; letter-spacing:0.5px; text-transform:uppercase; font-family:Arial,Helvetica,sans-serif;" bgcolor="${config.badgeColor}">${typeLabel}</td>
                        </tr>
                      </table>
                      <p style="margin:0 0 8px 0; font-size:14px; font-family:Arial,Helvetica,sans-serif;">
                        <span style="color:#64748b; font-weight:600;">Tipo: </span>
                        <span style="color:#1e293b; font-weight:500;">${typeLabel}</span>
                      </p>
                      <p style="margin:0 0 8px 0; font-size:14px; font-family:Arial,Helvetica,sans-serif;">
                        <span style="color:#64748b; font-weight:600;">${isSingleDay ? "Data" : "Periodo"}: </span>
                        <span style="color:#1e293b; font-weight:500;">${dateRange}</span>
                      </p>
                      ${timeRange ? `
                      <p style="margin:0 0 8px 0; font-size:14px; font-family:Arial,Helvetica,sans-serif;">
                        <span style="color:#64748b; font-weight:600;">Orario: </span>
                        <span style="color:#1e293b; font-weight:500;">${timeRange}</span>
                      </p>` : ""}
                      ${adminNotes ? `
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
                        <tr>
                          <td style="background-color:#fffbeb; border-left:4px solid #f59e0b; border-radius:0 8px 8px 0; padding:12px 16px; font-size:14px; color:#475569; font-style:italic; font-family:Arial,Helvetica,sans-serif;" bgcolor="#fffbeb">
                            &#128172; <strong>Nota dell'admin:</strong> ${adminNotes}
                          </td>
                        </tr>
                      </table>` : ""}
                    </td>
                  </tr>
                </table>

                <!-- CTA box -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                  <tr>
                    <td style="background-color:#f8fafc; border:2px solid #e2e8f0; border-radius:12px; padding:28px; text-align:center;" bgcolor="#f8fafc">
                      <p style="color:#334155; font-size:14px; margin:0 0 16px 0; font-family:Arial,Helvetica,sans-serif;">Puoi controllare le tue richieste dalla dashboard:</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                        <tr>
                          <td align="center" style="background-color:${statusColor}; border-radius:10px;" bgcolor="${statusColor}">
                            <a href="${dashboardUrl}" style="display:inline-block; padding:14px 28px; color:#ffffff; text-decoration:none; font-weight:600; font-size:15px; font-family:Arial,Helvetica,sans-serif;">Vai alle mie richieste</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color:#f8fafc; padding:24px 30px; text-align:center; border-top:1px solid #e2e8f0;" bgcolor="#f8fafc">
                <p style="color:#94a3b8; font-size:12px; margin:0 0 4px 0; font-family:Arial,Helvetica,sans-serif;">Email automatica &mdash; non rispondere a questo messaggio</p>
                <p style="color:#334155; font-weight:600; font-size:13px; margin:8px 0 0 0; font-family:Arial,Helvetica,sans-serif;">${brand.appName} &copy; ${brand.year}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const statusTextMap: Record<StatusAction, string> = {
    APPROVED: "APPROVATA ✅",
    REJECTED: "RIFIUTATA ❌",
    MODIFIED: "MODIFICATA ✏️",
  };

  const text = `${config.title} ${config.emoji}

Ciao ${employeeName}! 👋

La tua richiesta di ${typeLabel} è stata ${statusTextMap[action]}.

Dettagli:
- Tipo: ${typeLabel}
- ${isSingleDay ? "Data" : "Periodo"}: ${dateRange}${timeRange ? `\n- Orario: ${timeRange}` : ""}${adminNotes ? `\n- Nota admin: ${adminNotes}` : ""}

Controlla le tue richieste:
${dashboardUrl}

---
Email automatica — non rispondere a questo messaggio
${brand.appName} © ${brand.year}`;

  return { html, text };
}
