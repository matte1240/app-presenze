import { Hono } from "hono";
import { loadSession } from "./auth/guards";
import { onError } from "./http/errors";
import type { AppEnv } from "./http/app-env";
import { authRoutes } from "./routes/auth";

/**
 * Every route sits behind `loadSession`, and each router then declares its own
 * authorization. Nothing is protected by a path pattern kept somewhere else.
 */
export const api = new Hono<AppEnv>()
  .use("*", loadSession)
  .route("/auth", authRoutes)
  .get("/health", (c) => c.json({ status: "ok" }));

export const app = new Hono<AppEnv>().onError(onError).route("/api", api);

/** Consumed by the SPA's typed client; never imported for its implementation. */
export type AppType = typeof app;
