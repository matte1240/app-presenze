/**
 * One response convention for the whole API.
 *
 * The previous build had two: most routes went through a helper module while
 * seven hand-rolled their own JSON, which is how the same failure could come
 * back under three different shapes.
 */
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { issuesOf } from "./validate";

export type ErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid"
  | "rate_limited"
  | "internal";

const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid: 422,
  rate_limited: 429,
  internal: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get status(): ContentfulStatusCode {
    return STATUS[this.code];
  }
}

export const unauthenticated = (m = "Sessione non valida o scaduta") => new ApiError("unauthenticated", m);
export const forbidden = (m = "Non hai i permessi per questa operazione") => new ApiError("forbidden", m);
export const notFound = (m = "Risorsa non trovata") => new ApiError("not_found", m);
export const conflict = (m: string) => new ApiError("conflict", m);
export const invalid = (m: string, details?: unknown) => new ApiError("invalid", m, details);

export function onError(err: Error, c: Context): Response {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
  }

  if (err instanceof ZodError) {
    return c.json(
      { error: { code: "invalid", message: "Dati non validi", details: issuesOf(err) } },
      422,
    );
  }

  if (err instanceof HTTPException) {
    return c.json({ error: { code: "invalid", message: err.message } }, err.status);
  }

  console.error("Errore non gestito:", err);
  return c.json({ error: { code: "internal", message: "Errore interno del server" } }, 500);
}
