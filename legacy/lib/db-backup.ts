import path from "path";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import prisma from "@/lib/prisma";

/** Extension of a backup file: a plain SQLite database, not a SQL dump. */
export const BACKUP_EXTENSION = ".db";

function getS3Client(): S3Client | null {
  const bucket = process.env.BACKUP_S3_BUCKET;
  const region = process.env.BACKUP_S3_REGION;

  if (!bucket || !region) return null;

  const clientConfig: ConstructorParameters<typeof S3Client>[0] = { region };

  // Use explicit credentials if provided, otherwise fall back to default chain (IAM role, instance profile, etc.)
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;
  if (accessKeyId && secretAccessKey) {
    clientConfig.credentials = { accessKeyId, secretAccessKey };
  }

  // Support custom endpoint for S3-compatible storage (MinIO, DigitalOcean Spaces, etc.)
  if (process.env.BACKUP_S3_ENDPOINT) {
    clientConfig.endpoint = process.env.BACKUP_S3_ENDPOINT;
    clientConfig.forcePathStyle = true;
  }

  return new S3Client(clientConfig);
}

export async function uploadBackupToS3(filePath: string, filename: string): Promise<string> {
  const s3 = getS3Client();
  if (!s3) {
    throw new Error("S3 not configured: BACKUP_S3_BUCKET and BACKUP_S3_REGION are required");
  }

  const bucket = process.env.BACKUP_S3_BUCKET!;
  const prefix = process.env.BACKUP_S3_PREFIX || "backups/database";
  const key = `${prefix}/${filename}`;

  const fileContent = fs.readFileSync(filePath);

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileContent,
    ContentType: "application/x-sqlite3",
  }));

  const s3Uri = `s3://${bucket}/${key}`;
  console.log(`✅ Backup caricato su S3: ${s3Uri}`);
  return s3Uri;
}

export function isS3Configured(): boolean {
  return !!(process.env.BACKUP_S3_BUCKET && process.env.BACKUP_S3_REGION);
}

export async function performBackup() {
  try {
    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${timestamp}${BACKUP_EXTENSION}`;

    // Ensure backups directory exists
    const backupsDir = path.join(process.cwd(), "backups", "database");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const backupPath = path.join(backupsDir, filename);

    console.log(`Starting backup: ${filename}`);

    // VACUUM INTO writes a consistent, defragmented copy of the database even
    // while other statements are running, so no external tooling and no
    // downtime are involved. It refuses to overwrite, hence the unique
    // timestamped name above.
    await prisma.$executeRawUnsafe(
      `VACUUM INTO '${backupPath.replace(/'/g, "''")}'`
    );

    if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size === 0) {
      throw new Error("Backup failed: file not created or empty");
    }

    console.log(`Backup completed successfully: ${filename}`);

    // Upload to S3 if configured
    let s3Uri: string | undefined;
    if (isS3Configured()) {
      try {
        s3Uri = await uploadBackupToS3(backupPath, filename);
      } catch (s3Error) {
        console.error("⚠️ Upload S3 fallito (il backup locale è stato creato):", s3Error);
      }
    }

    return { success: true, filename, path: backupPath, s3Uri };

  } catch (error) {
    console.error("Backup failed:", error);
    throw error;
  }
}
