-- DropIndex
DROP INDEX IF EXISTS "user_workdate_idx";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_workdate_unique" ON "TimeEntry"("userId", "workDate");
