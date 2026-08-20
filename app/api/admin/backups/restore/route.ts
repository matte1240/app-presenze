import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { getRequiredSession } from "@/lib/api-middleware";
import { auditAdmin } from "@/lib/audit-log";

const execAsync = promisify(exec);

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

    // Create temp file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempPath = path.join(process.cwd(), "backups", `restore-${Date.now()}.sql`);
    
    // Ensure backups directory exists
    const backupsDir = path.dirname(tempPath);
    if (!fs.existsSync(backupsDir)) {
      await fs.promises.mkdir(backupsDir, { recursive: true });
    }

    await writeFile(tempPath, buffer);

    // Database connection details from env
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL not configured");
    }

    // Remove query parameters (psql doesn't need them)
    const cleanUrl = dbUrl.split('?')[0];

    console.log("Restoring database...");
    
    // Use psql with connection string directly (similar to pg_dump approach)
    const command = `psql "${cleanUrl}" -f "${tempPath}"`;

    await execAsync(command);

    // Clean up temp file
    await unlink(tempPath);

    await auditAdmin.backupRestored("system");

    return NextResponse.json(
      { success: true, message: "Database restored successfully" },
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
