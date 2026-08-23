/**
 * `zValidator` with our own failure shape.
 *
 * Left to itself it answers with a raw serialised ZodError, which is a second
 * error format for clients to special-case. This routes validation failures
 * through the same `{ error: { code, message, details } }` envelope as
 * everything else, with the first concrete message surfaced so a form has
 * something to show.
 */
import { zValidator } from "@hono/zod-validator";
import type { ZodType } from "zod";
import { ApiError } from "./errors";

type Target = "json" | "query" | "form" | "param" | "header";

export interface FieldIssue {
  readonly field: string;
  readonly message: string;
}

export function issuesOf(error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> }): FieldIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.filter((p) => typeof p === "string").join("."),
    message: issue.message,
  }));
}

export function validate<T extends ZodType>(target: Target, schema: T) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      const issues = issuesOf(result.error);
      const first = issues[0];
      throw new ApiError(
        "invalid",
        first ? (first.field ? `${first.field}: ${first.message}` : first.message) : "Dati non validi",
        issues,
      );
    }
  });
}
