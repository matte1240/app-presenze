/**
 * The wire contract, written once and used from both sides: the API validates
 * requests with these schemas and the SPA drives its forms from the same ones,
 * so a field cannot drift out of sync between them.
 */
import { z } from "zod";
import { isLocalDate } from "./date";
import { isClock } from "./time";
import { DAY_KINDS } from "./timesheet";

/*
  The `: boolean` annotations are load-bearing. Passing a type guard here —
  or letting TypeScript infer one, which it does for a bare arrow since 5.5 —
  narrows these schemas to the *branded* domain types, and the brand then
  propagates out through every form value and payload. On the wire a date is a
  validated string; `toLocalDate` re-establishes the brand at the boundary,
  where the domain actually needs it.
*/
export const localDateSchema = z
  .string()
  .refine((value): boolean => isLocalDate(value), "Data non valida (attesa YYYY-MM-DD)");
export const clockSchema = z
  .string()
  .refine((value): boolean => isClock(value), "Orario non valido (atteso HH:MM)");
export const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mese non valido");

export const spanSchema = z
  .object({ start: clockSchema, end: clockSchema })
  .refine((s) => s.start < s.end, "L'orario di fine deve seguire quello di inizio");

export const roleSchema = z.enum(["ADMIN", "EMPLOYEE"]);
export const dayKindSchema = z.enum(DAY_KINDS as [string, ...string[]]);

/**
 * Eight to sixty-four characters with an upper case letter, a lower case
 * letter and a digit. Deliberately not stricter: rules people cannot satisfy
 * get written on sticky notes.
 */
export const passwordSchema = z
  .string()
  .min(8, "La password deve avere almeno 8 caratteri")
  .max(64, "La password non può superare i 64 caratteri")
  .regex(/[a-z]/, "Serve almeno una lettera minuscola")
  .regex(/[A-Z]/, "Serve almeno una lettera maiuscola")
  .regex(/\d/, "Serve almeno un numero");

export const emailSchema = z.email("Indirizzo email non valido").max(160);
export const nameSchema = z.string().trim().min(1, "Il nome è obbligatorio").max(100);

// ── Authentication ────────────────────────────────────────────────────────

/**
 * `organizationId` is the second half of a two-step sign-in. It is absent the
 * first time; if the address and password match an account in more than one
 * company, the server answers with the list and the browser asks again naming
 * one. Nothing is disclosed by that list which the password did not already
 * unlock.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  organizationId: z.string().min(1).optional(),
});

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, "Il nome dell'organizzazione è obbligatorio")
  .max(120);

/** Creating a company and its first administrator, in one step. */
export const signupSchema = z.object({
  organizationName: organizationNameSchema,
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(1), password: passwordSchema });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Inserisci la password attuale"),
  newPassword: passwordSchema,
});

// ── Organization ──────────────────────────────────────────────────────────

/**
 * A real IANA zone, checked by asking the platform rather than by keeping a
 * list of our own that would be wrong within a year.
 */
const isTimezone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** `MM-DD`, comma separated — the shape `holidayConfigOf()` already reads. */
const isPatronDays = (value: string): boolean =>
  value
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .every((d) => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d));

export const organizationSettingsSchema = z.object({
  name: organizationNameSchema,
  /** What staff see on the sign-in screen; defaults to the name. */
  companyName: z.string().trim().max(120).nullable(),
  timezone: z.string().refine((v): boolean => isTimezone(v), "Fuso orario non valido"),
  holidayPatronDays: z
    .string()
    .trim()
    .refine((v): boolean => isPatronDays(v), "Usa il formato MM-DD, separato da virgole"),
});

/**
 * Changing the address changes the key you sign in with, so the current
 * password comes with it. The name alone does not need one.
 */
export const updateProfileSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    currentPassword: z.string().optional(),
  });

// ── Timesheet ─────────────────────────────────────────────────────────────

/**
 * What the browser is allowed to say about a day.
 *
 * Note what is absent: every hour bucket. The old API accepted `hoursWorked`,
 * `overtimeHours` and the rest straight from the client and stored them
 * verbatim, so a hand-written request could book any number it liked. The
 * client now sends only what was observed — which shifts, which kind of day —
 * and the server derives the classification itself.
 */
export const dayEntrySchema = z
  .object({
    date: localDateSchema,
    kind: dayKindSchema,
    morning: spanSchema.nullable().default(null),
    afternoon: spanSchema.nullable().default(null),
    morningOnLeave: z.boolean().default(false),
    afternoonOnLeave: z.boolean().default(false),
    use104: z.boolean().default(false),
    hours104Override: z.number().min(0).max(24).nullable().default(null),
    notes: z.string().max(500).nullable().default(null),
    medicalCertificate: z.string().max(120).nullable().default(null),
    /** Admins only; ignored when an employee sends it. */
    userId: z.string().min(1).optional(),
  })
  .refine(
    (d) => d.kind !== "work" || d.morning !== null || d.afternoon !== null ||
      d.morningOnLeave || d.afternoonOnLeave,
    { message: "Indica almeno un turno o segnala il permesso", path: ["morning"] },
  );

export const recalculateSchema = z.object({
  userId: z.string().min(1),
  month: yearMonthSchema,
});

// ── Working schedules ─────────────────────────────────────────────────────

export const daySchedulePayloadSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  isWorking: z.boolean(),
  morning: spanSchema.nullable().default(null),
  afternoon: spanSchema.nullable().default(null),
  contractHours: z.number().min(0).max(24).default(0),
  manualHours: z.boolean().default(false),
});

export const weekSchedulePayloadSchema = z.object({
  days: z.array(daySchedulePayloadSchema).max(7),
  canWorkSunday: z.boolean().optional(),
});

// ── Leave requests ────────────────────────────────────────────────────────

export const leaveTypeSchema = z.enum(["VACATION", "SICKNESS", "PERMESSO"]);
export const leaveStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);

export const leaveRequestSchema = z
  .object({
    type: leaveTypeSchema,
    startDate: localDateSchema,
    endDate: localDateSchema,
    startTime: clockSchema.nullable().default(null),
    endTime: clockSchema.nullable().default(null),
    reason: z.string().max(500).nullable().default(null),
  })
  .refine((r) => r.startDate <= r.endDate, {
    message: "La data di fine non può precedere quella di inizio",
    path: ["endDate"],
  })
  .refine((r) => r.type !== "PERMESSO" || (r.startTime !== null && r.endTime !== null), {
    message: "Un permesso orario richiede orario di inizio e fine",
    path: ["startTime"],
  })
  .refine((r) => r.type !== "PERMESSO" || r.startDate === r.endDate, {
    message: "Un permesso orario riguarda un solo giorno",
    path: ["endDate"],
  });

/** Approve or reject. Kept apart from editing so a status change always
 *  runs the side effects that go with it. */
export const leaveReviewSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });

// ── Users ─────────────────────────────────────────────────────────────────

const userFlagsSchema = z.object({
  canWorkSunday: z.boolean().optional(),
  has104: z.boolean().optional(),
  hasPaternity: z.boolean().optional(),
});

export const createUserSchema = userFlagsSchema.extend({
  name: nameSchema,
  email: emailSchema,
  role: roleSchema.default("EMPLOYEE"),
  /** Omit to send the new user a setup link by email instead. */
  password: passwordSchema.optional(),
});

export const updateUserSchema = userFlagsSchema.extend({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  role: roleSchema.optional(),
});

export const adminResetPasswordSchema = z.object({ newPassword: passwordSchema.optional() });

// ── Reports ───────────────────────────────────────────────────────────────

export const excelReportSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(200),
  month: yearMonthSchema,
});

export type DayEntryPayload = z.infer<typeof dayEntrySchema>;
export type WeekSchedulePayload = z.infer<typeof weekSchedulePayloadSchema>;
export type LeaveRequestPayload = z.infer<typeof leaveRequestSchema>;
export type CreateUserPayload = z.infer<typeof createUserSchema>;
export type UpdateUserPayload = z.infer<typeof updateUserSchema>;
export type LeaveType = z.infer<typeof leaveTypeSchema>;
export type LeaveStatus = z.infer<typeof leaveStatusSchema>;
