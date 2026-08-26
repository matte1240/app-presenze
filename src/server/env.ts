/**
 * Configuration, read once and validated at boot.
 *
 * `DATABASE_URL` deliberately has no default. Every other value here can fall
 * back to something harmless, but a connection string that quietly points
 * somewhere plausible is how an instance ends up serving an empty database and
 * looking healthy while doing it.
 */
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().default("http://localhost:3000"),
  TZ: z.string().default("Europe/Rome"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL è obbligatoria"),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),

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

  REMINDER_CRON: z.string().default("0 19 * * *"),
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
