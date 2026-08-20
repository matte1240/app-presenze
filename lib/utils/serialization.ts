/**
 * Data transformation utilities for converting Prisma types to JSON-safe types
 */

import type { Prisma } from "@/lib/generated/prisma/client";

type Decimal = Prisma.Decimal;

/**
 * Convert Prisma Decimal to number
 * Safe for JSON serialization
 */
export function decimalToNumber(decimal: Decimal | null | undefined): number {
  if (decimal === null || decimal === undefined) {
    return 0;
  }
  return parseFloat(decimal.toString());
}

/**
 * Convert a TimeEntry from Prisma to a plain object
 * Handles Decimal conversions and date formatting
 */
export function serializeTimeEntry<T extends {
  id: string;
  userId: string;
  workDate: Date;
  hoursWorked: Decimal;
  overtimeHours: Decimal;
  permessoHours: Decimal;
  sicknessHours: Decimal;
  vacationHours: Decimal;
  permesso104Hours: Decimal;
  paternityHours: Decimal;
  morningStart: string | null;
  morningEnd: string | null;
  afternoonStart: string | null;
  afternoonEnd: string | null;
  medicalCertificate: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}>(entry: T) {
  return {
    id: entry.id,
    userId: entry.userId,
    workDate: entry.workDate.toISOString().split('T')[0], // Return only date part (YYYY-MM-DD)
    hoursWorked: decimalToNumber(entry.hoursWorked),
    overtimeHours: decimalToNumber(entry.overtimeHours),
    permessoHours: decimalToNumber(entry.permessoHours),
    sicknessHours: decimalToNumber(entry.sicknessHours),
    vacationHours: decimalToNumber(entry.vacationHours),
    permesso104Hours: decimalToNumber(entry.permesso104Hours),
    paternityHours: decimalToNumber(entry.paternityHours),
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
export function serializeTimeEntries<T extends {
  id: string;
  userId: string;
  workDate: Date;
  hoursWorked: Decimal;
  overtimeHours: Decimal;
  permessoHours: Decimal;
  sicknessHours: Decimal;
  vacationHours: Decimal;
  permesso104Hours: Decimal;
  paternityHours: Decimal;
  morningStart: string | null;
  morningEnd: string | null;
  afternoonStart: string | null;
  afternoonEnd: string | null;
  medicalCertificate: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}>(entries: T[]) {
  return entries.map(serializeTimeEntry);
}
