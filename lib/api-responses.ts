/**
 * Standardized API response utilities
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Create a success response
 */
export function successResponse<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string,
  status = 500
): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Create a 400 Bad Request response
 */
export function badRequestResponse(
  message = "Invalid payload"
): NextResponse<{ error: string }> {
  return errorResponse(message, 400);
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorizedResponse(
  message = "Unauthorized"
): NextResponse<{ error: string }> {
  return errorResponse(message, 401);
}

/**
 * Create a 403 Forbidden response
 */
export function forbiddenResponse(
  message = "Forbidden"
): NextResponse<{ error: string }> {
  return errorResponse(message, 403);
}

/**
 * Create a 404 Not Found response
 */
export function notFoundResponse(
  message = "Not found"
): NextResponse<{ error: string }> {
  return errorResponse(message, 404);
}

/**
 * Create a 409 Conflict response
 */
export function conflictResponse(
  message: string
): NextResponse<{ error: string }> {
  return errorResponse(message, 409);
}

/**
 * Handle Zod validation errors
 * Returns a 400 response with the first error message
 */
export function handleZodError(error: ZodError): NextResponse<{ error: string }> {
  const firstError = error.issues[0];
  return badRequestResponse(firstError?.message ?? "Invalid input");
}

/**
 * Handle generic errors
 * Logs the error and returns a 500 response
 */
export function handleError(
  error: unknown,
  context?: string
): NextResponse<{ error: string }> {
  if (context) {
    console.error(`Error in ${context}:`, error);
  } else {
    console.error("Error:", error);
  }

  if (error instanceof ZodError) {
    return handleZodError(error);
  }

  return errorResponse("Internal server error", 500);
}
