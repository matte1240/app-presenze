import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { organizations } from "./platform-schema";

const id = () => text("id").primaryKey();

/**
 * Every table here carries it, including the ones already reachable through
 * `users`. The redundancy is the point: a row-level security policy can only
 * test a column the row actually has, and a query can filter without a join it
 * might forget to add.
 */
const org = () =>
  text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });
const now = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const bool = (name: string) => boolean(name).notNull().default(false);

export const users = pgTable(
  "users",
  {
    id: id(),
    organizationId: org(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["ADMIN", "EMPLOYEE"] }).notNull().default("EMPLOYEE"),
    canWorkSunday: bool("can_work_sunday"),
    has104: bool("has_104"),
    hasPaternity: bool("has_paternity"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  // The address was globally unique when the deployment was the company. It
  // cannot be now: the same accountant may keep the books for two of them.
  (t) => [unique("users_org_email_unique").on(t.organizationId, t.email)],
);

/**
 * Opaque server-side sessions rather than a JWT.
 *
 * The old build carried a `tokenVersion` column purely to fake revocation for
 * tokens it could not withdraw, and re-checked it only every five minutes.
 * Deleting a row here logs someone out immediately, and the idle timeout is a
 * single column instead of a client heartbeat plus two server mechanisms.
 *
 * `id` is the SHA-256 of the cookie value: a leaked database still does not
 * hand over live sessions.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    organizationId: org(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    /**
     * Set when a platform administrator opened this session from the
     * back-office rather than the user signing in. Support work inside
     * somebody's account should be visible to them, not silent.
     */
    impersonatedBy: text("impersonated_by"),
    createdAt: now(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: id(),
    organizationId: org(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [index("password_resets_user_idx").on(t.userId)],
);

export const workSchedules = pgTable(
  "work_schedules",
  {
    organizationId: org(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    isWorking: boolean("is_working").notNull().default(true),
    morningStart: text("morning_start"),
    morningEnd: text("morning_end"),
    afternoonStart: text("afternoon_start"),
    afternoonEnd: text("afternoon_end"),
    contractHours: doublePrecision("contract_hours").notNull().default(0),
    manualHours: boolean("manual_hours").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekday] })],
);

/**
 * One row per user per day.
 *
 * Both halves are stored: what the employee reported (the shift columns and
 * the 104 choice) and what the engine made of it (the hour buckets). Keeping
 * the inputs is what lets a schedule change be replayed over a past month
 * without guessing at the original entry.
 */
export const timeEntries = pgTable(
  "time_entries",
  {
    id: id(),
    organizationId: org(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** Civil date as `YYYY-MM-DD`; never a timestamp. */
    workDate: text("work_date").notNull(),
    kind: text("kind", { enum: ["work", "vacation", "sickness", "paternity"] })
      .notNull()
      .default("work"),

    morningStart: text("morning_start"),
    morningEnd: text("morning_end"),
    afternoonStart: text("afternoon_start"),
    afternoonEnd: text("afternoon_end"),
    morningOnLeave: bool("morning_on_leave"),
    afternoonOnLeave: bool("afternoon_on_leave"),
    use104: bool("use_104"),
    hours104Override: doublePrecision("hours_104_override"),

    regularHours: doublePrecision("regular_hours").notNull().default(0),
    overtimeHours: doublePrecision("overtime_hours").notNull().default(0),
    leaveHours: doublePrecision("leave_hours").notNull().default(0),
    leave104Hours: doublePrecision("leave_104_hours").notNull().default(0),
    vacationHours: doublePrecision("vacation_hours").notNull().default(0),
    sicknessHours: doublePrecision("sickness_hours").notNull().default(0),
    paternityHours: doublePrecision("paternity_hours").notNull().default(0),

    notes: text("notes"),
    medicalCertificate: text("medical_certificate"),
    createdBy: text("created_by"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [
    index("time_entries_org_date_idx").on(t.organizationId, t.workDate),
    // Uniqueness used to be an application-code promise kept by `entryOn()`
    // alone. On a database that will hold every customer, a promise is not
    // enough: two concurrent writes could each insert a row for the same day.
    // The constraint's index also serves the (user, date) lookups that the
    // separate index used to, so that index is gone.
    unique("time_entries_user_date_unique").on(t.userId, t.workDate),
  ],
);

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: id(),
    organizationId: org(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["VACATION", "SICKNESS", "PERMESSO"] }).notNull(),
    status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] })
      .notNull()
      .default("PENDING"),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    /** Only for PERMESSO, which is always a single day. */
    startTime: text("start_time"),
    endTime: text("end_time"),
    reason: text("reason"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [
    index("leave_requests_user_status_idx").on(t.userId, t.status),
    index("leave_requests_org_status_idx").on(t.organizationId, t.status, t.createdAt),
    index("leave_requests_dates_idx").on(t.userId, t.startDate, t.endDate),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type TimeEntryRow = typeof timeEntries.$inferSelect;
export type WorkScheduleRow = typeof workSchedules.$inferSelect;
export type LeaveRequestRow = typeof leaveRequests.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type PasswordResetRow = typeof passwordResets.$inferSelect;
