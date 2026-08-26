/**
 * The current tenant, carried out of band.
 *
 * Threading an organization through thirty function signatures would have
 * worked, and every one of those signatures would have been a place to forget
 * it. Instead the request establishes the tenant once and every query below it
 * reads the same value — and `currentOrg()` throws when there is none, so code
 * that runs outside a tenant (a scheduled job, the back-office) has to say so
 * out loud rather than quietly reading nothing.
 *
 * This module imports no runtime code of ours on purpose: both the client and
 * the middleware depend on it, and neither may depend on the other.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { OrganizationRow } from "./platform-schema";

export interface TenantContext {
  readonly organization: OrganizationRow;
  /** The transaction the work runs in; `app.current_org_id` is set on it. */
  readonly tx: unknown;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export const currentTenant = (): TenantContext | undefined => tenantStorage.getStore();

export class MissingTenantError extends Error {
  constructor() {
    super(
      "Nessuna organizzazione nel contesto: questa operazione deve girare dentro runInTenant(), " +
        "oppure usare esplicitamente la connessione di piattaforma.",
    );
    this.name = "MissingTenantError";
  }
}

export function currentOrg(): OrganizationRow {
  const context = tenantStorage.getStore();
  if (!context) throw new MissingTenantError();
  return context.organization;
}

export const currentOrgId = (): string => currentOrg().id;
