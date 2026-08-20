import { getEmailBranding } from "@/lib/branding";

export const getPasswordResetLinkEmailTemplate = (
  username: string,
  resetUrl: string,
  validityDuration: string = "1 ora"
) => {
  const brand = getEmailBranding();
  const html = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>Reset Password</title>
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
              <td align="center" style="background-color:${brand.colors.primary}; padding:32px 30px;" bgcolor="${brand.colors.primary}">
                <img src="cid:${brand.logoDarkCid}" alt="${brand.appName}" width="${brand.logoWidth}" style="display:block; max-width:${brand.logoWidth}px; height:auto; margin:0 auto 12px auto;" />
                <h1 style="color:#ffffff; font-size:24px; font-weight:700; margin:0; font-family:Arial,Helvetica,sans-serif; line-height:1.3;">Reset Password &#128272;</h1>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding:36px 30px; font-family:Arial,Helvetica,sans-serif;">
                <p style="font-size:18px; font-weight:600; color:#0f172a; margin:0 0 12px 0; line-height:1.4;">Ciao ${username}! &#128075;</p>
                <p style="color:#475569; margin:0 0 20px 0; font-size:15px; line-height:1.6;">
                  Hai chiesto di reimpostare la password del tuo account ${brand.appName}.
                  Tranquillo, capita a tutti! &#128516;
                </p>

                <!-- CTA box -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
                  <tr>
                    <td style="background-color:#f8fafc; border:2px solid #e2e8f0; border-radius:12px; padding:28px; text-align:center;" bgcolor="#f8fafc">
                      <p style="color:#334155; font-size:15px; font-weight:600; margin:0 0 16px 0; font-family:Arial,Helvetica,sans-serif;">Clicca qui sotto per scegliere una nuova password:</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                        <tr>
                          <td align="center" style="background-color:${brand.colors.primary}; border-radius:10px;" bgcolor="${brand.colors.primary}">
                            <a href="${resetUrl}" style="display:inline-block; padding:14px 28px; color:#ffffff; text-decoration:none; font-weight:600; font-size:15px; font-family:Arial,Helvetica,sans-serif;">Reimposta la mia password</a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:16px 0 0 0; padding-top:16px; border-top:1px solid #e2e8f0; font-size:12px; color:#64748b; font-family:Arial,Helvetica,sans-serif;">
                        Il pulsante non funziona? Copia questo link nel browser:<br />
                        <a href="${resetUrl}" style="color:${brand.colors.primary}; word-break:break-all; text-decoration:none;">${resetUrl}</a>
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Info box -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
                  <tr>
                    <td style="background-color:#fffbeb; border-left:4px solid #f59e0b; border-radius:8px; padding:16px;" bgcolor="#fffbeb">
                      <p style="font-weight:600; color:#92400e; margin:0 0 8px 0; font-size:14px; font-family:Arial,Helvetica,sans-serif;">&#9200; Info utili</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="color:#78350f; font-size:14px; font-family:Arial,Helvetica,sans-serif;">
                        <tr><td style="padding:3px 0; line-height:1.5;">&bull; Il link &egrave; <strong>valido per ${validityDuration}</strong></td></tr>
                        <tr><td style="padding:3px 0; line-height:1.5;">&bull; Puoi usarlo <strong>una sola volta</strong></td></tr>
                        <tr><td style="padding:3px 0; line-height:1.5;">&bull; Dopo il reset dovrai fare il login con la nuova password</td></tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Security note -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
                  <tr>
                    <td style="background-color:#f1f5f9; border-left:4px solid #64748b; border-radius:8px; padding:16px;" bgcolor="#f1f5f9">
                      <p style="font-weight:600; color:#334155; margin:0 0 6px 0; font-size:14px; font-family:Arial,Helvetica,sans-serif;">&#128737;&#65039; Non sei stato tu?</p>
                      <p style="color:#475569; font-size:13px; margin:0; line-height:1.5; font-family:Arial,Helvetica,sans-serif;">
                        Se non hai chiesto tu il reset, ignora pure questa email e
                        avvisa l'amministratore. Il tuo account resta al sicuro.
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

  const text = `Reset Password 🔐

Ciao ${username}! 👋

Hai chiesto di reimpostare la password del tuo account ${brand.appName}. Tranquillo, capita a tutti!

Clicca il link qui sotto per scegliere una nuova password:
${resetUrl}

⏰ INFO UTILI:
- Il link è valido per ${validityDuration}
- Puoi usarlo una sola volta
- Dopo il reset dovrai fare il login con la nuova password

🛡️ Non sei stato tu? Ignora questa email e avvisa l'amministratore.

---
Email automatica — non rispondere a questo messaggio
${brand.appName} © ${brand.year}`;

  return { html, text };
};
