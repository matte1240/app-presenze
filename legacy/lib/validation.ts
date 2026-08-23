import { z } from "zod";

/**
 * Shared password validation schema.
 * Requires: 8+ chars, uppercase, lowercase, number.
 */
export const passwordSchema = z
  .string()
  .min(8, "La password deve contenere almeno 8 caratteri")
  .max(64)
  .regex(/[A-Z]/, "La password deve contenere almeno una lettera maiuscola")
  .regex(/[a-z]/, "La password deve contenere almeno una lettera minuscola")
  .regex(/[0-9]/, "La password deve contenere almeno un numero");
