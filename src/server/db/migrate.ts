/**
 * Applying migrations, once, whoever asks.
 *
 * Migrations run at boot, and the application is meant to be able to run as
 * more than one replica: two of them starting together would otherwise both
 * find the schema missing and both try to create it, and the loser gets a
 * duplicate-object error instead of a working process.
 *
 * A session-level advisory lock serialises them. Unlike the migration table,
 * it is taken *before* anything is read, and it is released when the connection
 * ends — so a process that dies mid-migration does not leave the next one
 * waiting forever.
 */
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { platformDb, platformSql } from "./client";

const MIGRATION_LOCK = 4_201_004;

export async function migrateDatabase(migrationsFolder: string): Promise<void> {
  await platformSql`SELECT pg_advisory_lock(${MIGRATION_LOCK})`;
  try {
    // The owner, never the application role: the role that serves requests
    // deliberately cannot create or alter a table.
    await migrate(platformDb, { migrationsFolder });
  } finally {
    await platformSql`SELECT pg_advisory_unlock(${MIGRATION_LOCK})`;
  }
}
