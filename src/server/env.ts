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
  /**
   * The table owner, which Postgres exempts from row-level security. Only the
   * sign-in lookup, the back-office and the scheduled jobs use it. Required in
   * production: without it the application runs as the owner and the isolation
   * policies never apply.
   */
  DATABASE_ADMIN_URL: z.string().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),

  APP_NAME: z.string().default("Presenze"),

  /** Whether anyone may create an organization, or only the back-office. */
  SIGNUP_ENABLED: z.stringbool().default(true),
  TRIAL_DAYS: z.coerce.number().int().min(0).default(14),

  /**
   * Creates the first platform administrator at boot, and only while there is
   * none. Both are needed; either alone is ignored.
   */
  PLATFORM_ADMIN_EMAIL: z.string().optional(),
  PLATFORM_ADMIN_PASSWORD: z.string().optional(),

  /**
   * Defaults for a newly created organization; each one keeps its own copy
   * from then on. Comma-separated `MM-DD` local patron saint days.
   */
  DEFAULT_HOLIDAY_PATRON_DAYS: z.string().default(""),

  /**
   * Stripe. Absent in development: the billing routes then answer "not
   * configured" instead of the application refusing to start, so nobody needs
   * an account to work on the timesheet.
   */
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_BUSINESS: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().optional(),

  REMINDER_CRON: z.string().default("0 19 * * *"),
  ENABLE_CRON: z.stringbool().default(true),

  /**
   * Object storage for whole-database backups. Written against the plain S3
   * API — Hetzner Object Storage speaks that and nothing else — so the same
   * code reaches it, MinIO in development, or AWS S3 itself unchanged.
   * Absent in development: the back-office backup screen then says so instead
   * of the application refusing to start.
   */
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /**
   * Path-style (`endpoint/bucket/key`) rather than virtual-hosted
   * (`bucket.endpoint/key`) addressing. The safe default for anything that
   * isn't AWS itself: Hetzner's endpoint has no wildcard certificate for
   * `<bucket>.<endpoint>`, so virtual-hosted requests fail TLS verification.
   */
  S3_FORCE_PATH_STYLE: z.stringbool().default(true),
  /** Key prefix inside the bucket, so it can be shared with other tenants of the bucket itself. */
  BACKUP_PREFIX: z.string().default("backups/"),
  BACKUP_CRON: z.string().default("0 3 * * *"),
  /** Backups older than this are pruned — but never below BACKUP_MIN_COUNT. */
  BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
  BACKUP_MIN_COUNT: z.coerce.number().int().min(1).default(7),
  BACKUP_EMAIL_TO: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Configurazione non valida:", z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";

/** Turns an organization's stored `MM-DD` list into what the domain expects. */
export function holidayConfigOf(patronDays: string) {
  return { patronDays: patronDays.split(",").map((s) => s.trim()).filter(Boolean) } as const;
}

export const mailEnabled = Boolean(env.SMTP_HOST && env.MAIL_FROM);

export const stripeEnabled = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);

/** The Stripe price for each plan, as configured. Missing ones cannot be sold. */
export const stripePrices = {
  STARTER: env.STRIPE_PRICE_STARTER,
  PRO: env.STRIPE_PRICE_PRO,
  BUSINESS: env.STRIPE_PRICE_BUSINESS,
} as const;

export const s3Enabled = Boolean(
  env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
);

/** Always ending in `/`, so a key is a plain concatenation and never a double slash. */
export const backupPrefix = env.BACKUP_PREFIX === "" ? "" : env.BACKUP_PREFIX.replace(/\/*$/, "/");
