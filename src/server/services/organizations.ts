/**
 * Creating and reading organizations — the part of the control plane that both
 * self-service signup and the back-office need.
 */
import { randomUUID } from "node:crypto";
import { and, count, eq, isNull, ne } from "drizzle-orm";
import type { PlanId } from "@core/plans";
import { hashPassword } from "../auth/password";
import { db, platformDb } from "../db/client";
import { currentOrgId } from "../db/context";
import { organizations, type OrganizationRow } from "../db/platform-schema";
import { users } from "../db/schema";
import { runInTenant } from "../db/tenant";
import { env } from "../env";
import { createDefaultSchedules } from "./schedules";

/** `Studio Rossi & Figli` → `studio-rossi-figli`, made unique if it collides. */
export async function uniqueSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "org";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const [clash] = await platformDb
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (!clash) return slug;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export interface NewOrganization {
  organizationName: string;
  adminName: string;
  adminEmail: string;
  /** Absent when the administrator is being invited rather than signing up. */
  adminPassword?: string;
  plan?: PlanId;
  trialDays?: number;
}

export interface CreatedOrganization {
  organization: OrganizationRow;
  adminId: string;
}

/**
 * Creates the company, its first administrator and that administrator's default
 * week.
 *
 * The two halves live on different sides of the isolation boundary — the
 * organization row is control plane, the user row is tenant data — so this is
 * the one place that crosses it, and it crosses in that order: an organization
 * with no administrator is recoverable, an administrator belonging to nothing
 * is not.
 */
export async function createOrganization(input: NewOrganization): Promise<CreatedOrganization> {
  const organizationId = randomUUID();
  const adminId = randomUUID();
  const trialDays = input.trialDays ?? env.TRIAL_DAYS;

  const [organization] = await platformDb
    .insert(organizations)
    .values({
      id: organizationId,
      name: input.organizationName,
      slug: await uniqueSlug(input.organizationName),
      status: "TRIAL",
      plan: input.plan ?? "STARTER",
      trialEndsAt: new Date(Date.now() + trialDays * 86_400_000),
      timezone: env.TZ,
      holidayPatronDays: env.DEFAULT_HOLIDAY_PATRON_DAYS,
      companyName: input.organizationName,
    })
    .returning();

  // A password is required by the column; an invited administrator gets an
  // unguessable one they will never use, and a setup link instead.
  const passwordHash = await hashPassword(input.adminPassword ?? randomUUID() + randomUUID());

  await runInTenant(organization!, async () => {
    await db.insert(users).values({
      id: adminId,
      organizationId,
      name: input.adminName,
      email: input.adminEmail.toLowerCase(),
      passwordHash,
      role: "ADMIN",
    });
    await createDefaultSchedules(adminId);
  });

  return { organization: organization!, adminId };
}

/**
 * How many seats the plan considers used. Administrators count too;
 * deactivated people do not, which is what makes deactivation a real way back
 * under a plan's limit rather than a cosmetic one.
 */
export async function seatsUsed(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(users)
    .where(and(eq(users.organizationId, currentOrgId()), isNull(users.deactivatedAt)));
  return Number(row?.total ?? 0);
}

/** Whether an address is already taken inside this organization. */
export async function emailTaken(email: string, exceptUserId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.organizationId, currentOrgId()),
        eq(users.email, email.toLowerCase()),
        exceptUserId ? ne(users.id, exceptUserId) : undefined,
      ),
    )
    .limit(1);
  return Boolean(row);
}
