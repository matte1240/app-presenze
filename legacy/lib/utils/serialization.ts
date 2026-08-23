/**
 * Data transformation utilities for converting Prisma rows to JSON-safe types
 */

/** Shape of the numeric + date fields a TimeEntry row exposes to the API layer. */
type TimeEntryRow = {
  id: string;
  userId: string;
  workDate: Date;
  hoursWorked: number;
  overtimeHours: number;
  permessoHours: number;
  sicknessHours: number;
  vacationHours: number;
  permesso104Hours: number;
  paternityHours: number;
  morningStart: string | null;
  morningEnd: string | null;
  afternoonStart: string | null;
  afternoonEnd: string | null;
  medicalCertificate: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Convert a TimeEntry from Prisma to a plain object.
 * Normalises dates: workDate becomes YYYY-MM-DD, timestamps become ISO strings.
 */
export function serializeTimeEntry<T extends TimeEntryRow>(entry: T) {
  return {
    id: entry.id,
    userId: entry.userId,
    workDate: entry.workDate.toISOString().split('T')[0], // Return only date part (YYYY-MM-DD)
    hoursWorked: entry.hoursWorked,
    overtimeHours: entry.overtimeHours,
    permessoHours: entry.permessoHours,
    sicknessHours: entry.sicknessHours,
    vacationHours: entry.vacationHours,
    permesso104Hours: entry.permesso104Hours,
    paternityHours: entry.paternityHours,
    morningStart: entry.morningStart,
    morningEnd: entry.morningEnd,
    afternoonStart: entry.afternoonStart,
    afternoonEnd: entry.afternoonEnd,
    medicalCertificate: entry.medicalCertificate,
    notes: entry.notes,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

/**
 * Batch convert multiple time entries
 */
export function serializeTimeEntries<T extends TimeEntryRow>(entries: T[]) {
  return entries.map(serializeTimeEntry);
}
