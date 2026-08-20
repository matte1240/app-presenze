import { NextRequest, NextResponse } from "next/server";
import { rename, unlink, writeFile } from "fs/promises";
import prisma, { getDatabaseFilePath } from "@/lib/prisma";
import { BACKUP_EXTENSION } from "@/lib/db-backup";
import { getRequiredSession } from "@/lib/api-middleware";
import { auditAdmin } from "@/lib/audit-log";

export const runtime = "nodejs";

/** Every SQLite database starts with this 16-byte header. */
const SQLITE_MAGIC = Buffer.from("SQLite format 3\0", "utf8");

async function removeIfPresent(filePath: string) {
  try {
    await unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check if system is in setup mode (no users)
    const userCount = await prisma.user.count();
    const isSetupMode = userCount === 0;

    // In setup mode, proxy.ts allows unauthenticated access to this endpoint.
    // In normal mode, proxy.ts enforces admin auth — just verify the session exists.
    if (!isSetupMode) {
      await getRequiredSession();
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Refuse anything that is not a SQLite database before touching the live
    // file: a bad upload would otherwise leave the app with an unopenable DB.
    if (!buffer.subarray(0, SQLITE_MAGIC.length).equals(SQLITE_MAGIC)) {
      return NextResponse.json(
        { error: `Invalid backup file: expected a SQLite database (${BACKUP_EXTENSION})` },
        { status: 400 }
      );
    }

    const dbPath = getDatabaseFilePath();
    const stagingPath = `${dbPath}.restore`;

    // Stage the upload next to the database so the swap below is a rename on
    // the same filesystem, i.e. atomic.
    await writeFile(stagingPath, buffer);

    console.log("Restoring database...");

    // Close the pool before swapping the file out from under it.
    await prisma.$disconnect();

    await rename(stagingPath, dbPath);

    // The WAL and shared-memory sidecars belong to the replaced database; left
    // behind they would be replayed on top of the restored one.
    await removeIfPresent(`${dbPath}-wal`);
    await removeIfPresent(`${dbPath}-shm`);

    await auditAdmin.backupRestored("system");

    // A live better-sqlite3 handle cannot be re-pointed at the new file, so the
    // process exits and the supervisor (docker compose `restart: unless-stopped`)
    // brings it back up against the restored database.
    setTimeout(() => process.exit(0), 500);

    return NextResponse.json(
      {
        success: true,
        message: "Database restored successfully. The application is restarting.",
        restarting: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Restore error:", error);
    return NextResponse.json(
      {
        error: "Failed to restore database",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
