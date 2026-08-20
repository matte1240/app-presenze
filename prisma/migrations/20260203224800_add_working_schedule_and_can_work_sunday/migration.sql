-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkingSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "morningStart" TEXT,
    "morningEnd" TEXT,
    "afternoonStart" TEXT,
    "afternoonEnd" TEXT,
    "totalHours" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkingSchedule_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canWorkSunday" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkingSchedule_userId_dayOfWeek_key" ON "WorkingSchedule"("userId", "dayOfWeek");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkingSchedule_userId_idx" ON "WorkingSchedule"("userId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'WorkingSchedule_userId_fkey') THEN
        ALTER TABLE "WorkingSchedule" ADD CONSTRAINT "WorkingSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;