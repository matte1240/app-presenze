import path from "node:path";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * SQLite runs in-process, so connection tuning lives here instead of in a
 * database server config:
 * - WAL lets readers keep working while a write is in flight. It is stored in
 *   the database file itself, so it survives restarts.
 * - synchronous = NORMAL is the durability trade-off recommended under WAL.
 * - foreign_keys enforces the `onDelete: Cascade` relations of the schema, and
 *   busy_timeout makes a concurrent writer wait instead of failing with
 *   SQLITE_BUSY. better-sqlite3 already defaults both to these values; they are
 *   restated so the behaviour does not silently depend on the driver default.
 */
const PRAGMAS = [
  "PRAGMA journal_mode = WAL",
  "PRAGMA synchronous = NORMAL",
  "PRAGMA foreign_keys = ON",
  "PRAGMA busy_timeout = 5000",
];

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: url! }) });

  // `next build` imports every route module to collect metadata, with no
  // DATABASE_URL and no database to talk to. Opening a connection there would
  // fail noisily for no reason, so the pragmas wait until there is a URL to
  // connect to; any real query still surfaces a missing URL on its own.
  if (!url) return client;

  // PRAGMA statements return rows, so they go through $queryRawUnsafe. They are
  // issued before any application query reaches the single SQLite connection.
  Promise.all(PRAGMAS.map((pragma) => client.$queryRawUnsafe(pragma))).catch(
    (error) => console.error("Failed to apply SQLite pragmas:", error)
  );

  return client;
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

/**
 * Absolute path of the SQLite database file behind DATABASE_URL.
 * Used by the backup and restore routines, which operate on the file directly.
 */
export function getDatabaseFilePath(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not configured");
  }
  return path.resolve(url.replace(/^file:/, ""));
}
