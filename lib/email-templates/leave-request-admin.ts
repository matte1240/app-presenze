import { getEmailBranding } from "@/lib/branding";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: "Ferie",
  SICKNESS: "Malattia",
  PERMESSO: "Permesso",
};

const LEAVE_TYPE_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  VACATION: {
    bg: "#dbeafe",
    border: "#93c5fd",
    text: "#1e40af",
    badge: "#2563eb",
  },
  SICKNESS: {
    bg: "#ffedd5",
    border: "#fdba74",
    text: "#c2410c",
    badge: "#ea580c",
  },
  PERMESSO: {
    bg: "#ede9fe",
    border: "#c4b5fd",
    text: "#6d28d9",
    badge: "#7c3aed",
  },
};

export function getLeaveRequestAdminEmailTemplate(params: {
  adminName: string;
  employeeName: string;
  employeeEmail: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
  dashboardUrl: string;
}) {
  const brand = getEmailBranding();
  const {
    adminName,
    employeeName,
    employeeEmail,
    leaveType,
    startDate,
    endDate,
    startTime,
    endTime,
    reason,
    dashboardUrl,
  } = params;

  const typeLabel = LEAVE_TYPE_LABELS[leaveType] ?? leaveType;
  const colors = LEAVE_TYPE_COLORS[leaveType] ?? LEAVE_TYPE_COLORS.PERMESSO;

  const isSingleDay = startDate === endDate;
  const dateRange = isSingleDay ? startDate : `${startDate} → ${endDate}`;
  const timeRange = startTime && endTime ? `${startTime} – ${endTime}` : null;

  const html = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>Nuova richiesta di assenza</title>
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
              <td align="center" style="background-color:${brand.colors.warning}; padding:32px 30px;" bgcolor="${brand.colors.warning}">
                <img src="cid:${brand.logoDarkCid}" alt="${brand.appName}" width="${brand.logoWidth}" style="display:block; max-width:${brand.logoWidth}px; height:auto; margin:0 auto 12px auto;" />
                <h1 style="color:#ffffff; font-size:24px; font-weight:700; margin:0; font-family:Arial,Helvetica,sans-serif; line-height:1.3;">Nuova richiesta di assenza &#128203;</h1>
                <p style="color:rgba(255,255,255,0.85); margin:6px 0 0 0; font-size:14px; font-family:Arial,Helvetica,sans-serif;">Da approvare</p>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding:36px 30px; font-family:Arial,Helvetica,sans-serif;">
                <p style="font-size:18px; font-weight:600; color:#0f172a; margin:0 0 12px 0; line-height:1.4;">Ciao ${adminName}! &#128075;</p>
                <p style="color:#475569; margin:0 0 20px 0; font-size:15px; line-height:1.6;">
                  <strong>${employeeName}</strong> ha inviato una richiesta di assenza &mdash; dai un'occhiata quando puoi!
                </p>

                <!-- Request card -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
                  <tr>
                    <td style="background-color:${colors.bg}; border:2px solid ${colors.border}; border-radius:12px; padding:20px;" bgcolor="${colors.bg}">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
                        <tr>
                          <td style="background-color:${colors.badge}; color:#ffffff; font-size:12px; font-weight:700; padding:4px 10px; border-radius:20px; letter-spacing:0.5px; text-transform:uppercase; font-family:Arial,Helvetica,sans-serif;" bgcolor="${colors.badge}">${typeLabel}</td>
                        </tr>
                      </table>
                      <p style="margin:0 0 8px 0; font-size:14px; font-family:Arial,Helvetica,sans-serif;">
                        <span style="color:#64748b; font-weight:600;">Dipendente: </span>
                        <span style="color:${colors.text}; font-weight:500;">${employeeName} &lt;${employeeEmail}&gt;</span>
                      </p>
                      <p style="margin:0 0 8px 0; font-size:14px; font-family:Arial,Helvetica,sans-serif;">
                        <span style="color:#64748b; font-weight:600;">Tipo: </span>
                        <span style="color:${colors.text}; font-weight:500;">${typeLabel}</span>
                      </p>
                      <p style="margin:0 0 8px 0; font-size:14px; font-family:Arial,Helvetica,sans-serif;">
                        <span style="color:#64748b; font-weight:600;">${isSingleDay ? "Data" : "Periodo"}: </span>
                        <span style="color:${colors.text}; font-weight:500;">${dateRange}</span>
                      </p>
                      ${timeRange ? `
                      <p style="margin:0 0 8px 0; font-size:14px; font-family:Arial,Helvetica,sans-serif;">
                        <span style="color:#64748b; font-weight:600;">Orario: </span>
                        <span style="color:${colors.text}; font-weight:500;">${timeRange}</span>
                      </p>` : ""}
                      ${reason ? `
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
                        <tr>
                          <td style="background-color:#f8fafc; border-left:3px solid #cbd5e1; border-radius:0 8px 8px 0; padding:12px 16px; font-size:14px; color:#475569; font-style:italic; font-family:Arial,Helvetica,sans-serif;" bgcolor="#f8fafc">
                            &#128172; <strong>Nota:</strong> ${reason}
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
                      <p style="color:#334155; font-size:14px; margin:0 0 16px 0; font-family:Arial,Helvetica,sans-serif;">Vai alla dashboard per approvare o rifiutare:</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                        <tr>
                          <td align="center" style="background-color:${brand.colors.warning}; border-radius:10px;" bgcolor="${brand.colors.warning}">
                            <a href="${dashboardUrl}" style="display:inline-block; padding:14px 28px; color:#ffffff; text-decoration:none; font-weight:600; font-size:15px; font-family:Arial,Helvetica,sans-serif;">Gestisci richiesta &rarr;</a>
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

  const text = `Nuova richiesta di assenza 📋

Ciao ${adminName}! 👋

${employeeName} (${employeeEmail}) ha inviato una richiesta di assenza.

Dettagli:
- Tipo: ${typeLabel}
- ${isSingleDay ? "Data" : "Periodo"}: ${dateRange}${timeRange ? `\n- Orario: ${timeRange}` : ""}${reason ? `\n- Nota: ${reason}` : ""}

Vai alla dashboard per gestire la richiesta:
${dashboardUrl}

---
Email automatica — non rispondere a questo messaggio
${brand.appName} © ${brand.year}`;

  return { html, text };
}
