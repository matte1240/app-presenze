/**
 * Configuration, read once and validated at boot.
 *
 * A missing session secret in production is a hard failure rather than a
 * silent fallback: the alternative is a deployment that looks healthy while
 * signing cookies with a default everybody knows.
 */
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().default("http://localhost:3000"),
  TZ: z.string().default("Europe/Rome"),

  DATABASE_FILE: z.string().default("./data/app.db"),
  BACKUP_DIR: z.string().default("./backups"),

  APP_NAME: z.string().default("Presenze"),
  COMPANY_NAME: z.string().default(""),

  /** Comma-separated `MM-DD` local patron saint days. */
  HOLIDAY_PATRON_DAYS: z.string().default(""),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().optional(),

  BACKUP_CRON: z.string().default("0 2 * * *"),
  REMINDER_CRON: z.string().default("0 19 * * *"),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
  BACKUP_MIN_COUNT: z.coerce.number().int().min(1).default(7),
  BACKUP_EMAIL_TO: z.string().optional(),
  ENABLE_CRON: z.stringbool().default(true),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Configurazione non valida:", z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";

export const holidayConfig = {
  patronDays: env.HOLIDAY_PATRON_DAYS.split(",").map((s) => s.trim()).filter(Boolean),
} as const;

export const mailEnabled = Boolean(env.SMTP_HOST && env.MAIL_FROM);
