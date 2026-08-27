/**
 * The record of what was done to a customer's account from outside it.
 *
 * Deliberately narrow. This is not an activity feed for the application — every
 * timesheet edit already leaves its own row — it is the answer to "who changed
 * this company's plan, who suspended them, and who has been inside their
 * account". Those are the actions a customer would be entitled to ask about.
 */
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { platformDb } from "../db/client";
import { auditLog } from "../db/platform-schema";

export type AuditAction =
  | "organization.created"
  | "organization.updated"
  | "organization.impersonated"
  | "organization.exported"
  | "organization.deleted"
  | "platform_admin.created"
  | "platform_admin.deleted"
  | "backup.created"
  | "backup.restored"
  | "backup.deleted";

export async function record(entry: {
  organizationId: string | null;
  actorType: "USER" | "PLATFORM_ADMIN" | "SYSTEM";
  actorId: string | null;
  actorLabel: string | null;
  action: AuditAction;
  detail?: unknown;
}): Promise<void> {
  await platformDb.insert(auditLog).values({
    id: randomUUID(),
    organizationId: entry.organizationId,
    actorType: entry.actorType,
    actorId: entry.actorId,
    actorLabel: entry.actorLabel,
    action: entry.action,
    detail: entry.detail ?? null,
  });
}

export async function recentAudit(limit = 100, organizationId?: string) {
  const query = platformDb.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
  return organizationId ? query.where(eq(auditLog.organizationId, organizationId)) : query;
}
