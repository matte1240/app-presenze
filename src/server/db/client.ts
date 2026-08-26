import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

/**
 * One pool for the whole process.
 *
 * The SQLite build exported `db` with `let` so that restoring a backup could
 * swap the file handle underneath every importer. There is no file to swap any
 * more — a Postgres restore happens outside the process — so the binding is
 * constant again.
 */
export const sql = postgres(env.DATABASE_URL, {
  max: env.DATABASE_POOL_MAX,
  // Dates are civil values in this application (`work_date` is a string) and
  // every timestamp column is `timestamptz`, so the driver never has to guess.
  types: {},
  onnotice: () => {},
});

export const db = drizzle(sql, { schema });

export async function closeDatabase(): Promise<void> {
  await sql.end({ timeout: 5 });
}

export { schema };
export type Db = typeof db;
