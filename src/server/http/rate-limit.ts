/**
 * A fixed-window limiter held in memory.
 *
 * Deliberately not a shared store: the deployment is a single process, so a
 * per-process counter is exactly as strong as what it protects. That is now
 * the only thing keeping the application from running as several replicas —
 * the database is shared and the scheduled jobs take an advisory lock, but
 * these buckets are not. Behind more than one instance this needs replacing
 * with a Postgres table keyed the same way, not tuning.
 */
import { createMiddleware } from "hono/factory";
import { ApiError } from "./errors";
import type { AppEnv } from "./app-env";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Sweeping on write keeps the map bounded without a background timer.
function sweep(nowMs: number) {
  if (buckets.size < 512) return;
  for (const [key, b] of buckets) if (b.resetAt <= nowMs) buckets.delete(key);
}

export function hit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const nowMs = Date.now();
  sweep(nowMs);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= nowMs) {
    buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - nowMs) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

export function rateLimit(name: string, limit: number, windowMs: number) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const result = hit(`${name}:${clientIp(c.req.raw.headers)}`, limit, windowMs);
    if (!result.ok) {
      c.header("Retry-After", String(result.retryAfter));
      throw new ApiError("rate_limited", "Troppi tentativi. Riprova più tardi.");
    }
    await next();
  });
}
