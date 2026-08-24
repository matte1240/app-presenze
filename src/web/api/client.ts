/**
 * The typed API client.
 *
 * `hc<AppType>` derives request and response types from the Hono routes
 * themselves, so there is no schema to keep in sync and no generated client to
 * regenerate — and the import is `import type`, enforced by lint, so no server
 * code ever reaches the bundle.
 */
import { hc } from "hono/client";
import type { AppType } from "@server/app";

export const rpc = hc<AppType>("/").api;

export interface FieldIssue {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly issues: FieldIssue[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Idle timeout and revoked sessions both land here. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

interface Envelope {
  error?: { code?: string; message?: string; details?: unknown };
}

/**
 * Unwraps a typed response, turning the API's error envelope into a thrown
 * `ApiError`. Every caller therefore deals with one failure type rather than
 * checking `res.ok` and guessing at the body — which is what led to raw
 * response text being shown to users in the previous build.
 */
export async function call<T>(
  request: Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>,
): Promise<T> {
  let response;
  try {
    response = await request;
  } catch {
    throw new ApiError("network", "Impossibile contattare il server.", 0);
  }

  if (response.ok) return (await response.json()) as T;

  const body = (await response.json().catch(() => null)) as Envelope | null;
  const details = Array.isArray(body?.error?.details) ? (body.error.details as FieldIssue[]) : [];

  throw new ApiError(
    body?.error?.code ?? "internal",
    body?.error?.message ?? "Errore imprevisto",
    response.status,
    details,
  );
}

/** Downloads a binary response, since fetch cannot save a file by itself. */
export async function download(
  request: Promise<{ ok: boolean; status: number; blob: () => Promise<Blob>; json: () => Promise<unknown> }>,
  filename: string,
): Promise<void> {
  const response = await request;
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as Envelope | null;
    throw new ApiError(body?.error?.code ?? "internal", body?.error?.message ?? "Download fallito", response.status);
  }

  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
