import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/api-middleware";
import { performBackup } from "@/lib/db-backup";
import { auditAdmin } from "@/lib/audit-log";
import { readdir, stat } from "fs/promises";
import path from "path";
import fs from "fs";

export const runtime = 'nodejs';

// Helper for formatting bytes
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export async function GET(req: NextRequest) {
  try {
    // Auth + admin role enforced by proxy.ts
    await getRequiredSession();

    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");

    // If filename is provided, download the file
    if (filename) {
      // Security check: prevent directory traversal
      const sanitizedFilename = path.basename(filename);
      const backupPath = path.join(
        process.cwd(),
        "backups",
        "database",
        sanitizedFilename
      );

      const fileBuffer = await fs.promises.readFile(backupPath);

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${sanitizedFilename}"`,
        },
      });
    }

    // Otherwise, list backups
    const backupsDir = path.join(process.cwd(), "backups", "database");

    // Ensure directory exists
    if (!fs.existsSync(backupsDir)) {
        await fs.promises.mkdir(backupsDir, { recursive: true });
    }

    // Read directory contents
    const files = await readdir(backupsDir);

    // Filter SQL files and get their stats
    const backupFiles = await Promise.all(
      files
        .filter((file) => file.endsWith(".sql"))
        .map(async (file) => {
          const filePath = path.join(backupsDir, file);
          const stats = await stat(filePath);

          return {
            filename: file,
            size: stats.size,
            sizeFormatted: formatBytes(stats.size),
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
          };
        })
    );

    // Sort by creation date (newest first)
    backupFiles.sort(
      (a, b) =>
        new Date(b.created).getTime() - new Date(a.created).getTime()
    );

    return NextResponse.json(
      {
        success: true,
        backups: backupFiles,
        count: backupFiles.length,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Backups API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Auth + admin role enforced by proxy.ts
    const session = await getRequiredSession();

    const result = await performBackup();

    await auditAdmin.backupCreated(session.user.id);

    return NextResponse.json(
      {
        success: true,
        filename: result.filename,
        message: "Database backup created successfully",
        path: result.path,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Backup error:", error);
    return NextResponse.json(
      {
        error: "Failed to create backup",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
