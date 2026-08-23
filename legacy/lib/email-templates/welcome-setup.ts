import { getEmailBranding } from "@/lib/branding";

export const getWelcomeSetupEmailTemplate = (
  username: string,
  setupUrl: string,
  email: string
) => {
  const brand = getEmailBranding();
  const html = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>Benvenuto su ${brand.appName}</title>
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
                <h1 style="color:#ffffff; font-size:24px; font-weight:700; margin:0; font-family:Arial,Helvetica,sans-serif; line-height:1.3;">Benvenuto nel team! &#127881;</h1>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding:36px 30px; font-family:Arial,Helvetica,sans-serif;">
                <p style="font-size:18px; font-weight:600; color:#0f172a; margin:0 0 12px 0; line-height:1.4;">Ciao ${username}! &#128075;</p>
                <p style="color:#475569; margin:0 0 20px 0; font-size:15px; line-height:1.6;">
                  Che bello averti a bordo! Il tuo account su <strong>${brand.appName}</strong>
                  &egrave; pronto &mdash; manca solo un ultimo passaggio.
                </p>

                <!-- Highlight box -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
                  <tr>
                    <td style="background-color:#dcfce7; border:2px solid #86efac; border-radius:12px; padding:20px;" bgcolor="#dcfce7">
                      <p style="color:#166534; font-size:15px; font-weight:600; margin:0 0 8px 0; font-family:Arial,Helvetica,sans-serif;">&#127919; Quasi fatto!</p>
                      <p style="color:#15803d; font-size:14px; margin:0; line-height:1.5; font-family:Arial,Helvetica,sans-serif;">
                        Devi solo scegliere una password per il tuo account.
                        Ci vogliono due minuti, promesso!
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- CTA box -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
                  <tr>
                    <td style="background-color:#f8fafc; border:2px solid #e2e8f0; border-radius:12px; padding:28px; text-align:center;" bgcolor="#f8fafc">
                      <p style="color:#334155; font-size:15px; font-weight:600; margin:0 0 16px 0; font-family:Arial,Helvetica,sans-serif;">Clicca qui sotto per impostare la password:</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                        <tr>
                          <td align="center" style="background-color:${brand.colors.primary}; border-radius:10px;" bgcolor="${brand.colors.primary}">
                            <a href="${setupUrl}" style="display:inline-block; padding:14px 28px; color:#ffffff; text-decoration:none; font-weight:600; font-size:15px; font-family:Arial,Helvetica,sans-serif;">Imposta la mia password</a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:16px 0 0 0; padding-top:16px; border-top:1px solid #e2e8f0; font-size:12px; color:#64748b; font-family:Arial,Helvetica,sans-serif;">
                        Il pulsante non funziona? Copia questo link nel browser:<br />
                        <a href="${setupUrl}" style="color:${brand.colors.primary}; word-break:break-all; text-decoration:none;">${setupUrl}</a>
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Info box -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
                  <tr>
                    <td style="background-color:#eff6ff; border-left:4px solid #3b82f6; border-radius:8px; padding:16px;" bgcolor="#eff6ff">
                      <p style="font-weight:600; color:#1e40af; margin:0 0 8px 0; font-size:14px; font-family:Arial,Helvetica,sans-serif;">&#128203; Cose da sapere</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="color:#1e3a8a; font-size:14px; font-family:Arial,Helvetica,sans-serif;">
                        <tr><td style="padding:3px 0; line-height:1.5;">&bull; Il link &egrave; <strong>valido per 24 ore</strong></td></tr>
                        <tr><td style="padding:3px 0; line-height:1.5;">&bull; Scegli una password di almeno 8 caratteri</td></tr>
                        <tr><td style="padding:3px 0; line-height:1.5;">&bull; Dopo aver impostato la password potrai accedere subito</td></tr>
                        <tr><td style="padding:3px 0; line-height:1.5;">&bull; Il tuo username &egrave;: <strong>${email}</strong></td></tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <p style="color:#475569; margin:0; font-size:15px; line-height:1.6;">
                  Se hai dubbi o qualcosa non va, scrivi pure all'amministratore &mdash; siamo qui per aiutarti!
                </p>
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

  const text = `Benvenuto su ${brand.appName}! 🎉

Ciao ${username}! 👋

Che bello averti a bordo! Il tuo account è pronto, manca solo la password.

🎯 QUASI FATTO
Clicca il link qui sotto per scegliere la tua password (ci vogliono 2 minuti):
${setupUrl}

📋 COSE DA SAPERE:
- Il link è valido per 24 ore
- Scegli una password di almeno 8 caratteri
- Dopo potrai accedere subito
- Il tuo username è: ${email}

Se hai dubbi, scrivi pure all'amministratore!

---
Email automatica — non rispondere a questo messaggio
${brand.appName} © ${brand.year}`;

  return { html, text };
};
