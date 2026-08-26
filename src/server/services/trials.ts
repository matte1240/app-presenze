/**
 * The daily pass over expiring trials.
 *
 * Nothing is deleted and nothing is locked out: a lapsed trial becomes
 * read-only through `accessLevel`, which reads the same columns this job
 * writes. The job exists so that the state in the database matches what people
 * are being told, and so that the warning email goes out before the deadline
 * rather than after it.
 */
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { platformDb } from "../db/client";
import { organizations } from "../db/platform-schema";

/** How many days before the end the warning goes out. */
const WARN_DAYS = 3;

export async function expireLapsedTrials(): Promise<{ expired: number; expiring: number }> {
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

  const warnWindow = new Date(now.getTime() + WARN_DAYS * 86_400_000);
  const expiring = await platformDb
    .select({ id: organizations.id, name: organizations.name, trialEndsAt: organizations.trialEndsAt })
    .from(organizations)
    .where(
      and(
        eq(organizations.status, "TRIAL"),
        isNotNull(organizations.trialEndsAt),
        gte(organizations.trialEndsAt, now),
        lte(organizations.trialEndsAt, warnWindow),
      ),
    );

  if (lapsed.length > 0 || expiring.length > 0) {
    console.info(
      `Trial: ${lapsed.length} scaduti, ${expiring.length} in scadenza entro ${WARN_DAYS} giorni`,
    );
  }

  return { expired: lapsed.length, expiring: expiring.length };
}
