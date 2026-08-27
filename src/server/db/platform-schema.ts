/**
 * The control plane: who the customers are, what they pay for, and who at this
 * end can act on them.
 *
 * Kept in its own file, and out of `schema.ts`, because the two obey opposite
 * rules. Everything in `schema.ts` belongs to exactly one company and is fenced
 * off by row-level security; everything here spans companies by definition and
 * must not be.
 */
import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { ORG_STATUSES, PLAN_IDS } from "@core/plans";

const id = () => text("id").primaryKey();
const now = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  /** Unique and stable: the hook a subdomain or custom domain would hang on. */
  slug: text("slug").notNull().unique(),

  status: text("status", { enum: ORG_STATUSES }).notNull().default("TRIAL"),
  plan: text("plan", { enum: PLAN_IDS }).notNull().default("STARTER"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  /** When payment first failed; the grace period in `@core/plans` counts from here. */
  pastDueSince: timestamp("past_due_since", { withTimezone: true }),

  /** Was one deploy-wide env var each; they belong to the company now. */
  timezone: text("timezone").notNull().default("Europe/Rome"),
  holidayPatronDays: text("holiday_patron_days").notNull().default(""),

  /** Branding. Read on the sign-in screen today, the hook for the rest later. */
  companyName: text("company_name"),
  logoUrl: text("logo_url"),
  brandColor: text("brand_color"),

  createdAt: now(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const subscriptions = pgTable("subscriptions", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  /** Stripe's own vocabulary, kept verbatim; ours lives on `organizations`. */
  stripeStatus: text("stripe_status"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: text("cancel_at_period_end"),
  createdAt: now(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

/**
 * Webhook idempotency. Stripe redelivers, and a redelivered
 * `invoice.payment_failed` must not restart a grace period that has already
 * run down.
 */
export const stripeEvents = pgTable("stripe_events", {
  id: id(),
  type: text("type").notNull(),
  processedAt: now(),
});

/**
 * Who to invoice, and where the invoice has to go.
 *
 * Its own table rather than more columns on `organizations`: this is accounting
 * data with its own lifecycle and its own audience, and an organization's
 * settings are already crowded enough without an address in the middle of them.
 */
export const billingProfiles = pgTable("billing_profiles", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),

  /** The name on the invoice, which is rarely the name people call them by. */
  legalName: text("legal_name").notNull(),
  addressLine: text("address_line").notNull(),
  postalCode: text("postal_code").notNull(),
  city: text("city").notNull(),
  province: text("province"),
  country: text("country").notNull().default("IT"),

  vatNumber: text("vat_number"),
  taxCode: text("tax_code"),
  /** Where the exchange system delivers an Italian electronic invoice. */
  sdiCode: text("sdi_code"),
  pec: text("pec"),
  billingEmail: text("billing_email"),

  createdAt: now(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type BillingProfileRow = typeof billingProfiles.$inferSelect;

/**
 * Deliberately not a role on `users`.
 *
 * If "can administer the platform" were a value in the tenant `role` column,
 * then every code path that writes that column — an invite, an import, a bug —
 * would be a possible privilege escalation out of a customer's account and into
 * everybody's. A separate table with a separate cookie cannot be reached that
 * way at all.
 */
export const platformAdmins = pgTable("platform_admins", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  /**
   * Set on an account somebody else created, and cleared when its owner picks
   * their own password. An account that can reach every customer should not
   * keep running on a password a second person knows.
   */
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: now(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const platformSessions = pgTable(
  "platform_sessions",
  {
    id: id(),
    adminId: text("admin_id")
      .notNull()
      .references(() => platformAdmins.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: now(),
  },
  (t) => [index("platform_sessions_admin_idx").on(t.adminId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    actorType: text("actor_type", { enum: ["USER", "PLATFORM_ADMIN", "SYSTEM"] }).notNull(),
    actorId: text("actor_id"),
    actorLabel: text("actor_label"),
    action: text("action").notNull(),
    detail: jsonb("detail"),
    createdAt: now(),
  },
  (t) => [
    index("audit_log_org_idx").on(t.organizationId, t.createdAt),
    index("audit_log_created_idx").on(t.createdAt),
  ],
);

export type OrganizationRow = typeof organizations.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type PlatformAdminRow = typeof platformAdmins.$inferSelect;
