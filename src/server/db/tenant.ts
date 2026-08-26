/**
 * Establishing the tenant for a unit of work.
 *
 * Two things happen together and must not come apart: the organization goes
 * into the async context that every query reads, and its id goes into
 * `app.current_org_id` on the transaction, which is what the row-level security
 * policies compare each row against. `set_config(..., true)` scopes that to the
 * transaction, so a connection returned to the pool never carries one tenant's
 * identity into the next request.
 */
import { eq, sql } from "drizzle-orm";
import { basePool, platformDb } from "./client";
import { tenantStorage } from "./context";
import { organizations, type OrganizationRow } from "./platform-schema";

export class UnknownOrganizationError extends Error {
  constructor(readonly organizationId: string) {
    super(`Organizzazione inesistente: ${organizationId}`);
    this.name = "UnknownOrganizationError";
  }
}

export async function runInTenant<T>(
  organization: string | OrganizationRow,
  fn: () => Promise<T>,
): Promise<T> {
  const organizationId = typeof organization === "string" ? organization : organization.id;

  // `basePool` rather than the proxied `db`: opening the transaction on the
  // proxy would nest it inside whichever tenant is already current, which is
  // the mistake this function exists to prevent.
  return basePool.transaction(async (tx) => {
    // Parameterised, never interpolated: this one string decides which rows
    // the rest of the transaction is allowed to see.
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, true)`);

    // `organizations` carries no policy of its own — it is the table the
    // policies are written against — so it reads fine from inside the tenant.
    const row =
      typeof organization === "string"
        ? (await tx.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1))[0]
        : organization;
    if (!row) throw new UnknownOrganizationError(organizationId);

    return tenantStorage.run({ organization: row, tx }, fn);
  });
}

/**
 * Runs `fn` once for each organization, each in its own transaction and its own
 * context. Used by the scheduled jobs, which are the only part of the
 * application that legitimately walks every customer in turn.
 */
export async function forEachTenant(
  organizationIds: readonly string[],
  fn: (organizationId: string) => Promise<void>,
): Promise<{ done: number; failed: number }> {
  let done = 0;
  let failed = 0;

  for (const organizationId of organizationIds) {
    try {
      await runInTenant(organizationId, () => fn(organizationId));
      done += 1;
    } catch (error) {
      // One company's bad data must not stop the sweep for the rest.
      failed += 1;
      console.error(`Job fallito per l'organizzazione ${organizationId}:`, error);
    }
  }

  return { done, failed };
}

export { platformDb };
