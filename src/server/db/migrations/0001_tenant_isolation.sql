-- Row-level security: the floor under the application's own filters.
--
-- Every query in `src/server` already carries an `organization_id` predicate.
-- These policies are what holds when one of them is ever forgotten — a WHERE
-- dropped in a refactor, a new endpoint written in a hurry — because the
-- database will not return the row regardless of what the query asked for.
--
-- `app.current_org_id` is set per transaction by `runInTenant` in
-- `src/server/db/tenant.ts`. Note the fallback to the empty string: with no
-- tenant established, `current_setting(..., true)` is NULL, and `column = NULL`
-- is never true. A query outside a tenant therefore sees nothing, which is the
-- correct failure — the alternative is a query that sees everything.
--
-- Two tenant tables are deliberately absent. `sessions` and `password_resets`
-- hold no business data, are reachable only by the SHA-256 of a 32-byte random
-- token, and are read before any tenant exists to be inside of: they are what
-- establishes one.
--
-- The role that owns these tables is exempt from the policies (Postgres exempts
-- owners unless FORCE is set, and FORCE is deliberately not set). That
-- exemption is the whole reason there are two connections: DATABASE_URL logs in
-- as an ordinary role and is bound by everything below, while
-- DATABASE_ADMIN_URL logs in as the owner and is used only where crossing
-- companies is the point — signing in, the back-office, the nightly sweep.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "users"
  USING ("organization_id" = coalesce(current_setting('app.current_org_id', true), ''))
  WITH CHECK ("organization_id" = coalesce(current_setting('app.current_org_id', true), ''));--> statement-breakpoint

ALTER TABLE "work_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "work_schedules"
  USING ("organization_id" = coalesce(current_setting('app.current_org_id', true), ''))
  WITH CHECK ("organization_id" = coalesce(current_setting('app.current_org_id', true), ''));--> statement-breakpoint

ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "time_entries"
  USING ("organization_id" = coalesce(current_setting('app.current_org_id', true), ''))
  WITH CHECK ("organization_id" = coalesce(current_setting('app.current_org_id', true), ''));--> statement-breakpoint

ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "leave_requests"
  USING ("organization_id" = coalesce(current_setting('app.current_org_id', true), ''))
  WITH CHECK ("organization_id" = coalesce(current_setting('app.current_org_id', true), ''));
