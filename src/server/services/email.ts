/**
 * Outgoing mail: one transport, one HTML layout, short bodies.
 *
 * The previous version had six standalone templates totalling around 936 lines
 * because each one repeated the header, the button and the footer inline. The
 * shared layout below is the whole of that duplication.
 */
import { createTransport, type Transporter } from "nodemailer";
import { formatDateIt, type LocalDate } from "@core/date";
import { env, mailEnabled } from "../env";

let transporter: Transporter | null = null;

function transport(): Transporter | null {
  if (!mailEnabled) return null;
  transporter ??= createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface Layout {
  title: string;
  intro: string;
  body?: string;
  action?: { label: string; href: string };
  footnote?: string;
}

/** Inline styles and a table shell, because that is what mail clients render. */
function render({ title, intro, body = "", action, footnote }: Layout): string {
  const button = action
    ? `<p style="margin:28px 0"><a href="${escape(action.href)}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">${escape(action.label)}</a></p>`
    : "";
  const note = footnote ? `<p style="color:#6b7280;font-size:13px;margin-top:24px">${footnote}</p>` : "";

  return `<!doctype html><html lang="it"><body style="margin:0;background:#f4f4f5;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:32px;max-width:560px">
<tr><td>
<p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">${escape(env.APP_NAME)}</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escape(title)}</h1>
<p style="margin:0 0 12px;line-height:1.6">${intro}</p>
${body}${button}${note}
</td></tr></table>
<p style="color:#9ca3af;font-size:12px;margin-top:16px">Messaggio automatico, non rispondere a questa email.</p>
</td></tr></table></body></html>`;
}

async function send(to: string, subject: string, layout: Layout, replyTo?: string): Promise<boolean> {
  const t = transport();
  if (!t) {
    console.warn(`SMTP non configurato: email "${subject}" non inviata a ${to}`);
    return false;
  }
  try {
    await t.sendMail({
      from: env.MAIL_FROM,
      to,
      subject,
      html: render(layout),
      replyTo,
    });
    return true;
  } catch (error) {
    console.error(`Invio email fallito (${subject} → ${to}):`, error);
    return false;
  }
}

const list = (items: readonly string[]) =>
  `<ul style="margin:0 0 12px;padding-left:20px;line-height:1.8">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

/**
 * `organizationName` is not decoration. The same address can hold an account in
 * more than one company, each with its own password, and a link that does not
 * say which one it opens is a link the recipient cannot use.
 */
export function sendPasswordResetEmail(to: string, token: string, organizationName: string) {
  return send(to, `Reimposta la tua password — ${organizationName}`, {
    title: "Reimposta la password",
    intro: `Abbiamo ricevuto una richiesta di reimpostazione della password per il tuo account su ${escape(organizationName)}.`,
    action: { label: "Scegli una nuova password", href: `${env.APP_URL}/reset-password?token=${token}` },
    footnote: "Il link scade fra un'ora. Se non hai richiesto tu il cambio, puoi ignorare questa email.",
  });
}

export function sendWelcomeEmail(to: string, name: string, token: string, organizationName: string) {
  return send(to, `Il tuo accesso a ${organizationName}`, {
    title: `Benvenuto, ${escape(name)}`,
    intro: `È stato creato un account per te su ${escape(organizationName)}. Imposta una password per iniziare.`,
    action: { label: "Imposta la password", href: `${env.APP_URL}/reset-password?token=${token}` },
    footnote: "Il link scade fra 24 ore.",
  });
}

const LEAVE_LABEL = { VACATION: "Ferie", SICKNESS: "Malattia", PERMESSO: "Permesso" } as const;

export function sendLeaveRequestToAdmin(args: {
  to: string;
  employeeName: string;
  employeeEmail: string;
  type: keyof typeof LEAVE_LABEL;
  startDate: LocalDate;
  endDate: LocalDate;
  reason: string | null;
}) {
  const label = LEAVE_LABEL[args.type];
  const period =
    args.startDate === args.endDate
      ? formatDateIt(args.startDate)
      : `dal ${formatDateIt(args.startDate)} al ${formatDateIt(args.endDate)}`;

  return send(
    args.to,
    `Nuova richiesta di ${label.toLowerCase()} da ${args.employeeName}`,
    {
      title: `Richiesta di ${label.toLowerCase()}`,
      intro: `<strong>${escape(args.employeeName)}</strong> ha inviato una richiesta da approvare.`,
      body: list([
        `Tipo: <strong>${label}</strong>`,
        `Periodo: <strong>${period}</strong>`,
        ...(args.reason ? [`Motivo: ${escape(args.reason)}`] : []),
      ]),
      action: { label: "Apri le richieste", href: `${env.APP_URL}/richieste` },
    },
    args.employeeEmail,
  );
}

export function sendLeaveDecision(args: {
  to: string;
  type: keyof typeof LEAVE_LABEL;
  startDate: LocalDate;
  endDate: LocalDate;
  approved: boolean;
}) {
  const label = LEAVE_LABEL[args.type];
  const period =
    args.startDate === args.endDate
      ? formatDateIt(args.startDate)
      : `dal ${formatDateIt(args.startDate)} al ${formatDateIt(args.endDate)}`;
  const verdict = args.approved ? "approvata" : "rifiutata";

  return send(args.to, `Richiesta di ${label.toLowerCase()} ${verdict}`, {
    title: `Richiesta ${verdict}`,
    intro: `La tua richiesta di <strong>${label.toLowerCase()}</strong> ${period} è stata <strong>${verdict}</strong>.`,
    action: { label: "Apri le richieste", href: `${env.APP_URL}/richieste` },
  });
}

export function sendMissingTimesheetReminder(args: {
  to: string;
  name: string;
  editable: readonly LocalDate[];
  requiresAdmin: readonly LocalDate[];
}) {
  const sections: string[] = [];
  if (args.editable.length) {
    sections.push(
      `<p style="margin:0 0 8px"><strong>Puoi ancora compilarli tu:</strong></p>${list(args.editable.map(formatDateIt))}`,
    );
  }
  if (args.requiresAdmin.length) {
    sections.push(
      `<p style="margin:0 0 8px"><strong>Questi vanno chiesti a un amministratore:</strong></p>${list(args.requiresAdmin.map(formatDateIt))}`,
    );
  }

  return send(args.to, "Cartellino incompleto", {
    title: `Ciao ${escape(args.name)}`,
    intro: "Risultano dei giorni senza ore registrate.",
    body: sections.join(""),
    action: { label: "Apri il calendario", href: `${env.APP_URL}/calendario` },
  });
}

export function sendTrialEndingEmail(args: {
  to: string;
  organizationName: string;
  daysLeft: number;
}) {
  const when =
    args.daysLeft === 0
      ? "oggi"
      : args.daysLeft === 1
        ? "domani"
        : `fra ${args.daysLeft} giorni`;

  return send(args.to, `La prova di ${args.organizationName} finisce ${when}`, {
    title: "La prova gratuita sta per finire",
    intro:
      `Il periodo di prova di <strong>${escape(args.organizationName)}</strong> finisce ${when}. ` +
      "Dopo, i dati restano consultabili ed esportabili, ma non sarà più possibile registrare nuove ore.",
    action: { label: "Scegli un piano", href: `${env.APP_URL}/abbonamento` },
    footnote: "Se hai già attivato un abbonamento puoi ignorare questa email.",
  });
}
