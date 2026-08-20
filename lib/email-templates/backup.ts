import { getEmailBranding } from "@/lib/branding";

export const getBackupEmailTemplate = (
  success: boolean,
  filename?: string,
  errorMessage?: string
) => {
  const brand = getEmailBranding();
  const statusColor = success ? brand.colors.success : brand.colors.danger;

  const html = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${success ? "Backup completato" : "Errore backup"}</title>
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
                <h1 style="color:#ffffff; font-size:24px; font-weight:700; margin:0; font-family:Arial,Helvetica,sans-serif; line-height:1.3;">${success ? "Backup completato &#9989;" : "Errore backup &#10060;"}</h1>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding:36px 30px; font-family:Arial,Helvetica,sans-serif;">
                <p style="color:#475569; margin:0 0 20px 0; font-size:15px; line-height:1.6;">
                  ${success
                    ? "Il backup del database &egrave; andato a buon fine! Trovi il file in allegato."
                    : "Purtroppo qualcosa &egrave; andato storto durante il backup del database."
                  }
                </p>

                <!-- Detail box -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
                  <tr>
                    <td style="background-color:#f8fafc; border:2px solid #e2e8f0; border-radius:12px; padding:20px;" bgcolor="#f8fafc">
                      ${success
                        ? `<p style="margin:0 0 8px 0; font-size:14px; font-family:Arial,Helvetica,sans-serif;">
                            <span style="color:#64748b; font-weight:600;">File: </span>
                            <span style="color:#1e293b; font-weight:500;">${filename}</span>
                          </p>`
                        : `<p style="margin:0 0 8px 0; font-size:14px; font-family:Arial,Helvetica,sans-serif;">
                            <span style="color:#64748b; font-weight:600;">Errore: </span>
                            <span style="color:#1e293b; font-weight:500;">${errorMessage}</span>
                          </p>`
                      }
                      <p style="margin:0; font-size:14px; font-family:Arial,Helvetica,sans-serif;">
                        <span style="color:#64748b; font-weight:600;">Data: </span>
                        <span style="color:#1e293b; font-weight:500;">${new Date().toLocaleString("it-IT")}</span>
                      </p>
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

  return { html };
};
