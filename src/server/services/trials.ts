/**
 * The daily pass over trials.
 *
 * Nothing is deleted and nobody is locked out: a lapsed trial becomes read-only
 * through `accessLevel`, which reads the same column this job writes. The job
 * exists so that the state in the database matches what people have been told,
 * and so that the warning reaches them before the deadline rather than after.
 */
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { trialDaysLeft } from "@core/plans";
import { db, platformDb } from "../db/client";
import { organizations } from "../db/platform-schema";
import { users } from "../db/schema";
import { runInTenant } from "../db/tenant";
import { revokeOrganizationSessions } from "../auth/session";
import { sendTrialEndingEmail } from "./email";

/** How many days before the end the warning goes out. */
const WARN_DAYS = 3;

export async function expireLapsedTrials(): Promise<{ expired: number; warned: number }> {
  const now = new Date();

  const lapsed = await platformDb
    .update(organizations)
    .set({ status: "SUSPENDED", updatedAt: now })
    .where(
      and(
        eq(organizations.status, "TRIAL"),
        isNotNull(organizations.trialEndsAt),
        lte(organizations.trialEndsAt, now),
      ),
    )
    .returning({ id: organizations.id, name: organizations.name });

  // Read-only takes effect on the next request anyway; ending the sessions
  // makes it take effect on the open tabs too, so nobody spends the morning
  // typing into a form that will refuse to save.
  for (const organization of lapsed) {
    await revokeOrganizationSessions(organization.id);
  }

  const warnWindow = new Date(now.getTime() + WARN_DAYS * 86_400_000);
  const expiring = await platformDb
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.status, "TRIAL"),
        isNotNull(organizations.trialEndsAt),
        gte(organizations.trialEndsAt, now),
        lte(organizations.trialEndsAt, warnWindow),
      ),
    );

  let warned = 0;
  for (const organization of expiring) {
    // Inside the tenant, because the administrators to write to are its rows.
    await runInTenant(organization, async () => {
      const admins = await db
        .select({ email: users.email })
        .from(users)
        .where(and(eq(users.organizationId, organization.id), eq(users.role, "ADMIN")));

      for (const admin of admins) {
        const sent = await sendTrialEndingEmail({
          to: admin.email,
          organizationName: organization.name,
          daysLeft: trialDaysLeft(organization.trialEndsAt, now) ?? 0,
        });
        if (sent) warned += 1;
      }
    });
  }

  if (lapsed.length > 0 || warned > 0) {
    console.info(`Trial: ${lapsed.length} scaduti, ${warned} avvisi inviati`);
  }
  return { expired: lapsed.length, warned };
}

/**
 * Housekeeping. Expired rows are already treated as absent by every lookup;
 * this is what stops the tables growing forever with rows nobody will read.
 */
export async function purgeExpiredCredentials(): Promise<void> {
  const { purgeExpiredSessions } = await import("../auth/session");
  const { purgeExpiredPlatformSessions } = await import("../auth/platform");
  await purgeExpiredSessions();
  await purgeExpiredPlatformSessions();
}
