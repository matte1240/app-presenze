import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env, isProduction } from "../env";
import { currentTenant } from "./context";
import * as platformSchema from "./platform-schema";
import * as tenantSchema from "./schema";

const schema = { ...tenantSchema, ...platformSchema };

const options = {
  max: env.DATABASE_POOL_MAX,
  onnotice: () => {},
} as const;

/**
 * Two connections, two roles, on purpose.
 *
 * `sql` logs in as a role that owns nothing and is therefore subject to the
 * row-level security policies: whatever it asks for, it can only ever be shown
 * rows belonging to the organization set on the transaction. That is the
 * connection every request uses.
 *
 * `platformSql` logs in as the table owner, which Postgres exempts from those
 * policies. Three things genuinely need to see across companies — resolving an
 * email address at sign-in, the back-office, and the nightly sweep over every
 * customer — and they say so by reaching for `platformDb` explicitly. If the
 * two URLs are the same the exemption is universal and the policies protect
 * nothing, which is tolerable in development and refused in production.
 */
export const sql = postgres(env.DATABASE_URL, options);

const adminUrl = env.DATABASE_ADMIN_URL ?? env.DATABASE_URL;
export const platformSql = adminUrl === env.DATABASE_URL ? sql : postgres(adminUrl, options);

if (isProduction && !env.DATABASE_ADMIN_URL) {
  console.error(
    "DATABASE_ADMIN_URL non è impostata: l'applicazione girerebbe come proprietaria delle " +
      "tabelle e le policy di isolamento non verrebbero applicate.",
  );
  process.exit(1);
}

/**
 * The pool itself, unproxied. `runInTenant` opens its transactions here so that
 * establishing a tenant never nests inside whichever one happens to be current.
 */
export const basePool = drizzle(sql, { schema });

/** Bypasses row-level security. Every use should be obvious and deliberate. */
export const platformDb = drizzle(platformSql, { schema });

/**
 * The handle everything else uses.
 *
 * Inside a request it resolves to that request's tenant transaction, so the
 * hundred existing `db.select()` calls keep working untouched and each one runs
 * with `app.current_org_id` already set. Outside one it falls back to the pool,
 * where the policies still apply — a query that forgot its tenant returns
 * nothing rather than everything.
 */
export const db = new Proxy(basePool, {
  get(target, property, receiver) {
    const active = (currentTenant()?.tx as typeof basePool | undefined) ?? target;
    const value = Reflect.get(active, property, receiver);
    return typeof value === "function" ? value.bind(active) : value;
  },
}) as typeof basePool;

export async function closeDatabase(): Promise<void> {
  await sql.end({ timeout: 5 });
  if (platformSql !== sql) await platformSql.end({ timeout: 5 });
}

export { schema };
export type Db = typeof basePool;
