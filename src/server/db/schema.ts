import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const now = () => integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`);
const bool = (name: string) => integer(name, { mode: "boolean" }).notNull().default(false);

export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["ADMIN", "EMPLOYEE"] }).notNull().default("EMPLOYEE"),
  canWorkSunday: bool("can_work_sunday"),
  has104: bool("has_104"),
  hasPaternity: bool("has_paternity"),
  createdAt: now(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

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
export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    userAgent: text("user_agent"),
    createdAt: now(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = sqliteTable(
  "password_resets",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdAt: now(),
  },
  (t) => [index("password_resets_user_idx").on(t.userId)],
);

export const workSchedules = sqliteTable(
  "work_schedules",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    isWorking: integer("is_working", { mode: "boolean" }).notNull().default(true),
    morningStart: text("morning_start"),
    morningEnd: text("morning_end"),
    afternoonStart: text("afternoon_start"),
    afternoonEnd: text("afternoon_end"),
    contractHours: real("contract_hours").notNull().default(0),
    manualHours: integer("manual_hours", { mode: "boolean" }).notNull().default(false),
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
export const timeEntries = sqliteTable(
  "time_entries",
  {
    id: id(),
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
    hours104Override: real("hours_104_override"),

    regularHours: real("regular_hours").notNull().default(0),
    overtimeHours: real("overtime_hours").notNull().default(0),
    leaveHours: real("leave_hours").notNull().default(0),
    leave104Hours: real("leave_104_hours").notNull().default(0),
    vacationHours: real("vacation_hours").notNull().default(0),
    sicknessHours: real("sickness_hours").notNull().default(0),
    paternityHours: real("paternity_hours").notNull().default(0),

    notes: text("notes"),
    medicalCertificate: text("medical_certificate"),
    createdBy: text("created_by"),
    createdAt: now(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("time_entries_user_date_idx").on(t.userId, t.workDate),
    index("time_entries_date_idx").on(t.workDate),
  ],
);

export const leaveRequests = sqliteTable(
  "leave_requests",
  {
    id: id(),
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
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    createdAt: now(),
  },
  (t) => [
    index("leave_requests_user_status_idx").on(t.userId, t.status),
    index("leave_requests_status_idx").on(t.status, t.createdAt),
    index("leave_requests_dates_idx").on(t.userId, t.startDate, t.endDate),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type TimeEntryRow = typeof timeEntries.$inferSelect;
export type WorkScheduleRow = typeof workSchedules.$inferSelect;
export type LeaveRequestRow = typeof leaveRequests.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
