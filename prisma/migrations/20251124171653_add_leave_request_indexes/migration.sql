-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_status_idx" ON "LeaveRequest"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "status_created_idx" ON "LeaveRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_dates_idx" ON "LeaveRequest"("userId", "startDate", "endDate");
