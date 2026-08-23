/**
 * Structured audit logger.
 * Writes JSON-formatted log lines to stdout and optionally to /app/logs/audit.log.
 *
 * Log categories:
 * - AUTH:   login success/failure, logout, password reset
 * - ACCESS: HTTP requests to API routes
 * - ADMIN:  user management, approvals, exports
 * - SECURITY: rate limit violations, token invalidation
 */

import { appendFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export type AuditCategory = "AUTH" | "ACCESS" | "ADMIN" | "SECURITY";

export interface AuditEvent {
  category: AuditCategory;
  action: string;
  userId?: string;
  ip?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  details?: Record<string, unknown>;
}

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "audit.log");

let dirEnsured = false;

async function ensureLogDir() {
  if (dirEnsured) return;
  if (!existsSync(LOG_DIR)) {
    await mkdir(LOG_DIR, { recursive: true });
  }
  dirEnsured = true;
}

/**
 * Write a structured audit log entry.
 * Always prints to stdout (captured by Docker); also writes to file if possible.
 */
export async function audit(event: AuditEvent): Promise<void> {
  const entry = {
    timestamp: new Date().toISOString(),
    ...event,
  };

  const line = JSON.stringify(entry);

  // Always log to stdout (Docker captures this)
  console.log(line);

  // Best-effort write to file (non-blocking, no crash on failure)
  try {
    await ensureLogDir();
    await appendFile(LOG_FILE, line + "\n", "utf-8");
  } catch {
    // File logging is best-effort — don't crash the app
  }
}

/**
 * Convenience helpers for common audit events.
 */
export const auditAuth = {
  loginSuccess(userId: string, ip: string) {
    return audit({ category: "AUTH", action: "LOGIN_SUCCESS", userId, ip });
  },
  loginFailed(ip: string, email?: string) {
    return audit({
      category: "AUTH",
      action: "LOGIN_FAILED",
      ip,
      details: email ? { email: email.replace(/(.{2}).*(@.*)/, "$1***$2") } : undefined,
    });
  },
  logout(userId: string) {
    return audit({ category: "AUTH", action: "LOGOUT", userId });
  },
  passwordReset(userId: string, ip: string) {
    return audit({ category: "AUTH", action: "PASSWORD_RESET", userId, ip });
  },
  passwordResetRequested(ip: string) {
    return audit({ category: "AUTH", action: "PASSWORD_RESET_REQUESTED", ip });
  },
  sessionInvalidated(userId: string) {
    return audit({ category: "SECURITY", action: "SESSION_INVALIDATED", userId });
  },
};

export const auditAdmin = {
  userCreated(adminId: string, newUserId: string, role: string) {
    return audit({ category: "ADMIN", action: "USER_CREATED", userId: adminId, details: { newUserId, role } });
  },
  userUpdated(adminId: string, targetUserId: string, changes: Record<string, unknown>) {
    return audit({ category: "ADMIN", action: "USER_UPDATED", userId: adminId, details: { targetUserId, ...changes } });
  },
  userDeleted(adminId: string, targetUserId: string) {
    return audit({ category: "ADMIN", action: "USER_DELETED", userId: adminId, details: { targetUserId } });
  },
  leaveRequestReviewed(adminId: string, requestId: string, status: string) {
    return audit({ category: "ADMIN", action: "LEAVE_REQUEST_REVIEWED", userId: adminId, details: { requestId, status } });
  },
  excelExported(userId: string) {
    return audit({ category: "ADMIN", action: "EXCEL_EXPORTED", userId });
  },
  backupCreated(userId: string) {
    return audit({ category: "ADMIN", action: "BACKUP_CREATED", userId });
  },
  backupRestored(userId: string) {
    return audit({ category: "ADMIN", action: "BACKUP_RESTORED", userId });
  },
};

export const auditSecurity = {
  rateLimited(ip: string, endpoint: string) {
    return audit({ category: "SECURITY", action: "RATE_LIMITED", ip, details: { endpoint } });
  },
  setupCompleted(userId: string, ip: string) {
    return audit({ category: "SECURITY", action: "SETUP_COMPLETED", userId, ip });
  },
};

export const auditCalendar = {
  entryCreated(userId: string, workDate: string, details?: Record<string, unknown>) {
    return audit({ category: "ADMIN", action: "TIMEENTRY_CREATED", userId, details: { workDate, ...details } });
  },
  entryUpdated(userId: string, workDate: string, details?: Record<string, unknown>) {
    return audit({ category: "ADMIN", action: "TIMEENTRY_UPDATED", userId, details: { workDate, ...details } });
  },
  entryDeleted(userId: string, workDate: string, deletedBy: string) {
    return audit({ category: "ADMIN", action: "TIMEENTRY_DELETED", userId: deletedBy, details: { targetUserId: userId, workDate } });
  },
  leaveRequested(userId: string, leaveType: string, startDate: string, endDate: string) {
    return audit({ category: "ADMIN", action: "LEAVE_REQUESTED", userId, details: { leaveType, startDate, endDate } });
  },
};
