/**
 * S3-compatible object storage, for whole-database backups.
 *
 * Written against the plain S3 API rather than a Hetzner SDK, because Hetzner
 * Object Storage speaks that API and nothing else. It is also the reason the
 * same code below reaches MinIO in a test, or AWS S3 itself, unchanged — this
 * module knows nothing about where the bucket actually lives.
 */
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createWriteStream } from "node:fs";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { backupPrefix, env, s3Enabled } from "../env";

export { s3Enabled };

let client: S3Client | null = null;

export function s3(): S3Client {
  if (!s3Enabled) throw new Error("Lo storage S3 non è configurato su questa installazione");
  client ??= new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

/**
 * Every function below takes the same `prefix` an installation's whole-database
 * backups sit under (`env.BACKUP_PREFIX`) unless told otherwise — the one
 * caller that needs a different namespace, `services/org-backup.ts`, passes
 * its own so a per-organization snapshot never shows up in the whole-database
 * list, and pruning that list never sweeps one up by accident.
 */
const keyFor = (filename: string, prefix: string) => `${prefix}${filename}`;

export interface StoredBackup {
  filename: string;
  sizeBytes: number;
  /** ISO timestamp. */
  lastModified: string;
}

const isNotFound = (error: unknown): boolean =>
  error instanceof Error && ["NoSuchKey", "NotFound"].includes(error.name);

export async function listBackups(prefix: string = backupPrefix): Promise<StoredBackup[]> {
  const backups: StoredBackup[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await s3().send(
      new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of page.Contents ?? []) {
      if (!object.Key || object.Size === undefined) continue;
      const filename = object.Key.slice(prefix.length);
      // The prefix "directory" itself can list as a zero-length key.
      if (!filename) continue;
      backups.push({
        filename,
        sizeBytes: object.Size,
        lastModified: (object.LastModified ?? new Date(0)).toISOString(),
      });
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return backups.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
}

/** Streams straight from the source to the bucket — a dump of any real size should never have to fit twice on the container's own disk. */
export async function uploadBackup(filename: string, body: Readable, prefix: string = backupPrefix): Promise<void> {
  const upload = new Upload({
    client: s3(),
    params: {
      Bucket: env.S3_BUCKET,
      Key: keyFor(filename, prefix),
      Body: body,
      ContentType: "application/octet-stream",
    },
  });
  await upload.done();
}

export async function backupInfo(filename: string, prefix: string = backupPrefix): Promise<StoredBackup | null> {
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: keyFor(filename, prefix) }));
    return {
      filename,
      sizeBytes: head.ContentLength ?? 0,
      lastModified: (head.LastModified ?? new Date(0)).toISOString(),
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function downloadBackupToFile(
  filename: string,
  destinationPath: string,
  prefix: string = backupPrefix,
): Promise<void> {
  const result = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: keyFor(filename, prefix) }));
  if (!result.Body) throw new Error(`Backup "${filename}" vuoto o non trovato`);
  // The Node runtime of the SDK always resolves this to a Node `Readable`; the
  // wider union in its type only accounts for the browser build.
  await pipeline(result.Body as Readable, createWriteStream(destinationPath));
}

/** For a backup small enough to hold in memory at once — a per-organization export, never the whole database. */
export async function downloadBackupText(filename: string, prefix: string = backupPrefix): Promise<string> {
  const result = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: keyFor(filename, prefix) }));
  if (!result.Body) throw new Error(`Backup "${filename}" vuoto o non trovato`);
  return result.Body.transformToString("utf-8");
}

/**
 * A time-boxed link straight to the object, so a multi-gigabyte dump travels
 * from the bucket to the browser directly rather than through this process.
 *
 * The response-disposition override is what makes the browser save it as a
 * file at all: the link points at the bucket's own origin, and browsers
 * ignore an anchor's `download` attribute across origins — the server on the
 * other end has to say "attachment" itself.
 */
export async function presignedDownloadUrl(
  filename: string,
  expiresInSeconds = 300,
  prefix: string = backupPrefix,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: keyFor(filename, prefix),
    ResponseContentDisposition: `attachment; filename="${filename}"`,
    ResponseContentType: "application/octet-stream",
  });
  return getSignedUrl(s3(), command, { expiresIn: expiresInSeconds });
}

export async function deleteBackup(filename: string, prefix: string = backupPrefix): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: keyFor(filename, prefix) }));
}

export async function deleteBackups(filenames: readonly string[], prefix: string = backupPrefix): Promise<void> {
  if (filenames.length === 0) return;
  // The batch API tops out at 1000 keys per call; pruning that many at once
  // would mean retention was neglected for years, but the chunking costs
  // nothing to have.
  for (let i = 0; i < filenames.length; i += 1000) {
    const chunk = filenames.slice(i, i + 1000);
    await s3().send(
      new DeleteObjectsCommand({
        Bucket: env.S3_BUCKET,
        Delete: { Objects: chunk.map((filename) => ({ Key: keyFor(filename, prefix) })) },
      }),
    );
  }
}
