/**
 * Shared types for the employee management application
 * Centralized type definitions to avoid duplication across components
 */

// User roles
export type UserRole = "EMPLOYEE" | "ADMIN";

// Base user type
export type User = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  image?: string | null;
  createdAt: Date;
  hasPermesso104?: boolean;
  hasPaternityLeave?: boolean;
};

// Time entry data transfer object
export type TimeEntryDTO = {
  id: string;
  userId: string;
  workDate: string;
  hoursWorked: number;
  overtimeHours?: number;
  permessoHours?: number;
  sicknessHours?: number;
  vacationHours?: number;
  permesso104Hours?: number;
  paternityHours?: number;
  morningStart?: string | null;
  morningEnd?: string | null;
  afternoonStart?: string | null;
  afternoonEnd?: string | null;
  medicalCertificate?: string | null;
  notes?: string | null;
};

export type LeaveType = "VACATION" | "SICKNESS" | "PERMESSO";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type LeaveRequestDTO = {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  type: LeaveType;
  status: RequestStatus;
  reason?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  createdAt: string;
  user?: {
    name: string | null;
    email: string;
  };
};

// Working schedule for per-user, per-day base hours configuration
export type WorkingScheduleDTO = {
  id: string;
  userId: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  morningStart: string | null;
  morningEnd: string | null;
  afternoonStart: string | null;
  afternoonEnd: string | null;
  totalHours: number;
  useManualHours: boolean;
  isWorkingDay: boolean;
};

// Day names for UI
export const DAY_NAMES = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
] as const;

export const DAY_NAMES_SHORT = [
  "Dom",
  "Lun",
  "Mar",
  "Mer",
  "Gio",
  "Ven",
  "Sab",
] as const;

