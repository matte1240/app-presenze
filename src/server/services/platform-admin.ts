/**
 * Creating the first back-office account.
 *
 * Only ever while there is none — the same defensive shape the old
 * first-administrator screen had, for the same reason: an endpoint or a boot
 * step that can create a privileged account twice is one that can be used to
 * create one at any time.
 */
import { randomUUID } from "node:crypto";
import { count } from "drizzle-orm";
import { hashPassword } from "../auth/password";
import { platformDb, platformSql } from "../db/client";
import { platformAdmins } from "../db/platform-schema";
import { env } from "../env";

/** Shared with the migration lock's neighbours; any fixed number will do. */
const BOOTSTRAP_LOCK = 4_201_005;

export async function ensurePlatformAdmin(): Promise<void> {
  const email = env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.PLATFORM_ADMIN_PASSWORD;
  if (!email || !password) return;

  // Two replicas booting together would otherwise both count zero.
  await platformSql`SELECT pg_advisory_lock(${BOOTSTRAP_LOCK})`;
  try {
    const [row] = await platformDb.select({ total: count() }).from(platformAdmins);
    if (Number(row?.total ?? 0) > 0) return;

    await platformDb.insert(platformAdmins).values({
      id: randomUUID(),
      email,
      name: "Amministratore piattaforma",
      passwordHash: await hashPassword(password),
    });
    console.info(`Amministratore di piattaforma creato: ${email}`);
  } finally {
    await platformSql`SELECT pg_advisory_unlock(${BOOTSTRAP_LOCK})`;
  }
}
