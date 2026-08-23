import { Hono } from "hono";
import { loadSession } from "./auth/guards";
import type { AppEnv } from "./http/app-env";
import { onError } from "./http/errors";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { hoursRoutes } from "./routes/hours";
import { reportRoutes } from "./routes/reports";
import { requestRoutes } from "./routes/requests";
import { meRoutes, userRoutes } from "./routes/users";

/**
 * Every router sits behind `loadSession` and then declares its own
 * authorization. Nothing is protected by a path pattern kept in another file —
 * that separation is what let the restore endpoint go unguarded.
 */
export const api = new Hono<AppEnv>()
  .use("*", loadSession)
  .route("/auth", authRoutes)
  .route("/me", meRoutes)
  .route("/users", userRoutes)
  .route("/hours", hoursRoutes)
  .route("/requests", requestRoutes)
  .route("/reports", reportRoutes)
  .route("/admin", adminRoutes)
  .get("/health", (c) => c.json({ status: "ok" }));

export const app = new Hono<AppEnv>().onError(onError).route("/api", api);

/** Consumed by the SPA's typed client; never imported for its implementation. */
export type AppType = typeof app;
