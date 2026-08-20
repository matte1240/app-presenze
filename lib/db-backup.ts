import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const execAsync = promisify(exec);

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
    ContentType: "application/sql",
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
    const filename = `backup-${timestamp}.sql`;
    
    // Ensure backups directory exists
    const backupsDir = path.join(process.cwd(), "backups", "database");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    const backupPath = path.join(backupsDir, filename);

    // Get database URL from environment
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL not configured");
    }

    // Remove query parameters that pg_dump doesn't support
    const cleanUrl = databaseUrl.split('?')[0];

    // Use pg_dump with connection string (format: plain SQL)
    // --clean adds DROP commands before CREATE to allow clean restore
    // --if-exists prevents errors if objects don't exist during DROP
    const command = `pg_dump "${cleanUrl}" -F p -b -v --clean --if-exists -f "${backupPath}"`;

    console.log(`Starting backup: ${filename}`);
    const { stderr } = await execAsync(command);
    
    // pg_dump writes verbose output to stderr, so we check if it failed
    // If the file exists and has size > 0, we assume success mostly
    if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size === 0) {
        throw new Error(`Backup failed: File not created or empty. Stderr: ${stderr}`);
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
