import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { env } from "../env";
import * as schema from "./schema";

export const databaseFile = resolve(env.DATABASE_FILE);
mkdirSync(dirname(databaseFile), { recursive: true });

function open() {
  const connection = new Database(databaseFile);
  // WAL keeps readers off the single writer's back, which is all a
  // single-instance deployment needs. Foreign keys are off by default in
  // SQLite and the cascade deletes depend on them.
  connection.pragma("journal_mode = WAL");
  connection.pragma("foreign_keys = ON");
  connection.pragma("busy_timeout = 5000");
  return connection;
}

/**
 * Exported with `let` on purpose. A database restore swaps the file underneath
 * us, and an ES module's live bindings mean every importer picks up the new
 * handle — so restoring no longer has to kill the process and lean on the
 * container restart policy to come back.
 */
export let sqlite = open();
export let db = drizzle(sqlite, { schema });

export function reopenDatabase(): void {
  try {
    sqlite.close();
  } catch (error) {
    console.error("Chiusura della connessione fallita:", error);
  }
  sqlite = open();
  db = drizzle(sqlite, { schema });
}

export { schema };
export type Db = typeof db;
