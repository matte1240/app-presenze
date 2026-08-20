import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import AdminOverview from "@/components/dashboard/admin/overview";
import PendingRequests from "@/components/dashboard/admin/pending-requests";
import type { User } from "@/types/models";

type UserAggregate = User & {
  regularHours: number;
  overtimeHours: number;
  permessoHours: number;
  sicknessHours: number;
  vacationHours: number;
  lastEntry?: string | null;
};

type UserRow = User;

export default async function AdminDashboardPage() {
  // Auth + admin role enforced by proxy.ts
  await getAuthSession();

  // Filter by current month only (to match calendar view)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const firstDay = new Date(`${year}-${month.toString().padStart(2, '0')}-01T00:00:00.000Z`);
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayDate = new Date(`${year}-${month.toString().padStart(2, '0')}-${lastDay}T23:59:59.999Z`);

  // Run all queries in parallel for better performance
  const [users, totals, lastEntries] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
        createdAt: true,
      },
    }) as Promise<UserRow[]>,
    prisma.timeEntry.groupBy({
      by: ["userId"],
      _sum: { hoursWorked: true, overtimeHours: true, permessoHours: true, sicknessHours: true, vacationHours: true },
      where: {
        workDate: {
          gte: firstDay,
          lte: lastDayDate,
        },
      },
    }),
    prisma.timeEntry.groupBy({
      by: ["userId"],
      _max: { workDate: true },
    }),
  ]);

  const regularHoursMap = new Map<string, number>();
  const overtimeHoursMap = new Map<string, number>();
  const permessoHoursMap = new Map<string, number>();
  const sicknessHoursMap = new Map<string, number>();
  const vacationHoursMap = new Map<string, number>();

  for (const row of totals) {
    if (row._sum) {
      const regularHours = row._sum.hoursWorked ? parseFloat(row._sum.hoursWorked.toString()) : 0;
      const overtimeHours = row._sum.overtimeHours ? parseFloat(row._sum.overtimeHours.toString()) : 0;
      const permessoHours = row._sum.permessoHours ? parseFloat(row._sum.permessoHours.toString()) : 0;
      const sicknessHours = row._sum.sicknessHours ? parseFloat(row._sum.sicknessHours.toString()) : 0;
      const vacationHours = row._sum.vacationHours ? parseFloat(row._sum.vacationHours.toString()) : 0;

      console.log(`[SERVER] userId: ${row.userId}, hoursWorked: ${regularHours}, overtime: ${overtimeHours}, permesso: ${permessoHours}, sickness: ${sicknessHours}, vacation: ${vacationHours}`);

      // hoursWorked already contains only regular hours (max 8 per day)
      regularHoursMap.set(row.userId, regularHours);
      overtimeHoursMap.set(row.userId, overtimeHours);
      permessoHoursMap.set(row.userId, permessoHours);
      sicknessHoursMap.set(row.userId, sicknessHours);
      vacationHoursMap.set(row.userId, vacationHours);
    }
  }

  const lastEntryMap = new Map<string, string | null>();
  for (const row of lastEntries) {
    lastEntryMap.set(row.userId, row._max.workDate ? row._max.workDate.toISOString() : null);
  }

  const rows: UserAggregate[] = users.map((user) => ({
    ...user,
    regularHours: regularHoursMap.get(user.id) ?? 0,
    overtimeHours: overtimeHoursMap.get(user.id) ?? 0,
    permessoHours: permessoHoursMap.get(user.id) ?? 0,
    sicknessHours: sicknessHoursMap.get(user.id) ?? 0,
    vacationHours: vacationHoursMap.get(user.id) ?? 0,
    lastEntry: lastEntryMap.get(user.id) ?? null,
  }));

  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        <PendingRequests />
      </div>
      <AdminOverview users={rows} />
    </div>
  );
}
